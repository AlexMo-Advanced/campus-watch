-- Spam detection and rate limiting schema updates

alter table reports add column if not exists moderation_status text default 'pending';
-- values: 'pending' | 'approved' | 'flagged' | 'hidden' | 'appealed'
alter table reports add column if not exists spam_confidence numeric;
alter table reports add column if not exists spam_reasoning text;
alter table reports add column if not exists moderated_at timestamptz;
alter table reports add column if not exists appeal_message text;
alter table reports add column if not exists appealed_at timestamptz;

create table if not exists report_rate_limits (
  user_id uuid references auth.users(id) primary key,
  report_count int default 0,
  window_start timestamptz default now()
);
alter table report_rate_limits enable row level security;

-- Admin gating
alter table profiles add column if not exists is_admin boolean default false;

-- RLS for rate limits
create policy "Users can view their own rate limits"
  on report_rate_limits for select
  using (auth.uid() = user_id);

-- RPC for rate limiting
create or replace function check_rate_limit(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_count int;
  v_window_start timestamptz;
begin
  select report_count, window_start into v_count, v_window_start
  from report_rate_limits
  where user_id = p_user_id;

  if not found then
    insert into report_rate_limits (user_id, report_count) values (p_user_id, 1);
    return true;
  end if;

  if now() - v_window_start > interval '10 minutes' then
    update report_rate_limits
    set report_count = 1, window_start = now()
    where user_id = p_user_id;
    return true;
  end if;

  if v_count >= 5 then
    return false;
  end if;

  update report_rate_limits
  set report_count = report_count + 1
  where user_id = p_user_id;
  return true;
end;
$$;

-- Lock down check_rate_limit: only authenticated users may call it
revoke execute on function check_rate_limit(uuid) from public, anon;
grant execute on function check_rate_limit(uuid) to authenticated;

-- RLS for admin actions
create policy "Admins can update moderation fields"
  on reports for update
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- RLS for appeal submission
create policy "Users can appeal their own hidden reports"
  on reports for update
  using (auth.uid() = user_id and moderation_status = 'hidden')
  with check (moderation_status = 'appealed');
