/**
 * LiquidTabBar — iOS-style liquid glass floating navigation
 * Gaussian blur shell, whole-bar touch physics, no sliding pill selector.
 */

import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeedback } from '../lib/useFeedback';
import { useReportMode } from '../lib/ReportModeContext';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT } from '../lib/tabBarLayout';
import { useTabBarScrollControls } from '../lib/TabBarScrollContext';
import { useTheme } from '../lib/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useLockdown } from '../lib/LockdownContext';

const TAB_DEFS = [
  { route: 'Home',            labelKey: 'tabs.home',   icon: 'home-outline',       activeIcon: 'home'       },
  { route: 'Campus Feed',     labelKey: 'tabs.feed',   icon: 'list-outline',       activeIcon: 'list'       },
  { route: 'Report Incident', labelKey: 'tabs.report', icon: 'add-circle-outline', activeIcon: 'add-circle' },
  { route: 'Campus Map',      labelKey: 'tabs.map',    icon: 'map-outline',        activeIcon: 'map'        },
  { route: 'AI Assistant',    labelKey: 'tabs.ai',     icon: 'sparkles-outline',   activeIcon: 'sparkles'   },
];

const REPORT_INDEX = 2;
const AI_TAB_INDEX = 4;

const { width: SW } = Dimensions.get('window');
const SIDE_MARGIN = 16;
const BOTTOM_GAP = TAB_BAR_BOTTOM_GAP;
const BAR_H = TAB_BAR_HEIGHT;
const BAR_W = SW - SIDE_MARGIN * 2;
const TAB_COUNT = TAB_DEFS.length;
const TAB_W = BAR_W / TAB_COUNT;

const SPRING_SNAP = { damping: 18, stiffness: 320, mass: 0.85 };
const SPRING_PRESS = { damping: 22, stiffness: 480, mass: 0.7 };

function hexToRgba(hex, alpha) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return `rgba(15, 23, 42, ${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function TabButton({ tab, isFocused, isHighlighted, isReport, onPress, onLongPress, onPressInHaptic, colors }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(isFocused || isHighlighted ? 1.08 : 1, SPRING_SNAP);
  }, [isFocused, isHighlighted, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    onPressInHaptic?.();
    scale.value = withSpring(0.88, SPRING_PRESS);
  };

  const handlePressOut = () => {
    scale.value = withSpring(isFocused || isHighlighted ? 1.08 : 1, SPRING_SNAP);
  };

  return (
    <TouchableOpacity
      style={styles.tabBtn}
      activeOpacity={1}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.tabInner, animStyle]}>
        {isReport ? (
          <View style={[styles.reportBadge, isFocused && styles.reportBadgeActive]}>
            <Ionicons
              name={isFocused ? tab.activeIcon : tab.icon}
              size={22}
              color={isFocused ? '#ffffff' : '#2563eb'}
            />
            <Text style={[styles.reportBadgeLabel, isFocused && styles.reportBadgeLabelActive]}>
              {tab.label}
            </Text>
          </View>
        ) : (
          <>
            <Ionicons
              name={isFocused ? tab.activeIcon : tab.icon}
              size={22}
              color={isFocused || isHighlighted ? colors.primary : colors.tabBarIcon}
            />
            <Text
              style={[
                styles.label,
                { color: colors.tabBarIcon },
                (isFocused || isHighlighted) && { color: colors.primary, fontWeight: '800' },
              ]}
            >
              {tab.label}
            </Text>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function FloatingTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const { t, i18n } = useTranslation();
  const TABS = React.useMemo(
    () => TAB_DEFS.map((tab) => ({ ...tab, label: t(tab.labelKey) })),
    [t, i18n.language]
  );
  const { tabBarOffset, hiddenLockCount, showTabBar, hideTabBar } = useTabBarScrollControls();
  const { openPicker } = useReportMode();
  const { setReportingActive } = useLockdown();
  const { tabPress, tabLongPress, tabDragSnap, barPress } = useFeedback();
  const isAITab = state.index === AI_TAB_INDEX;
  const shouldForceHide = isAITab || hiddenLockCount > 0;
  const bottomInset = Math.max(insets.bottom + BOTTOM_GAP, BOTTOM_GAP) - 16;

  const barScale = useSharedValue(1);
  const barLift = useSharedValue(0);
  const glassPulse = useSharedValue(0);
  const touchGlowX = useSharedValue(BAR_W / 2);

  const isDragging = useRef(false);
  const lastHoverIndex = useRef(state.index);
  const [hoverIndex, setHoverIndex] = useState(state.index);
  const [isDraggingBar, setIsDraggingBar] = useState(false);

  useEffect(() => {
    setHoverIndex(state.index);
    lastHoverIndex.current = state.index;
  }, [state.index]);

  useEffect(() => {
    if (shouldForceHide) {
      hideTabBar?.();
    } else {
      showTabBar?.();
    }
  }, [state.index, shouldForceHide, showTabBar, hideTabBar]);

  const switchTab = (index) => {
    const isFocused = state.index === index;
    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes[index]?.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(TABS[index].route);
    }
  };

  const indexFromLocalX = (localX) =>
    Math.max(0, Math.min(TAB_COUNT - 1, Math.floor(localX / TAB_W)));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6,
      onPanResponderGrant: (evt) => {
        isDragging.current = true;
        setIsDraggingBar(true);
        const x = evt.nativeEvent.locationX;
        touchGlowX.value = x;
        const idx = indexFromLocalX(x);
        setHoverIndex(idx);
        barScale.value = withSpring(0.975, SPRING_PRESS);
        barLift.value = withSpring(-2, SPRING_PRESS);
        glassPulse.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
        barPress();
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        touchGlowX.value = withTiming(x, { duration: 80 });
        const idx = indexFromLocalX(x);
        if (idx !== lastHoverIndex.current) {
          lastHoverIndex.current = idx;
          tabDragSnap();
        }
        setHoverIndex(idx);
      },
      onPanResponderRelease: (evt) => {
        isDragging.current = false;
        setIsDraggingBar(false);
        const idx = indexFromLocalX(evt.nativeEvent.locationX);
        barScale.value = withSpring(1, SPRING_SNAP);
        barLift.value = withSpring(0, SPRING_SNAP);
        glassPulse.value = withTiming(0, { duration: 260 });
        setHoverIndex(idx);
        if (idx !== state.index) {
          switchTab(idx);
        }
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        setIsDraggingBar(false);
        barScale.value = withSpring(1, SPRING_SNAP);
        barLift.value = withSpring(0, SPRING_SNAP);
        glassPulse.value = withTiming(0, { duration: 200 });
        setHoverIndex(state.index);
      },
    })
  ).current;

  const onBarPressIn = () => {
    barPress();
    barScale.value = withSpring(0.985, SPRING_PRESS);
    barLift.value = withSpring(-1, SPRING_PRESS);
    glassPulse.value = withTiming(0.65, { duration: 120 });
  };

  const onBarPressOut = () => {
    if (isDragging.current) return;
    barScale.value = withSpring(1, SPRING_SNAP);
    barLift.value = withSpring(0, SPRING_SNAP);
    glassPulse.value = withTiming(0, { duration: 200 });
  };

  const floatingStyle = useAnimatedStyle(() => {
    const hideDistance = BAR_H + bottomInset + 24;
    const offset = shouldForceHide ? 1 : (tabBarOffset ? tabBarOffset.value : 0);

    return {
      transform: [
        { translateY: offset * hideDistance + barLift.value },
        { scale: barScale.value },
      ],
      opacity: 1 - offset,
    };
  });

  const glassPulseStyle = useAnimatedStyle(() => ({
    opacity: (isDark ? 0.03 : 0.08) + glassPulse.value * (isDark ? 0.14 : 0.22),
  }));

  const touchGlowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: touchGlowX.value - 40 }],
    opacity: (isDark ? 0.12 : 0.25) + glassPulse.value * (isDark ? 0.2 : 0.35),
  }));

  const ambientColor = colors.backgroundGradient?.[colors.backgroundGradient.length - 1] || colors.background;
  const glassTintColor = isDark ? hexToRgba(ambientColor, 0.82) : colors.tabBarGlass;
  const blurTint = colors.tabBarBlur;
  const specularColors = isDark
    ? [hexToRgba(colors.primary, 0.14), hexToRgba(ambientColor, 0.06), 'rgba(0,0,0,0)']
    : ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)'];
  const touchGlowColors = isDark
    ? [hexToRgba(colors.primary, 0.28), 'rgba(0,0,0,0)']
    : ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)'];
  const pulseOverlayColor = isDark ? colors.primary : '#ffffff';
  const innerBorderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.35)';

  return (
    <Animated.View
      pointerEvents={shouldForceHide ? 'none' : 'auto'}
      style={[
        styles.floatingContainer,
        {
          left: SIDE_MARGIN,
          right: SIDE_MARGIN,
          bottom: bottomInset,
          borderColor: colors.tabBarBorder,
          shadowColor: isDark ? ambientColor : '#2563eb',
          shadowOpacity: isDark ? 0.45 : 0.18,
        },
        floatingStyle,
      ]}
      onStartShouldSetResponder={() => true}
      onResponderGrant={onBarPressIn}
      onResponderRelease={onBarPressOut}
      onResponderTerminate={onBarPressOut}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 88 : 72}
        tint={blurTint}
        style={styles.blurView}
        experimentalBlurMethod="dimezisBlurView"
      >
        <View style={[styles.glassTint, { backgroundColor: glassTintColor }]} />

        <LinearGradient
          colors={specularColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.45 }}
          style={styles.specularHighlight}
          pointerEvents="none"
        />

        <Animated.View style={[styles.touchGlow, touchGlowStyle]} pointerEvents="none">
          <LinearGradient
            colors={touchGlowColors}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        <Animated.View
          style={[styles.glassPulseOverlay, { backgroundColor: pulseOverlayColor }, glassPulseStyle]}
          pointerEvents="none"
        />

        <View style={[styles.innerBorder, { borderColor: innerBorderColor }]} pointerEvents="none" />

        <View style={styles.tabButtonsContainer} {...panResponder.panHandlers}>
          {TABS.map((tab, index) => {
            const isFocused = state.index === index;
            const isHighlighted = isDraggingBar && hoverIndex === index;
            const isReport = index === REPORT_INDEX;

            return (
              <TabButton
                key={tab.route}
                tab={tab}
                isFocused={isFocused}
                isHighlighted={isHighlighted}
                isReport={isReport}
                colors={colors}
                onPressInHaptic={tabPress}
                onPress={() => {
                  if (isReport) setReportingActive(true);
                  setHoverIndex(index);
                  switchTab(index);
                }}
                onLongPress={
                  isReport
                    ? () => {
                        setReportingActive(true);
                        tabLongPress();
                        openPicker?.();
                      }
                    : undefined
                }
              />
            );
          })}
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    height: BAR_H,
    borderRadius: BAR_H / 2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 16,
    borderWidth: 1,
  },
  blurView: {
    flex: 1,
    borderRadius: BAR_H / 2,
    overflow: 'hidden',
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
  },
  specularHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BAR_H / 2,
  },
  glassPulseOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BAR_H / 2,
  },
  touchGlow: {
    position: 'absolute',
    top: 6,
    width: 80,
    height: BAR_H - 12,
    borderRadius: (BAR_H - 12) / 2,
    overflow: 'hidden',
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BAR_H / 2,
    borderWidth: StyleSheet.hairlineWidth,
    margin: 1,
  },
  tabButtonsContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  tabBtn: {
    width: TAB_W,
    height: BAR_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  reportBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    gap: 1,
  },
  reportBadgeActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  reportBadgeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 0.3,
  },
  reportBadgeLabelActive: {
    color: '#ffffff',
  },
});
