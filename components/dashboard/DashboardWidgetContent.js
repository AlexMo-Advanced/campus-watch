import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../lib/ThemeContext';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import MapView, { Marker } from '../CustomMapView';

export function SecurityIndexWidget({ statusInfo, activeCount, colors }) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.widgetHeader}>
        <Ionicons name="shield-checkmark" size={20} color={statusInfo.color} />
        <Text style={[styles.widgetTitle, { color: colors.text }]}>{t('dashboard.securityIndex')}</Text>
      </View>
      <View style={styles.scoreContainer}>
        <Text style={[styles.scorePercent, { color: statusInfo.color }]}>{statusInfo.score}%</Text>
        <View style={[styles.statusTag, { backgroundColor: statusInfo.color }]}>
          <Text style={styles.statusTagText}>{statusInfo.label}</Text>
        </View>
      </View>
      <Text style={[styles.widgetSubtext, { color: colors.textSecondary }]}>
        {t('dashboard.activeIncidents', { count: activeCount })}
      </Text>
    </>
  );
}

function AiBriefShell({ loading, children, colors }) {
  const theme = useTheme();
  const activeColors = colors || theme.colors;
  const isDark = theme.isDark;

  const gradientColors = activeColors?.backgroundGradient || (isDark
    ? ['#0f172a', '#1e293b', '#0f172a']
    : ['#e0f2fe', '#f8fafc', '#e0f2fe']);

  const accentGradient = activeColors?.accentGradient || ['#38bdf8', '#2563eb'];

  // Ambient animated shimmer orb moving horizontally
  const orbTranslateX = useSharedValue(-80);
  const orbOpacity = useSharedValue(0.25);

  useEffect(() => {
    orbTranslateX.value = withRepeat(
      withTiming(240, { duration: 4500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    orbOpacity.value = withRepeat(
      withTiming(0.55, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [orbTranslateX, orbOpacity]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: orbTranslateX.value }],
    opacity: orbOpacity.value,
  }));

  const borderColor = isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(37, 99, 235, 0.22)';
  const glassOverlay = isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.5)';

  return (
    <View style={[styles.aiBriefShell, { borderColor, borderWidth: 1 }]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Animated time-of-day accent shimmer orb */}
      <Animated.View style={[StyleSheet.absoluteFillObject, orbStyle]}>
        <LinearGradient
          colors={[accentGradient[0] + '40', 'transparent', accentGradient[1] + '40']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <View style={[styles.aiBriefContent, { backgroundColor: glassOverlay }]}>
        {children}
      </View>
    </View>
  );
}

export function AiBriefingWidget({ aiLoading, aiReport, colors, onOpenBriefing }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const activeColors = colors || theme.colors;
  const isDark = theme.isDark;
  const timePeriodLabel = theme.colors.timePeriodLabel || 'Campus';

  // Sparkle pulse animation
  const sparkleScale = useSharedValue(1);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    sparkleScale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [sparkleScale]);

  const animatedSparkleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkleScale.value }],
  }));

  const animatedPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  if (aiLoading) {
    return (
      <AiBriefShell loading colors={activeColors}>
        <AiLoadingContent colors={activeColors} />
      </AiBriefShell>
    );
  }
  if (!aiReport) return null;

  const titleColor = isDark ? '#f0f9ff' : '#0f172a';
  const textColor = isDark ? '#dbeafe' : '#1e293b';
  const subColor = isDark ? '#93c5fd' : '#2563eb';
  const badgeBg = isDark ? 'rgba(37, 99, 235, 0.85)' : activeColors.primary;
  const tagBg = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(37, 99, 235, 0.12)';

  const content = (
    <Animated.View entering={FadeInDown.duration(400).springify()}>
      <View style={styles.widgetHeader}>
        <Animated.View style={[styles.aiIconBadge, { backgroundColor: badgeBg }, animatedSparkleStyle]}>
          <Ionicons name="sparkles" size={14} color="#ffffff" />
        </Animated.View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.widgetTitle, { color: titleColor }]}>{t('dashboard.aiBriefing')}</Text>
          <View style={[styles.timePeriodBadge, { backgroundColor: tagBg }]}>
            <Text style={[styles.timePeriodText, { color: subColor }]}>{timePeriodLabel}</Text>
          </View>
        </View>
        {onOpenBriefing ? (
          <Ionicons name="expand-outline" size={16} color={subColor} style={{ marginLeft: 'auto' }} />
        ) : null}
      </View>
      <Text style={[styles.aiReportText, { color: textColor }]} numberOfLines={6}>
        {aiReport}
      </Text>
      <Text style={[styles.aiFooter, { color: subColor }]}>
        {onOpenBriefing ? t('dashboard.tapFullBriefing') : ''}
        {t('dashboard.aiGeneratedBy')}
        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </Animated.View>
  );

  if (!onOpenBriefing) {
    return <AiBriefShell colors={activeColors}>{content}</AiBriefShell>;
  }

  return (
    <AiBriefShell colors={activeColors}>
      <Animated.View style={animatedPressStyle}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onOpenBriefing}
          onPressIn={() => { pressScale.value = withSpring(0.97); }}
          onPressOut={() => { pressScale.value = withSpring(1); }}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.aiBriefing')}
        >
          {content}
        </TouchableOpacity>
      </Animated.View>
    </AiBriefShell>
  );
}

function AiLoadingContent({ colors }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.isDark;
  const shimmer = useSharedValue(0);
  const scanLine = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true);
    scanLine.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.linear }), -1, false);
  }, [shimmer, scanLine]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.8]),
  }));

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scanLine.value, [0, 1], [0, 80]) }],
    opacity: interpolate(scanLine.value, [0, 0.2, 0.8, 1], [0, 0.8, 0.8, 0]),
  }));

  const titleColor = isDark ? '#f0f9ff' : '#0f172a';
  const subColor = isDark ? '#93c5fd' : '#2563eb';
  const barBg = isDark ? 'rgba(147,197,253,0.25)' : 'rgba(37,99,235,0.2)';

  return (
    <>
      <Animated.View style={[styles.scanBeam, scanLineStyle]} />
      <View style={styles.widgetHeader}>
        <Ionicons name="sparkles" size={18} color={subColor} />
        <Text style={[styles.widgetTitle, { color: titleColor }]}>{t('dashboard.aiBriefing')}</Text>
        <ActivityIndicator size="small" color={subColor} style={{ marginLeft: 'auto' }} />
      </View>
      <Text style={{ color: subColor, fontSize: 12, fontStyle: 'italic' }}>{t('dashboard.analyzing')}</Text>
      {[1, 0.85, 0.65].map((w, i) => (
        <Animated.View
          key={i}
          style={[styles.shimmerLine, shimmerStyle, { width: `${w * 100}%`, backgroundColor: barBg }]}
        />
      ))}
    </>
  );
}

export function NewestAlertsWidget({ latestAlerts, colors, onOpenFeed }) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.widgetHeader}>
        <Ionicons name="notifications" size={20} color={colors.primary} />
        <Text style={[styles.widgetTitle, { color: colors.text }]}>{t('dashboard.newestAlerts')}</Text>
      </View>
      {latestAlerts.length > 0 ? (
        latestAlerts.map((alert) => (
          <TouchableOpacity key={alert.id} style={styles.alertPreview} onPress={onOpenFeed}>
            <Text style={[styles.alertPreviewTitle, { color: colors.text }]} numberOfLines={1}>
              • {alert.title}
            </Text>
            <Text style={[styles.alertPreviewLoc, { color: colors.textSecondary }]}>{alert.location}</Text>
          </TouchableOpacity>
        ))
      ) : (
        <Text style={[styles.emptyWidgetText, { color: colors.textMuted }]}>{t('dashboard.noRecentAlerts')}</Text>
      )}
    </>
  );
}

export function EmergencyWidget({ colors }) {
  const { t } = useTranslation();
  return (
    <>
      <View style={styles.widgetHeader}>
        <Ionicons name="call" size={20} color="#dc2626" />
        <Text style={[styles.widgetTitle, { color: colors.text }]}>{t('dashboard.emergencyHotlines')}</Text>
      </View>
      <TouchableOpacity style={[styles.contactBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => Linking.openURL('tel:911')}>
        <Ionicons name="alert-circle" size={16} color="#dc2626" />
        <Text style={[styles.contactText, { color: '#dc2626' }]}>{t('dashboard.campusPolice')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.contactBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => Linking.openURL('tel:7805550199')}>
        <Ionicons name="medkit" size={16} color={colors.primary} />
        <Text style={[styles.contactText, { color: colors.text }]}>{t('dashboard.firstAid')}</Text>
      </TouchableOpacity>
    </>
  );
}

export function SafetyGuidelinesWidget({ colors }) {
  const { t } = useTranslation();
  const lines = [
    t('dashboard.guideline1'),
    t('dashboard.guideline2'),
    t('dashboard.guideline3'),
  ];
  return (
    <>
      <View style={styles.widgetHeader}>
        <Ionicons name="book" size={20} color="#059669" />
        <Text style={[styles.widgetTitle, { color: colors.text }]}>{t('dashboard.safetyGuidelines')}</Text>
      </View>
      {lines.map((line) => (
        <View key={line} style={styles.protocolRow}>
          <Ionicons name="checkmark-circle" size={14} color="#059669" />
          <Text style={[styles.protocolText, { color: colors.textBody }]}>{line}</Text>
        </View>
      ))}
    </>
  );
}

export function CampusMapWidget({ mapReports, colors, onOpenMap }) {
  const { t } = useTranslation();
  const region = mapReports[0]
    ? {
      latitude: mapReports[0].latitude,
      longitude: mapReports[0].longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }
    : {
      latitude: 55.1707,
      longitude: -118.7947,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };

  return (
    <>
      <View style={styles.widgetHeader}>
        <Ionicons name="map" size={20} color={colors.primary} />
        <Text style={[styles.widgetTitle, { color: colors.text }]}>{t('dashboard.campusMap')}</Text>
      </View>
      <TouchableOpacity style={styles.miniMapWrap} activeOpacity={0.9} onPress={onOpenMap}>
        <MapView style={styles.miniMap} initialRegion={region} scrollEnabled={false} zoomEnabled={false} pointerEvents="none">
          {mapReports.slice(0, 8).map((r) => (
            <Marker key={r.id} coordinate={{ latitude: r.latitude, longitude: r.longitude }} pinColor={colors.primary} />
          ))}
        </MapView>
        <View style={styles.mapOverlay}>
          <Text style={styles.mapOverlayText}>{t('dashboard.tapOpenMap')}</Text>
        </View>
      </TouchableOpacity>
    </>
  );
}

export function InstantReportWidget({ colors, onInstantReport }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity style={styles.instantBtn} activeOpacity={0.88} onPress={onInstantReport}>
      <LinearGradient colors={['#2563eb', '#1d4ed8']} style={StyleSheet.absoluteFillObject} />
      <Ionicons name="camera" size={28} color="#ffffff" />
      <Text style={styles.instantTitle}>{t('dashboard.quickPhotoReport')}</Text>
      <Text style={styles.instantSub}>{t('dashboard.snapAndPost')}</Text>
    </TouchableOpacity>
  );
}

export function AiShortcutWidget({ colors, onOpenAi }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity style={[styles.shortcutBtn, { backgroundColor: colors.primaryLight, borderColor: colors.border }]} onPress={onOpenAi}>
      <Ionicons name="sparkles" size={24} color={colors.primary} />
      <Text style={[styles.shortcutTitle, { color: colors.text }]}>{t('dashboard.askAi')}</Text>
      <Text style={[styles.shortcutSub, { color: colors.textSecondary }]}>{t('dashboard.campusAssistant')}</Text>
    </TouchableOpacity>
  );
}

export function ActiveStatsWidget({ reports, colors }) {
  const { t } = useTranslation();
  const active = reports.filter((r) => r.status !== 'resolved');
  const crisis = active.filter((r) => r.severity === 'Crisis' || r.severity === 'High').length;
  return (
    <>
      <View style={styles.widgetHeader}>
        <Ionicons name="pulse" size={20} color={colors.primary} />
        <Text style={[styles.widgetTitle, { color: colors.text }]}>{t('dashboard.activeIncidentsTitle')}</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={[styles.statPill, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.statNum, { color: colors.primary }]}>{active.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('dashboard.open')}</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: '#fee2e2' }]}>
          <Text style={[styles.statNum, { color: '#dc2626' }]}>{crisis}</Text>
          <Text style={[styles.statLabel, { color: '#991b1b' }]}>{t('dashboard.highPlus')}</Text>
        </View>
      </View>
    </>
  );
}

export function renderDashboardWidget(type, props) {
  switch (type) {
    case 'security_index':
      return <SecurityIndexWidget {...props} />;
    case 'ai_briefing':
      return <AiBriefingWidget {...props} />;
    case 'newest_alerts':
      return <NewestAlertsWidget {...props} />;
    case 'emergency':
      return <EmergencyWidget {...props} />;
    case 'safety_guidelines':
      return <SafetyGuidelinesWidget {...props} />;
    case 'campus_map':
      return <CampusMapWidget {...props} />;
    case 'instant_report':
      return <InstantReportWidget {...props} />;
    case 'ai_shortcut':
      return <AiShortcutWidget {...props} />;
    case 'active_stats':
      return <ActiveStatsWidget {...props} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  widgetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  widgetTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  scoreContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 },
  scorePercent: { fontSize: 32, fontWeight: '900' },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusTagText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  widgetSubtext: { fontSize: 12, marginTop: 2 },
  aiBriefShell: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 140,
  },
  aiBriefContent: {
    flex: 1,
    padding: 14,
  },
  aiIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePeriodBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  timePeriodText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scanBeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(59,130,246,0.6)',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
  },
  aiReportText: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  aiFooter: { fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  shimmerLine: { height: 10, borderRadius: 5, marginTop: 8 },
  alertPreview: { paddingVertical: 5 },
  alertPreviewTitle: { fontSize: 14, fontWeight: '600' },
  alertPreviewLoc: { fontSize: 12, marginLeft: 10 },
  emptyWidgetText: { fontSize: 13 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8, marginTop: 4 },
  contactText: { marginLeft: 8, fontWeight: '600', fontSize: 13 },
  protocolRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  protocolText: { marginLeft: 6, fontSize: 12, fontWeight: '500', flex: 1 },
  miniMapWrap: { height: 140, borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  miniMap: { flex: 1 },
  mapOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15,23,42,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mapOverlayText: { color: '#f8fafc', fontSize: 10, fontWeight: '700' },
  instantBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 4,
    minHeight: 110,
  },
  instantTitle: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  instantSub: { color: '#bfdbfe', fontSize: 11, fontWeight: '600' },
  shortcutBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 4,
    minHeight: 110,
  },
  shortcutTitle: { fontWeight: '800', fontSize: 14 },
  shortcutSub: { fontSize: 11, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  statPill: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
});
