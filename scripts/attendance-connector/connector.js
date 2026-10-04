// scripts/attendance-connector/connector.js
//
// This is the piece that runs on a real PC on the company's own office
// network, next to the attendance terminals. It is NOT part of the
// deployed web/mobile app and is never uploaded to Vercel. Its only job:
// read new check-ins off the devices and forward them to the app's own
// backend (api/attendance-device-webhook.ts).
//
// Why a separate program at all: most terminals either speak their own
// local network protocol (SDK devices like the ZKTeco K14/MB10) or serve
// a JSON API only on the office LAN. Neither can be reached from Vercel.
// This program is the bridge, and it means the devices themselves are
// never exposed to the internet. Devices that can push events to a web
// address on their own ("API, Push" in the app) don't need this program.
//
// ============================== MODES ==============================
// Registry mode (recommended). config.json holds only apiBaseUrl and
// connectorKey. Every poll, the program asks the app which devices to
// read (api/connector-devices.ts), so adding a device in the app (HR >
// Attendance > Add Device) is enough. Nothing is hard-coded here.
//
// Legacy mode. config.json holds deviceIp/devicePort/deviceId/
// webhookUrl/webhookSecret for one ZKTeco device, exactly as before. Kept
// so an existing install keeps working untouched.
//
// ============================== SETUP ==============================
// 1. Install Node.js 18 or newer on a PC that stays on and stays on the
//    same office network as the devices.
// 2. In this folder, run:  npm install
// 3. Copy config.example.json to config.json and fill in:
//      - apiBaseUrl: https://<your deployed domain>
//      - connectorKey: the value saved in the app under Control Center >
//        API Keys > Attendance Connector Key (any long random value you
//        choose; it just has to match on both sides).
// 4. Add each device in the app. For SDK devices, enter its IP and port.
//    For API devices in Pull mode, enter its API address and login.
// 5. On each device, enroll staff using their real employee number as the
//    device's User ID (EMP-00001, or just 1 on keypad-only terminals).
// 6. Run:  node connector.js   (pm2 can keep it running after reboots).
//
// ============================== TIMING ==============================
// - SDK devices with a driver stay connected and listen. Each scan is sent
//   to the app the moment it happens. On every (re)connect the program
//   first catches up on anything stored on the device since the last scan
//   it sent, so nothing is lost while the network or the PC was down. The
//   connection is refreshed every 10 minutes as a safety net.
// - API Pull devices are read every 10 seconds.
// - API Push devices don't use this program at all.
// - Each device's health (live, error, no driver) is reported to the app
//   (api/connector-status.ts) so HR can see it on the Attendance screen.
//
// ============================ HONEST CAVEATS ==========================
// - Devices are typed into the app, never picked from a list. The make
//   typed there picks the driver (letters only, case ignored, so "ZKTeco"
//   and "zk teco" both match "zkteco"). The only SDK driver today is
//   ZKTeco, through node-zklib (a community library, not official ZKTeco
//   software; test it against your real device first). Any other make is
//   reported to the app as "no driver yet" instead of pretending.
// - API Pull supports Bearer tokens and Basic auth. Devices that need
//   Digest auth (some Dahua/Hikvision firmware) need that added here.
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'state.json');
const TICK_MS = 10_000;               // pull devices are read this often
const REGISTRY_REFRESH_MS = 30_000;   // the device list is re-fetched this often
const SESSION_REFRESH_MS = 10 * 60_000; // live SDK connections are renewed this often
const RECONNECT_DELAY_MS = 10_000;    // wait before reconnecting a dropped device
const STATUS_HEARTBEAT_MS = 60_000;   // health is re-sent at least this often
const BATCH_SIZE = 200; // the webhook's own per-request cap
const DEFAULT_FIELD_MAP = { employeeNumber: 'employeeNumber', timestamp: 'timestamp', event: 'event', recordsPath: '' };

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const logError = (msg) => console.error(`[${new Date().toISOString()}] ${msg}`);

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Missing config.json. Copy config.example.json to config.json and fill it in first.');
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (!config.connectorKey && !config.deviceIp) {
    console.error('config.json needs either apiBaseUrl + connectorKey (registry mode) or deviceIp + webhookUrl + webhookSecret (legacy mode).');
    process.exit(1);
  }
  if (config.connectorKey && !config.apiBaseUrl) {
    console.error('config.json has a connectorKey but no apiBaseUrl.');
    process.exit(1);
  }
  return config;
}

// Per-device watermark: the newest record time already sent, so a restart
// doesn't re-send old check-ins. The backend also refuses a second check-in
// for the same person on the same day, so this is a second layer, not the
// only one.
function loadState() {
  let state = { devices: {} };
  if (fs.existsSync(STATE_PATH)) {
    try { state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch { /* start fresh */ }
  }
  if (!state.devices) state.devices = {};
  return state;
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function getPath(obj, p) {
  if (!p) return undefined;
  return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// Puts `value` back at a dot path in a fresh object, so a pulled batch is
// re-sent to the webhook in the device's own JSON shape and the device's
// field mapping applies to it unchanged.
function wrapAtPath(p, value) {
  if (!p) return value;
  return p.split('.').reduceRight((inner, key) => ({ [key]: inner }), value);
}

// Same rules as the webhook's parseTimestamp: ISO strings and epoch
// seconds or milliseconds. Returns null when unreadable.
function toTime(raw) {
  if (typeof raw === 'number') return new Date(raw < 1e12 ? raw * 1000 : raw);
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    const n = Number(raw);
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  if (!raw) return null;
  const d = new Date(String(raw));
  return isNaN(d.getTime()) ? null : d;
}

// --------------------------- registry ---------------------------

let lastKnownDevices = [];
let lastRegistryFetch = 0;

async function fetchDevices(config) {
  if (!config.connectorKey) {
    // Legacy mode: one ZKTeco device described entirely by config.json.
    return [{
      id: 'legacy',
      device_name: config.deviceId || 'UNKNOWN-DEVICE',
      connection_type: 'sdk',
      protocol: 'zkteco',
      ip_address: config.deviceIp,
      port: config.devicePort || 4370,
      webhook_secret: config.webhookSecret,
      field_map: DEFAULT_FIELD_MAP,
    }];
  }
  if (Date.now() - lastRegistryFetch < REGISTRY_REFRESH_MS) return lastKnownDevices;
  lastRegistryFetch = Date.now();
  try {
    const res = await fetch(`${config.apiBaseUrl.replace(/\/+$/, '')}/api/connector-devices`, {
      headers: { 'x-connector-key': config.connectorKey },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    lastKnownDevices = body.devices || [];
  } catch (err) {
    logError(`Could not load the device list from the app (${err.message}). Using the last known list of ${lastKnownDevices.length} device(s).`);
  }
  return lastKnownDevices;
}

function webhookUrlFor(config, device) {
  const base = config.connectorKey
    ? `${config.apiBaseUrl.replace(/\/+$/, '')}/api/attendance-device-webhook`
    : config.webhookUrl;
  return `${base}?device=${encodeURIComponent(device.device_name)}`;
}

// --------------------------- sending ---------------------------

// Sends one batch. Returns how many records (from the start of the batch)
// are safe to move the watermark past. A failed request returns 0 so the
// whole batch is retried next poll. A per-record server error (5xx) stops
// at that record, since it may succeed on retry; a per-record rejection
// like "employee not found" is logged and passed over, since retrying
// can't fix it.
async function sendBatch(config, device, body, count) {
  let res;
  try {
    res = await fetch(webhookUrlFor(config, device), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-webhook-secret': device.webhook_secret },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logError(`${device.device_name}: could not reach the app (${err.message}). Will retry.`);
    return 0;
  }
  const json = await res.json().catch(() => ({}));
  const results = Array.isArray(json.results) ? json.results : [{ httpStatus: res.status, ...json }];

  // Request-level failure (bad secret, deactivated device, rate limit,
  // server down): nothing in this batch was processed.
  if (!Array.isArray(json.results) && (res.status === 401 || res.status === 403 || res.status === 429 || res.status >= 500)) {
    logError(`${device.device_name}: the app refused the batch (${json.error || `HTTP ${res.status}`}). Will retry.`);
    return 0;
  }

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const status = r.httpStatus || res.status;
    if (status >= 500) {
      logError(`${device.device_name}: record ${i + 1} failed on the server (${r.error || status}). Will retry from here.`);
      return i;
    }
    if (status >= 400) logError(`${device.device_name}: record ${i + 1} rejected: ${r.error || status}`);
    else if (r.recorded) log(`${device.device_name}: recorded check-in (${r.status})`);
  }
  return count;
}

// Sends records (already oldest-first) in batches, advancing the device's
// watermark only past what was actually accepted.
async function forwardRecords(config, state, device, records, getTime, buildBody) {
  const devState = state.devices[device.id] || (state.devices[device.id] = { lastSeenTimestamp: null });
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);
    const accepted = await sendBatch(config, device, buildBody(chunk), chunk.length);
    if (accepted > 0) {
      const t = getTime(chunk[accepted - 1]);
      if (t) devState.lastSeenTimestamp = t.toISOString();
      saveState(state);
    }
    if (accepted < chunk.length) return;
  }
}

// --------------------------- health ---------------------------

// Latest health per device, sent to the app when it changes and at least
// once a minute, so HR sees "live", "can't reach it" or "no driver".
const health = new Map(); // deviceId -> { status, message, sentAt, dirty }

function setHealth(device, status, message) {
  if (device.id === 'legacy') return; // legacy mode has no app registry
  const prev = health.get(device.id);
  if (prev && prev.status === status && prev.message === (message || null)) return;
  health.set(device.id, { status, message: message || null, sentAt: prev?.sentAt || 0, dirty: true });
}

async function sendHealth(config) {
  if (!config.connectorKey) return;
  const now = Date.now();
  const due = [...health.entries()].filter(([, h]) => h.dirty || now - h.sentAt > STATUS_HEARTBEAT_MS);
  if (due.length === 0) return;
  try {
    const res = await fetch(`${config.apiBaseUrl.replace(/\/+$/, '')}/api/connector-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-connector-key': config.connectorKey },
      body: JSON.stringify({ reports: due.map(([deviceId, h]) => ({ deviceId, status: h.status, message: h.message })) }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    for (const [, h] of due) { h.dirty = false; h.sentAt = now; }
  } catch (err) {
    logError(`Could not report device health to the app (${err.message}). Will retry.`);
  }
}

// --------------------------- drivers ---------------------------

// The make typed in the app, letters and digits only, lower case.
const driverKey = (make) => String(make || '').toLowerCase().replace(/[^a-z0-9]/g, '');

let ZKLib = null;
function loadZkLib() {
  if (!ZKLib) ZKLib = require('node-zklib');
  return ZKLib;
}

// SDK, ZKTeco: one long-lived connection per device.
//   connect -> send everything newer than the watermark (catch-up)
//           -> listen for live scans and send each one immediately
//   dropped -> reconnect after RECONNECT_DELAY_MS (and catch up again)
//   every SESSION_REFRESH_MS the connection is renewed, in case a device
//   went quiet without closing the connection.
// Sends for one device run one at a time (a queue), so a burst of scans
// keeps its order and the watermark only ever moves forward.
const sessions = new Map(); // deviceId -> session

function sessionSignature(device) {
  return `${device.ip_address}|${device.port || 4370}|${device.webhook_secret}|${device.device_name}`;
}

function zkRecordBody(device, userId, when) {
  return {
    employeeNumber: String(userId).trim(),
    deviceId: device.device_name,
    event: 'CHECK_IN',
    timestamp: new Date(when).toISOString(),
  };
}

function startZktecoSession(config, state, device) {
  const session = { device, signature: sessionSignature(device), zk: null, stopped: false, queue: Promise.resolve(), timers: [] };
  sessions.set(device.id, session);

  const enqueue = (fn) => { session.queue = session.queue.then(fn).catch((err) => logError(`${device.device_name}: ${err.message}`)); return session.queue; };

  const closeSocket = async () => {
    const zk = session.zk;
    session.zk = null;
    if (zk) { try { await zk.disconnect(); } catch { /* already closed */ } }
  };

  const scheduleReconnect = () => {
    if (session.stopped) return;
    session.timers.push(setTimeout(connect, RECONNECT_DELAY_MS));
  };

  const connect = async () => {
    if (session.stopped) return;
    session.timers.forEach(clearTimeout);
    session.timers = [];
    await closeSocket();
    const Zk = loadZkLib();
    const zk = new Zk(device.ip_address, device.port || 4370, 10000, 4000);
    session.zk = zk;
    let reconnecting = false;
    try {
      const onDrop = () => {
        if (session.stopped || session.zk !== zk || reconnecting) return;
        reconnecting = true;
        setHealth(device, 'error', 'The connection to the device dropped. Reconnecting.');
        log(`${device.device_name}: connection dropped, reconnecting in ${RECONNECT_DELAY_MS / 1000}s.`);
        scheduleReconnect();
      };
      await zk.createSocket(onDrop, onDrop);

      // Catch up on anything stored since the last scan we sent.
      const since = state.devices[device.id]?.lastSeenTimestamp;
      const result = await zk.getAttendances();
      const logs = (result?.data || [])
        .filter((l) => !since || new Date(l.recordTime) > new Date(since))
        .sort((a, b) => new Date(a.recordTime) - new Date(b.recordTime));
      if (logs.length) {
        log(`${device.device_name}: catching up on ${logs.length} stored scan(s).`);
        await enqueue(() => forwardRecords(config, state, device, logs, (l) => new Date(l.recordTime),
          (chunk) => chunk.map((l) => zkRecordBody(device, l.deviceUserId, l.recordTime))));
      }
      if (session.stopped || session.zk !== zk) return;

      // Listen. node-zklib only attaches its live-event handler when the
      // socket has no other data listener, and some versions leave one
      // behind after getAttendances(), so it is cleared first. The idle
      // timeout is switched off because a quiet office is not a fault.
      const tcp = zk.zklibTcp && zk.zklibTcp.socket;
      if (tcp && zk.connectionType === 'tcp') {
        tcp.removeAllListeners('data');
        tcp.setTimeout(0);
      }
      await zk.getRealTimeLogs((event) => {
        if (!event || event.userId == null) return;
        const when = event.attTime ? new Date(event.attTime) : new Date();
        log(`${device.device_name}: live scan from ${event.userId}.`);
        enqueue(() => forwardRecords(config, state, device, [{ userId: event.userId, when }], (r) => r.when,
          (chunk) => chunk.map((r) => zkRecordBody(device, r.userId, r.when))));
      });
      setHealth(device, 'live', 'Connected. Scans are sent the moment they happen.');
      log(`${device.device_name}: connected, listening for live scans.`);
      session.timers.push(setTimeout(connect, SESSION_REFRESH_MS));
    } catch (err) {
      setHealth(device, 'error', `Could not reach the device at ${device.ip_address}:${device.port || 4370} (${err.message}).`);
      logError(`${device.device_name}: could not connect (${err.message}). Retrying in ${RECONNECT_DELAY_MS / 1000}s.`);
      if (!reconnecting) { reconnecting = true; scheduleReconnect(); }
    }
  };

  session.stop = async () => {
    session.stopped = true;
    session.timers.forEach(clearTimeout);
    await closeSocket();
  };

  connect();
  return session;
}

const SDK_DRIVERS = {
  zkteco: startZktecoSession,
};

// API, Pull. Reads the device's JSON, keeps records newer than the
// watermark, and re-sends them in the device's own shape so the field
// mapping saved in the app does the interpretation.
async function pollApi(config, state, device) {
  if (!device.api_url) {
    setHealth(device, 'error', 'No API address saved in the app.');
    return;
  }
  const headers = { Accept: 'application/json' };
  if (device.api_token) headers.Authorization = `Bearer ${device.api_token}`;
  else if (device.auth_username) headers.Authorization = `Basic ${Buffer.from(`${device.auth_username}:${device.auth_password || ''}`).toString('base64')}`;

  const res = await fetch(device.api_url, { headers });
  if (!res.ok) throw new Error(`the device API answered HTTP ${res.status}`);
  const body = await res.json();

  const map = { ...DEFAULT_FIELD_MAP, ...(device.field_map || {}) };
  const source = map.recordsPath ? getPath(body, map.recordsPath) : body;
  const all = Array.isArray(source) ? source : source ? [source] : [];
  const since = state.devices[device.id]?.lastSeenTimestamp;
  const timeOf = (r) => toTime(getPath(r, map.timestamp));

  const fresh = all
    .filter((r) => { const t = timeOf(r); return !since || !t || t > new Date(since); })
    .sort((a, b) => (timeOf(a)?.getTime() || 0) - (timeOf(b)?.getTime() || 0));
  setHealth(device, 'ok', `Read every ${TICK_MS / 1000} seconds.`);
  if (fresh.length === 0) return;
  log(`${device.device_name}: ${fresh.length} new record(s).`);
  await forwardRecords(config, state, device, fresh, timeOf, (chunk) => wrapAtPath(map.recordsPath, chunk));
}

// --------------------------- loop ---------------------------

const warnedNoDriver = new Set();
const pulling = new Set();

async function syncSdkSessions(config, state, devices) {
  const wanted = new Map();
  for (const d of devices) {
    if (d.connection_type === 'api') continue;
    const start = SDK_DRIVERS[driverKey(d.protocol)];
    if (!start) {
      setHealth(d, 'no_driver', `There is no driver for "${d.protocol}" yet. If the device can send to a web address, set it to API Push in the app instead.`);
      if (!warnedNoDriver.has(d.id)) {
        warnedNoDriver.add(d.id);
        logError(`${d.device_name}: no SDK driver for "${d.protocol}" yet, so it is skipped.`);
      }
      continue;
    }
    if (!d.ip_address) {
      setHealth(d, 'error', 'No IP address saved in the app.');
      continue;
    }
    wanted.set(d.id, { device: d, start });
  }

  // Stop sessions for devices that were removed, deactivated or changed.
  for (const [id, session] of sessions) {
    const w = wanted.get(id);
    if (!w || sessionSignature(w.device) !== session.signature) {
      sessions.delete(id);
      await session.stop();
      if (w) log(`${w.device.device_name}: settings changed in the app, reconnecting.`);
    }
  }
  for (const [id, { device, start }] of wanted) {
    if (!sessions.has(id)) start(config, state, device);
  }
}

async function pollPullDevices(config, state, devices) {
  for (const device of devices) {
    if (device.connection_type !== 'api' || device.api_mode !== 'pull') continue;
    if (pulling.has(device.id)) continue; // a slow device shouldn't stack overlapping reads
    pulling.add(device.id);
    pollApi(config, state, device)
      .catch((err) => {
        setHealth(device, 'error', `Could not read ${device.api_url} (${err.message}).`);
        logError(`${device.device_name}: could not read the device at ${device.api_url} (${err.message}).`);
      })
      .finally(() => pulling.delete(device.id));
  }
}

let ticking = false;
async function tick(config, state) {
  if (ticking) return;
  ticking = true;
  try {
    const devices = await fetchDevices(config);
    await syncSdkSessions(config, state, devices);
    await pollPullDevices(config, state, devices);
    await sendHealth(config);
  } finally {
    ticking = false;
  }
}

async function main() {
  const config = loadConfig();
  const state = loadState();
  // Carry a legacy single-device watermark over so an upgrade doesn't
  // re-send that device's whole history.
  if (state.lastSeenTimestamp && !state.devices.legacy) {
    state.devices.legacy = { lastSeenTimestamp: state.lastSeenTimestamp };
    delete state.lastSeenTimestamp;
    saveState(state);
  }
  log(config.connectorKey
    ? `Attendance connector starting in registry mode. Devices come from ${config.apiBaseUrl}.`
    : `Attendance connector starting in legacy mode. Device: ${config.deviceIp}:${config.devicePort || 4370}.`);
  await tick(config, state);
  setInterval(() => tick(config, state), TICK_MS);
}

main();
