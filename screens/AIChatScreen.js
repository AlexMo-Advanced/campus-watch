import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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

const SUGGESTED_PROMPTS = [
  'How do I report a safety incident?',
  'What should I do in a lockdown?',
  'Are there any active alerts near me?',
  'How do I submit an anonymous report?',
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
      <Animated.View entering={FadeInUp.duration(500)} style={styles.loadingHero}>
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
            <Ionicons name="sparkles" size={28} color="#2563eb" />
          </Animated.View>
        </View>
        <Text style={[styles.loadingTitle, { color: colors.text }]}>CampusWatch AI</Text>
        <Text style={[styles.loadingSub, { color: colors.textSecondary }]}>Loading campus intelligence...</Text>
      </Animated.View>

      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          entering={FadeInLeft.delay(200 + i * 120).duration(400)}
          style={[styles.loadingBubble, { backgroundColor: bubbleBg, borderColor: isDark ? '#334155' : '#e2e8f0' }]}
        >
          <Animated.View style={[styles.loadingLine, shimmerStyle, { width: `${90 - i * 15}%`, backgroundColor: lineBg }]} />
          <Animated.View style={[styles.loadingLine, shimmerStyle, { width: `${70 - i * 10}%`, backgroundColor: lineBg, marginTop: 8 }]} />
        </Animated.View>
      ))}

      <Animated.View entering={FadeIn.delay(700).duration(400)} style={styles.loadingFooter}>
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
  const keyboardOffset = useSharedValue(0);
  const focusGlow = useSharedValue(0);
  const sendPulse = useSharedValue(1);
  const hasText = inputText.trim().length > 0;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (e) => {
      const offset = Math.max(0, e.endCoordinates.height - insets.bottom);
      keyboardOffset.value = withTiming(offset, {
        duration: e.duration ?? 250,
        easing: Easing.out(Easing.cubic),
      });
    });
    const onHide = Keyboard.addListener(hideEvent, (e) => {
      keyboardOffset.value = withTiming(0, {
        duration: e?.duration ?? 250,
        easing: Easing.out(Easing.cubic),
      });
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [insets.bottom, keyboardOffset]);

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
    transform: [{ translateY: -keyboardOffset.value }],
    paddingBottom: keyboardOffset.value > 0 ? 10 : insets.bottom + 8,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(focusGlow.value, [0, 1], [0, isDark ? 0.55 : 0.4]),
    transform: [{ scale: interpolate(focusGlow.value, [0, 1], [0.98, 1]) }],
  }));

  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendPulse.value }],
  }));

  const inputBarBg = isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.92)';

  return (
    <Animated.View
      entering={FadeInUp.delay(300).duration(400)}
      style={[
        styles.inputBarOuter,
        barStyle,
        { backgroundColor: inputBarBg, borderTopColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.8)' },
      ]}
    >
      <Animated.View style={[styles.inputGlowRing, glowStyle]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(37, 99, 235, 0.5)', 'rgba(124, 58, 237, 0.25)', 'rgba(37, 99, 235, 0.5)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <View style={styles.inputBar}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(241, 245, 249, 0.95)',
              color: isDark ? '#f1f5f9' : '#0f172a',
              borderColor: hasText ? '#2563eb' : (isDark ? '#334155' : '#e2e8f0'),
            },
          ]}
          placeholder="Ask about campus safety..."
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
            <Ionicons name="send" size={18} color={hasText ? '#ffffff' : (isDark ? '#475569' : '#94a3b8')} />
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
      parts: "Hi! I'm **CampusWatch AI** — your campus safety assistant. I have access to live campus reports. Ask me anything about current incidents, safety procedures, or how to report an issue.",
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const gradientColors = colors.backgroundGradient;
  const headerBg = isDark ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.72)';

  const headerPulse = useSharedValue(0);
  useEffect(() => {
    headerPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800 }),
        withTiming(0.4, { duration: 1800 })
      ),
      -1,
      false
    );
  }, [headerPulse]);

  const headerBadgeStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(headerPulse.value, [0.4, 1], [0.15, 0.45]),
    transform: [{ scale: interpolate(headerPulse.value, [0.4, 1], [1, 1.04]) }],
  }));

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
    const anim = isUser ? FadeInRight.duration(300).springify() : FadeInLeft.delay(index === 0 ? 200 : 0).duration(300).springify();
    return (
      <Animated.View entering={anim} style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <View style={[styles.aiAvatar, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
            <Ionicons name="sparkles" size={14} color="#2563eb" />
          </View>
        )}
        <View style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: '#2563eb' }]
            : [styles.bubbleAI, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.92)', borderColor: isDark ? '#334155' : '#e2e8f0' }],
        ]}>
          <Text style={[styles.bubbleText, { color: isUser ? '#ffffff' : (isDark ? '#e2e8f0' : '#0f172a') }]}>
            {renderText(item.parts)}
          </Text>
        </View>
      </Animated.View>
    );
  };

  const TypingIndicator = () => (
    <Animated.View entering={FadeInLeft.duration(200)} style={styles.messageRow}>
      <View style={[styles.aiAvatar, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
        <Ionicons name="sparkles" size={14} color="#2563eb" />
      </View>
      <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.92)', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
        <TypingDots color="#2563eb" />
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

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <AmbientBackground isDark={isDark} />
      <GlowingEdge isDark={isDark} />

      <View style={styles.flex}>
        <Animated.View
          entering={FadeInDown.duration(350)}
          style={[styles.header, { paddingTop: insets.top + 4, backgroundColor: headerBg, borderBottomColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.8)' }]}
        >
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={isDark ? '#f1f5f9' : '#0f172a'} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Animated.View style={[styles.headerAIBadge, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }, headerBadgeStyle]}>
              <Ionicons name="sparkles" size={16} color="#2563eb" />
            </Animated.View>
            <View>
              <Text style={[styles.headerTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>CampusWatch AI</Text>
              <Text style={[styles.headerSub, { color: isDark ? '#94a3b8' : '#64748b' }]}>Powered by PinayAI</Text>
            </View>
          </View>
          <View style={styles.headerSpacer} />
        </Animated.View>

        {pageLoading ? (
          <ChatLoadingScreen isDark={isDark} colors={colors} />
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={[styles.messageList, { paddingBottom: 12 }]}
              ListFooterComponent={isTyping ? <TypingIndicator /> : null}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
            />

            {showSuggestions && (
              <Animated.View entering={FadeInDown.duration(400)} style={styles.suggestionsWrapper}>
                <Text style={[styles.suggestionsLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Try asking:</Text>
                <View style={styles.suggestionsRow}>
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <Animated.View key={prompt} entering={FadeInUp.delay(i * 80).duration(350).springify()}>
                      <TouchableOpacity
                        style={[styles.suggestionChip, { backgroundColor: isDark ? 'rgba(30, 58, 95, 0.85)' : 'rgba(239, 246, 255, 0.95)', borderColor: isDark ? 'rgba(37, 99, 235, 0.35)' : '#bfdbfe' }]}
                        onPress={() => sendMessage(prompt)}
                        onPressIn={tap}
                      >
                        <Text style={[styles.suggestionChipText, { color: '#2563eb' }]}>{prompt}</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>
              </Animated.View>
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
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerSpacer: { width: 36 },
  headerAIBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  headerSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  messageList: { padding: 16, paddingBottom: 8 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 8 },
  messageRowUser: { flexDirection: 'row-reverse' },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAI: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  typingBubble: { paddingVertical: 14, paddingHorizontal: 16 },
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  typingDot: { width: 7, height: 7, borderRadius: 3.5 },
  suggestionsWrapper: { paddingHorizontal: 16, paddingBottom: 8 },
  suggestionsLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestionChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  suggestionChipText: { fontSize: 12, fontWeight: '600' },
  inputBarOuter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  inputGlowRing: {
    position: 'absolute',
    top: 6,
    left: 10,
    right: 10,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
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
});
