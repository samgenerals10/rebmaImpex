// rebma-web/src/components/collaborative/callUi.tsx
//
// Phone-style pieces shared by the call screens: the ringing tone you hear
// while calling someone, the ringtone for an incoming call, a running call
// timer, and the person's photo with pulsing rings. Tones are made by the
// browser itself (Web Audio), so there are no sound files to load.
import { useEffect, useState } from 'react';

type Pattern = { freqs: number[]; on: number; off: number; bursts?: number; gap?: number };

// Ringing you hear while waiting for someone to pick up.
const RINGBACK: Pattern = { freqs: [440, 480], on: 2000, off: 4000 };
// Ringtone for a call coming in: two short rings, then a pause.
const RINGTONE: Pattern = { freqs: [880, 660], on: 400, off: 200, bursts: 2, gap: 1600 };

function useTone(active: boolean, pattern: Pattern) {
  useEffect(() => {
    if (!active) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const beep = (ms: number) => {
      const gain = ctx.createGain();
      gain.gain.value = 0.06;
      gain.connect(ctx.destination);
      const oscs = pattern.freqs.map((f) => {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        o.connect(gain);
        o.start();
        return o;
      });
      setTimeout(() => { oscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } }); gain.disconnect(); }, ms);
    };

    const cycle = () => {
      if (stopped) return;
      const bursts = pattern.bursts || 1;
      for (let i = 0; i < bursts; i++) setTimeout(() => { if (!stopped) beep(pattern.on); }, i * (pattern.on + pattern.off));
      const cycleLength = bursts * (pattern.on + pattern.off) + (pattern.gap ?? 0);
      timer = setTimeout(cycle, Math.max(cycleLength, pattern.on + pattern.off));
    };
    cycle();

    return () => { stopped = true; clearTimeout(timer); ctx.close().catch(() => {}); };
  }, [active, pattern]);
}

export const useRingback = (active: boolean) => useTone(active, RINGBACK);
export const useRingtone = (active: boolean) => useTone(active, RINGTONE);

// Seconds since `running` became true, as m:ss or h:mm:ss.
export function useCallTimer(running: boolean): string {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) { setSeconds(0); return; }
    const started = Date.now();
    const iv = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [running]);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const initialsOf = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

// The person's photo (or initials), with soft rings pulsing out while ringing.
export function CallAvatar({ name, photo, size = 128, ringing = false }: { name: string; photo?: string | null; size?: number; ringing?: boolean }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {ringing && (
        <>
          <span className="absolute inset-0 rounded-full bg-white/15 animate-ping" />
          <span className="absolute -inset-4 rounded-full border border-white/15 animate-pulse" />
        </>
      )}
      {photo ? (
        <img src={photo} alt="" className="relative rounded-full object-cover ring-4 ring-white/20" style={{ width: size, height: size }} />
      ) : (
        <div className="relative rounded-full bg-[var(--accent)] text-white font-bold flex items-center justify-center ring-4 ring-white/20" style={{ width: size, height: size, fontSize: size * 0.34 }}>
          {initialsOf(name)}
        </div>
      )}
    </div>
  );
}
