-- Coursepoint v1.4. New in-app notifications only; existing Q&A tables are unchanged.
begin;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('question_answer', 'question_comment', 'answer_comment', 'answer_accepted')),
  question_id uuid not null references public.questions(id) on delete cascade,
  answer_id uuid references public.answers(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_no_self check (recipient_id <> actor_id),
  constraint notifications_source check (
    (type in ('question_answer', 'answer_accepted') and answer_id is not null and comment_id is null)
    or (type = 'question_comment' and answer_id is null and comment_id is not null)
    or (type = 'answer_comment' and answer_id is not null and comment_id is not null)
  )
);

create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc, id desc);
create index notifications_unread_recipient_idx on public.notifications (recipient_id) where is_read = false;
create index notifications_actor_idx on public.notifications (actor_id);
create index notifications_question_idx on public.notifications (question_id);
create index notifications_answer_idx on public.notifications (answer_id);
-- Retries/re-accepting an answer do not create repeated notifications.
create unique index notifications_answer_event_idx on public.notifications (type, answer_id) where comment_id is null;
create unique index notifications_comment_event_idx on public.notifications (comment_id);

alter table public.notifications enable row level security;
-- Explicit grants are needed on projects that no longer expose new tables by default.
revoke all on public.notifications from public, anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant all on public.notifications to service_role;

create policy notifications_read_own on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (recipient_id = (select auth.uid()));
-- No client INSERT policy or grant: event/actor/recipient data comes from Express.
notify pgrst, 'reload schema';
commit;
