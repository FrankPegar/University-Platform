import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/AppError.js';

export async function listDepartments() {
  const { data, error } = await supabaseAdmin
    .from('departments')
    .select('id, name')
    .order('name');

  if (error) throw new AppError(error.message, 500);
  return data;
}

export async function listCoursesByDepartment(departmentId) {
  const { data, error } = await supabaseAdmin
    .from('courses')
    .select('id, name, department_id')
    .eq('department_id', departmentId)
    .order('name');

  if (error) throw new AppError(error.message, 500);
  return data;
}
