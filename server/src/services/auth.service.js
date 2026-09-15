import { supabaseAdmin, supabaseAuth } from '../config/supabase.js';
import { AppError } from '../utils/AppError.js';

/**
 * Registers a student: creates the Supabase Auth user, then creates the
 * matching profiles row using the service-role client (bypasses RLS).
 * If profile creation fails (e.g. mismatched course/department), the auth
 * user is rolled back so we never leave an orphaned account with no profile.
 */
export async function registerStudent({
  full_name,
  email,
  password,
  student_id,
  department_id,
  course_id,
  year_level,
}) {
  const { data: signUpData, error: signUpError } = await supabaseAuth.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    const status = signUpError.status === 422 ? 409 : 400;
    throw new AppError(signUpError.message, status);
  }

  const authUser = signUpData.user;
  if (!authUser) {
    throw new AppError('Registration did not return a user', 500);
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: authUser.id,
      full_name,
      student_id,
      department_id,
      course_id,
      year_level,
    })
    .select(
      'id, full_name, student_id, year_level, created_at, department:department_id(id,name), course:course_id(id,name)'
    )
    .single();

  if (profileError) {
    // Roll back the orphaned auth user - best effort, don't mask the real error.
    await supabaseAdmin.auth.admin.deleteUser(authUser.id).catch(() => {});

    if (profileError.code === '23505') {
      throw new AppError('Student ID is already registered', 409);
    }
    if (profileError.code === '23503') {
      throw new AppError(
        'course_id does not belong to department_id, or the department/course does not exist',
        400
      );
    }
    throw new AppError(profileError.message, 400);
  }

  return {
    user: { id: authUser.id, email: authUser.email },
    profile,
    // session is null if your Supabase project requires email confirmation
    // before a session is issued - the student would then log in after
    // confirming their email.
    session: signUpData.session,
  };
}

export async function loginStudent({ email, password }) {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

  if (error) {
    throw new AppError('Invalid email or password', 401);
  }

  return {
    session: data.session,
    user: { id: data.user.id, email: data.user.email },
  };
}

export async function logoutStudent(accessToken) {
  const { error } = await supabaseAdmin.auth.admin.signOut(accessToken);
  if (error) {
    throw new AppError(error.message, 400);
  }
}
