import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/AppError.js';

const PROFILE_SELECT = `
  id, full_name, student_id, year_level, created_at, updated_at,
  department:department_id ( id, name ),
  course:course_id ( id, name )
`;

export async function getProfileById(id) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new AppError('Profile not found', 404);
    throw new AppError(error.message, 500);
  }
  return data;
}

export async function updateProfile(id, updates) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select(PROFILE_SELECT)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new AppError('Profile not found', 404);
    if (error.code === '23503') {
      throw new AppError(
        'course_id does not belong to department_id, or the department/course does not exist',
        400
      );
    }
    throw new AppError(error.message, 400);
  }
  return data;
}
