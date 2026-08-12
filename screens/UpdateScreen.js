import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/ThemeContext';

const STATE = {
  CHECKING: 'checking',
  AVAILABLE: 'available',
  UP_TO_DATE: 'up_to_date',
  DOWNLOADING: 'downloading',
  READY: 'ready',
  ERROR: 'error',
};

export default function UpdateScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [state, setState] = useState(STATE.CHECKING);
  const [errorMsg, setErrorMsg] = useState('');

  // Spinning ring animation
  const spin = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(null);

  // Pulse animation for icon
  const pulse = useRef(new Animated.Value(1)).current;

  const startSpin = () => {
    spin.setValue(0);
    spinAnim.current = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinAnim.current.start();
  };

  const stopSpin = () => spinAnim.current?.stop();

  const doPulse = () => {
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.15, duration: 300, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const runCheck = async () => {
    setState(STATE.CHECKING);
    startSpin();
    try {
      const update = await Updates.checkForUpdateAsync();
      stopSpin();
      doPulse();
      if (update.isAvailable) {
        setState(STATE.AVAILABLE);
      } else {
        setState(STATE.UP_TO_DATE);
      }
    } catch (e) {
      stopSpin();
      setErrorMsg(__DEV__
        ? 'Update checks are only available in production builds.'
        : e.message);
      setState(STATE.ERROR);
    }
  };

  const runDownload = async () => {
    setState(STATE.DOWNLOADING);
    startSpin();
    try {
      await Updates.fetchUpdateAsync();
      stopSpin();
      doPulse();
      setState(STATE.READY);
    } catch (e) {
      stopSpin();
      setErrorMsg(e.message);
      setState(STATE.ERROR);
    }
  };

  useEffect(() => {
    runCheck();
    return () => stopSpin();
  }, []);

  const spinInterpolate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isSpinning = state === STATE.CHECKING || state === STATE.DOWNLOADING;

  const config = {
    [STATE.CHECKING]: {
      icon: 'cloud-download-outline',
      iconColor: '#2563eb',
      title: 'Checking for Updates',
      subtitle: 'Connecting to update server…',
    },
    [STATE.AVAILABLE]: {
      icon: 'arrow-down-circle',
      iconColor: '#2563eb',
      title: 'Update Available',
      subtitle: 'A new version of CampusWatch is ready to download.',
    },
    [STATE.UP_TO_DATE]: {
      icon: 'checkmark-circle',
      iconColor: '#16a34a',
      title: "You're Up to Date",
      subtitle: 'CampusWatch is running the latest version.',
    },
    [STATE.DOWNLOADING]: {
      icon: 'cloud-download',
      iconColor: '#2563eb',
      title: 'Downloading Update',
      subtitle: 'Please keep the app open…',
    },
    [STATE.READY]: {
      icon: 'rocket',
      iconColor: '#7c3aed',
      title: 'Update Ready',
      subtitle: 'The update has been downloaded. Restart to apply it.',
    },
    [STATE.ERROR]: {
      icon: 'alert-circle',
      iconColor: '#ef4444',
      title: 'Update Failed',
      subtitle: errorMsg || 'Something went wrong.',
    },
  };

  const { icon, iconColor, title, subtitle } = config[state];

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
      <View style={[styles.inner, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>

        {/* Back button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Profile</Text>
        </TouchableOpacity>

        <View style={styles.centerBlock}>
          {/* Spinning ring + icon */}
          <View style={styles.iconWrapper}>
            {isSpinning && (
              <Animated.View
                style={[styles.spinRing, { borderTopColor: iconColor, transform: [{ rotate: spinInterpolate }] }]}
              />
            )}
            <Animated.View style={{ transform: [{ scale: pulse }] }}>
              <View style={[styles.iconCircle, { backgroundColor: `${iconColor}18` }]}>
                <Ionicons name={icon} size={48} color={iconColor} />
              </View>
            </Animated.View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

          {/* Version badge */}
          <View style={[styles.versionBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.versionText, { color: colors.textMuted }]}>Version 1.0.0 · CampusWatch</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {state === STATE.AVAILABLE && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#2563eb' }]} onPress={runDownload}>
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Download Update</Text>
            </TouchableOpacity>
          )}

          {state === STATE.READY && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#7c3aed' }]} onPress={() => Updates.reloadAsync()}>
              <Ionicons name="refresh-circle-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Restart & Apply</Text>
            </TouchableOpacity>
          )}

          {(state === STATE.UP_TO_DATE || state === STATE.ERROR) && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#2563eb' }]} onPress={runCheck}>
              <Ionicons name="refresh-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Check Again</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>

      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backText: { fontSize: 15, fontWeight: '600' },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  spinRing: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  versionText: { fontSize: 12, fontWeight: '500' },
  actions: { gap: 12 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
});
