import { useColorScheme } from 'react-native';

const lightColors = {
  background: '#f8fafc',
  gradientBg: ['#e0f2fe', '#f8fafc', '#f8fafc'],
  cardBg: '#ffffff',
  cardBorder: '#e2e8f0',
  textMain: '#0f172a',
  textSub: '#64748b',
  textBody: '#334155',
  textMuted: '#94a3b8',
  primary: '#2563eb',
  primaryBg: '#eff6ff',
  primaryBorder: '#bfdbfe',
  border: '#cbd5e1',
  inputBg: '#ffffff',
  headerBg: '#f8fafc',
  icon: '#64748b',
  danger: '#ef4444',
  dangerBg: '#fef2f2',
  success: '#16a34a',
  successBg: '#f0fdf4',
  warning: '#d97706',
  warningBg: '#fffbeb',
  crisis: '#9333ea',
  crisisBg: '#faf5ff',
  pillBg: '#e2e8f0',
  placeholder: '#f1f5f9',
};

const darkColors = {
  background: '#0f172a', // Slate 900
  gradientBg: ['#1e293b', '#0f172a', '#0f172a'], // Slate 800 -> 900
  cardBg: '#1e293b', // Slate 800
  cardBorder: '#334155', // Slate 700
  textMain: '#f8fafc', // Slate 50
  textSub: '#94a3b8', // Slate 400
  textBody: '#cbd5e1', // Slate 300
  textMuted: '#64748b', // Slate 500
  primary: '#3b82f6', // Blue 500
  primaryBg: '#1e3a8a', // Blue 900
  primaryBorder: '#1e40af', // Blue 800
  border: '#334155', // Slate 700
  inputBg: '#0f172a', // Slate 900
  headerBg: '#1e293b', // Slate 800
  icon: '#94a3b8', // Slate 400
  danger: '#f87171', // Red 400
  dangerBg: '#450a0a', // Red 950
  success: '#4ade80', // Green 400
  successBg: '#052e16', // Green 950
  warning: '#fbbf24', // Amber 400
  warningBg: '#451a03', // Amber 950
  crisis: '#c084fc', // Purple 400
  crisisBg: '#3b0764', // Purple 950
  pillBg: '#334155', // Slate 700
  placeholder: '#1e293b', // Slate 800
};

export const useAppTheme = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
  };
};
