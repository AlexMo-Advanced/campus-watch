import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureCurrentLocation, submitReport } from '../lib/reportSubmit';
import { useTheme } from '../lib/ThemeContext';

const CATEGORIES = ['Safety', 'Maintenance', 'Vandalism', 'Lost & Found', 'Other'];
const SEVERITIES = [
  { label: 'Low', color: '#16a34a' },
  { label: 'Medium', color: '#d97706' },
  { label: 'High', color: '#ef4444' },
  { label: 'Crisis', color: '#9333ea' },
];

export default function InstantReportDetailsScreen({
  photoUri,
  onRetake,
  onSuccess,
}) {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();

  const [category, setCategory] = useState('Safety');
  const [severity, setSeverity] = useState('Low');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLocLoading(true);
      try {
        const loc = await captureCurrentLocation();
        if (loc) {
          setLocation(loc.locationLabel);
          setLatitude(loc.latitude);
          setLongitude(loc.longitude);
        }
      } finally {
        setLocLoading(false);
      }
    })();
  }, []);

  const handlePost = async () => {
    if (!description.trim()) {
      Alert.alert('Add a description', 'Tell us briefly what happened.');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Location needed', 'Please add where this incident occurred.');
      return;
    }

    setLoading(true);
    try {
      await submitReport({
        title: description.slice(0, 60),
        category,
        severity,
        location,
        description,
        imageUri: photoUri,
        isAnonymous,
        latitude,
        longitude,
      });

      Alert.alert('Report Posted!', 'Your incident has been shared with campus safety.', [
        { text: 'Done', onPress: onSuccess },
      ]);
    } catch (err) {
      Alert.alert('Could not post', err.message);
    } finally {
      setLoading(false);
    }
  };

  const surfaceBg = isDark ? 'rgba(30, 41, 59, 0.95)' : '#ffffff';
  const inputBg = isDark ? '#0f172a' : '#f1f5f9';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Photo hero */}
        <View style={styles.photoWrap}>
          <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.65)']}
            style={styles.photoGradient}
          />
          <TouchableOpacity style={[styles.retakeBtn, { top: insets.top + 8 }]} onPress={onRetake}>
            <Ionicons name="camera-reverse" size={18} color="#ffffff" />
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
          <View style={styles.photoCaption}>
            <Text style={styles.photoCaptionTitle}>New Incident Report</Text>
            <Text style={styles.photoCaptionSub}>Add details before posting</Text>
          </View>
        </View>

        <Animated.View entering={FadeInUp.duration(350)} style={[styles.formCard, { backgroundColor: surfaceBg }]}>
          {/* Category */}
          <Text style={[styles.label, { color: colors.textBody }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Severity */}
          <Text style={[styles.label, { color: colors.textBody }]}>Severity</Text>
          <View style={styles.severityRow}>
            {SEVERITIES.map((sev) => (
              <TouchableOpacity
                key={sev.label}
                style={[
                  styles.severityChip,
                  { borderColor: sev.color },
                  severity === sev.label && { backgroundColor: sev.color },
                ]}
                onPress={() => setSeverity(sev.label)}
              >
                <Text style={[styles.severityText, { color: severity === sev.label ? '#fff' : sev.color }]}>
                  {sev.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Description */}
          <Text style={[styles.label, { color: colors.textBody }]}>What happened?</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: inputBg, color: colors.text, borderColor: colors.border }]}
            placeholder="Brief description of the incident..."
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={280}
          />
          <Text style={[styles.charCount, { color: colors.textMuted }]}>{description.length}/280</Text>

          {/* Location */}
          <Text style={[styles.label, { color: colors.textBody }]}>Location</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={18} color="#2563eb" />
            {locLoading ? (
              <ActivityIndicator size="small" color="#2563eb" style={{ marginLeft: 8 }} />
            ) : (
              <TextInput
                style={[styles.locationInput, { color: colors.text }]}
                value={location}
                onChangeText={setLocation}
                placeholder="Where did this happen?"
                placeholderTextColor={colors.textMuted}
              />
            )}
          </View>

          {/* Anonymous */}
          <View style={styles.anonRow}>
            <View>
              <Text style={[styles.anonLabel, { color: colors.text }]}>Post anonymously</Text>
              <Text style={[styles.anonSub, { color: colors.textSecondary }]}>Your identity stays hidden</Text>
            </View>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ false: colors.border, true: '#93c5fd' }}
              thumbColor={isAnonymous ? '#2563eb' : colors.surfaceSecondary}
            />
          </View>
        </Animated.View>
      </ScrollView>

      {/* Post button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: surfaceBg, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.postBtn, loading && styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="paper-plane" size={18} color="#ffffff" />
              <Text style={styles.postBtnText}>Post Report</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  photoWrap: { width: '100%', height: 340, backgroundColor: '#000' },
  photo: { width: '100%', height: '100%' },
  photoGradient: { ...StyleSheet.absoluteFillObject },
  retakeBtn: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retakeText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  photoCaption: { position: 'absolute', bottom: 20, left: 20 },
  photoCaptionTitle: { color: '#ffffff', fontSize: 22, fontWeight: '800' },
  photoCaptionSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  formCard: {
    marginTop: -24,
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  chipScroll: { marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  chipTextActive: { color: '#ffffff' },
  severityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  severityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  severityText: { fontSize: 13, fontWeight: '700' },
  textArea: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 4 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  locationInput: { flex: 1, fontSize: 14, fontWeight: '500' },
  anonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  anonLabel: { fontSize: 15, fontWeight: '700' },
  anonSub: { fontSize: 12, marginTop: 2 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  postBtn: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  postBtnDisabled: { opacity: 0.6 },
  postBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
});
