import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/AppError.js';

export async function searchTags(search) {
  let query = supabaseAdmin.from('tags').select('id, name').order('name').limit(20);
  if (search) {
    query = query.ilike('name', `%${search}%`);
  }
  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);
  return data;
}

/**
 * Given a list of tag names typed by a student, ensures each one exists in
 * the tags table (creating any that don't) and returns their rows. Used
 * when creating/editing a question so free-typed tags become real rows.
 */
export async function upsertTagsByName(names) {
  const clean = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))];
  if (clean.length === 0) return [];

  const { error: upsertError } = await supabaseAdmin
    .from('tags')
    .upsert(
      clean.map((name) => ({ name })),
      { onConflict: 'name', ignoreDuplicates: true }
    );

  if (upsertError) throw new AppError(upsertError.message, 500);

  const { data, error } = await supabaseAdmin.from('tags').select('id, name').in('name', clean);
  if (error) throw new AppError(error.message, 500);
  return data;
}
