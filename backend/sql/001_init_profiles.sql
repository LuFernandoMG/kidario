create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key,
  email text not null unique,
  first_name text,
  last_name text,
  role text not null check (role in ('parent', 'teacher')),
  auth_email_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists parent_profiles (
  profile_id uuid primary key references profiles(id) on delete cascade,
  phone text,
  birth_date date,
  address text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists parent_children (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references parent_profiles(profile_id) on delete cascade,
  name text not null,
  gender text,
  age smallint,
  current_grade text,
  birth_month_year text,
  school text,
  focus_points text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_parent_children_profile_id on parent_children(profile_id);

create table if not exists teacher_profiles (
  profile_id uuid primary key references profiles(id) on delete cascade,
  phone text,
  cpf text,
  professional_registration text,
  city text,
  state text,
  modality text,
  mini_bio text,
  hourly_rate numeric(10,2),
  lesson_duration_minutes int,
  profile_photo_file_name text,
  request_experience_anonymity boolean not null default false,
  is_active_teacher boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teacher_specialties (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references teacher_profiles(profile_id) on delete cascade,
  specialty text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, specialty)
);
create index if not exists idx_teacher_specialties_profile_id on teacher_specialties(profile_id);

create table if not exists teacher_formations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references teacher_profiles(profile_id) on delete cascade,
  degree_type text not null,
  course_name text not null,
  institution text not null,
  completion_year text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_teacher_formations_profile_id on teacher_formations(profile_id);

create table if not exists teacher_experiences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references teacher_profiles(profile_id) on delete cascade,
  institution text not null,
  role text not null,
  responsibilities text not null,
  period_from text not null,
  period_to text,
  current_position boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_teacher_experiences_profile_id on teacher_experiences(profile_id);

create table if not exists teacher_availability (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references teacher_profiles(profile_id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time text not null,
  end_time text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, day_of_week, start_time, end_time)
);
create index if not exists idx_teacher_availability_profile_id on teacher_availability(profile_id);
