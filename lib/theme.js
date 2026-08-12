export const lightColors = {
  background: '#f8fafc',
  backgroundGradient: ['#e0f2fe', '#f8fafc', '#f8fafc'],
  surface: '#ffffff',
  surfaceSecondary: '#f1f5f9',
  border: '#e2e8f0',
  borderInput: '#cbd5e1',
  text: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  textBody: '#334155',
  textLabel: '#334155',
  header: '#1e293b',
  primary: '#2563eb',
  primaryLight: '#eff6ff',
  chip: '#e2e8f0',
  chipText: '#475569',
  inputBg: '#ffffff',
  inputText: '#0f172a',
  locationSection: '#f0f9ff',
  locationSectionBorder: '#bae6fd',
  tabBarBlur: 'light',
  tabBarGlass: 'rgba(255, 255, 255, 0.25)',
  tabBarBorder: 'rgba(255, 255, 255, 0.95)',
  tabBarIcon: '#64748b',
  statusBar: 'dark',
};

export const darkColors = {
  background: '#0f172a',
  backgroundGradient: ['#0f172a', '#1e293b', '#1e293b'],
  surface: '#1e293b',
  surfaceSecondary: '#334155',
  border: '#334155',
  borderInput: '#475569',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  textBody: '#cbd5e1',
  textLabel: '#e2e8f0',
  header: '#020617',
  primary: '#3b82f6',
  primaryLight: '#1e3a5f',
  chip: '#334155',
  chipText: '#cbd5e1',
  inputBg: '#1e293b',
  inputText: '#f8fafc',
  locationSection: '#172554',
  locationSectionBorder: '#1e40af',
  tabBarBlur: 'dark',
  tabBarGlass: 'rgba(15, 23, 42, 0.72)',
  tabBarBorder: 'rgba(255, 255, 255, 0.12)',
  tabBarIcon: '#94a3b8',
  statusBar: 'light',
};

export function getThemeColors(isDark) {
  return isDark ? darkColors : lightColors;
}

export function getSeverityGradient(severity, isDark) {
  if (isDark) {
    switch (severity) {
      case 'Crisis':
        return ['#1e293b', '#3b0764'];
      case 'High':
        return ['#1e293b', '#450a0a'];
      case 'Medium':
        return ['#1e293b', '#451a03'];
      case 'Low':
        return ['#1e293b', '#052e16'];
      default:
        return ['#1e293b', '#0f172a'];
    }
  }

  switch (severity) {
    case 'Crisis':
      return ['#ffffff', '#faf5ff'];
    case 'High':
      return ['#ffffff', '#fef2f2'];
    case 'Medium':
      return ['#ffffff', '#fffbeb'];
    case 'Low':
      return ['#ffffff', '#f0fdf4'];
    default:
      return ['#ffffff', '#f8fafc'];
  }
}
