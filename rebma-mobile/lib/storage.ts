// rebma-mobile/lib/storage.ts
//
// Phase 7.1: uploads a local file URI to a Supabase Storage bucket and
// returns its public URL — mirrors rebma-web/src/utils/uploadFile.ts
// (upload → getPublicUrl), for the two delivery-proof-photo flows that
// use a real bucket rather than an inline base64 column (see
// lib/media.ts's header comment for which flow is which).
//
// React Native has no browser File/Blob-from-input the way web's
// uploadFile.ts does — the standard RN approach is to fetch() the local
// file:// uri and hand the resulting ArrayBuffer straight to
// supabase-js's storage.upload(), which accepts it directly.
import { supabase } from './supabaseClient';

export async function uploadToBucket(uri: string, bucket: string, folder: string, mimeType = 'image/jpeg'): Promise<string | null> {
  const ext = mimeType.split('/')[1] || 'jpg';
  const path = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Same upload mechanics as uploadToBucket() above, for PRIVATE buckets
// (business-certificates, staff-resumes) — returns the raw storage path
// instead of a public URL, matching web's uploadPrivateFile() exactly.
export async function uploadToPrivateBucket(uri: string, bucket: string, folder: string, mimeType = 'image/jpeg'): Promise<string | null> {
  const ext = mimeType.split('/')[1] || 'jpg';
  const path = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message);

  return path;
}

// Mints a 7-day signed URL for a path in a private bucket, on demand at
// view time — matches web's getSignedFileUrl() exactly. Never persisted,
// only the bare path is stored.
export async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) return null;
  return data?.signedUrl || null;
}
