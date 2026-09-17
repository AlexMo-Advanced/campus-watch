import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Pass 1: Flag expirations
    const { error: flagError } = await supabaseClient.rpc('flag_expired_reports')
    if (flagError) throw flagError

    // Pass 2: Delete images for archived reports that are synced and past grace period, or past hard cap
    const { data: reportsToDelete, error: getError } = await supabaseClient.rpc('get_reports_for_deletion')
    if (getError) throw getError

    let deletedCount = 0;

    for (const report of reportsToDelete || []) {
      if (report.image_urls && report.image_urls.length > 0) {
        // Extract paths from public URLs
        const pathsToDelete = report.image_urls.map(url => {
          const parts = url.split('/reports/')
          return parts.length > 1 ? parts[1] : null
        }).filter(Boolean)

        if (pathsToDelete.length > 0) {
          const { error: storageError } = await supabaseClient.storage.from('reports').remove(pathsToDelete)
          if (storageError) {
            console.error('Error removing files:', storageError)
            continue
          }
        }
      }
      
      // Clear URLs from DB
      const { error: clearError } = await supabaseClient.rpc('clear_report_images', { p_report_id: report.id })
      if (!clearError) {
        deletedCount++;
      }
    }

    return new Response(
      JSON.stringify({ message: `Successfully flagged expirations and deleted images for ${deletedCount} reports` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
