-- Keep the legacy booking trigger compatible with the normalized v2 schema.
-- v2 bookings write parent_id + child_id and children is the source of truth.

alter table if exists public.bookings
  drop constraint if exists bookings_child_id_fkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_parent_child_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_parent_child_fkey
      foreign key (parent_id, child_id)
      references public.children(parent_id, id)
      on delete restrict
      not valid;
  end if;
end
$$;

create or replace function public.validate_booking_child_parent_match()
returns trigger
language plpgsql
as $$
declare
  resolved_parent_id uuid;
  resolved_parent_profile_id uuid;
begin
  if new.parent_id is not null then
    select c.parent_id
    into resolved_parent_id
    from public.children c
    where c.id = new.child_id;

    if resolved_parent_id is null then
      raise exception 'child_id does not exist in children';
    end if;

    if resolved_parent_id <> new.parent_id then
      raise exception 'child_id does not belong to parent_id';
    end if;

    return new;
  end if;

  if new.parent_profile_id is not null then
    select pc.profile_id
    into resolved_parent_profile_id
    from public.parent_children pc
    where pc.id = new.child_id;

    if resolved_parent_profile_id is null then
      raise exception 'child_id does not exist in parent_children';
    end if;

    if resolved_parent_profile_id <> new.parent_profile_id then
      raise exception 'child_id does not belong to parent_profile_id';
    end if;
  end if;

  return new;
end;
$$;
