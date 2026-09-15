import { z } from 'zod';

export const searchTagsSchema = z.object({
  query: z.object({ search: z.string().max(50).optional() }),
  body: z.any().optional(),
  params: z.any().optional(),
});
