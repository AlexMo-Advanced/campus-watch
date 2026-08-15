# BLE Proximity Alerts — Deployment

Privacy-first nearby incident priority uses Supabase Edge Functions and ephemeral BLE tokens.

## 1. Run migration

Apply `supabase/migrations/20260813_ble_proximity.sql` in the Supabase SQL editor (or `supabase db push`).

Optional pg_cron purge (if extension enabled):

```sql
select cron.schedule(
  'purge-expired-ble-tokens',
  '* * * * *',
  $$ delete from ble_tokens where expires_at < now(); $$
);
```

## 2. Deploy edge functions

```bash
supabase functions deploy ble-heartbeat
supabase functions deploy report-proximity-notify
```

Both use `SUPABASE_SERVICE_ROLE_KEY` automatically in the hosted environment.

## 3. Native build required

BLE device scanning is **disabled by default** (`lib/proximity/bleNativeEnabled.js`) because `react-native-ble-plx` + RN 0.81 + New Architecture caused instant Android crashes.

Current build uses:
- HTTP heartbeat → `ble_tokens` + geofence priority
- Lockdown UI via Supabase realtime (`report_notifications` with `priority: crisis`)
- **No native BleManager** until you opt back in

### Re-enable native BLE (after crash-free build)

1. Set `BLE_NATIVE_ENABLED = true` in `lib/proximity/bleNativeEnabled.js`
2. In `app.json`: remove `react-native-ble-plx` from `autolinking.exclude`, keep `newArchEnabled: false`
3. Add plugin back (central mode only, no background):

```json
[
  "react-native-ble-plx",
  {
    "isBackgroundEnabled": false,
    "modes": ["central"]
  }
]
```

4. Run a **new EAS build** (OTA cannot add/remove native modules):

```bash
eas build --profile preview --platform android
```

Until then, geofence + heartbeat proximity works; full BLE scan for Crisis lockdown requires the steps above.

## 4. Native build (general)

`react-native-ble-plx` requires a **custom EAS build** (not Expo Go):

```bash
eas build --profile preview --platform android
```

## 4. Crisis lockdown (BLE-only full-screen alert)

When a reporter submits a **Crisis** severity report with nearby BLE tokens:

- **Nearby BLE-matched devices** → `report_notifications.priority = 'crisis'`, `nearby = true` → full-screen red lockdown UI in the app
- **Everyone else** → normal feed + standard push notification (`priority = 'normal'`)

Apply `supabase/migrations/20260813_lockdown_crisis.sql` if not already run.

Users can disable lockdown screens in **Settings → Crisis Lockdown Alerts** (feed notifications still work).

After changing the edge function, redeploy:

```bash
npx supabase functions deploy report-proximity-notify
```

## 5. Privacy guarantees

- Tokens live in memory only on device; opt-in pref is the only persisted client flag.
- `ble_tokens` rows expire in 5 minutes; no client RLS policies on token tables.
- `report_notifications` stores `{report_id, user_id, priority}` only — never tokens or proximity pairs.
- Errors fail closed: no tokens in logs or analytics.

## 6. Priority radii

Configured in `supabase/functions/report-proximity-notify/index.ts`:

- Tight: 50m (high / critical with BLE match)
- Wide: 300m (normal tier)

Adjust after field testing at GPCHS.
