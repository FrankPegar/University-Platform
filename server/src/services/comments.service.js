import { supabaseAdmin } from '../config/supabase.js';
import { withAuthorAvatars } from './avatars.service.js';
import { AppError } from '../utils/AppError.js';

const COMMENT_SELECT = `
  id, question_id, answer_id, body, created_at,
  author:author_id ( id, full_name, student_id, avatar_path, updated_at )
`;

export async function listCommentsForQuestion(questionId) {
  const { data, error } = await supabaseAdmin
    .from('comments')
    .select(COMMENT_SELECT)
    .eq('question_id', questionId)
    .order('created_at', { ascending: true });

  if (error) throw new AppError(error.message, 500);
  return withAuthorAvatars(data || []);
}

export async function listCommentsForAnswer(answerId) {
  const { data, error } = await supabaseAdmin
    .from('comments')
    .select(COMMENT_SELECT)
    .eq('answer_id', answerId)
    .order('created_at', { ascending: true });

  if (error) throw new AppError(error.message, 500);
  return withAuthorAvatars(data || []);
}

export async function createComment({ author_id, question_id, answer_id, body }) {
  const { data, error } = await supabaseAdmin
    .from('comments')
    .insert({
      author_id,
      question_id: question_id ?? null,
      answer_id: answer_id ?? null,
      body,
    })
    .select(COMMENT_SELECT)
    .single();

  if (error) {
    if (error.code === '23503') throw new AppError('question_id or answer_id does not exist', 400);
    if (error.code === '23514') {
      throw new AppError('A comment must belong to exactly one of question_id or answer_id', 400);
    }
    throw new AppError(error.message, 400);
  }
  return (await withAuthorAvatars([data]))[0];
}

async function requireCommentAuthor(id, requestingUserId, action) {
  const { data, error: fetchError } = await supabaseAdmin
    .from('comments')
    .select('id, author_id')
    .eq('id', id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') throw new AppError('Comment not found', 404);
    throw new AppError(fetchError.message, 500);
  }
  if (data.author_id !== requestingUserId) {
    throw new AppError(`Only the comment author can ${action} this comment`, 403);
  }
}

export async function updateComment(id, requestingUserId, { body }) {
  await requireCommentAuthor(id, requestingUserId, 'edit');
  const { data, error } = await supabaseAdmin.from('comments')
    .update({ body }).eq('id', id).eq('author_id', requestingUserId)
    .select(COMMENT_SELECT).single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError('Comment not found', 404);
    throw new AppError(error.message, 400);
  }
  return (await withAuthorAvatars([data]))[0];
}

export async function deleteComment(id, requestingUserId) {
  await requireCommentAuthor(id, requestingUserId, 'delete');
  const { error } = await supabaseAdmin.from('comments').delete().eq('id', id).eq('author_id', requestingUserId);
  if (error) throw new AppError(error.message, 400);
}
