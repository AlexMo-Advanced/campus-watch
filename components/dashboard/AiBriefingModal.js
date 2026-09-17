import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/ThemeContext';

export default function AiBriefingModal({ visible, report, generatedAt, onClose }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colors = theme.colors;
  const isDark = theme.isDark;
  const timePeriodLabel = colors.timePeriodLabel || 'Campus';

  // Ambient floating background glow animation
  const glowTranslateY = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);
  const sparkScale = useSharedValue(1);
  const closeScale = useSharedValue(1);

  useEffect(() => {
    glowTranslateY.value = withRepeat(
      withTiming(-30, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    glowOpacity.value = withRepeat(
      withTiming(0.6, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    sparkScale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [glowTranslateY, glowOpacity, sparkScale]);

  const animatedGlowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: glowTranslateY.value }],
    opacity: glowOpacity.value,
  }));

  const animatedSparkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkScale.value }],
  }));

  const animatedCloseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: closeScale.value }],
  }));

  if (!report) return null;

  const timeLabel = generatedAt
    ? generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const gradientColors = colors.backgroundGradient || (isDark
    ? ['#0f172a', '#1e3a5f', '#1d4ed8']
    : ['#c8e8fd', '#e6f4ff', '#ffffff']);

  const accentGradient = colors.accentGradient || ['#38bdf8', '#2563eb'];
  const titleColor = isDark ? '#f0f9ff' : '#0f172a';
  const subtitleColor = isDark ? '#93c5fd' : '#2563eb';
  const bodyColor = isDark ? '#e2e8f0' : '#1e293b';
  const headerBorder = isDark ? 'rgba(147,197,253,0.25)' : 'rgba(37,99,235,0.2)';
  const closeBg = isDark ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.7)';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <LinearGradient colors={gradientColors} style={styles.container}>
        {/* Animated background ambient glow orbs matching time of day */}
        <Animated.View style={[styles.ambientOrb, animatedGlowStyle]}>
          <LinearGradient
            colors={[accentGradient[0] + '55', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(400).springify()}
          style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: headerBorder }]}
        >
          <View style={styles.headerLeft}>
            <Animated.View style={[styles.iconBadge, { backgroundColor: colors.primary }, animatedSparkStyle]}>
              <Ionicons name="sparkles" size={18} color="#ffffff" />
            </Animated.View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.title, { color: titleColor }]}>AI Campus Briefing</Text>
                <View style={[styles.timeBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(37,99,235,0.1)' }]}>
                  <Text style={[styles.timeBadgeText, { color: subtitleColor }]}>{timePeriodLabel.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={[styles.subtitle, { color: subtitleColor }]}>PinayAI · Generated at {timeLabel}</Text>
            </View>
          </View>
          <Animated.View style={animatedCloseStyle}>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: closeBg }]}
              onPress={onClose}
              onPressIn={() => { closeScale.value = withSpring(0.9); }}
              onPressOut={() => { closeScale.value = withSpring(1); }}
              accessibilityLabel="Close briefing"
            >
              <Ionicons name="close" size={24} color={titleColor} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInUp.delay(100).duration(450).springify()} style={[styles.cardContainer, { backgroundColor: isDark ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.65)', borderColor: headerBorder }]}>
            <View style={styles.liveIndicatorRow}>
              <View style={styles.pulseDot} />
              <Text style={[styles.liveText, { color: subtitleColor }]}>LIVE CAMPUS INTELLIGENCE</Text>
            </View>
            <Text style={[styles.body, { color: bodyColor }]}>{report}</Text>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  ambientOrb: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  timeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  timeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  cardContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '500',
  },
});
