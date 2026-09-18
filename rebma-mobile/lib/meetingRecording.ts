// rebma-mobile/lib/meetingRecording.ts
//
// Local host-device meeting recording. Per the user's explicit
// correction earlier in this project: NOT a server-side mixer combining
// every participant's stream (this app has no infrastructure for that,
// and it was never actually what was asked for) — the host's own device
// records its own screen (react-native-record-screen, already
// installed), and the finished file is uploaded to a real Storage
// bucket with a meeting_recordings row tracking it, so a recording is
// "in the database... fetched whenever it is needed," not just left on
// the host's phone with no record it ever happened.
import RecordScreen, { RecordingResult } from 'react-native-record-screen';
import { supabase } from './supabaseClient';
import { uploadToBucket } from './storage';

export async function startLocalRecording(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await RecordScreen.startRecording({ mic: true });
    if (res === RecordingResult.PermissionError) {
      return { ok: false, reason: 'Screen/microphone recording permission was denied.' };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Could not start recording.' };
  }
}

export interface StopRecordingResult {
  ok: boolean;
  localUri?: string;
  reason?: string;
}

export async function stopLocalRecording(): Promise<StopRecordingResult> {
  try {
    const res = await RecordScreen.stopRecording();
    if (res.status !== 'success') {
      return { ok: false, reason: 'Recording did not finish successfully.' };
    }
    return { ok: true, localUri: res.result.outputURL };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Could not stop recording.' };
  }
}

// Uploads the finished local recording and writes the row that makes it
// fetchable later. `meeting-recordings` is a real Storage bucket the
// user needs to create by hand once — same as every other bucket in
// this app, none of which are ever created via SQL here.
export async function uploadRecording(params: {
  meetingId?: string | null;
  room: string;
  hostId: string;
  hostName: string;
  localUri: string;
  consentedUserIds: string[];
  declinedUserIds: string[];
  startedAt: string;
  endedAt: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const publicUrl = await uploadToBucket(params.localUri, 'meeting-recordings', params.meetingId || params.room, 'video/mp4');
    if (!publicUrl) throw new Error('Upload failed.');

    const { error } = await supabase.from('meeting_recordings').insert({
      meeting_id: params.meetingId || null,
      room: params.room,
      host_id: params.hostId,
      host_name: params.hostName,
      file_url: publicUrl,
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
