import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLockdown } from '../lib/LockdownContext';

export default function LockdownAlert() {
  const { lockdownAlert, dismissLockdown } = useLockdown();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!lockdownAlert) return;

    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [lockdownAlert, fadeAnim, pulseAnim]);

  if (!lockdownAlert) return null;

  const report = lockdownAlert;
  const photoUri = report.image_url || report.photo_url;
  const isBle = report._source === 'ble';

  return (
    <Modal visible animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={['#450a0a', '#7f1d1d', '#991b1b', '#b91c1c', '#dc2626']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="warning" size={56} color="#fef2f2" />
          </Animated.View>

          <Text style={styles.headline}>{t('lockdown.headline')}</Text>
          <Text style={styles.subheadline}>{t('lockdown.subheadline')}</Text>

          {isBle && (
            <View style={styles.bleBadge}>
              <Ionicons name="bluetooth" size={13} color="#93c5fd" />
              <Text style={styles.bleBadgeText}>Detected via Bluetooth — you are very close to this incident</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{report.title}</Text>

            {report.location ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-sharp" size={15} color="#ef4444" />
                <Text style={styles.locationText}>{report.location}</Text>
              </View>
            ) : null}

            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
            ) : null}

            {report.description ? (
              <Text style={styles.description}>{report.description}</Text>
            ) : null}

            {report.category ? (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{report.category}</Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity style={styles.gotItBtn} onPress={dismissLockdown} activeOpacity={0.85}>
            <Text style={styles.gotItText}>{t('lockdown.gotIt')}</Text>
          </TouchableOpacity>

          <Text style={styles.safetyNote}>{t('lockdown.safetyNote')}</Text>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { alignItems: 'center', paddingHorizontal: 24 },
  iconWrap: { marginBottom: 16 },
  bleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.5)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 18,
  },
  bleBadgeText: {
    fontSize: 12,
    color: '#93c5fd',
    fontWeight: '700',
    flexShrink: 1,
  },
  headline: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fef2f2',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  subheadline: {
    fontSize: 16,
    color: '#fecaca',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 20,
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 13,
    color: '#fca5a5',
    fontWeight: '600',
    flex: 1,
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#fef2f2',
    lineHeight: 20,
    marginBottom: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239,68,68,0.4)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.6)',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fecaca',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gotItBtn: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
    marginBottom: 24,
  },
  gotItText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  safetyNote: {
    fontSize: 12,
    color: 'rgba(254,226,226,0.7)',
    textAlign: 'center',
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
