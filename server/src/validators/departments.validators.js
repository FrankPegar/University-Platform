import { z } from 'zod';

export const departmentIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.any().optional(),
  query: z.any().optional(),
});
