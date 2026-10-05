import { supabaseAdmin } from '../config/supabase.js';
import { withAuthorAvatars } from './avatars.service.js';
import { AppError } from '../utils/AppError.js';
import { getQuestionAuthorId } from './questions.service.js';

const ANSWER_SELECT = `
  id, question_id, body, is_accepted, created_at, updated_at,
  author:author_id ( id, full_name, student_id, avatar_path, updated_at ),
  votes!answer_id ( id )
`;

function shapeAnswer(row) {
  return {
    id: row.id,
    question_id: row.question_id,
    body: row.body,
    is_accepted: row.is_accepted,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: row.author,
    vote_count: (row.votes || []).length,
  };
}

export async function listAnswersForQuestion(questionId) {
  // Confirm the question exists so callers get a clean 404 instead of an
  // empty list for a bad id.
  await getQuestionAuthorId(questionId);

  const { data, error } = await supabaseAdmin
    .from('answers')
    .select(ANSWER_SELECT)
    .eq('question_id', questionId)
    .order('is_accepted', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw new AppError(error.message, 500);
  return withAuthorAvatars((data || []).map(shapeAnswer));
}

export async function createAnswer({ question_id, author_id, body }) {
  await getQuestionAuthorId(question_id); // 404s if the question doesn't exist

  const { data, error } = await supabaseAdmin
    .from('answers')
    .insert({ question_id, author_id, body })
    .select(ANSWER_SELECT)
    .single();

  if (error) throw new AppError(error.message, 400);
  return (await withAuthorAvatars([shapeAnswer(data)]))[0];
}

async function getAnswerRow(id) {
  const { data, error } = await supabaseAdmin
    .from('answers')
    .select('id, question_id, author_id, is_accepted')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new AppError('Answer not found', 404);
    throw new AppError(error.message, 500);
  }
  return data;
}

export async function updateAnswer(id, requestingUserId, { body }) {
  const answer = await getAnswerRow(id);
  if (answer.author_id !== requestingUserId) {
    throw new AppError('Only the answer author can edit this answer', 403);
  }

  const { data, error } = await supabaseAdmin
    .from('answers')
    .update({ body })
    .eq('id', id)
    .select(ANSWER_SELECT)
    .single();

  if (error) throw new AppError(error.message, 400);
  return (await withAuthorAvatars([shapeAnswer(data)]))[0];
}

/**
 * Only the QUESTION author may accept an answer - not the answer's own
 * author. requestingUserId always comes from the verified access token
 * (req.user.id), never from the request body.
 */
export async function acceptAnswer(answerId, requestingUserId) {
  const answer = await getAnswerRow(answerId);
  const questionAuthorId = await getQuestionAuthorId(answer.question_id);

  if (questionAuthorId !== requestingUserId) {
    throw new AppError('Only the question author can accept an answer', 403);
  }

  // The DB only allows one accepted answer per question at a time
  // (partial unique index), so unset any previous one first.
  const { error: unsetError } = await supabaseAdmin
    .from('answers')
    .update({ is_accepted: false })
    .eq('question_id', answer.question_id)
    .eq('is_accepted', true);

  if (unsetError) throw new AppError(unsetError.message, 500);

  const { data, error } = await supabaseAdmin
    .from('answers')
    .update({ is_accepted: true })
    .eq('id', answerId)
    .select(ANSWER_SELECT)
    .single();

  if (error) throw new AppError(error.message, 400);
  return (await withAuthorAvatars([shapeAnswer(data)]))[0];
}

export async function unacceptAnswer(answerId, requestingUserId) {
  const answer = await getAnswerRow(answerId);
  const questionAuthorId = await getQuestionAuthorId(answer.question_id);

  if (questionAuthorId !== requestingUserId) {
    throw new AppError('Only the question author can unaccept an answer', 403);
  }

  const { data, error } = await supabaseAdmin
    .from('answers')
    .update({ is_accepted: false })
    .eq('id', answerId)
    .select(ANSWER_SELECT)
    .single();

  if (error) throw new AppError(error.message, 400);
  return (await withAuthorAvatars([shapeAnswer(data)]))[0];
}
