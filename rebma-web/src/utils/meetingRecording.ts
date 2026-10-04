// rebma-web/src/utils/meetingRecording.ts
//
// Meeting recording from web, the twin of rebma-mobile/lib/meetingRecording.ts.
// The phone records the host's own screen. A browser can't record itself
// silently, so the host is asked which tab or screen to share (they pick
// the meeting tab and tick "share tab audio" to catch everyone's voices),
// and the host's own microphone is mixed in. The finished file goes to
// the same `meeting-recordings` Storage bucket with the same
// meeting_recordings row the phone writes, so a recording made on either
// app is stored and found the same way.

import { supabase } from '../lib/supabaseClient';

export interface BrowserRecording {
  /** Stops recording and gives back the finished file. */
  stop: () => Promise<Blob | null>;
  /** Fires if the host ends the screen share from the browser's own bar. */
  onEndedByBrowser: (cb: () => void) => void;
  mimeType: string;
}

function pickMimeType(): string {
  const options = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return options.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';
}

export async function startBrowserRecording(micStream: MediaStream | null): Promise<{ ok: true; recording: BrowserRecording } | { ok: false; reason: string }> {
  if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
    return { ok: false, reason: 'This browser cannot record the meeting. Try the latest Chrome or Edge.' };
  }
  let display: MediaStream;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
  } catch {
    return { ok: false, reason: 'Recording needs you to choose the meeting tab or screen to share.' };
  }

  // Mix the shared tab's sound (everyone else) with the host's microphone.
  let audioContext: AudioContext | null = null;
  const tracks: MediaStreamTrack[] = [...display.getVideoTracks()];
  const audioSources = [display, micStream].filter((s): s is MediaStream => !!s && s.getAudioTracks().length > 0);
  if (audioSources.length > 0) {
    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    audioSources.forEach((s) => audioContext!.createMediaStreamSource(new MediaStream(s.getAudioTracks())).connect(destination));
    tracks.push(...destination.stream.getAudioTracks());
  }

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(new MediaStream(tracks), mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  recorder.start(1000);

  const endedListeners: (() => void)[] = [];
  display.getVideoTracks()[0]?.addEventListener('ended', () => endedListeners.forEach((cb) => cb()));

  const cleanup = () => {
    display.getTracks().forEach((t) => t.stop());
    audioContext?.close().catch(() => {});
  };

  return {
    ok: true,
    recording: {
      mimeType: recorder.mimeType || mimeType || 'video/webm',
      onEndedByBrowser: (cb) => { endedListeners.push(cb); },
      stop: () => new Promise((resolve) => {
        if (recorder.state === 'inactive') { cleanup(); resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || 'video/webm' }) : null); return; }
        recorder.onstop = () => {
          cleanup();
          resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || 'video/webm' }) : null);
        };
        recorder.stop();
      }),
    },
  };
}

// Same row and bucket as the phone's uploadRecording(). The bucket is
// private (supabase_private_data_security.sql).
export async function uploadRecording(params: {
  meetingId?: string | null;
  room: string;
  hostId: string;
  hostName: string;
  file: Blob;
  consentedUserIds: string[];
  declinedUserIds: string[];
  startedAt: string;
  endedAt: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const ext = params.file.type.includes('mp4') ? 'mp4' : 'webm';
    const folder = params.meetingId || params.room;
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('meeting-recordings').upload(path, params.file, { contentType: params.file.type || `video/${ext}`, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { error } = await supabase.from('meeting_recordings').insert({
      meeting_id: params.meetingId || null,
      room: params.room,
      host_id: params.hostId,
      host_name: params.hostName,
      // The folder is private: this stores the file's place in it, and a
      // short-lived link is made only when someone allowed opens it.
      file_url: path,
      consented_user_ids: params.consentedUserIds,
      declined_user_ids: params.declinedUserIds,
      started_at: params.startedAt,
      ended_at: params.endedAt,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Could not save the recording.' };
  }
}
