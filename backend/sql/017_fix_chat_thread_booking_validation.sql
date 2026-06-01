-- Keep the legacy chat trigger compatible with the normalized v2 schema.
-- v2 chat threads write parent_id + teacher_id + child_id directly.

alter table if exists public.chat_threads
  drop constraint if exists chat_threads_child_id_fkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_threads_parent_child_fkey'
      and conrelid = 'public.chat_threads'::regclass
  ) then
    alter table public.chat_threads
      add constraint chat_threads_parent_child_fkey
      foreign key (parent_id, child_id)
      references public.children(parent_id, id)
      on delete restrict
      not valid;
  end if;
end
$$;

create or replace function public.validate_chat_thread_booking_match()
returns trigger
language plpgsql
as $$
declare
  booking_parent_id uuid;
  booking_teacher_id uuid;
  booking_child_id uuid;
  booking_parent_profile_id uuid;
  booking_teacher_profile_id uuid;
begin
  select b.parent_id, b.teacher_id, b.child_id, b.parent_profile_id, b.teacher_profile_id
  into booking_parent_id, booking_teacher_id, booking_child_id, booking_parent_profile_id, booking_teacher_profile_id
  from public.bookings b
  where b.id = new.booking_id;

  if booking_child_id is null then
    raise exception 'booking_id does not exist';
  end if;

  if new.parent_id is not null then
    if booking_parent_id is null or new.parent_id <> booking_parent_id then
      raise exception 'parent_id does not match booking';
    end if;
  elsif new.parent_profile_id is not null then
    if booking_parent_profile_id is null or new.parent_profile_id <> booking_parent_profile_id then
      raise exception 'parent_profile_id does not match booking';
    end if;
  else
    raise exception 'parent_id is required';
  end if;

  if new.teacher_id is not null then
    if booking_teacher_id is null or new.teacher_id <> booking_teacher_id then
      raise exception 'teacher_id does not match booking';
    end if;
  elsif new.teacher_profile_id is not null then
    if booking_teacher_profile_id is null or new.teacher_profile_id <> booking_teacher_profile_id then
      raise exception 'teacher_profile_id does not match booking';
    end if;
  else
    raise exception 'teacher_id is required';
  end if;

  if new.child_id <> booking_child_id then
    raise exception 'child_id does not match booking';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_chat_thread_booking_match on public.chat_threads;
create trigger trg_validate_chat_thread_booking_match
before insert or update of booking_id, parent_id, teacher_id, parent_profile_id, teacher_profile_id, child_id
on public.chat_threads
for each row execute function public.validate_chat_thread_booking_match();
