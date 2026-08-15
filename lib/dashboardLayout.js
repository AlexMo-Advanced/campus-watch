import AsyncStorage from '@react-native-async-storage/async-storage';

export const DASHBOARD_LAYOUT_KEY = '@campus_watch_dashboard_layout';

export const WIDGET_SIZES = {
  sm: { label: 'S', height: 128, flex: 1 },
  md: { label: 'M', height: 168, flex: 1.25 },
  lg: { label: 'L', height: 220, flex: 1.6 },
};

export const WIDGET_WIDTHS = {
  half: { label: 'Half', flex: 0.5 },
  full: { label: 'Full', flex: 1 },
};

export const WIDGET_CATALOG = {
  security_index: {
    type: 'security_index',
    title: 'Campus Security Index',
    icon: 'shield-checkmark',
    description: 'Live safety score based on open incidents',
    defaultSize: 'md',
    defaultWidth: 'full',
  },
  ai_briefing: {
    type: 'ai_briefing',
    title: 'AI Campus Briefing',
    icon: 'sparkles',
    description: 'PinayAI summary of campus activity',
    defaultSize: 'lg',
    defaultWidth: 'full',
  },
  newest_alerts: {
    type: 'newest_alerts',
    title: 'Newest Alerts',
    icon: 'notifications',
    description: 'Latest incidents from the feed',
    defaultSize: 'md',
    defaultWidth: 'full',
  },
  emergency: {
    type: 'emergency',
    title: 'Emergency Hotlines',
    icon: 'call',
    description: 'Quick dial campus police & first aid',
    defaultSize: 'md',
    defaultWidth: 'half',
  },
  safety_guidelines: {
    type: 'safety_guidelines',
    title: 'Safety Guidelines',
    icon: 'book',
    description: 'Campus safety reminders',
    defaultSize: 'md',
    defaultWidth: 'half',
  },
  campus_map: {
    type: 'campus_map',
    title: 'Campus Map',
    icon: 'map',
    description: 'Mini map with nearby incidents',
    defaultSize: 'lg',
    defaultWidth: 'full',
  },
  instant_report: {
    type: 'instant_report',
    title: 'Instant Report',
    icon: 'camera',
    description: 'Jump straight to quick photo reporting',
    defaultSize: 'sm',
    defaultWidth: 'half',
  },
  ai_shortcut: {
    type: 'ai_shortcut',
    title: 'AI Assistant',
    icon: 'chatbubble-ellipses',
    description: 'Open the campus AI chat',
    defaultSize: 'sm',
    defaultWidth: 'half',
  },
  active_stats: {
    type: 'active_stats',
    title: 'Active Incidents',
    icon: 'pulse',
    description: 'Counts of open alerts by severity',
    defaultSize: 'sm',
    defaultWidth: 'full',
  },
};

export const DEFAULT_DASHBOARD_LAYOUT = [
  { id: 'w_security', type: 'security_index', size: 'md', width: 'full' },
  { id: 'w_ai', type: 'ai_briefing', size: 'lg', width: 'full' },
  { id: 'w_alerts', type: 'newest_alerts', size: 'md', width: 'full' },
  { id: 'w_emergency', type: 'emergency', size: 'md', width: 'half' },
  { id: 'w_guidelines', type: 'safety_guidelines', size: 'md', width: 'half' },
];

function makeId(type) {
  return `w_${type}_${Date.now().toString(36)}`;
}

export function createWidget(type) {
  const meta = WIDGET_CATALOG[type];
  if (!meta) return null;
  return {
    id: makeId(type),
    type,
    size: meta.defaultSize,
    width: meta.defaultWidth,
  };
}

export async function loadDashboardLayout() {
  try {
    const raw = await AsyncStorage.getItem(DASHBOARD_LAYOUT_KEY);
    if (!raw) return DEFAULT_DASHBOARD_LAYOUT;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_DASHBOARD_LAYOUT;
    return parsed.filter((w) => WIDGET_CATALOG[w.type]);
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT;
  }
}

export async function saveDashboardLayout(layout) {
  await AsyncStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(layout));
}

/** Restore the original default home screen widget layout. */
export async function resetDashboardLayout() {
  await AsyncStorage.removeItem(DASHBOARD_LAYOUT_KEY);
  return DEFAULT_DASHBOARD_LAYOUT.map((widget) => ({ ...widget }));
}

export function cycleSize(current) {
  const order = ['sm', 'md', 'lg'];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

export function toggleWidth(current) {
  return current === 'full' ? 'half' : 'full';
}

export const SIZE_ORDER = ['sm', 'md', 'lg'];

export function heightForSize(size) {
  return WIDGET_SIZES[size]?.height || WIDGET_SIZES.md.height;
}

export function widthFractionForWidth(width) {
  return width === 'half' ? 0.485 : 1;
}

/** Snap dragged dimensions to the nearest supported widget size/width. */
export function snapWidgetDimensions(height, widthFraction) {
  let size = 'md';
  if (height < 148) size = 'sm';
  else if (height >= 194) size = 'lg';

  const width = widthFraction >= 0.74 ? 'full' : 'half';
  return { size, width };
}

export function pointInRect(x, y, rect) {
  if (!rect) return false;
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
