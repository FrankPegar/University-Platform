import { z } from 'zod';

const uuid = z.string().uuid();

// Used for GET /questions/:id/comments, GET /answers/:id/comments,
// GET /questions/:id/answers - any route that just needs a parent :id.
export const parentIdParamSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.any().optional(),
  query: z.any().optional(),
});

export const createCommentSchema = z.object({
  body: z
    .object({
      question_id: uuid.optional(),
      answer_id: uuid.optional(),
      body: z.string().min(1).max(1000),
    })
    .refine((data) => Boolean(data.question_id) !== Boolean(data.answer_id), {
      message: 'Provide exactly one of question_id or answer_id',
    }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const commentIdParamSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.any().optional(),
  query: z.any().optional(),
});

export const updateCommentSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ body: z.string().trim().min(1).max(1000) }),
  query: z.any().optional(),
});
