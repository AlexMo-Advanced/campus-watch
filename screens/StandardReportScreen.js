import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from '../components/CustomMapView';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { summarizeAndTagIncident, checkToxicity } from '../lib/gemini';
import { useTabBarScrollHandler } from '../lib/TabBarScrollContext';
import { getTabBarClearance } from '../lib/tabBarLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/ThemeContext';
import { useNetwork } from '../lib/NetworkContext';
import { enqueueReport } from '../lib/reportQueue';

const DEFAULT_REGION = {
  latitude: 55.1707,
  longitude: -118.7947,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function StandardReportScreen({ navigation, onSwitchToInstant }) {
  const insets = useSafeAreaInsets();
  const { onScroll, scrollEventThrottle } = useTabBarScrollHandler();
  const tabBarPadding = getTabBarClearance(insets);
  const { isDark, colors: themeColors } = useTheme();
  const { isOnline } = useNetwork();
  const colors = {
    background: themeColors.background,
    gradientBg: themeColors.backgroundGradient,
    cardBg: themeColors.surface,
    cardBorder: themeColors.border,
    textMain: themeColors.text,
    textSub: themeColors.textSecondary,
    textBody: themeColors.textBody,
    textMuted: themeColors.textMuted,
    primary: themeColors.primary,
    primaryBg: themeColors.primaryLight,
    primaryBorder: themeColors.borderInput,
    border: themeColors.borderInput,
    inputBg: themeColors.inputBg,
    headerBg: themeColors.surfaceSecondary,
    icon: themeColors.textSecondary,
    danger: isDark ? '#f87171' : '#ef4444',
    dangerBg: isDark ? '#450a0a' : '#fef2f2',
    success: isDark ? '#4ade80' : '#16a34a',
    successBg: isDark ? '#052e16' : '#f0fdf4',
    warning: isDark ? '#fbbf24' : '#d97706',
    pillBg: themeColors.chip,
    placeholder: themeColors.surfaceSecondary,
    crisis: isDark ? '#c084fc' : '#9333ea',
  };
  const styles = getStyles(colors);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Safety');
  const [severity, setSeverity] = useState('Low');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiTagging, setAiTagging] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pinCoordinate, setPinCoordinate] = useState(null);
  const [mapPickerRegion, setMapPickerRegion] = useState(DEFAULT_REGION);

  const categories = ['Safety', 'Maintenance', 'Vandalism', 'Lost & Found', 'Other'];
  const severities = [
    { label: 'Low', color: colors.success },
    { label: 'Medium', color: colors.warning },
    { label: 'High', color: colors.danger },
    { label: 'Crisis', color: colors.crisis },
  ];

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleGpsToggle = async (value) => {
    setUseCurrentLocation(value);
    if (!value) return;
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required to use this feature.');
        setUseCurrentLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      setLatitude(lat);
      setLongitude(lng);
      setPinCoordinate({ latitude: lat, longitude: lng });
      setMapPickerRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 });
      const geocoded = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geocoded.length > 0) {
        const addr = geocoded[0];
        const parts = [addr.name, addr.street, addr.district, addr.city].filter(Boolean);
        setLocation((prev) => (!prev || prev.trim() === '' ? parts.join(', ') : prev));
      }
    } catch {
      Alert.alert('GPS Error', 'Could not retrieve your location. Please try again.');
      setUseCurrentLocation(false);
    } finally {
      setGpsLoading(false);
    }
  };

  const openMapPicker = () => {
    if (latitude && longitude) {
      setMapPickerRegion({ latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 });
      setPinCoordinate({ latitude, longitude });
    }
    setShowMapPicker(true);
  };

  const confirmMapPin = () => {
    if (pinCoordinate) {
      setLatitude(pinCoordinate.latitude);
      setLongitude(pinCoordinate.longitude);
    }
    setShowMapPicker(false);
  };

  const clearLocation = () => {
    setLatitude(null);
    setLongitude(null);
    setPinCoordinate(null);
    setUseCurrentLocation(false);
  };

  const uploadImageToSupabase = async (uri, userId) => {
    if (uri.startsWith('http')) return uri;
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpeg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('reports').upload(filePath, arrayBuffer, {
      contentType: `image/${fileExt}`,
    });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('reports').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleAiTag = async () => {
    if (!description.trim()) return;
    setAiTagging(true);
    try {
      const { category: suggestedCat, summary } = await summarizeAndTagIncident(description);
      setCategory(suggestedCat);
      setAiSummary(summary);
    } catch (_) {}
    finally { setAiTagging(false); }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !location.trim() || !description.trim()) {
      Alert.alert('Missing Fields', 'Please fill in the title, location, and description.');
      return;
    }
    setLoading(true);
    try {
      // Toxicity check — only when online
      if (isOnline) {
        try {
          const { isToxic, reason } = await checkToxicity(`${title} ${description}`);
          if (isToxic) {
            Alert.alert('Submission Blocked', reason || 'Your report contains inappropriate content.');
            setLoading(false);
            return;
          }
        } catch (_) {}
      }

      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        title: title.trim(),
        category,
        severity,
        location: location.trim(),
        description: description.trim(),
        is_anonymous: isAnonymous,
        image_url: null,
        status: 'pending',
        user_id: user ? user.id : null,
      };
      if (latitude !== null && longitude !== null) {
        payload.latitude = latitude;
        payload.longitude = longitude;
      }

      if (!isOnline) {
        await enqueueReport(payload);
        Alert.alert(
          'Saved Offline',
          'No internet connection. Your report has been saved and will be submitted automatically when you reconnect.',
          [{ text: 'OK', onPress: () => { setTitle(''); setLocation(''); setDescription(''); setImageUri(null); setLatitude(null); setLongitude(null); setPinCoordinate(null); setUseCurrentLocation(false); } }]
        );
        return;
      }

      let publicImageUrl = null;
      if (imageUri) {
        publicImageUrl = await uploadImageToSupabase(imageUri, user ? user.id : 'anonymous');
      }
      payload.image_url = publicImageUrl;

      const { error } = await supabase.from('reports').insert([payload]);
      if (error) throw error;
      Alert.alert('Success', 'Your report has been submitted safely.', [
        {
          text: 'OK',
          onPress: () => {
            setTitle('');
            setLocation('');
            setDescription('');
            setImageUri(null);
            setLatitude(null);
            setLongitude(null);
            setPinCoordinate(null);
            setUseCurrentLocation(false);
            navigation?.navigate('Campus Feed');
          },
        },
      ]);
    } catch (err) {
      Alert.alert('Submission Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={colors.gradientBg} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarPadding, paddingTop: insets.top + 12 }]}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.modeSelector}>
          <Pressable style={styles.modeChip} onPress={onSwitchToInstant}>
            <Ionicons name="camera-outline" size={12} color={colors.textSub} />
            <Text style={styles.modeChipText}>Quick Photo</Text>
          </Pressable>
          <Pressable style={[styles.modeChip, styles.modeChipActive]}>
            <Ionicons name="document-text" size={12} color="#ffffff" />
            <Text style={styles.modeChipTextActive}>Full Report</Text>
          </Pressable>
        </View>

        <Text style={styles.headerTitle}>Report an Incident</Text>
        <Text style={styles.subTitle}>Submit an incident or safety concern on campus.</Text>

        <TouchableOpacity style={styles.quickSnapBanner} onPress={onSwitchToInstant} activeOpacity={0.85}>
          <View style={styles.quickSnapIcon}>
            <Ionicons name="camera" size={22} color="#ffffff" />
          </View>
          <View style={styles.quickSnapBody}>
            <Text style={styles.quickSnapTitle}>Snap it fast instead?</Text>
            <Text style={styles.quickSnapSub}>Take a photo first, add details after — like posting a story</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={24} color="#2563eb" />
        </TouchableOpacity>

        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryContainer}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, category === cat && styles.activeChip]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.chipText, category === cat && styles.activeChipText]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Severity Level</Text>
        <View style={styles.severityContainer}>
          {severities.map((sev) => (
            <TouchableOpacity
              key={sev.label}
              style={[styles.severityChip, { borderColor: sev.color }, severity === sev.label && { backgroundColor: sev.color }]}
              onPress={() => setSeverity(sev.label)}
            >
              <Text style={[styles.severityChipText, { color: severity === sev.label ? '#fff' : sev.color }]}>{sev.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} placeholder="e.g., Broken Lock in Locker Room" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Location / Room #</Text>
        <TextInput style={styles.input} placeholder="e.g., 3rd Floor East Wing or Room 3007" placeholderTextColor={colors.textMuted} value={location} onChangeText={setLocation} />

        <View style={styles.locationSection}>
          <View style={styles.gpsToggleRow}>
            <View style={styles.gpsToggleLeft}>
              <Ionicons name="navigate-circle-outline" size={20} color={colors.primary} />
              <View style={styles.gpsToggleTextGroup}>
                <Text style={styles.gpsToggleLabel}>Use My Current Location</Text>
                <Text style={styles.gpsToggleSub}>Auto-fill address & pin on map</Text>
              </View>
            </View>
            {gpsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch value={useCurrentLocation} onValueChange={handleGpsToggle} trackColor={{ false: colors.border, true: colors.primaryBorder }} thumbColor={useCurrentLocation ? colors.primary : colors.placeholder} />
            )}
          </View>
          {latitude !== null && longitude !== null ? (
            <View style={styles.coordsCard}>
              <View style={styles.coordsLeft}>
                <Ionicons name="location" size={16} color={colors.success} />
                <View>
                  <Text style={styles.coordsText}>{latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
                  <Text style={styles.coordsSub}>GPS coordinates captured</Text>
                </View>
              </View>
              <View style={styles.coordsActions}>
                <TouchableOpacity style={styles.coordsActionBtn} onPress={openMapPicker}>
                  <Ionicons name="map-outline" size={14} color={colors.primary} />
                  <Text style={styles.coordsActionText}>Adjust</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.coordsActionBtn, styles.coordsClearBtn]} onPress={clearLocation}>
                  <Ionicons name="close-circle-outline" size={14} color={colors.danger} />
                  <Text style={[styles.coordsActionText, { color: colors.danger }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.mapPickerBtn} onPress={openMapPicker}>
              <Ionicons name="map-outline" size={18} color={colors.primary} />
              <Text style={styles.mapPickerBtnText}>Drop a Pin on Map</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="Provide as much detail as possible..." placeholderTextColor={colors.textMuted} value={description} onChangeText={(t) => { setDescription(t); setAiSummary(''); }} multiline numberOfLines={4} />
        <TouchableOpacity style={[styles.aiTagBtn, (!description.trim() || aiTagging || !isOnline) && { opacity: 0.5 }]} onPress={handleAiTag} disabled={!description.trim() || aiTagging || !isOnline}>
          {aiTagging ? <ActivityIndicator size="small" color="#2563eb" /> : <Ionicons name="sparkles" size={15} color="#2563eb" />}
          <Text style={styles.aiTagBtnText}>{aiTagging ? 'Analyzing...' : !isOnline ? 'AI unavailable offline' : 'AI Auto-Tag & Summarize'}</Text>
        </TouchableOpacity>
        {!!aiSummary && (
          <View style={styles.aiSummaryBox}>
            <Text style={styles.aiSummaryLabel}>AI Summary</Text>
            <Text style={styles.aiSummaryText}>{aiSummary}</Text>
          </View>
        )}

        <Text style={styles.label}>Attach Photo (Optional)</Text>
        <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
          <Ionicons name="camera-outline" size={20} color={colors.primary} />
          <Text style={styles.imagePickerText}>{imageUri ? 'Change Image' : 'Select Image'}</Text>
        </TouchableOpacity>
        {imageUri && <Image source={{ uri: imageUri }} style={styles.previewImage} />}

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Submit Anonymously</Text>
          <Switch value={isAnonymous} onValueChange={setIsAnonymous} trackColor={{ false: colors.border, true: colors.primaryBorder }} thumbColor={isAnonymous ? colors.primary : colors.placeholder} />
        </View>

        <TouchableOpacity style={[styles.submitBtn, loading && styles.disabledBtn]} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{isOnline ? 'Submit Incident Report' : 'Save for Later (Offline)'}</Text>}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showMapPicker} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowMapPicker(false)}>
        <View style={styles.mapPickerModal}>
          <View style={styles.mapPickerHeader}>
            <TouchableOpacity onPress={() => setShowMapPicker(false)} style={styles.mapPickerClose}>
              <Ionicons name="close" size={22} color={colors.textMain} />
            </TouchableOpacity>
            <Text style={styles.mapPickerTitle}>Pin Incident Location</Text>
            <View style={{ width: 36 }} />
          </View>
          <Text style={styles.mapPickerHint}>Tap anywhere on the map to place a pin</Text>
          <MapView style={styles.mapPickerMap} initialRegion={mapPickerRegion} onPress={(e) => setPinCoordinate(e.nativeEvent.coordinate)}>
            {pinCoordinate && (
              <Marker coordinate={pinCoordinate} draggable onDragEnd={(e) => setPinCoordinate(e.nativeEvent.coordinate)} pinColor={colors.primary} />
            )}
          </MapView>
          <View style={styles.mapPickerFooter}>
            {pinCoordinate && (
              <Text style={styles.mapPickerCoords}>
                <Ionicons name="location" size={13} color={colors.textSub} /> {pinCoordinate.latitude.toFixed(5)}, {pinCoordinate.longitude.toFixed(5)}
              </Text>
            )}
            <TouchableOpacity style={[styles.confirmPinBtn, !pinCoordinate && styles.disabledBtn]} onPress={confirmMapPin} disabled={!pinCoordinate}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.confirmPinText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 0 },
  modeSelector: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 2,
    marginTop: 2,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 1,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  modeChipActive: { backgroundColor: colors.primary },
  modeChipText: { fontSize: 11, fontWeight: '700', color: colors.textSub },
  modeChipTextActive: { fontSize: 11, fontWeight: '800', color: '#ffffff' },
  quickSnapBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primaryBg,
    borderWidth: 1.5,
    borderColor: colors.primaryBorder,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  quickSnapIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickSnapBody: { flex: 1 },
  quickSnapTitle: { fontSize: 14, fontWeight: '800', color: colors.textMain, marginBottom: 2 },
  quickSnapSub: { fontSize: 12, color: colors.textSub, lineHeight: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.textMain, marginBottom: 4 },
  subTitle: { fontSize: 14, color: colors.textSub, marginBottom: 16, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textBody, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 15, color: colors.textMain },
  textArea: { height: 100, textAlignVertical: 'top' },
  categoryContainer: { flexDirection: 'row', marginBottom: 8 },
  severityContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  severityChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, marginRight: 8, marginBottom: 8 },
  severityChipText: { fontSize: 13, fontWeight: '700' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.pillBg, marginRight: 8 },
  activeChip: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSub },
  activeChipText: { color: '#ffffff' },
  locationSection: { marginTop: 12, backgroundColor: colors.primaryBg, borderRadius: 12, borderWidth: 1, borderColor: colors.primaryBorder, padding: 14, gap: 12 },
  gpsToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gpsToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  gpsToggleTextGroup: { flex: 1 },
  gpsToggleLabel: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  gpsToggleSub: { fontSize: 11, color: colors.textSub, marginTop: 1 },
  coordsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.successBg, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: colors.success, gap: 8 },
  coordsLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  coordsText: { fontSize: 12, fontWeight: '700', color: colors.textMain },
  coordsSub: { fontSize: 10, color: colors.textSub },
  coordsActions: { flexDirection: 'row', gap: 8 },
  coordsActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primaryBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  coordsClearBtn: { backgroundColor: colors.dangerBg },
  coordsActionText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  mapPickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: 8, padding: 12, gap: 8 },
  mapPickerBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  imagePickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryBg, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: 8, padding: 12, marginTop: 4 },
  imagePickerText: { marginLeft: 8, color: colors.primary, fontWeight: '600', fontSize: 14 },
  previewImage: { width: '100%', height: 160, borderRadius: 8, marginTop: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 20 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.textMain },
  submitBtn: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  disabledBtn: { backgroundColor: colors.primaryBorder },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  mapPickerModal: { flex: 1, backgroundColor: colors.background },
  mapPickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.headerBg },
  mapPickerClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.pillBg, justifyContent: 'center', alignItems: 'center' },
  mapPickerTitle: { fontSize: 16, fontWeight: '800', color: colors.textMain },
  mapPickerHint: { fontSize: 12, color: colors.textSub, textAlign: 'center', paddingVertical: 8, backgroundColor: colors.headerBg },
  mapPickerMap: { flex: 1 },
  mapPickerFooter: { backgroundColor: colors.cardBg, padding: 16, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
  mapPickerCoords: { fontSize: 12, color: colors.textSub, textAlign: 'center' },
  confirmPinBtn: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 10, gap: 8 },
  confirmPinText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  aiTagBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff' },
  aiTagBtnText: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
  aiSummaryBox: { marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  aiSummaryLabel: { fontSize: 11, fontWeight: '700', color: '#2563eb', textTransform: 'uppercase', marginBottom: 4 },
  aiSummaryText: { fontSize: 13, color: '#1e40af', lineHeight: 18 },
});
