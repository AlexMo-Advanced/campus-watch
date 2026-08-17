import Groq from 'groq-sdk';
import { supabase } from './supabase';

const MODEL = 'openai/gpt-oss-20b';
let _cachedKey = null;

async function getApiKey() {
  if (_cachedKey) return _cachedKey;
  const { data, error } = await supabase
    .from('secrets')
    .select('value')
    .eq('key', 'groq_api_key')
    .single();
  if (error || !data?.value) throw new Error('GEMINI_KEY_MISSING');
  _cachedKey = data.value;
  return _cachedKey;
}

async function getClient() {
  const key = await getApiKey();
  return new Groq({ apiKey: key, dangerouslyAllowBrowser: true });
}

async function chat(messages) {
  const client = await getClient();
  const res = await client.chat.completions.create({ model: MODEL, messages });
  return res.choices[0].message.content.trim();
}

/**
 * Given a free-text incident description, returns a suggested category and a
 * clean 1-sentence summary for the feed card.
 *
 * @param {string} description
 * @returns {Promise<{category: string, summary: string}>}
 */
export async function summarizeAndTagIncident(description) {
  const text = await chat([
    {
      role: 'user',
      content: `You are a campus safety assistant. Analyze this incident description and return JSON with exactly two fields:
1. "category": one of ["Safety", "Maintenance", "Vandalism", "Lost & Found", "Other"]
2. "summary": a single clean sentence (max 15 words) summarizing the incident for a campus alert feed.

Incident description: "${description}"

Respond with ONLY valid JSON, no markdown, no extra text.`,
    },
  ]);
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(clean);
  return {
    category: parsed.category || 'Other',
    summary: parsed.summary || '',
  };
}

/**
 * Checks whether the given text contains toxic, abusive, or spam content.
 *
 * @param {string} text
 * @returns {Promise<{isToxic: boolean, reason: string}>}
 */
export async function checkToxicity(text) {
  const raw = await chat([
    {
      role: 'user',
      content: `You are a content moderation assistant for a school safety app used by students.
Analyze the following report text for toxicity, abusive language, hate speech, spam, or clearly fake/joke submissions.

Text: "${text}"

Respond with ONLY valid JSON with two fields:
1. "isToxic": true or false
2. "reason": a brief user-facing explanation if toxic (e.g. "Contains inappropriate language"), or an empty string if clean.

No markdown, no extra text.`,
    },
  ]);
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(clean);
  return {
    isToxic: !!parsed.isToxic,
    reason: parsed.reason || '',
  };
}

/**
 * Generates a concise AI campus situation briefing for the Dashboard.
 *
 * @param {Array} reports - All fetched reports
 * @param {number} newCount - Reports in the last 24 hours
 * @param {number|null} nearbyCount - Reports near user GPS location (null if unavailable)
 * @returns {Promise<string>}
 */
export async function generateCampusReport(reports, newCount, nearbyCount, userContext = {}) {
  const activeReports = reports.filter((r) => r.status !== 'resolved');
  const bySeverity = { Crisis: 0, High: 0, Medium: 0, Low: 0 };
  activeReports.forEach((r) => {
    const s = r.severity || 'Low';
    bySeverity[s] = (bySeverity[s] || 0) + 1;
  });

  const byCategory = {};
  activeReports.forEach((r) => {
    const c = r.category || 'Other';
    byCategory[c] = (byCategory[c] || 0) + 1;
  });
  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, cnt]) => `${cat} (${cnt})`)
    .join(', ');

  const proximityLine =
    nearbyCount !== null
      ? `${nearbyCount} alert(s) are within 1 km of the user's current location.`
      : 'User location unavailable.';

  let contextString = '';
  if (userContext.userName) contextString += `- User Name: ${userContext.userName}\n`;
  if (userContext.personalReportsCount !== undefined) contextString += `- Incidents filed by user: ${userContext.personalReportsCount}\n`;
  if (userContext.bleInfo) contextString += `- Nearby BLE Tokens Detected: ${userContext.bleInfo}\n`;

  return chat([
    {
      role: 'system',
      content: 'You are a campus safety AI generating concise daily briefings for students on CampusWatch. You must NOT make any assumptions about administration taking action unless the report status explicitly states it.',
    },
    {
      role: 'user',
      content: `Campus data right now:
- Total active (unresolved) incidents: ${activeReports.length}
- New incidents in the last 24 hours: ${newCount}
- Severity breakdown: Crisis: ${bySeverity.Crisis}, High: ${bySeverity.High}, Medium: ${bySeverity.Medium}, Low: ${bySeverity.Low}
- Top incident categories: ${topCategories || 'None'}
- Proximity: ${proximityLine}
${contextString ? `\nUser Context:\n${contextString}` : ''}
Write a 2-3 sentence campus safety briefing. Be factual, calm, helpful, and personalize it to the user if their name is available. Mention the most important trend or concern. Do NOT use bullet points or markdown. Plain prose only.`,
    },
  ]);
}

/**
 * Multi-turn campus assistant chatbot.
 *
 * @param {Array<{role: 'user'|'model', parts: string}>} history
 * @returns {Promise<string>}
 */
export async function askCampusAssistant(history, reportContext = '', userContext = {}) {
  const client = await getClient();

  let contextString = '';
  if (userContext.userName) contextString += `- User Name: ${userContext.userName}\n`;
  if (userContext.personalReportsCount !== undefined) contextString += `- Incidents filed by user: ${userContext.personalReportsCount}\n`;
  if (userContext.bleInfo) contextString += `- Nearby BLE Tokens Detected: ${userContext.bleInfo}\n`;

  const messages = [
    {
      role: 'system',
      content: `You are CampusWatch AI — a friendly, knowledgeable campus safety assistant.
You help students with: understanding safety policies, how to report incidents, emergency procedures,
general campus questions, and wellness resources.
Be warm, concise, reassuring, and personalized. Do NOT make assumptions that administrators or security are "on it" or actively resolving an issue unless the live data explicitly says it.
If someone describes an emergency, always tell them to call 911 first.
Keep replies under 100 words unless a longer answer is clearly needed.

Here is the current live campus incident data you have access to:
${reportContext}
${contextString ? `\nHere is some context about the user you are talking to:\n${contextString}` : ''}`,
    },
    // Groq uses 'assistant' instead of Gemini's 'model'
    ...history.map((msg) => ({
      role: msg.role === 'model' ? 'assistant' : 'user',
      content: msg.parts,
    })),
  ];

  const res = await client.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 400,
  });
  return res.choices[0].message.content.trim();
}
