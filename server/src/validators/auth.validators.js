import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    full_name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    student_id: z.string().min(3).max(30),
    department_id: z.string().uuid(),
    course_id: z.string().uuid(),
    year_level: z.number().int().min(1).max(8),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});
