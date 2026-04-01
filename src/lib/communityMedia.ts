import { supabase } from '@/lib/supabase';

function decodeBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function getFileExtension(fileName?: string | null, mimeType?: string | null) {
  const fileExtension = fileName?.split('.').pop()?.toLowerCase();
  if (fileExtension) return fileExtension;

  const mimeExtension = mimeType?.split('/').pop()?.toLowerCase();
  if (mimeExtension === 'jpeg') return 'jpg';
  return mimeExtension || 'jpg';
}

function getMimeType(extension: string, mimeType?: string | null) {
  if (mimeType) return mimeType;
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

export async function uploadCommunityMedia({
  base64,
  userId,
  fileName,
  mimeType,
  folder = 'posts',
}: {
  base64: string;
  userId: string;
  fileName?: string | null;
  mimeType?: string | null;
  folder?: 'posts' | 'stories';
}) {
  const bytes = decodeBase64(base64);
  const maxSize = 5 * 1024 * 1024;

  if (bytes.byteLength > maxSize) {
    throw new Error('单张图片不能超过 5MB');
  }

  const extension = getFileExtension(fileName, mimeType);
  const contentType = getMimeType(extension, mimeType);
  const filePath = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage
    .from('community-media')
    .upload(filePath, bytes, {
      upsert: false,
      contentType,
    });

  if (error) {
    throw new Error(error.message || '图片上传失败');
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('community-media').getPublicUrl(filePath);

  return `${publicUrl}?t=${Date.now()}`;
}
