-- Privacy-first BLE proximity alert infrastructure.
-- ble_tokens: ephemeral, TTL-based. No client RLS policies (edge-function only).
-- user_last_locations: coarse position for geofence priority (updated via heartbeat only).
-- report_notifications: delivery audit without tokens or proximity pairs.

create table if not exists ble_tokens (
  token uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

create index if not exists ble_tokens_expires_at_idx on ble_tokens (expires_at);
create index if not exists ble_tokens_user_id_idx on ble_tokens (user_id);

alter table ble_tokens enable row level security;

create table if not exists user_last_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz not null default now()
);

alter table user_last_locations enable row level security;

create table if not exists report_notifications (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  priority text not null check (priority in ('critical', 'high', 'normal')),
  delivered_at timestamptz not null default now()
);

create index if not exists report_notifications_report_id_idx on report_notifications (report_id);
create index if not exists report_notifications_user_id_idx on report_notifications (user_id);

alter table report_notifications enable row level security;

create policy "Users read own report notifications"
  on report_notifications for select
  using (auth.uid() = user_id);

-- Purge expired BLE tokens (run manually or via pg_cron if enabled on project):
-- delete from ble_tokens where expires_at < now();
