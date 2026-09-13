import { supabase } from '../lib/supabaseClient';

export async function uploadFile(
  file: File,
  bucket: string,
  folder: string = ''
): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const safeName = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(safeName, file, { cacheControl: '3600', upsert: false });

  if (error) {
    console.error('Upload error:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

// Same upload mechanics as uploadFile() above, for PRIVATE buckets
// (business-certificates, staff-resumes) — returns the raw storage path
// instead of a public URL, since these buckets have no public URL to
// return. Matches the existing chat-attachments precedent
// (apiClient.ts's uploadChatAttachment/getSignedAttachmentUrl) exactly:
// the path is what gets stored in the DB column, and getSignedFileUrl()
// below mints a fresh, time-limited URL on demand at view time.
export async function uploadPrivateFile(
  file: File,
  bucket: string,
  folder: string = ''
): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const safeName = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(safeName, file, { cacheControl: '3600', upsert: false });

  if (error) {
    console.error('Upload error:', error);
    return null;
  }

  return data.path;
}

// Mints a 7-day signed URL for a path in a private bucket — same expiry
// apiClient.ts's getSignedAttachmentUrl() already uses. Called on demand
// when a user clicks "View", not stored — the URL itself is never
// persisted anywhere, only the bare path is.
export async function getSignedFileUrl(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) {
    console.error('Signed URL error:', error);
    return null;
  }
  return data?.signedUrl || null;
}
