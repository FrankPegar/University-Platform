import { z } from 'zod';

export const listNotificationsSchema = z.object({
  query: z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }).strict(),
});
export const notificationIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({}).strict().optional(),
  query: z.object({}).strict(),
});
export const readAllNotificationsSchema = z.object({
  body: z.object({}).strict().optional(),
  query: z.object({}).strict(),
});
