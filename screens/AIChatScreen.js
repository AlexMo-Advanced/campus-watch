import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
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

function ChatLoadingScreen({ isDark, colors }) {
  const shimmer = useSharedValue(0);
  const pulse = useSharedValue(0.4);

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
  }, [shimmer, pulse]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.25, 0.75]),
  }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const bubbleBg = isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.85)';
  const lineBg = isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.35)';

  return (
    <View style={styles.loadingContent}>
      <Animated.View entering={FadeInUp.duration(500)} style={styles.loadingHero}>
        <Animated.View style={[styles.loadingHeroIcon, pulseStyle, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
          <Ionicons name="sparkles" size={28} color="#2563eb" />
        </Animated.View>
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

export default function AIChatScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const { aiSend, aiReply, tap, error: hapticError } = useFeedback();
  const { isOnline } = useNetwork();
  const flatListRef = useRef(null);
  const [reports, setReports] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const { data } = await supabase
        .from('reports')
        .select('title, category, severity, location, description, status, created_at')
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
  const inputBarBg = isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.92)';

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

    try {
      const reply = await askCampusAssistant(
        updatedHistory.filter((m) => m.id !== 'welcome'),
        buildReportContext()
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
    const anim = isUser ? FadeInRight.duration(300) : FadeInLeft.delay(index === 0 ? 200 : 0).duration(300);
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
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  return (
    <LinearGradient colors={gradientColors} style={styles.container} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        {/* Header — flush to top safe area */}
        <Animated.View
          entering={FadeInDown.duration(350)}
          style={[styles.header, { paddingTop: insets.top + 4, backgroundColor: headerBg, borderBottomColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.8)' }]}
        >
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={isDark ? '#f1f5f9' : '#0f172a'} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={[styles.headerAIBadge, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
              <Ionicons name="sparkles" size={16} color="#2563eb" />
            </View>
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
              contentContainerStyle={styles.messageList}
              ListFooterComponent={isTyping ? <TypingIndicator /> : null}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
            />

            {showSuggestions && (
              <Animated.View entering={FadeInDown.duration(400)} style={styles.suggestionsWrapper}>
                <Text style={[styles.suggestionsLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>Try asking:</Text>
                <View style={styles.suggestionsRow}>
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <Animated.View key={prompt} entering={FadeInUp.delay(i * 80).duration(350)}>
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

        {/* Input Bar */}
        {!pageLoading && (
          <Animated.View
            entering={FadeInUp.delay(300).duration(400)}
            style={[styles.inputBar, { backgroundColor: inputBarBg, borderTopColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(226, 232, 240, 0.8)', paddingBottom: insets.bottom + 8 }]}
          >
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(241, 245, 249, 0.95)', color: isDark ? '#f1f5f9' : '#0f172a', borderColor: isDark ? '#334155' : '#e2e8f0' }]}
              placeholder="Ask about campus safety..."
              placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
              blurOnSubmit
            />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: inputText.trim() ? '#2563eb' : (isDark ? '#334155' : '#e2e8f0') }]}
          onPress={() => sendMessage()}
          onPressIn={() => inputText.trim() && tap()}
          disabled={!inputText.trim() || isTyping}
        >
              <Ionicons name="send" size={18} color={inputText.trim() ? '#ffffff' : (isDark ? '#475569' : '#94a3b8')} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
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
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  input: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  loadingContent: { flex: 1, padding: 24, justifyContent: 'center' },
  loadingHero: { alignItems: 'center', marginBottom: 32 },
  loadingHeroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
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
