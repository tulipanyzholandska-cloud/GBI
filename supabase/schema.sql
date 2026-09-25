-- GetBizIdea — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- USER PLANS
create table if not exists public.user_plans (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  business_type text,
  status      text default 'active' check (status in ('active', 'archived')),
  income_potential text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- CHECKLIST TASKS (per plan)
create table if not exists public.checklist_tasks (
  id          uuid primary key default uuid_generate_v4(),
  plan_id     uuid references public.user_plans(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  task_text   text not null,
  completed   boolean default false,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

-- Row Level Security: users can only see their own data
alter table public.user_plans enable row level security;
alter table public.checklist_tasks enable row level security;

create policy "Users see own plans"
  on public.user_plans for all
  using (auth.uid() = user_id);

create policy "Users see own tasks"
  on public.checklist_tasks for all
  using (auth.uid() = user_id);

-- Auto-update updated_at on plans
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_plan_updated
  before update on public.user_plans
  for each row execute procedure public.handle_updated_at();
