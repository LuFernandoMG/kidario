begin;

alter table public.teacher_payout_profiles
  add column if not exists birthdate date,
  add column if not exists monthly_income_cents integer,
  add column if not exists professional_occupation text;

do $$
begin
  alter table public.teacher_payout_profiles
    add constraint teacher_payout_profiles_monthly_income_positive
    check (monthly_income_cents is null or monthly_income_cents > 0);
exception
  when duplicate_object then null;
end
$$;

commit;
