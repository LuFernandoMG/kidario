-- Kidario RLS baseline for chat domain tables
-- Apply after:
--   004_init_bookings.sql
--   005_rls_bookings.sql
--   007_init_chat.sql

alter table if exists chat_threads enable row level security;
alter table if exists chat_messages enable row level security;

-- Trusted backend/service roles: full access
drop policy if exists chat_threads_service_all on chat_threads;
create policy chat_threads_service_all
on chat_threads
for all
to service_role, postgres
using (true)
with check (true);

drop policy if exists chat_messages_service_all on chat_messages;
create policy chat_messages_service_all
on chat_messages
for all
to service_role, postgres
using (true)
with check (true);

-- chat_threads: only participants can read
drop policy if exists chat_threads_participant_select on chat_threads;
create policy chat_threads_participant_select
on chat_threads
for select
to authenticated
using (
  parent_profile_id = auth.uid()
  or teacher_profile_id = auth.uid()
);

-- chat_threads: participants can create (must belong to booking participants)
drop policy if exists chat_threads_participant_insert on chat_threads;
create policy chat_threads_participant_insert
on chat_threads
for insert
to authenticated
with check (
  (parent_profile_id = auth.uid() or teacher_profile_id = auth.uid())
  and exists (
    select 1
    from bookings b
    where b.id = chat_threads.booking_id
      and b.parent_profile_id = chat_threads.parent_profile_id
      and b.teacher_profile_id = chat_threads.teacher_profile_id
      and b.child_id = chat_threads.child_id
  )
);

-- chat_messages: only participants can read
drop policy if exists chat_messages_participant_select on chat_messages;
create policy chat_messages_participant_select
on chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from chat_threads t
    where t.id = chat_messages.thread_id
      and (
        t.parent_profile_id = auth.uid()
        or t.teacher_profile_id = auth.uid()
      )
  )
);

-- chat_messages: only participants can send and sender must be auth.uid()
drop policy if exists chat_messages_participant_insert on chat_messages;
create policy chat_messages_participant_insert
on chat_messages
for insert
to authenticated
with check (
  sender_profile_id = auth.uid()
  and exists (
    select 1
    from chat_threads t
    where t.id = chat_messages.thread_id
      and (
        t.parent_profile_id = auth.uid()
        or t.teacher_profile_id = auth.uid()
      )
  )
);
