import { z } from 'zod';

const uuid = z.string().uuid();

const targetShape = z
  .object({
    question_id: uuid.optional(),
    answer_id: uuid.optional(),
  })
  .refine((data) => Boolean(data.question_id) !== Boolean(data.answer_id), {
    message: 'Provide exactly one of question_id or answer_id',
  });

export const voteSchema = z.object({
  body: targetShape,
  query: z.any().optional(),
  params: z.any().optional(),
});
