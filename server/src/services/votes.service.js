import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/AppError.js';

// Return only the total and the authenticated viewer's state, never voter IDs.
export async function getVoteState({ user_id, question_id, answer_id }) {
  const column = question_id ? 'question_id' : 'answer_id';
  const targetId = question_id || answer_id;
  // Count all votes without depending on Supabase's returned-row limit.
  const [total, ownVote] = await Promise.all([
    supabaseAdmin.from('votes').select('id', { count: 'exact', head: true }).eq(column, targetId),
    supabaseAdmin.from('votes').select('id').eq(column, targetId).eq('user_id', user_id).limit(1),
  ]);
  if (total.error || ownVote.error) throw new AppError((total.error || ownVote.error).message, 400);
  return {
    vote_count: total.count || 0,
    has_voted: (ownVote.data || []).length > 0,
  };
}

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
