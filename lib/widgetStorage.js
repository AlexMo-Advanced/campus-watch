import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@campus_watch_widgets';

export const ALL_WIDGETS = [
  { id: 'security',   label: 'Campus Security Index', icon: 'shield-checkmark', defaultSize: 'full' },
  { id: 'ai',         label: 'AI Campus Briefing',    icon: 'sparkles',         defaultSize: 'full' },
  { id: 'alerts',     label: 'Newest Alerts',         icon: 'notifications',    defaultSize: 'full' },
  { id: 'hotlines',   label: 'Emergency Hotlines',    icon: 'call',             defaultSize: 'full' },
  { id: 'guidelines', label: 'Safety Guidelines',     icon: 'book',             defaultSize: 'full' },
  { id: 'map',        label: 'Campus Map',            icon: 'map',              defaultSize: 'full' },
  { id: 'report',     label: 'Quick Report',          icon: 'add-circle',       defaultSize: 'half' },
  { id: 'stats',      label: 'Report Stats',          icon: 'bar-chart',        defaultSize: 'half' },
];

const DEFAULT_LAYOUT = ALL_WIDGETS.slice(0, 5).map((w) => ({
  id: w.id,
  size: w.defaultSize,
}));

export async function loadWidgetLayout() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const saved = JSON.parse(raw);
    // Ensure any new widgets added to ALL_WIDGETS aren't lost
    return Array.isArray(saved) ? saved : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export async function saveWidgetLayout(layout) {
  await AsyncStorage.setItem(KEY, JSON.stringify(layout));
}
