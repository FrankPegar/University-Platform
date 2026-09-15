import { z } from 'zod';

const uuid = z.string().uuid();

export const listQuestionsSchema = z.object({
  query: z.object({
    department_id: uuid.optional(),
    sort: z.enum(['newest', 'votes', 'unanswered']).optional(),
    search: z.string().max(200).optional(),
    page: z.string().regex(/^\d+$/, 'page must be a positive integer').optional(),
    limit: z.string().regex(/^\d+$/, 'limit must be a positive integer').optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});

export const createQuestionSchema = z.object({
  body: z.object({
    title: z.string().min(5).max(200),
    body: z.string().min(10),
    department_id: uuid,
    tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const questionIdParamSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.any().optional(),
  query: z.any().optional(),
});

export const updateQuestionSchema = z.object({
  params: z.object({ id: uuid }),
  body: z
    .object({
      title: z.string().min(5).max(200).optional(),
      body: z.string().min(10).optional(),
      tags: z.array(z.string().min(1).max(30)).max(10).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
  query: z.any().optional(),
});
