import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/AppError.js';

export async function addVote({ user_id, question_id, answer_id }) {
  const { data, error } = await supabaseAdmin
    .from('votes')
    .insert({
      user_id,
      question_id: question_id ?? null,
      answer_id: answer_id ?? null,
    })
    .select('id, question_id, answer_id, created_at')
    .single();

  if (error) {
    // Unique index violation - the DB is the source of truth for
    // "one vote per user per target", this just gives a friendly message.
    if (error.code === '23505') throw new AppError('You have already voted on this item', 409);
    if (error.code === '23503') throw new AppError('question_id or answer_id does not exist', 400);
    if (error.code === '23514') {
      throw new AppError('A vote must target exactly one of question_id or answer_id', 400);
    }
    throw new AppError(error.message, 400);
  }
  return data;
}

export async function removeVote({ user_id, question_id, answer_id }) {
  let query = supabaseAdmin.from('votes').delete().eq('user_id', user_id);
  query = question_id ? query.eq('question_id', question_id) : query.eq('answer_id', answer_id);

  const { data, error } = await query.select('id');
  if (error) throw new AppError(error.message, 400);
  if (!data || data.length === 0) throw new AppError('Vote not found', 404);
}
