-- Keep the legacy chat message trigger compatible with the normalized v2 schema.
-- v2 chat messages write sender_user_id, while the legacy trigger expected sender_profile_id.

create or replace function public.validate_chat_message_sender()
returns trigger
language plpgsql
as $$
declare
  sender_user_id uuid;
  resolved_parent_user_id uuid;
  resolved_teacher_user_id uuid;
  resolved_parent_profile_id uuid;
  resolved_teacher_profile_id uuid;
begin
  if new.sender_user_id is not null
    and new.sender_profile_id is not null
    and new.sender_user_id <> new.sender_profile_id
  then
    raise exception 'sender_user_id does not match sender_profile_id';
  end if;

  sender_user_id := coalesce(new.sender_user_id, new.sender_profile_id);

  if sender_user_id is null then
    raise exception 'sender_user_id is required';
  end if;

  select p.user_id, teacher.user_id, t.parent_profile_id, t.teacher_profile_id
  into resolved_parent_user_id, resolved_teacher_user_id, resolved_parent_profile_id, resolved_teacher_profile_id
  from public.chat_threads t
  left join public.parents p on p.id = t.parent_id
  left join public.teachers teacher on teacher.id = t.teacher_id
  where t.id = new.thread_id;

  if not found then
    raise exception 'thread_id does not exist';
  end if;

  if not coalesce(sender_user_id = resolved_parent_user_id, false)
    and not coalesce(sender_user_id = resolved_teacher_user_id, false)
    and not coalesce(sender_user_id = resolved_parent_profile_id, false)
    and not coalesce(sender_user_id = resolved_teacher_profile_id, false)
  then
    raise exception 'sender_user_id is not part of this chat thread';
  end if;

  new.sender_user_id := sender_user_id;
  return new;
end;
$$;

drop trigger if exists trg_validate_chat_message_sender on public.chat_messages;
create trigger trg_validate_chat_message_sender
before insert or update of thread_id, sender_user_id, sender_profile_id
on public.chat_messages
for each row execute function public.validate_chat_message_sender();
