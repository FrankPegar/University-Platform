import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../utils/AppError.js';
import { upsertTagsByName } from './tags.service.js';

// votes!question_id / question_tags / answers are embedded via existing
// foreign keys - no schema changes, just relational selects.
const QUESTION_SELECT = `
  id, title, body, created_at, updated_at, author_id, department_id,
  author:author_id ( id, full_name, student_id ),
  department:department_id ( id, name ),
  question_tags ( tags ( id, name ) ),
  answers ( id, is_accepted ),
  votes!question_id ( id )
`;

function shapeQuestion(row) {
  const tags = (row.question_tags || []).map((qt) => qt.tags).filter(Boolean);
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: row.author,
    department: row.department,
    tags,
    answer_count: (row.answers || []).length,
    has_accepted_answer: (row.answers || []).some((a) => a.is_accepted),
    vote_count: (row.votes || []).length,
  };
}

/**
 * Fetches up to 200 recent questions matching the filters, then applies
 * sort/pagination in memory. This keeps 'sort by vote count' and
 * 'unanswered only' correct without needing a database view, at the cost
 * of not scaling past a few hundred open questions - acceptable for a
 * single-university MVP.
 */
export async function listQuestions({ department_id, sort = 'newest', search, page = 1, limit = 20 }) {
  let query = supabaseAdmin.from('questions').select(QUESTION_SELECT);

  if (department_id) query = query.eq('department_id', department_id);
  if (search) query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`);

  query = query.order('created_at', { ascending: false }).limit(200);

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  let shaped = (data || []).map(shapeQuestion);

  if (sort === 'votes') {
    shaped = [...shaped].sort((a, b) => b.vote_count - a.vote_count);
  } else if (sort === 'unanswered') {
    shaped = shaped.filter((q) => q.answer_count === 0);
  }
  // 'newest' is already the DB order.

  const from = (page - 1) * limit;
  const items = shaped.slice(from, from + limit);

  return { items, total: shaped.length, page, limit };
}

export async function getQuestionById(id) {
  const { data, error } = await supabaseAdmin
    .from('questions')
    .select(QUESTION_SELECT)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new AppError('Question not found', 404);
    throw new AppError(error.message, 500);
  }
  return shapeQuestion(data);
}

export async function getQuestionAuthorId(id) {
  const { data, error } = await supabaseAdmin
    .from('questions')
    .select('author_id')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new AppError('Question not found', 404);
    throw new AppError(error.message, 500);
  }
  return data.author_id;
}

export async function createQuestion({ author_id, department_id, title, body, tags = [] }) {
  const { data: question, error } = await supabaseAdmin
    .from('questions')
    .insert({ author_id, department_id, title, body })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23503') throw new AppError('department_id does not exist', 400);
    throw new AppError(error.message, 400);
  }

  if (tags.length > 0) {
    await attachTags(question.id, tags);
  }

  return getQuestionById(question.id);
}

export async function updateQuestion(id, requestingUserId, { title, body, tags }) {
  const authorId = await getQuestionAuthorId(id);
  if (authorId !== requestingUserId) {
    throw new AppError('Only the question author can edit this question', 403);
  }

  const patch = {};
  if (title !== undefined) patch.title = title;
  if (body !== undefined) patch.body = body;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabaseAdmin.from('questions').update(patch).eq('id', id);
    if (error) throw new AppError(error.message, 400);
  }

  if (tags !== undefined) {
    const { error } = await supabaseAdmin.from('question_tags').delete().eq('question_id', id);
    if (error) throw new AppError(error.message, 400);
    if (tags.length > 0) {
      await attachTags(id, tags);
    }
  }

  return getQuestionById(id);
}

export async function deleteQuestion(id, requestingUserId) {
  const authorId = await getQuestionAuthorId(id);
  if (authorId !== requestingUserId) {
    throw new AppError('Only the question author can delete this question', 403);
  }

  const { error } = await supabaseAdmin.from('questions').delete().eq('id', id);
  if (error) throw new AppError(error.message, 400);
}

async function attachTags(questionId, tagNames) {
  const tagRows = await upsertTagsByName(tagNames);
  const links = tagRows.map((t) => ({ question_id: questionId, tag_id: t.id }));
  if (links.length === 0) return;

  const { error } = await supabaseAdmin.from('question_tags').insert(links);
  if (error) throw new AppError(error.message, 400);
}
