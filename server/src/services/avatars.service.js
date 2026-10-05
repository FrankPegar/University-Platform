import sharp from 'sharp';
import { supabaseAdmin, createUserClient } from '../config/supabase.js';
import { AppError } from '../utils/AppError.js';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const FORMATS = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
const SIGNED_URL_SECONDS = 3600;
export const avatarPath = userId => `${userId}/avatar.webp`;

// Sign in one batch per response, without storing expiring URLs in the DB.
// Storage trouble must not make existing profiles/questions/answers unavailable.
export async function withAvatarUrls(profiles) {
  const paths = [...new Set(profiles.filter(profile => profile?.avatar_path && profile.avatar_path === avatarPath(profile.id)).map(profile => profile.avatar_path))];
  let urls = new Map();
  if (paths.length) {
    try {
      const { data, error } = await supabaseAdmin.storage.from('avatars').createSignedUrls(paths, SIGNED_URL_SECONDS);
      if (!error) urls = new Map((data || []).filter(item => item.signedUrl && !item.error).map(item => [item.path, item.signedUrl]));
    } catch {
      // An unavailable image service must not hide university content.
    }
  }
  return profiles.map(profile => profile ? {
    ...profile,
    avatar_url: urls.has(profile.avatar_path)
      ? `${urls.get(profile.avatar_path)}&v=${encodeURIComponent(profile.updated_at || '')}`
      : null,
  } : profile);
}

export async function withAuthorAvatars(items) {
  const authors = await withAvatarUrls(items.map(item => item.author));
  return items.map((item, index) => ({ ...item, author: authors[index] }));
}

export async function normalizeAvatar(buffer, contentType) {
  if (!FORMATS[contentType]) throw new AppError('Choose a JPG, PNG, or WebP image.', 415);
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new AppError('Choose an image to upload.', 400);
  if (buffer.length > AVATAR_MAX_BYTES) throw new AppError('Profile pictures must be 2 MB or smaller.', 413);
  try {
    const image = sharp(buffer, { limitInputPixels: 16000000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (metadata.format !== FORMATS[contentType]) throw new Error('Content does not match the declared image type');
    // Decode and re-encode; do not store arbitrary bytes or EXIF/GPS metadata.
    return await image.rotate().resize(512, 512, { fit: 'cover', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch {
    throw new AppError('This image could not be read. Use a valid JPG, PNG, or WebP up to 16 megapixels.', 400);
  }
}

export async function uploadAvatar(userId, accessToken, bytes, contentType) {
  const image = await normalizeAvatar(bytes, contentType);
  // Use the student's JWT for Storage, so RLS enforces the same ownership as
  // Express. The service-role key remains server-only for profile DB updates.
  const storage = createUserClient(accessToken).storage.from('avatars');
  const path = avatarPath(userId);
  const { error } = await storage.upload(path, image, { contentType: 'image/webp', cacheControl: '0', upsert: true });
  if (error) throw new AppError('Could not upload your profile picture. Please try again.', Number(error.statusCode) === 403 ? 403 : 502);
  const { error: profileError } = await supabaseAdmin.from('profiles')
    .update({ avatar_path: path, updated_at: new Date().toISOString() }).eq('id', userId);
  if (profileError) {
    // The fixed object key bounds failed saves to one recoverable object. Do
    // not delete it here: a concurrent successful replacement may own it now.
    throw new AppError('The image uploaded, but your profile could not be updated. Retry the upload or remove the picture.', 502);
  }
}

export async function removeAvatar(userId, accessToken) {
  // Delete first, including any unreferenced object from an interrupted upload.
  // Storage remove is idempotent; retry also repairs a failed profile update.
  const { error } = await createUserClient(accessToken).storage.from('avatars').remove([avatarPath(userId)]);
  if (error) throw new AppError('Could not remove your profile picture. Please try again.', 502);
  const { error: profileError } = await supabaseAdmin.from('profiles')
    .update({ avatar_path: null, updated_at: new Date().toISOString() }).eq('id', userId);
  if (profileError) throw new AppError('The image was removed, but your profile could not be updated. Retry removing it.', 502);
}
