create table if not exists public.user_widgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  widget_type text not null,
  grid_x integer not null,
  grid_y integer not null,
  width integer not null default 1,
  height integer not null default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_widgets enable row level security;

-- Policies
create policy "Users can view their own widgets"
  on public.user_widgets for select
  using (auth.uid() = user_id);

create policy "Users can insert their own widgets"
  on public.user_widgets for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own widgets"
  on public.user_widgets for update
  using (auth.uid() = user_id);

create policy "Users can delete their own widgets"
  on public.user_widgets for delete
  using (auth.uid() = user_id);

-- Index for faster queries by user_id
create index if not exists user_widgets_user_id_idx on public.user_widgets(user_id);
