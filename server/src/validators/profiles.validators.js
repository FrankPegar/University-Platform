import { z } from 'zod';

export const profileIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.any().optional(),
  query: z.any().optional(),
});

export const updateProfileSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      full_name: z.string().min(2).max(120).optional(),
      department_id: z.string().uuid().optional(),
      course_id: z.string().uuid().optional(),
      year_level: z.number().int().min(1).max(8).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
  query: z.any().optional(),
});
