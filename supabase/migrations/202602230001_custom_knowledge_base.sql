-- Custom Knowledge Base backend schema
-- Allows each authenticated user to store and query their own knowledge entries.

create extension if not exists pgcrypto;

create table if not exists public.custom_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0 and char_length(title) <= 200),
  content text not null check (char_length(trim(content)) > 0),
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists custom_knowledge_entries_user_id_idx
  on public.custom_knowledge_entries(user_id);

create index if not exists custom_knowledge_entries_updated_at_idx
  on public.custom_knowledge_entries(user_id, updated_at desc);

create index if not exists custom_knowledge_entries_search_idx
  on public.custom_knowledge_entries
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '')));

alter table public.custom_knowledge_entries enable row level security;


drop policy if exists "Users can read their own knowledge entries" on public.custom_knowledge_entries;
drop policy if exists "Users can insert their own knowledge entries" on public.custom_knowledge_entries;
drop policy if exists "Users can update their own knowledge entries" on public.custom_knowledge_entries;
drop policy if exists "Users can delete their own knowledge entries" on public.custom_knowledge_entries;

create policy "Users can read their own knowledge entries"
  on public.custom_knowledge_entries
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own knowledge entries"
  on public.custom_knowledge_entries
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own knowledge entries"
  on public.custom_knowledge_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own knowledge entries"
  on public.custom_knowledge_entries
  for delete
  using (auth.uid() = user_id);

create or replace function public.touch_custom_knowledge_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_custom_knowledge_entries_updated_at on public.custom_knowledge_entries;

create trigger set_custom_knowledge_entries_updated_at
before update on public.custom_knowledge_entries
for each row
execute function public.touch_custom_knowledge_entries_updated_at();
