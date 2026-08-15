-- Run in Supabase SQL editor to enable likes on comments and incident reports.
-- Uses uuid FKs to match comments.id and reports.id in this project.
-- Safe to re-run (idempotent).

-- If a previous attempt used wrong column types, run first:
-- drop table if exists public.comment_likes cascade;
-- drop table if exists public.report_likes cascade;

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create table if not exists public.report_likes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (report_id, user_id)
);

alter table public.comment_likes enable row level security;
alter table public.report_likes enable row level security;

drop policy if exists "Anyone can read comment likes" on public.comment_likes;
drop policy if exists "Authenticated users can like comments" on public.comment_likes;
drop policy if exists "Users can unlike their comment likes" on public.comment_likes;

create policy "Anyone can read comment likes"
  on public.comment_likes for select using (true);

create policy "Authenticated users can like comments"
  on public.comment_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike their comment likes"
  on public.comment_likes for delete
  using (auth.uid() = user_id);

drop policy if exists "Anyone can read report likes" on public.report_likes;
drop policy if exists "Authenticated users can like reports" on public.report_likes;
drop policy if exists "Users can unlike their report likes" on public.report_likes;

create policy "Anyone can read report likes"
  on public.report_likes for select using (true);

create policy "Authenticated users can like reports"
  on public.report_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike their report likes"
  on public.report_likes for delete
  using (auth.uid() = user_id);

create index if not exists comment_likes_comment_id_idx on public.comment_likes(comment_id);
create index if not exists report_likes_report_id_idx on public.report_likes(report_id);
