import { z } from 'zod';

const uuid = z.string().uuid();

export const createAnswerSchema = z.object({
  params: z.object({ id: uuid }), // question id
  body: z.object({ body: z.string().min(5) }),
  query: z.any().optional(),
});

export const answerIdParamSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.any().optional(),
  query: z.any().optional(),
});

export const updateAnswerSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({ body: z.string().min(5) }),
  query: z.any().optional(),
});
