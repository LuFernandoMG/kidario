-- Normalize legacy parent_children.gender values to canonical enum-like text values.
-- Apply after:
--   001_init_profiles.sql
--   002_rls_profiles.sql
--
-- Canonical values:
--   girl | boy | other | prefer not to disclose

with normalized_genders as (
  select
    id,
    case
      when gender is null then null
      when btrim(gender) = '' then null
      when regexp_replace(replace(lower(btrim(gender)), '_', ' '), '\s+', ' ', 'g') in ('girl', 'feminino', 'menina') then 'girl'
      when regexp_replace(replace(lower(btrim(gender)), '_', ' '), '\s+', ' ', 'g') in ('boy', 'masculino', 'menino') then 'boy'
      when regexp_replace(replace(lower(btrim(gender)), '_', ' '), '\s+', ' ', 'g') in ('other', 'outro') then 'other'
      when regexp_replace(replace(lower(btrim(gender)), '_', ' '), '\s+', ' ', 'g') in ('prefer not to disclose', 'nao informar', 'prefiro nao informar', 'prefiro não informar') then 'prefer not to disclose'
      else null
    end as normalized_gender
  from parent_children
)
update parent_children as pc
set
  gender = ng.normalized_gender,
  updated_at = now()
from normalized_genders as ng
where pc.id = ng.id
  and pc.gender is distinct from ng.normalized_gender;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_parent_children_gender_allowed'
      and conrelid = 'parent_children'::regclass
  ) then
    alter table parent_children
      add constraint chk_parent_children_gender_allowed
      check (
        gender is null
        or gender in ('girl', 'boy', 'other', 'prefer not to disclose')
      );
  end if;
end
$$;
