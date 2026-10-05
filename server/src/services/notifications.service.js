import { supabaseAdmin } from '../config/supabase.js';
import { withAvatarUrls } from './avatars.service.js';
import { AppError } from '../utils/AppError.js';

// Called only after a Q&A write succeeds. Delivery failure must not report a
// committed answer/comment as failed and encourage duplicate content on retry.
export async function createNotification(notification) {
  if (notification.recipient_id === notification.actor_id) return;
  try {
    const { error } = await supabaseAdmin.from('notifications').insert(notification);
    if (error && error.code !== '23505') throw error;
  } catch (error) {
    console.warn('[notifications] Delivery failed', error.code || error.message);
  }
}

export async function notifyCommentCreated(comment, actorId) {
  try {
    const onAnswer = Boolean(comment.answer_id);
    const { data: parent, error } = await supabaseAdmin.from(onAnswer ? 'answers' : 'questions')
      .select(onAnswer ? 'author_id, question_id' : 'author_id')
      .eq('id', onAnswer ? comment.answer_id : comment.question_id).single();
    if (error) throw error;
    await createNotification({ recipient_id: parent.author_id, actor_id: actorId,
      type: onAnswer ? 'answer_comment' : 'question_comment',
      question_id: onAnswer ? parent.question_id : comment.question_id,
      answer_id: comment.answer_id, comment_id: comment.id });
  } catch (error) {
    console.warn('[notifications] Comment recipient lookup failed', error.code || error.message);
  }
}

export async function listNotifications(recipientId, { page = 1, limit = 20 } = {}) {
  const [list, unread] = await Promise.all([
    supabaseAdmin.from('notifications')
      .select('id, type, question_id, answer_id, comment_id, is_read, created_at, actor:actor_id(id, full_name, avatar_path, updated_at), question:question_id(title)', { count: 'exact' })
      .eq('recipient_id', recipientId).order('created_at', { ascending: false }).order('id', { ascending: false })
      .range((page - 1) * limit, page * limit - 1),
    supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', recipientId).eq('is_read', false),
  ]);
  if (list.error || unread.error) throw new AppError('Could not load notifications. Please try again.', 500);
  const actors = await withAvatarUrls((list.data || []).map(item => item.actor));
  return { items: (list.data || []).map((item, index) => ({ ...item, actor: actors[index] })),
    total: list.count, unread_count: unread.count, page, limit };
}

export async function markNotificationRead(id, recipientId) {
  const { data, error } = await supabaseAdmin.from('notifications').update({ is_read: true })
    .eq('id', id).eq('recipient_id', recipientId).select('id, is_read').single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError('Notification not found', 404);
    throw new AppError('Could not mark notification as read. Please try again.', 500);
  }
  return data;
}

export async function markAllNotificationsRead(recipientId) {
  const { error } = await supabaseAdmin.from('notifications').update({ is_read: true })
    .eq('recipient_id', recipientId).eq('is_read', false);
  if (error) throw new AppError('Could not mark notifications as read. Please try again.', 500);
  return { updated: true };
}

export async function deleteNotification(id, recipientId) {
  const { error } = await supabaseAdmin.from('notifications').delete()
    .eq('id', id).eq('recipient_id', recipientId).select('id').single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError('Notification not found', 404);
    throw new AppError('Could not delete notification. Please try again.', 500);
  }
  return { deleted: true };
}
