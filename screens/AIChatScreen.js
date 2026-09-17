import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import { useReportMode } from '../lib/ReportModeContext';
import { REPORT_MODE_INSTANT } from '../lib/reportPreferences';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { askCampusAssistant } from '../lib/gemini';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/ThemeContext';
import { useFeedback } from '../lib/useFeedback';
import { useNetwork } from '../lib/NetworkContext';
import * as Location from 'expo-location';
import { useProximityOptional } from '../lib/ProximityContext';

// Animation constants for "quicker, more rapid but bouncy" effect
const SPRING_CONFIG = { damping: 14, stiffness: 220 };

const SUGGESTED_PROMPTS = [
  {
    id: 'walk',
    icon: 'walk',
    title: 'Walking home alone?',
    description: 'Request a virtual escort or find well-lit paths.',
    prompt: 'How can I get a virtual escort or find safe paths home?',
    theme: 'secondary', // #ffbf00
  },
  {
    id: 'study',
    icon: 'library',
    title: 'Find safe study spots',
    description: 'Locate 24/7 areas with security presence.',
    prompt: 'Where are safe, 24/7 study spots on campus?',
    theme: 'primary', // #2563eb
  },
  {
    id: 'emergency',
    icon: 'alert-circle',
    title: 'Emergency Protocols',
    description: 'Quick access to campus lockdown procedures.',
    prompt: 'What are the campus lockdown and emergency procedures?',
    theme: 'tertiary', // #9f0012
  },
  {
    id: 'report',
    icon: 'document-text',
    title: 'Report Incident',
    description: 'How to submit an anonymous report.',
    prompt: 'How do I submit an anonymous safety report?',
    theme: 'primary',
  }
];

function TypingDots({ color = '#2563eb' }) {
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    const bounce = (sv, delay) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 320, easing: Easing.out(Easing.ease) }),
            withTiming(0.3, { duration: 320, easing: Easing.in(Easing.ease) })
          ),
          -1,
          false
        )
      );
    };
    bounce(dot1, 0);
    bounce(dot2, 160);
    bounce(dot3, 320);
  }, [dot1, dot2, dot3]);

  const d1 = useAnimatedStyle(() => ({ opacity: dot1.value, transform: [{ scale: interpolate(dot1.value, [0.3, 1], [0.85, 1.15]) }] }));
  const d2 = useAnimatedStyle(() => ({ opacity: dot2.value, transform: [{ scale: interpolate(dot2.value, [0.3, 1], [0.85, 1.15]) }] }));
  const d3 = useAnimatedStyle(() => ({ opacity: dot3.value, transform: [{ scale: interpolate(dot3.value, [0.3, 1], [0.85, 1.15]) }] }));

  return (
    <View style={styles.typingDots}>
      <Animated.View style={[styles.typingDot, { backgroundColor: color }, d1]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: color }, d2]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: color }, d3]} />
    </View>
  );
}

function AmbientBackground({ isDark }) {
  const orb1 = useSharedValue(0);
  const orb2 = useSharedValue(0);
  const orb3 = useSharedValue(0);

  useEffect(() => {
    orb1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 4200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    orb2.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 5200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
    orb3.value = withDelay(
      1800,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 3800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, [orb1, orb2, orb3]);

  const orb1Style = useAnimatedStyle(() => ({
    opacity: interpolate(orb1.value, [0, 1], [0.12, 0.32]),
    transform: [
      { translateX: interpolate(orb1.value, [0, 1], [-20, 30]) },
      { translateY: interpolate(orb1.value, [0, 1], [0, 40]) },
      { scale: interpolate(orb1.value, [0, 1], [1, 1.18]) },
    ],
  }));
  const orb2Style = useAnimatedStyle(() => ({
    opacity: interpolate(orb2.value, [0, 1], [0.08, 0.24]),
    transform: [
      { translateX: interpolate(orb2.value, [0, 1], [30, -25]) },
      { translateY: interpolate(orb2.value, [0, 1], [20, -30]) },
      { scale: interpolate(orb2.value, [0, 1], [1.05, 0.92]) },
    ],
  }));
  const orb3Style = useAnimatedStyle(() => ({
    opacity: interpolate(orb3.value, [0, 1], [0.06, 0.2]),
    transform: [
      { translateX: interpolate(orb3.value, [0, 1], [-15, 20]) },
      { scale: interpolate(orb3.value, [0, 1], [0.9, 1.12]) },
    ],
  }));

  const primary = isDark ? '#2563eb' : '#3b82f6';
  const accent = isDark ? '#7c3aed' : '#818cf8';

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.View style={[styles.ambientOrb, styles.ambientOrbTop, { backgroundColor: primary }, orb1Style]} />
      <Animated.View style={[styles.ambientOrb, styles.ambientOrbMid, { backgroundColor: accent }, orb2Style]} />
      <Animated.View style={[styles.ambientOrb, styles.ambientOrbLow, { backgroundColor: primary }, orb3Style]} />
    </View>
  );
}

function GlowingEdge({ isDark }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 2200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.35, 0.85]),
  }));

  const colors = isDark
    ? ['rgba(37, 99, 235, 0.55)', 'rgba(124, 58, 237, 0.35)', 'rgba(37, 99, 235, 0.15)', 'rgba(37, 99, 235, 0.55)']
    : ['rgba(37, 99, 235, 0.45)', 'rgba(129, 140, 248, 0.3)', 'rgba(37, 99, 235, 0.1)', 'rgba(37, 99, 235, 0.45)'];

  return (
    <Animated.View style={[styles.glowEdge, glowStyle]} pointerEvents="none">
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
    </Animated.View>
  );
}

function ChatLoadingScreen({ isDark, colors }) {
  const shimmer = useSharedValue(0);
  const pulse = useSharedValue(0.4);
  const ringSpin = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0.35, { duration: 900 })
      ),
      -1,
      false
    );
    ringSpin.value = withRepeat(
      withTiming(360, { duration: 2400, easing: Easing.linear }),
      -1,
      false
    );
  }, [shimmer, pulse, ringSpin]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.25, 0.75]),
  }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringSpin.value}deg` }],
  }));

  const bubbleBg = isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.85)';
  const lineBg = isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.35)';

  return (
    <View style={styles.loadingContent}>
      <Animated.View entering={FadeInUp.springify().damping(15).stiffness(120)} style={styles.loadingHero}>
        <View style={styles.loadingHeroRingWrap}>
          <Animated.View style={[styles.loadingHeroRing, ringStyle]}>
            <LinearGradient
              colors={['#2563eb', '#7c3aed', 'transparent', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
          <Animated.View style={[styles.loadingHeroIcon, pulseStyle, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
            <Ionicons name="hardware-chip" size={28} color="#2563eb" />
          </Animated.View>
        </View>
        <Text style={[styles.loadingTitle, { color: colors.text }]}>CampusWatch AI</Text>
        <Text style={[styles.loadingSub, { color: colors.textSecondary }]}>Loading campus intelligence...</Text>
      </Animated.View>

      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          entering={FadeInLeft.delay(200 + i * 120).springify().damping(15).stiffness(120)}
          style={[styles.loadingBubble, { backgroundColor: bubbleBg, borderColor: isDark ? '#334155' : '#e2e8f0' }]}
        >
          <Animated.View style={[styles.loadingLine, shimmerStyle, { width: `${90 - i * 15}%`, backgroundColor: lineBg }]} />
          <Animated.View style={[styles.loadingLine, shimmerStyle, { width: `${70 - i * 10}%`, backgroundColor: lineBg, marginTop: 8 }]} />
        </Animated.View>
      ))}

      <Animated.View entering={FadeIn.delay(700).duration(400)} style={styles.loadingFooter}>
        <BlurView intensity={isDark ? 20 : 40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        <TypingDots color="#2563eb" />
        <Text style={[styles.loadingFooterText, { color: colors.textSecondary }]}>Syncing live reports</Text>
      </Animated.View>
    </View>
  );
}

function AnimatedInputBar({
  inputText,
  setInputText,
  sendMessage,
  isTyping,
  isDark,
  colors,
  insets,
  tap,
}) {
  const focusGlow = useSharedValue(0);
  const sendPulse = useSharedValue(1);
  const hasText = inputText.trim().length > 0;

  useEffect(() => {
    focusGlow.value = withTiming(hasText ? 1 : 0, { duration: 220 });
    if (hasText) {
      sendPulse.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        false
      );
    } else {
      sendPulse.value = withTiming(1, { duration: 180 });
    }
  }, [hasText, focusGlow, sendPulse]);

  const barStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(insets.bottom + 8, 12),
  }));

  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendPulse.value }],
  }));

  const inputBarBg = isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.92)';

  return (
    <Animated.View
      entering={FadeInUp.delay(300).springify().damping(14).stiffness(220)}
      style={[
        styles.inputBarOuter,
        barStyle,
      ]}
    >
      <View style={[styles.inputContainer, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: hasText ? '#2563eb' : (isDark ? '#334155' : '#e2e8f0') }]}>
        <TouchableOpacity style={styles.inputAddBtn}>
          <Ionicons name="add-circle" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
        </TouchableOpacity>
        
        <TextInput
          style={[
            styles.input,
            { color: isDark ? '#f1f5f9' : '#0f172a' },
          ]}
          placeholder="Type a message or ask for help..."
          placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          onSubmitEditing={() => sendMessage()}
          returnKeyType="send"
          blurOnSubmit
          onFocus={() => { focusGlow.value = withTiming(1, { duration: 200 }); }}
          onBlur={() => { focusGlow.value = withTiming(hasText ? 1 : 0, { duration: 200 }); }}
        />
        
        <Animated.View style={sendStyle}>
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: hasText ? '#2563eb' : (isDark ? '#334155' : '#e2e8f0') }]}
            onPress={() => sendMessage()}
            onPressIn={() => hasText && tap()}
            disabled={!hasText || isTyping}
          >
            <Ionicons name="send" size={18} color={hasText ? '#ffffff' : (isDark ? '#475569' : '#94a3b8')} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default function AIChatScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const { aiSend, aiReply, tap, error: hapticError } = useFeedback();
  const { isOnline } = useNetwork();
  const reportMode = useReportMode();
  const launchReport = reportMode?.launchReport;
  const flatListRef = useRef(null);
  const [reports, setReports] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const proximity = useProximityOptional();
  const bleCount = proximity ? proximity.getRecentTokenCount() : 0;

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      const { data } = await supabase
        .from('reports')
        .select('title, category, severity, location, description, status, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) setReports(data);
    } finally {
      setPageLoading(false);
    }
  };

  const buildReportContext = () => {
    if (!reports.length) return 'No reports currently in the system.';
    return reports.map((r, i) =>
      `${i + 1}. [${r.severity ?? 'Low'} / ${r.category ?? 'General'}] "${r.title}" at ${r.location} — ${r.status ?? 'pending'}. ${r.description ?? ''}`
    ).join('\n');
  };

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'model',
      parts: "Hello! I'm Campus Bot, your AI safety assistant. I can help you find safe routes, locate campus resources, or connect you with emergency services. How can I assist you today?\n\n[ACTION:OPEN_MAP|Open Campus Map|map] [ACTION:INSTANT_REPORT|Snap Photo Report|camera] [ACTION:EMERGENCY_CALL|Emergency Call|call]",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const gradientColors = colors.backgroundGradient;

  const sendMessage = async (text) => {
    const userText = (text || inputText).trim();
    if (!userText) return;

    if (!isOnline) {
      hapticError();
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        role: 'model',
        parts: 'You\'re offline. CampusWatch AI requires an internet connection.',
      }]);
      setInputText('');
      return;
    }

    aiSend();
    setInputText('');
    setShowSuggestions(false);

    const userMsg = { id: `user-${Date.now()}`, role: 'user', parts: userText };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setIsTyping(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    let locString = null;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        locString = `Lat: ${loc.coords.latitude}, Lng: ${loc.coords.longitude}`;
      }
    } catch (e) {}

    const userContext = {
      userName: currentUser?.user_metadata?.display_name || currentUser?.email?.split('@')[0] || 'Student',
      personalReportsCount: currentUser ? reports.filter((r) => r.user_id === currentUser.id).length : 0,
      locationString: locString,
      bleInfo: bleCount,
    };

    try {
      const reply = await askCampusAssistant(
        updatedHistory.filter((m) => m.id !== 'welcome'),
        buildReportContext(),
        userContext
      );
      setMessages((prev) => [...prev, { id: `ai-${Date.now()}`, role: 'model', parts: reply }]);
      aiReply();
    } catch (err) {
      hapticError();
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        role: 'model',
        parts: err.message === 'GEMINI_KEY_MISSING'
          ? 'AI features require a Groq API key. Please add EXPO_PUBLIC_GROQ_API_KEY to your .env file.'
          : `Error: ${err.message}`,
      }]);
    } finally {
      setIsTyping(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  const parseMessageContent = (rawText) => {
    if (!rawText) return { cleanText: '', actions: [] };
    let cleanText = rawText;
    const actions = [];

    // Match explicit [ACTION:TYPE|LABEL|ICON]
    const actionRegex = /\[ACTION:([A-Z0-9_]+)(?:\|([^\|\]]+))?(?:\|([^\]]+))?\]/gi;
    let match;
    while ((match = actionRegex.exec(rawText)) !== null) {
      actions.push({
        type: match[1].toUpperCase(),
        label: match[2] || match[1],
        icon: match[3] || 'arrow-forward',
      });
    }
    cleanText = cleanText.replace(actionRegex, '').trim();

    // Match explicit [LINK:URL|LABEL]
    const linkRegex = /\[LINK:([^\|\]]+)(?:\|([^\]]+))?\]/gi;
    while ((match = linkRegex.exec(rawText)) !== null) {
      actions.push({
        type: 'LINK',
        url: match[1],
        label: match[2] || 'Open Link',
        icon: 'open-outline',
      });
    }
    cleanText = cleanText.replace(linkRegex, '').trim();

    return { cleanText, actions };
  };

  const handleActionPress = (action) => {
    tap();
    switch (action.type) {
      case 'OPEN_MAP':
        navigation.navigate('Campus Map');
        break;
      case 'INSTANT_REPORT':
        if (launchReport) launchReport(REPORT_MODE_INSTANT);
        navigation.navigate('Report Incident');
        break;
      case 'REPORT_INCIDENT':
        navigation.navigate('Report Incident');
        break;
      case 'EMERGENCY_CALL':
        Linking.openURL('tel:911');
        break;
      case 'FEED':
        navigation.navigate('Home');
        break;
      case 'LINK':
        if (action.url) Linking.openURL(action.url);
        break;
      default:
        break;
    }
  };

  const renderText = (text) => {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1
        ? <Text key={i} style={{ fontWeight: '800' }}>{part}</Text>
        : <Text key={i}>{part}</Text>
    );
  };

  const renderMessage = ({ item, index }) => {
    const isUser = item.role === 'user';
    const anim = isUser ? FadeInRight.springify().damping(15).stiffness(120) : FadeInLeft.delay(index === 0 ? 200 : 0).springify().damping(15).stiffness(120);
    const { cleanText, actions } = isUser ? { cleanText: item.parts, actions: [] } : parseMessageContent(item.parts);

    return (
      <Animated.View entering={anim} style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <View style={[styles.aiAvatar, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
            <Ionicons name="hardware-chip" size={18} color="#2563eb" />
          </View>
        )}
        <View style={{ flex: 1, maxWidth: '84%' }}>
          <View style={[
            styles.bubble,
            isUser
              ? [styles.bubbleUser, { backgroundColor: '#2563eb' }]
              : [styles.bubbleAI, { backgroundColor: isDark ? 'rgba(30, 41, 59, 1)' : '#ffffff', borderColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 1)' }],
          ]}>
            <Text style={[styles.bubbleText, { color: isUser ? '#ffffff' : (isDark ? '#e2e8f0' : '#0f172a') }]}>
              {renderText(cleanText)}
            </Text>
          </View>

          {/* Adaptive Action Buttons & Deep Links */}
          {actions.length > 0 && (
            <View style={styles.actionContainer}>
              {actions.map((act, i) => {
                const isEmergency = act.type === 'EMERGENCY_CALL';
                const isLink = act.type === 'LINK';
                const bg = isEmergency
                  ? (isDark ? 'rgba(220,38,38,0.25)' : '#fee2e2')
                  : (isLink ? (isDark ? 'rgba(16,185,129,0.2)' : '#d1fae5') : (isDark ? 'rgba(37,99,235,0.25)' : '#eff6ff'));
                const border = isEmergency
                  ? '#ef4444'
                  : (isLink ? '#10b981' : (isDark ? 'rgba(59,130,246,0.5)' : '#bfdbfe'));
                const textColor = isEmergency
                  ? '#ef4444'
                  : (isLink ? '#059669' : (isDark ? '#93c5fd' : '#2563eb'));

                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.actionBtn, { backgroundColor: bg, borderColor: border }]}
                    onPress={() => handleActionPress(act)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={act.icon || 'arrow-forward'} size={14} color={textColor} />
                    <Text style={[styles.actionBtnText, { color: textColor }]}>{act.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  const TypingIndicator = () => (
    <Animated.View entering={FadeInLeft.springify().damping(15).stiffness(120)} style={styles.messageRow}>
      <View style={[styles.aiAvatar, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
        <Ionicons name="hardware-chip" size={18} color="#2563eb" />
      </View>
      <View style={{ gap: 6 }}>
        <Animated.View entering={FadeInUp.delay(100).springify().damping(15).stiffness(120)} style={styles.resourceStep}>
          <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
          <Text style={[styles.resourceStepText, { color: colors.textSecondary }]}>Accessing Live Location...</Text>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(800).springify().damping(15).stiffness(120)} style={styles.resourceStep}>
          <Ionicons name="document-text-outline" size={12} color={colors.textSecondary} />
          <Text style={[styles.resourceStepText, { color: colors.textSecondary }]}>Fetching Campus Reports...</Text>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(1500).springify().damping(15).stiffness(120)} style={styles.resourceStep}>
          <Ionicons name="analytics-outline" size={12} color={colors.textSecondary} />
          <Text style={[styles.resourceStepText, { color: colors.textSecondary }]}>Analyzing Context...</Text>
        </Animated.View>
        <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble, { backgroundColor: isDark ? 'rgba(30, 41, 59, 1)' : '#ffffff', borderColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 1)', alignSelf: 'flex-start' }]}>
          <TypingDots color="#2563eb" />
        </View>
      </View>
    </Animated.View>
  );

  const handleBack = () => {
    Keyboard.dismiss();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  const renderBentoGrid = () => (
    <Animated.View entering={FadeInDown.springify().damping(15).stiffness(120)} style={styles.bentoGrid}>
      {SUGGESTED_PROMPTS.map((item, i) => {
        let iconBgColor = '#2563eb15'; // Default primary soft
        let iconColor = '#2563eb'; // Default primary
        if (item.theme === 'secondary') { iconBgColor = '#ffbf0020'; iconColor = '#d97706'; } // Darker amber
        else if (item.theme === 'tertiary') { iconBgColor = '#9f001215'; iconColor = '#9f0012'; }

        return (
          <Animated.View key={item.id} entering={FadeInUp.delay(i * 100).springify().damping(15).stiffness(120)} style={styles.bentoItemWrapper}>
            <TouchableOpacity
              style={[styles.bentoCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0' }]}
              onPress={() => sendMessage(item.prompt)}
              onPressIn={tap}
              activeOpacity={0.7}
            >
              <View style={styles.bentoCardContent}>
                <View style={[styles.bentoIconWrap, { backgroundColor: iconBgColor }]}>
                  <Ionicons name={item.icon} size={20} color={iconColor} />
                </View>
                <View style={styles.bentoTextWrap}>
                  <Text style={[styles.bentoTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.bentoDesc, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={2}>{item.description}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <AmbientBackground isDark={isDark} />
      <GlowingEdge isDark={isDark} />

      {/* Floating Header */}
      <Animated.View entering={FadeInLeft.springify().damping(14).stiffness(220)} style={[styles.floatingHeaderWrap, { top: insets.top + 8 }]}>
        <TouchableOpacity style={[styles.floatingBackBtn, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.8)' }]} onPress={handleBack}>
          <BlurView intensity={isDark ? 30 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
          <Ionicons name="arrow-back" size={24} color={isDark ? '#f1f5f9' : '#0f172a'} />
        </TouchableOpacity>
        <View style={styles.floatingHeaderTitles}>
          <Text style={[styles.floatingHeaderTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>CampusWatch AI</Text>
          <Text style={[styles.floatingHeaderSub, { color: isDark ? '#94a3b8' : '#64748b' }]}>by PinayAI</Text>
        </View>
      </Animated.View>

      <KeyboardAvoidingView 
        style={[styles.flex, { paddingTop: insets.top + 60 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {pageLoading ? (
          <ChatLoadingScreen isDark={isDark} colors={colors} />
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[styles.messageList, { paddingBottom: 12 }]}
              ListHeaderComponent={() => (
                <View style={styles.todayBadgeWrap}>
                   <View style={[styles.todayBadge, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]}>
                     <Text style={[styles.todayBadgeText, { color: isDark ? '#cbd5e1' : '#64748b' }]}>TODAY</Text>
                   </View>
                </View>
              )}
              renderItem={renderMessage}
              ListFooterComponent={isTyping ? <TypingIndicator /> : null}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
            />

            {showSuggestions && (
              <View style={styles.suggestionsWrapper}>
                {renderBentoGrid()}
              </View>
            )}
          </>
        )}

        {!pageLoading && (
          <AnimatedInputBar
            inputText={inputText}
            setInputText={setInputText}
            sendMessage={sendMessage}
            isTyping={isTyping}
            isDark={isDark}
            colors={colors}
            insets={insets}
            tap={tap}
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  ambientOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  ambientOrbTop: { width: 220, height: 220, top: 80, right: -60 },
  ambientOrbMid: { width: 180, height: 180, top: '38%', left: -70 },
  ambientOrbLow: { width: 140, height: 140, bottom: 160, right: 20 },
  glowEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderRadius: 0,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  
  // Floating Header
  floatingHeaderWrap: {
    position: 'absolute',
    left: 16,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  floatingBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingHeaderTitles: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  floatingHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  floatingHeaderSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -1,
  },

  messageList: { padding: 16, paddingBottom: 8 },
  
  todayBadgeWrap: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  todayBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },

  messageRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, gap: 10 },
  messageRowUser: { flexDirection: 'row-reverse' },
  aiAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  bubbleUser: { borderTopRightRadius: 4 }, // Sharp top right for user
  bubbleAI: { borderWidth: 1, borderTopLeftRadius: 4 }, // Sharp top left for AI
  bubbleText: { fontSize: 15, lineHeight: 22 },
  typingBubble: { paddingVertical: 14, paddingHorizontal: 16 },
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  typingDot: { width: 7, height: 7, borderRadius: 3.5 },
  
  actionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  
  suggestionsWrapper: { paddingHorizontal: 16, paddingBottom: 8 },
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  bentoItemWrapper: { width: '48%', marginBottom: 12 },
  bentoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  bentoCardContent: { flexDirection: 'column', alignItems: 'flex-start', gap: 8 },
  bentoIconWrap: {
    padding: 8,
    borderRadius: 12,
  },
  bentoTextWrap: { gap: 2 },
  bentoTitle: { fontSize: 14, fontWeight: '700' },
  bentoDesc: { fontSize: 12, lineHeight: 16 },

  inputBarOuter: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    borderWidth: 1.5,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputAddBtn: {
    padding: 8,
  },
  input: { 
    flex: 1, 
    fontSize: 15, 
    maxHeight: 100, 
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  sendBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  loadingContent: { flex: 1, padding: 24, justifyContent: 'center' },
  loadingHero: { alignItems: 'center', marginBottom: 32 },
  loadingHeroRingWrap: { width: 80, height: 80, marginBottom: 14, justifyContent: 'center', alignItems: 'center' },
  loadingHeroRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    opacity: 0.7,
  },
  loadingHeroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  loadingSub: { fontSize: 13, fontWeight: '500' },
  loadingBubble: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    maxWidth: '85%',
    borderBottomLeftRadius: 4,
  },
  loadingLine: { height: 10, borderRadius: 5 },
  loadingFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, paddingLeft: 4 },
  loadingFooterText: { fontSize: 13, fontWeight: '500', fontStyle: 'italic' },
  resourceStep: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  resourceStepText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
});