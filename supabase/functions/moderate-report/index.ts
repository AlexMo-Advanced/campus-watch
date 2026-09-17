import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const groqApiKey = Deno.env.get('EXPO_PUBLIC_GROQ_API_KEY') || Deno.env.get('GROQ_API_KEY');

serve(async (req) => {
  try {
    const payload = await req.json();
    const report = payload.record;

    if (!report || payload.type !== 'INSERT') {
      return new Response("Not an INSERT event", { status: 200 });
    }

    if (!groqApiKey) {
      console.warn("No Groq API key found. Defaulting to approved.");
      await updateReportStatus(report.id, 'approved', 0, 'No Groq API key');
      return new Response("No API key", { status: 200 });
    }

    const contentToModerate = `Title: ${report.title}\nDescription: ${report.description}\nCategory: ${report.category}`;
    
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are an automated moderation system for a campus safety app. Your job is to determine if an incident report is spam, abusive, or highly irrelevant. Return ONLY a JSON object with three fields: 'is_spam' (boolean), 'confidence' (number 0-100), and 'reasoning' (short text string explaining why). Bias toward 'legitimate' or 'needs_review' over 'spam' when uncertain. Do NOT block legitimate reports."
          },
          {
            role: "user",
            content: `Please moderate this report:\n\n${contentToModerate}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${await response.text()}`);
    }

    const aiResult = await response.json();
    const content = JSON.parse(aiResult.choices[0].message.content);
    
    const status = content.is_spam ? 'flagged' : 'approved';

    await updateReportStatus(report.id, status, content.confidence, content.reasoning);

    return new Response(JSON.stringify({ status: "success", moderation: status }), { 
      headers: { "Content-Type": "application/json" },
      status: 200 
    });
  } catch (error) {
    console.error("Error processing moderation:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

async function updateReportStatus(reportId: string, status: string, confidence: number, reasoning: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase
    .from('reports')
    .update({ 
      moderation_status: status,
      spam_confidence: confidence,
      spam_reasoning: reasoning,
      moderated_at: new Date().toISOString()
    })
    .eq('id', reportId);

  if (error) {
    console.error("Error updating report:", error);
    throw error;
  }
}
