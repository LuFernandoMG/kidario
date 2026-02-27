alter table if exists booking_follow_ups
  add column if not exists objectives jsonb not null default '[]'::jsonb;

alter table if exists booking_follow_ups
  add column if not exists next_objectives jsonb not null default '[]'::jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'booking_follow_ups'
      and column_name = 'objectives'
      and udt_name = '_text'
  ) then
    alter table booking_follow_ups
      alter column objectives drop default;

    alter table booking_follow_ups
      alter column objectives type jsonb
      using coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'objective', objective_text,
              'achieved', false,
              'fullfilment_level', 0
            )
          )
          from unnest(objectives) as objective_text
        ),
        '[]'::jsonb
      );

    alter table booking_follow_ups
      alter column objectives set default '[]'::jsonb;
  end if;
end $$;

update booking_follow_ups
set next_objectives = objectives
where coalesce(jsonb_array_length(next_objectives), 0) = 0
  and coalesce(jsonb_array_length(objectives), 0) > 0;

update booking_follow_ups
set objectives = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'objective',
          coalesce(
            nullif(
              trim(
                case
                  when jsonb_typeof(item) = 'string' then trim(both '"' from item::text)
                  else item->>'objective'
                end
              ),
              ''
            ),
            'Objetivo pedagógico'
          ),
        'achieved',
          case
            when lower(coalesce(item->>'achieved', 'false')) in ('true', 't', '1') then true
            else false
          end,
        'fullfilment_level',
          case
            when coalesce(item->>'fullfilment_level', item->>'fulfilment_level') ~ '^[0-5]$'
              then (coalesce(item->>'fullfilment_level', item->>'fulfilment_level'))::int
            else 0
          end
      )
    )
    from jsonb_array_elements(coalesce(objectives, '[]'::jsonb)) as item
  ),
  '[]'::jsonb
);

update booking_follow_ups
set next_objectives = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'objective',
          coalesce(
            nullif(
              trim(
                case
                  when jsonb_typeof(item) = 'string' then trim(both '"' from item::text)
                  else item->>'objective'
                end
              ),
              ''
            ),
            'Objetivo pedagógico'
          ),
        'achieved',
          case
            when lower(coalesce(item->>'achieved', 'false')) in ('true', 't', '1') then true
            else false
          end,
        'fullfilment_level',
          case
            when coalesce(item->>'fullfilment_level', item->>'fulfilment_level') ~ '^[0-5]$'
              then (coalesce(item->>'fullfilment_level', item->>'fulfilment_level'))::int
            else 0
          end
      )
    )
    from jsonb_array_elements(coalesce(next_objectives, '[]'::jsonb)) as item
  ),
  '[]'::jsonb
);
