-- Multi-Photo Reports Migration
alter table reports add column image_urls text[];

-- Backfill existing single images into the new array
update reports 
set image_urls = array[image_url] 
where image_url is not null;

-- Alert Archiving System Schema
alter table reports add column archived boolean default false;
alter table reports add column archived_at timestamptz;
alter table reports add column expiration_date timestamptz;

create table archive_sync_acks (
  report_id uuid references reports(id) on delete cascade primary key,
  user_id uuid references auth.users(id),
  synced_at timestamptz default now()
);

alter table archive_sync_acks enable row level security;

create policy "Users can view own acks"
  on archive_sync_acks for select
  using (auth.uid() = user_id);

create policy "Users can insert own acks"
  on archive_sync_acks for insert
  with check (auth.uid() = user_id);

-- RPC: ack_archive_sync
create or replace function ack_archive_sync(p_report_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from reports
    where id = p_report_id and user_id = auth.uid()
  ) then
    raise exception 'Not authorized to ack this report';
  end if;

  insert into archive_sync_acks (report_id, user_id)
  values (p_report_id, auth.uid())
  on conflict (report_id) do nothing;
end;
$$;

-- RPC: flag_expired_reports
create or replace function flag_expired_reports()
returns void
language sql
security definer
as $$
  update reports 
  set archived = true, archived_at = now() 
  where archived = false and expiration_date <= now();
$$;

-- RPC: get_reports_for_deletion
create or replace function get_reports_for_deletion()
returns table(id uuid, image_urls text[])
language sql
security definer
as $$
  select r.id, r.image_urls
  from reports r
  left join archive_sync_acks a on r.id = a.report_id
  where r.archived = true
    and r.image_urls is not null
    and (
      (a.report_id is not null and r.archived_at <= now() - interval '3 days')
      or
      (r.archived_at <= now() - interval '30 days')
    );
$$;

-- RPC: clear_report_images
create or replace function clear_report_images(p_report_id uuid)
returns void
language sql
security definer
as $$
  update reports
  set image_urls = null, image_url = null
  where id = p_report_id;
$$;
