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
