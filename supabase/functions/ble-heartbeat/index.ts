import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const token = typeof body?.token === 'string' ? body.token.trim() : '';

    if (!UUID_RE.test(token)) {
      return new Response(null, { status: 400, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    await admin.from('ble_tokens').upsert({
      token,
      user_id: user.id,
      last_heartbeat_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    const latitude = body?.latitude;
    const longitude = body?.longitude;

    if (typeof latitude === 'number' && typeof longitude === 'number') {
      await admin.from('user_last_locations').upsert({
        user_id: user.id,
        latitude,
        longitude,
        updated_at: now.toISOString(),
      });
    }

    return new Response(null, { status: 200, headers: corsHeaders });
  } catch {
    return new Response(null, { status: 500, headers: corsHeaders });
  }
});
