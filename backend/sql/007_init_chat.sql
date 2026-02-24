create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id) on delete cascade,
  parent_profile_id uuid not null references parent_profiles(profile_id) on delete restrict,
  teacher_profile_id uuid not null references teacher_profiles(profile_id) on delete restrict,
  child_id uuid not null references parent_children(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

create index if not exists idx_chat_threads_parent_profile_id on chat_threads(parent_profile_id);
create index if not exists idx_chat_threads_teacher_profile_id on chat_threads(teacher_profile_id);
create index if not exists idx_chat_threads_last_message_at on chat_threads(last_message_at desc nulls last);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  sender_profile_id uuid not null references profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_thread_created_at on chat_messages(thread_id, created_at desc);
create index if not exists idx_chat_messages_sender_profile_id on chat_messages(sender_profile_id);

create or replace function validate_chat_thread_booking_match()
returns trigger
language plpgsql
as $$
declare
  booking_parent_id uuid;
  booking_teacher_id uuid;
  booking_child_id uuid;
begin
  select parent_profile_id, teacher_profile_id, child_id
  into booking_parent_id, booking_teacher_id, booking_child_id
  from bookings
  where id = new.booking_id;

  if booking_parent_id is null then
    raise exception 'booking_id does not exist';
  end if;

  if new.parent_profile_id <> booking_parent_id then
    raise exception 'parent_profile_id does not match booking';
  end if;

  if new.teacher_profile_id <> booking_teacher_id then
    raise exception 'teacher_profile_id does not match booking';
  end if;

  if new.child_id <> booking_child_id then
    raise exception 'child_id does not match booking';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_chat_thread_booking_match on chat_threads;
create trigger trg_validate_chat_thread_booking_match
before insert or update of booking_id, parent_profile_id, teacher_profile_id, child_id
on chat_threads
for each row
execute function validate_chat_thread_booking_match();

create or replace function validate_chat_message_sender()
returns trigger
language plpgsql
as $$
declare
  resolved_parent_id uuid;
  resolved_teacher_id uuid;
begin
  select parent_profile_id, teacher_profile_id
  into resolved_parent_id, resolved_teacher_id
  from chat_threads
  where id = new.thread_id;

  if resolved_parent_id is null then
    raise exception 'thread_id does not exist';
  end if;

  if new.sender_profile_id <> resolved_parent_id and new.sender_profile_id <> resolved_teacher_id then
    raise exception 'sender_profile_id is not part of this chat thread';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_chat_message_sender on chat_messages;
create trigger trg_validate_chat_message_sender
before insert on chat_messages
for each row
execute function validate_chat_message_sender();

create or replace function touch_chat_thread_on_new_message()
returns trigger
language plpgsql
as $$
begin
  update chat_threads
  set
    last_message_at = new.created_at,
    updated_at = new.created_at
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_chat_thread_on_new_message on chat_messages;
create trigger trg_touch_chat_thread_on_new_message
after insert on chat_messages
for each row
execute function touch_chat_thread_on_new_message();
