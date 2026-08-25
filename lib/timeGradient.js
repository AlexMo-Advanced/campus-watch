/** Time-of-day gradient palettes — shifts through the day for a living UI. */

export function getTimePeriod(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'dusk';
  if (hour >= 20 && hour < 22) return 'evening';
  return 'night';
}

export function getTimePeriodLabel(period) {
  switch (period) {
    case 'dawn': return 'Dawn';
    case 'morning': return 'Morning';
    case 'midday': return 'Midday';
    case 'afternoon': return 'Afternoon';
    case 'dusk': return 'Dusk';
    case 'evening': return 'Evening';
    default: return 'Night';
  }
}

const LIGHT_GRADIENTS = {
  // Pre-dawn purple-pink easing into soft sky
  dawn:      ['#fde8f5', '#fdd0a0', '#d9eeff'],
  // Sky blue fading to near-white — bridges from dawn's sky hint
  morning:   ['#c8e8fd', '#e6f4ff', '#f4faff'],
  // Bright sky, barely off-white — bridges from morning's pale blue
  midday:    ['#a8d8fa', '#ddf0ff', '#fafcff'],
  // Pale gold with a blue undertone — bridges from midday's sky
  afternoon: ['#fde9a2', '#fef5d7', '#d9eeff'],
  // Warm amber→soft mauve — bridges from afternoon's gold, edges toward evening violet
  dusk:      ['#fdc880', '#d8b4fe', '#4338ca'],
  // Muted indigo — bridges from dusk's mauve edge
  evening:   ['#a5b4fc', '#4338ca', '#1e1b4b'],
  // Deep indigo, consistent with evening's end
  night:     ['#1e1b4b', '#0f172a', '#020617'],
};

const DARK_GRADIENTS = {
  // Deep violet-blue easing into indigo
  dawn:      ['#2e1b6b', '#4c2d8a', '#1e2d5a'],
  // Deep navy — bridges from dawn's indigo
  morning:   ['#0e3a5e', '#1a2f50', '#0f172a'],
  // Slightly deeper navy — barely changes from morning
  midday:    ['#1a3a7a', '#1a2f50', '#0f172a'],
  // Dark amber-brown with navy base — bridges from midday's blue
  afternoon: ['#5a2e08', '#2a2040', '#0f172a'],
  // Deep violet — bridges from afternoon's warm-dark to evening
  dusk:      ['#3d1a7a', '#2e1b6b', '#0f172a'],
  // Dark indigo — bridges from dusk's violet
  evening:   ['#251a5e', '#1e1b4b', '#050510'],
  // Near-black with a blue cast — consistent with evening's end
  night:     ['#050510', '#0a0f28', '#020617'],
};

const ACCENT_GRADIENTS_LIGHT = {
  dawn: ['#f472b6', '#fb923c'],
  morning: ['#38bdf8', '#2563eb'],
  midday: ['#0ea5e9', '#6366f1'],
  afternoon: ['#f59e0b', '#2563eb'],
  dusk: ['#f97316', '#8b5cf6'],
  evening: ['#6366f1', '#4f46e5'],
  night: ['#4338ca', '#1d4ed8'],
};

const ACCENT_GRADIENTS_DARK = {
  dawn: ['#c026d3', '#ea580c'],
  morning: ['#0284c7', '#3b82f6'],
  midday: ['#2563eb', '#7c3aed'],
  afternoon: ['#d97706', '#2563eb'],
  dusk: ['#ea580c', '#7c3aed'],
  evening: ['#4f46e5', '#3730a3'],
  night: ['#312e81', '#1e40af'],
};

export function getTimeGradients(isDark, period = getTimePeriod()) {
  const backgroundGradient = isDark
    ? (DARK_GRADIENTS[period] || DARK_GRADIENTS.night)
    : (LIGHT_GRADIENTS[period] || LIGHT_GRADIENTS.morning);

  const accentGradient = isDark
    ? (ACCENT_GRADIENTS_DARK[period] || ACCENT_GRADIENTS_DARK.night)
    : (ACCENT_GRADIENTS_LIGHT[period] || ACCENT_GRADIENTS_LIGHT.morning);

  const headerTint = isDark
    ? backgroundGradient[0]
    : (period === 'dusk' || period === 'evening' || period === 'night' ? '#1e293b' : '#1e40af');

  return {
    backgroundGradient,
    accentGradient,
    headerTint,
    timePeriod: period,
    timePeriodLabel: getTimePeriodLabel(period),
  };
}
