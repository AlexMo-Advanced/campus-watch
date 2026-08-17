import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const TIGHT_RADIUS_M = 50;
const WIDE_RADIUS_M = 300;
const LOCATION_MAX_AGE_MS = 15 * 60 * 1000;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function priorityForUser(
  distanceM: number | null,
  bleMatch: boolean,
  isCrisisCategory: boolean
): 'crisis' | 'critical' | 'high' | 'normal' | null {
  const inTight = distanceM !== null && distanceM <= TIGHT_RADIUS_M;
  const inWide = distanceM !== null && distanceM <= WIDE_RADIUS_M;

  if ((bleMatch || inTight) && isCrisisCategory) return 'crisis';
  if (inTight && bleMatch) return 'critical';
  if (inTight || bleMatch) return 'high';
  if (inWide) return 'normal';
  return null;
}

function titleForPriority(priority: string, reportTitle: string) {
  if (priority === 'crisis') return '🚨 Crisis Alert — Lockdown';
  if (priority === 'critical') return 'Incident nearby — immediate attention';
  if (priority === 'high') return 'High-priority alert near you';
  return 'New campus alert';
}

function bodyForPriority(priority: string, reportTitle: string, location: string | null) {
  const loc = location ? ` at ${location}` : '';
  if (priority === 'crisis') {
    return `"${reportTitle}" — Crisis level reported very close to you${loc}. Stay safe.`;
  }
  if (priority === 'critical') {
    return `"${reportTitle}" was reported very close to you${loc}. Please stay alert.`;
  }
  if (priority === 'high') {
    return `"${reportTitle}" is nearby${loc}.`;
  }
  return `"${reportTitle}" was reported${loc}.`;
}

async function sendExpoPush(
  messages: Array<{ to: string; title: string; body: string; data: Record<string, unknown>; sound?: string }>
) {
  if (!messages.length) return;
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk),
    }).catch(() => {});
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(null, { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(null, { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const reportId = body?.report_id;
    const nearbyTokens: string[] = Array.isArray(body?.nearby_tokens)
      ? body.nearby_tokens.filter((t: unknown) => typeof t === 'string')
      : [];

    if (!reportId) {
      return new Response(null, { status: 400, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: report, error: reportError } = await admin
      .from('reports')
      .select('id, title, location, latitude, longitude, user_id, severity')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return new Response(null, { status: 404, headers: corsHeaders });
    }

    if (report.user_id !== user.id) {
      return new Response(null, { status: 403, headers: corsHeaders });
    }

    const reportLat = report.latitude;
    const reportLng = report.longitude;
    const hasReportCoords =
      typeof reportLat === 'number' &&
      typeof reportLng === 'number' &&
      !Number.isNaN(reportLat) &&
      !Number.isNaN(reportLng);

    // Resolve BLE token matches in-memory only — never persisted as pairs.
    const bleMatchedUserIds = new Set<string>();
    if (nearbyTokens.length) {
      const { data: tokenRows } = await admin
        .from('ble_tokens')
        .select('token, user_id')
        .in('token', nearbyTokens)
        .gt('expires_at', new Date().toISOString());

      for (const row of tokenRows ?? []) {
        if (row.user_id && row.user_id !== user.id) {
          bleMatchedUserIds.add(row.user_id);
        }
      }
    }

    const { data: pushRows } = await admin.from('push_tokens').select('user_id, token');
    const { data: locationRows } = await admin.from('user_last_locations').select('user_id, latitude, longitude, updated_at');

    const locationByUser = new Map<string, { lat: number; lng: number }>();
    const now = Date.now();
    for (const loc of locationRows ?? []) {
      const age = now - new Date(loc.updated_at).getTime();
      if (age <= LOCATION_MAX_AGE_MS) {
        locationByUser.set(loc.user_id, { lat: loc.latitude, lng: loc.longitude });
      }
    }

    const notifyMap = new Map<string, 'crisis' | 'critical' | 'high' | 'normal'>();

    const PRIORITY_RANK: Record<'crisis' | 'critical' | 'high' | 'normal', number> = {
      crisis: 4,
      critical: 3,
      high: 2,
      normal: 1,
    };

    for (const pushRow of pushRows ?? []) {
      const uid = pushRow.user_id;
      if (!uid || uid === user.id || !pushRow.token) continue;

      const bleMatch = bleMatchedUserIds.has(uid);
      const isCrisisSeverity = (report.severity ?? '').toLowerCase() === 'crisis';
      let distanceM: number | null = null;

      if (hasReportCoords) {
        const loc = locationByUser.get(uid);
        if (loc) {
          distanceM = haversineMeters(reportLat, reportLng, loc.lat, loc.lng);
        }
      }

      const priority = priorityForUser(distanceM, bleMatch, isCrisisSeverity);
      if (priority) {
        const existing = notifyMap.get(uid);
        if (!existing || PRIORITY_RANK[priority] > PRIORITY_RANK[existing]) {
          notifyMap.set(uid, priority);
        }
      }
    }

    // School-wide normal tier for users not already in priority path.
    for (const pushRow of pushRows ?? []) {
      const uid = pushRow.user_id;
      if (!uid || uid === user.id || !pushRow.token) continue;
      if (!notifyMap.has(uid)) {
        notifyMap.set(uid, 'normal');
      }
    }

    const pushMessages: Array<{
      to: string;
      title: string;
      body: string;
      data: Record<string, unknown>;
      sound?: string;
    }> = [];

    const notificationRows: Array<{
      report_id: string;
      user_id: string;
      priority: string;
      nearby: boolean;
    }> = [];

    for (const pushRow of pushRows ?? []) {
      const uid = pushRow.user_id;
      if (!uid || !pushRow.token) continue;
      const priority = notifyMap.get(uid);
      if (!priority) continue;

      const isNearbyBleCrisis = priority === 'crisis';

      if (uid !== user.id) {
        notificationRows.push({
          report_id: report.id,
          user_id: uid,
          priority,
          nearby: isNearbyBleCrisis || priority === 'critical' || priority === 'high',
        });
      }

      if (uid === user.id) continue;

      pushMessages.push({
        to: pushRow.token,
        title: titleForPriority(priority, report.title),
        body: bodyForPriority(priority, report.title, report.location),
        sound: priority === 'crisis' || priority === 'critical' || priority === 'high' ? 'alert.wav' : 'alert.wav',
        data: {
          reportId: report.id,
          priority,
          nearby: isNearbyBleCrisis || priority === 'critical' || priority === 'high',
          lockdown: isNearbyBleCrisis,
        },
      });
    }

    if (notificationRows.length) {
      await admin.from('report_notifications').insert(notificationRows);
    }

    await sendExpoPush(pushMessages);

    return new Response(JSON.stringify({ notified: pushMessages.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(null, { status: 500, headers: corsHeaders });
  }
});
