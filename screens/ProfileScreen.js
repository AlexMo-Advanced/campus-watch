import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  REPORT_MODE_INSTANT,
  REPORT_MODE_STANDARD,
} from '../lib/reportPreferences';
import { useReportMode } from '../lib/ReportModeContext';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/ThemeContext';
import { useHaptics } from '../lib/HapticsContext';
import { useSounds } from '../lib/SoundsContext';
import NotificationInboxPanel from '../components/NotificationInboxPanel';

export default function ProfileScreen({ navigation }) {
  const { isDark, colors, setDarkMode, dynamicGradients, setDynamicGradients } = useTheme();
  const { enabled: hapticsEnabled, setEnabled: setHapticsEnabled } = useHaptics();
  const {
    effectsEnabled: soundsEnabled,
    setEffectsEnabled: setSoundsEnabled,
    notificationsEnabled: notificationSoundsEnabled,
    setNotificationsEnabled: setNotificationSoundsEnabled,
  } = useSounds();
  const { preference, setPreference } = useReportMode();
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [email, setEmail] = useState('');
  const [archivedReports, setArchivedReports] = useState([]);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;

      if (user) {
        setEmail(user.email || '');
        setDisplayName(user.user_metadata?.display_name || '');
        setAvatarUri(user.user_metadata?.avatar_url || null);

        // Fetch archived reports
        const { data: reportsData } = await supabase
          .from('reports')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'resolved')
          .order('created_at', { ascending: false });
        
        if (reportsData) {
          setArchivedReports(reportsData);
        }
      }
    } catch (err) {
      console.log('Error loading profile:', err.message);
    }
  };

  // 1. Pick Image from Phone Library
  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'You need to allow access to your photos to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      // Set local preview state immediately
      setAvatarUri(result.assets[0].uri);
    }
  };

  // 2. Upload Local Image File to Supabase Storage Bucket
  const uploadAvatarToSupabase = async (uri, userId) => {
    // If avatarUri is already a web URL, skip re-uploading
    if (uri.startsWith('http')) return uri;

    // Convert local URI into ArrayBuffer for binary upload
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });

    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpeg';
    const filePath = `${userId}/avatar.${fileExt}`;

    // Upload ArrayBuffer to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, arrayBuffer, {
        contentType: `image/${fileExt}`,
        upsert: true, // Overwrite existing avatar if present
      });

    if (uploadError) throw uploadError;

    // Retrieve public CDN URL for the uploaded avatar
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

    // Append timestamp to bust cache when updating
    return `${data.publicUrl}?t=${Date.now()}`;
  };

  // 3. Save Updated Profile Information
  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('User session not found.');

      let publicAvatarUrl = avatarUri;

      if (avatarUri && !avatarUri.startsWith('http')) {
        publicAvatarUrl = await uploadAvatarToSupabase(avatarUri, user.id);
      }

      // Update metadata in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          avatar_url: publicAvatarUrl,
        },
      });

      if (updateError) throw updateError;

      // Also upsert into the public profiles table for relational joins (e.g. Campus Feed)
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: user.id,
        display_name: displayName,
        avatar_url: publicAvatarUrl,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) throw upsertError;

      setAvatarUri(publicAvatarUrl);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (err) {
      Alert.alert('Upload Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Error', error.message);
  };

  const checkForUpdates = () => navigation.navigate('Updates');

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={[styles.timeBadge, { color: colors.textSecondary }]}>
        {dynamicGradients
          ? `${colors.timePeriodLabel} palette · shifts through the day`
          : 'Classic light gradient · dynamic backgrounds off'}
      </Text>
        
        {/* Avatar Section */}
        <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickImage}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="person" size={50} color={colors.textSecondary} />
            </View>
          )}
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={16} color="#ffffff" />
          </View>
        </TouchableOpacity>
        <Text style={[styles.emailText, { color: colors.textSecondary }]}>{email}</Text>

        <NotificationInboxPanel />

        {/* Display Name Input */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textLabel }]}>Display Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.borderInput, color: colors.inputText }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your name"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Preferences Toggle */}
        <View style={[styles.sectionRow, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          <View style={styles.rowInfo}>
            <Ionicons name={isDark ? "moon" : "sunny"} size={22} color={isDark ? "#facc15" : colors.primary} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Dark Mode</Text>
          </View>
          <Switch value={isDark} onValueChange={setDarkMode} />
        </View>

        <View style={[styles.sectionRow, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          <View style={[styles.rowInfo, styles.rowInfoFlex]}>
            <Ionicons name="color-palette-outline" size={22} color={colors.primary} />
            <View style={styles.rowTextFlex}>
              <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                Dynamic Background
              </Text>
              <Text style={[styles.reportPrefSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {dynamicGradients ? 'Time-of-day gradients' : 'Classic static gradient'}
              </Text>
            </View>
          </View>
          <Switch value={dynamicGradients} onValueChange={setDynamicGradients} />
        </View>

        <View style={[styles.sectionRow, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          <View style={[styles.rowInfo, styles.rowInfoFlex]}>
            <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} />
            <View style={styles.rowTextFlex}>
              <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                Haptic Feedback
              </Text>
              <Text style={[styles.reportPrefSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {hapticsEnabled ? 'Taps, nav bar & AI' : 'Vibration off'}
              </Text>
            </View>
          </View>
          <Switch value={hapticsEnabled} onValueChange={setHapticsEnabled} />
        </View>

        <View style={[styles.sectionRow, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          <View style={[styles.rowInfo, styles.rowInfoFlex]}>
            <Ionicons name="volume-medium-outline" size={22} color={colors.primary} />
            <View style={styles.rowTextFlex}>
              <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                Sound Effects
              </Text>
              <Text style={[styles.reportPrefSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {soundsEnabled ? 'Taps, likes & sends' : 'Interaction sounds off'}
              </Text>
            </View>
          </View>
          <Switch value={soundsEnabled} onValueChange={setSoundsEnabled} />
        </View>

        <View style={[styles.sectionRow, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          <View style={[styles.rowInfo, styles.rowInfoFlex]}>
            <Ionicons name="notifications-outline" size={22} color={colors.primary} />
            <View style={styles.rowTextFlex}>
              <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                Notification Sounds
              </Text>
              <Text style={[styles.reportPrefSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {notificationSoundsEnabled ? 'Alerts, comments & likes' : 'Silent notifications'}
              </Text>
            </View>
          </View>
          <Switch value={notificationSoundsEnabled} onValueChange={setNotificationSoundsEnabled} />
        </View>

        {/* Default Report Mode */}
        <View style={[styles.reportPrefSection, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          <View style={styles.reportPrefHeader}>
            <Ionicons name="camera-outline" size={22} color={colors.primary} />
            <View style={styles.reportPrefHeaderText}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Default Report Mode</Text>
              <Text style={[styles.reportPrefSub, { color: colors.textSecondary }]}>
                Opens when you tap Report on the nav bar
              </Text>
            </View>
          </View>
          <View style={styles.reportPrefRow}>
            <TouchableOpacity
              style={[styles.reportPrefChip, preference === REPORT_MODE_INSTANT && styles.reportPrefChipActive]}
              onPress={() => setPreference(REPORT_MODE_INSTANT)}
            >
              <Ionicons name="camera" size={16} color={preference === REPORT_MODE_INSTANT ? '#ffffff' : colors.primary} />
              <Text style={[styles.reportPrefChipText, preference === REPORT_MODE_INSTANT && styles.reportPrefChipTextActive]}>
                Quick Photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reportPrefChip, preference === REPORT_MODE_STANDARD && styles.reportPrefChipActive]}
              onPress={() => setPreference(REPORT_MODE_STANDARD)}
            >
              <Ionicons name="document-text-outline" size={16} color={preference === REPORT_MODE_STANDARD ? '#ffffff' : colors.textSecondary} />
              <Text style={[styles.reportPrefChipText, preference === REPORT_MODE_STANDARD && styles.reportPrefChipTextActive]}>
                Standard
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.reportPrefHint, { color: colors.textMuted }]}>
            Tip: Hold the Report button to pick a mode without changing your default
          </Text>
        </View>

        {/* Archived Alerts */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textLabel }]}>Archived Alerts ({archivedReports.length})</Text>
          {archivedReports.length === 0 ? (
            <Text style={[styles.noArchivedText, { color: colors.textSecondary }]}>No archived alerts found.</Text>
          ) : (
            archivedReports.map(report => (
              <View key={report.id} style={[styles.archivedCard, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
                <View style={styles.archivedHeader}>
                  <Text style={[styles.archivedTitle, { color: colors.text }]}>{report.title}</Text>
                  <Text style={[styles.archivedDate, { color: colors.textSecondary }]}>{new Date(report.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.archivedDesc, { color: colors.textBody }]} numberOfLines={2}>{report.description}</Text>
              </View>
            ))
          )}
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSaveProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Check for Updates */}
        <TouchableOpacity
          style={styles.updateBtn}
          onPress={checkForUpdates}
        >
          <Ionicons name="cloud-download-outline" size={18} color="#2563eb" />
          <Text style={styles.updateBtnText}>Check for Updates</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Build Information */}
        <View style={styles.buildInfo}>
          <Text style={[styles.buildPowered, { color: colors.textMuted }]}>Powered by StephenOS, in collaboration with Park Fellas.</Text>
          <Text style={[styles.buildVersion, { color: colors.textMuted }]}>Version 1.0.0</Text>
          <Text style={[styles.buildCopy, { color: colors.textMuted }]}>StephenOS Technologies 2026 ©</Text>
        </View>

    </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 24, alignItems: 'center' },
  timeBadge: { fontSize: 11, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  avatarWrapper: { position: 'relative', marginBottom: 12, marginTop: 10 },
  avatarImage: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: '#2563eb' },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#2563eb',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  emailText: { fontSize: 14, fontWeight: '500', marginBottom: 24 },
  section: { width: '100%', marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  input: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  sectionRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 12,
  },
  rowInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowInfoFlex: { flex: 1, minWidth: 0, marginRight: 8 },
  rowTextFlex: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  reportPrefSection: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 12,
  },
  reportPrefHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  reportPrefHeaderText: { flex: 1 },
  reportPrefSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  reportPrefRow: { flexDirection: 'row', gap: 8 },
  reportPrefChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  reportPrefChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  reportPrefChipText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  reportPrefChipTextActive: { color: '#ffffff' },
  reportPrefHint: { fontSize: 11, marginTop: 10, lineHeight: 15, fontStyle: 'italic' },
  saveBtn: {
    width: '100%',
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    padding: 12,
  },
  signOutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  updateBtnText: { color: '#2563eb', fontWeight: '700', fontSize: 15 },
  noArchivedText: { fontSize: 14, fontStyle: 'italic', marginTop: 4 },
  archivedCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  archivedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  archivedTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  archivedDate: { fontSize: 12, marginLeft: 8 },
  archivedDesc: { fontSize: 13, lineHeight: 18 },
  buildInfo: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 16,
    gap: 4,
  },
  buildPowered: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  buildVersion: { fontSize: 11, textAlign: 'center' },
  buildCopy: { fontSize: 11, textAlign: 'center' },
});