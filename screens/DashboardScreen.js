import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInUp,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useTabBarScrollHandler } from '../lib/TabBarScrollContext';
import { getTabBarClearance } from '../lib/tabBarLayout';
import { useTheme } from '../lib/ThemeContext';
import { generateCampusReport } from '../lib/gemini';
import { useNetwork } from '../lib/NetworkContext';

export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { onScroll, scrollEventThrottle } = useTabBarScrollHandler();
  const tabBarPadding = getTabBarClearance(insets);
  const { colors } = useTheme();
  const { isOnline } = useNetwork();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('Welcome Back,');
  const [aiReport, setAiReport] = useState('');
  const [aiLoading, setAiLoading] = useState(true);

  const welcomeMessages = [
    "Welcome Back,",
    "Look who's here,",
    "Ready for the day,",
    "Stay safe,",
    "Good to see you,",
    "Hello again,",
    "Let's check in,",
    "How's it going,",
    "Campus looks safe,",
    "Welcome,"
  ];

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserName(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Student');
      }
      setWelcomeMessage(welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]);

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const fetchedReports = data || [];
      setReports(fetchedReports);

      // AI Campus Briefing — run in background after data loads
      setAiLoading(true);
      (async () => {
        try {
          const now = Date.now();
          const DAY_MS = 24 * 60 * 60 * 1000;
          const newCount = fetchedReports.filter(
            (r) => now - new Date(r.created_at).getTime() < DAY_MS
          ).length;

          // Try GPS for proximity count
          let nearbyCount = null;
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
              const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              const { latitude: uLat, longitude: uLng } = loc.coords;
              const toRad = (d) => (d * Math.PI) / 180;
              nearbyCount = fetchedReports.filter((r) => {
                if (!r.latitude || !r.longitude) return false;
                const dLat = toRad(r.latitude - uLat);
                const dLng = toRad(r.longitude - uLng);
                const a =
                  Math.sin(dLat / 2) ** 2 +
                  Math.cos(toRad(uLat)) * Math.cos(toRad(r.latitude)) * Math.sin(dLng / 2) ** 2;
                const dist = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return dist <= 1000; // 1 km radius
              }).length;
            }
          } catch (_) { /* GPS not available, nearbyCount stays null */ }

          if (!isOnline) {
            setAiReport('AI briefing unavailable offline. Connect to the internet to generate a campus briefing.');
            setAiLoading(false);
            return;
          }
          const report = await generateCampusReport(fetchedReports, newCount, nearbyCount);
          setAiReport(report);
        } catch (aiErr) {
          if (aiErr.message === 'GEMINI_KEY_MISSING') {
            setAiReport('Add your EXPO_PUBLIC_GROQ_API_KEY to .env to enable AI briefings.');
          } else {
            setAiReport('AI briefing temporarily unavailable.');
          }
        } finally {
          setAiLoading(false);
        }
      })();
    } catch (err) {
      console.error('Error fetching dashboard stats:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Algorithm: Calculate Security Score based on open/pending alerts and severity
  const calculateSafetyScore = () => {
    if (!reports || reports.length === 0) return { score: 100, label: 'Optimal', color: '#16a34a' };

    const activeReports = reports.filter((r) => r.status !== 'resolved');
    
    let penalty = 0;
    activeReports.forEach((r) => {
      if (r.category === 'Safety') penalty += 15;
      else if (r.category === 'Vandalism') penalty += 10;
      else if (r.category === 'Maintenance') penalty += 5;
      else penalty += 8;
    });

    const score = Math.max(25, 100 - penalty);

    if (score >= 80) return { score, label: 'Secure & Clear', color: '#16a34a' }; // Green
    if (score >= 50) return { score, label: 'Moderate Caution', color: '#d97706' }; // Amber
    return { score, label: 'High Risk Alert', color: '#dc2626' }; // Red
  };

  const statusInfo = calculateSafetyScore();
  const latestAlerts = reports.slice(0, 2);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarPadding }]}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchDashboardData();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={[styles.welcomeText, { color: colors.text }]}>{welcomeMessage} {userName}</Text>
        <Text style={[styles.timeHint, { color: colors.textSecondary }]}>
          {colors.dynamicGradients !== false
            ? `${colors.timePeriodLabel} · live gradient theme`
            : 'Classic gradient theme'}
        </Text>

        {/* Grid of 4 Widgets */}
        <View style={styles.grid}>
          
          {/* WIDGET 1: Campus Security Status Meter */}
          <Animated.View entering={FadeInUp.delay(100)} style={[styles.widgetCard, { backgroundColor: colors.surface, borderColor: statusInfo.color, borderWidth: 2 }]}>
            <View style={styles.widgetHeader}>
              <Ionicons name="shield-checkmark" size={20} color={statusInfo.color} />
              <Text style={[styles.widgetTitle, { color: colors.text }]}>Campus Security Index</Text>
            </View>
            <View style={styles.scoreContainer}>
              <Text style={[styles.scorePercent, { color: statusInfo.color }]}>
                {statusInfo.score}%
              </Text>
              <View style={[styles.statusTag, { backgroundColor: statusInfo.color }]}>
                <Text style={styles.statusTagText}>{statusInfo.label}</Text>
              </View>
            </View>
            <Text style={[styles.widgetSubtext, { color: colors.textSecondary }]}>
              {reports.filter((r) => r.status !== 'resolved').length} active incident(s) open.
            </Text>
          </Animated.View>

          {/* AI CAMPUS BRIEFING WIDGET */}
          {aiLoading ? (
            <AiLoadingCard colors={colors} />
          ) : aiReport ? (
            <Animated.View entering={FadeIn.duration(600)} style={[styles.widgetCard, styles.aiWidgetCard, { borderColor: '#2563eb40' }]}>
              <LinearGradient
                colors={['#1e3a5f', '#2563eb', '#1d4ed8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.widgetHeader}>
                <View style={styles.aiIconBadge}>
                  <Ionicons name="sparkles" size={14} color="#ffffff" />
                </View>
                <Text style={[styles.widgetTitle, { color: '#e0f2fe' }]}>AI Campus Briefing</Text>
              </View>
              <Text style={[styles.aiReportText, { color: '#bfdbfe' }]}>{aiReport}</Text>
              <Text style={[styles.aiFooter, { color: '#93c5fd' }]}>Generated by PinayAI · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </Animated.View>
          ) : null}

          {/* WIDGET 2: Latest Reported Alerts */}
          <Animated.View entering={FadeInUp.delay(200)} style={[styles.widgetCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.widgetHeader}>
              <Ionicons name="notifications" size={20} color={colors.primary} />
              <Text style={[styles.widgetTitle, { color: colors.text }]}>Newest Alerts</Text>
            </View>

            {latestAlerts.length > 0 ? (
              latestAlerts.map((alert) => (
                <TouchableOpacity
                  key={alert.id}
                  style={styles.alertPreview}
                  onPress={() => navigation.navigate('Campus Feed')}
                >
                  <Text style={[styles.alertPreviewTitle, { color: colors.text }]} numberOfLines={1}>
                    • {alert.title}
                  </Text>
                  <Text style={[styles.alertPreviewLoc, { color: colors.textSecondary }]}>{alert.location}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={[styles.emptyWidgetText, { color: colors.textMuted }]}>No recent alerts logged.</Text>
            )}
          </Animated.View>

          {/* WIDGET 3: Emergency Quick Contacts */}
          <Animated.View entering={FadeInUp.delay(300)} style={[styles.widgetCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.widgetHeader}>
              <Ionicons name="call" size={20} color="#dc2626" />
              <Text style={[styles.widgetTitle, { color: colors.text }]}>Emergency Hotlines</Text>
            </View>
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: colors.surfaceSecondary }]}
              onPress={() => Linking.openURL('tel:911')}
            >
              <Ionicons name="alert-circle" size={16} color="#dc2626" />
              <Text style={[styles.contactText, { color: '#dc2626' }]}>Campus Police / 911</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: colors.surfaceSecondary }]}
              onPress={() => Linking.openURL('tel:7805550199')}
            >
              <Ionicons name="medkit" size={16} color={colors.primary} />
              <Text style={[styles.contactText, { color: colors.text }]}>First Aid / Office Desk</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* WIDGET 4: Campus Safety Protocols */}
          <Animated.View entering={FadeInUp.delay(400)} style={[styles.widgetCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.widgetHeader}>
              <Ionicons name="book" size={20} color="#059669" />
              <Text style={[styles.widgetTitle, { color: colors.text }]}>Safety Guidelines</Text>
            </View>
            <View style={styles.protocolRow}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
              <Text style={[styles.protocolText, { color: colors.textBody }]}>Report hazards & incidents immediately.</Text>
            </View>
            <View style={styles.protocolRow}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
              <Text style={[styles.protocolText, { color: colors.textBody }]}>Keep clear of marked maintenance zones.</Text>
            </View>
            <View style={styles.protocolRow}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
              <Text style={[styles.protocolText, { color: colors.textBody }]}>During lockdowns, secure doors and stay out of sight.</Text>
            </View>
          </Animated.View>

        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function AiLoadingCard({ colors }) {
  const shimmer = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.4, { duration: 800 })
      ),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.8]),
  }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View entering={FadeInUp.delay(150)} style={[styles.widgetCard, styles.aiWidgetCard, { borderColor: '#2563eb60', overflow: 'hidden' }]}>
      <LinearGradient
        colors={['#1e3a5f', '#2563eb', '#1e3a5f']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View style={[StyleSheet.absoluteFillObject, shimmerStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <View style={styles.widgetHeader}>
        <Animated.View style={pulseStyle}>
          <Ionicons name="sparkles" size={18} color="#93c5fd" />
        </Animated.View>
        <Text style={[styles.widgetTitle, { color: '#e0f2fe' }]}>AI Campus Briefing</Text>
        <ActivityIndicator size="small" color="#93c5fd" style={{ marginLeft: 'auto' }} />
      </View>
      <Text style={{ color: '#93c5fd', fontSize: 12, marginBottom: 10, fontStyle: 'italic' }}>Analyzing campus data...</Text>
      {[1, 0.85, 0.65].map((w, i) => (
        <Animated.View key={i} style={[styles.shimmerLine, shimmerStyle, { width: `${w * 100}%`, backgroundColor: 'rgba(147,197,253,0.25)', marginBottom: i < 2 ? 8 : 0 }]} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  welcomeText: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  timeHint: { fontSize: 12, fontWeight: '600', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.4 },
  grid: { gap: 14 },
  widgetCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    elevation: 1,
    overflow: 'hidden',
  },
  aiWidgetCard: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  aiGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
    borderRadius: 16,
  },
  aiIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiReportText: { fontSize: 14, lineHeight: 22, marginTop: 4 },
  aiFooter: { fontSize: 11, marginTop: 10, fontStyle: 'italic' },
  shimmerLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    width: '100%',
    marginBottom: 8,
    opacity: 0.6,
  },
  widgetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  widgetTitle: { fontSize: 15, fontWeight: '700' },
  scoreContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  scorePercent: { fontSize: 36, fontWeight: '900' },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusTagText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },
  widgetSubtext: { fontSize: 12, marginTop: 4 },
  alertPreview: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  alertPreviewTitle: { fontSize: 14, fontWeight: '600' },
  alertPreviewLoc: { fontSize: 12, marginLeft: 10 },
  emptyWidgetText: { fontSize: 13 },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  contactText: { marginLeft: 8, fontWeight: '600', fontSize: 13 },
  protocolRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  protocolText: { marginLeft: 6, fontSize: 12, fontWeight: '500' },
});