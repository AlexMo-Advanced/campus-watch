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
  dawn: ['#fce7f3', '#fdba74', '#e0f2fe'],
  morning: ['#bae6fd', '#e0f2fe', '#f0f9ff'],
  midday: ['#7dd3fc', '#e0f2fe', '#ffffff'],
  afternoon: ['#fde68a', '#fef3c7', '#e0f2fe'],
  dusk: ['#fdba74', '#c4b5fd', '#1e293b'],
  evening: ['#818cf8', '#312e81', '#0f172a'],
  night: ['#1e1b4b', '#0f172a', '#020617'],
};

const DARK_GRADIENTS = {
  dawn: ['#1e1b4b', '#4c1d95', '#312e81'],
  morning: ['#0c4a6e', '#1e3a5f', '#0f172a'],
  midday: ['#1e40af', '#1e3a5f', '#0f172a'],
  afternoon: ['#451a03', '#1e3a5f', '#0f172a'],
  dusk: ['#4c1d95', '#312e81', '#0f172a'],
  evening: ['#312e81', '#1e1b4b', '#020617'],
  night: ['#020617', '#0f172a', '#020617'],
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
