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
import ProximityConsentModal from '../components/ProximityConsentModal';
import LanguagePickerModal from '../components/LanguagePickerModal';
import { useProximity } from '../lib/ProximityContext';
import { useLockdown } from '../lib/LockdownContext';
import { useLanguage } from '../lib/LanguageContext';
import { useTranslation } from 'react-i18next';

export default function ProfileScreen({ navigation }) {
  const { isDark, colors, setDarkMode, dynamicGradients, setDynamicGradients, themeMode, setThemeMode } = useTheme();
  const { enabled: hapticsEnabled, setEnabled: setHapticsEnabled } = useHaptics();
  const {
    effectsEnabled: soundsEnabled,
    setEffectsEnabled: setSoundsEnabled,
    notificationsEnabled: notificationSoundsEnabled,
    setNotificationsEnabled: setNotificationSoundsEnabled,
    preview: previewSound,
  } = useSounds();
  const {
    enabled: proximityEnabled,
    ready: proximityReady,
    bleAvailable,
    setEnabled: setProximityEnabled,
  } = useProximity();
  const { lockdownEnabled, setLockdownEnabled } = useLockdown();
  const [consentVisible, setConsentVisible] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const { t } = useTranslation();
  const { language, languages } = useLanguage();
  const currentLanguageLabel = t(languages.find((l) => l.code === language)?.labelKey || 'language.english');
  const { preference, setPreference } = useReportMode();
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [email, setEmail] = useState('');
  const [archivedReports, setArchivedReports] = useState([]);

  useEffect(() => {
    loadUserProfile();
  }, []);

  useEffect(() => {
    navigation?.setOptions?.({ title: t('settings.profileCenter') });
  }, [navigation, t, language]);

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
      Alert.alert(t('settings.permissionRequired'), t('settings.photoPermission'));
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
      Alert.alert(t('common.success'), t('settings.profileSaved'));
    } catch (err) {
      Alert.alert(t('settings.uploadError'), err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert(t('common.error'), error.message);
  };

  const checkForUpdates = () => navigation.navigate('Updates');

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={[styles.timeBadge, { color: colors.textSecondary }]}>
        {dynamicGradients
          ? t('settings.timeBadgeDynamic', { period: colors.timePeriodLabel })
          : t('settings.timeBadgeClassic')}
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

        {/* ── ACCOUNT ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.account')}</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          <View style={styles.groupRow}>
            <View style={styles.rowInfo}>
              <Ionicons name="person-outline" size={20} color={colors.primary} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.displayName')}</Text>
            </View>
          </View>
          <TextInput
            style={[styles.inlineInput, { backgroundColor: colors.inputBg, borderColor: colors.borderInput, color: colors.inputText }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t('settings.enterYourName')}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile} disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveBtnText}>{t('settings.saveProfile')}</Text>}
        </TouchableOpacity>

        {/* ── APP LANGUAGE ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('language.title')}</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          <TouchableOpacity style={styles.groupRow} onPress={() => setLanguagePickerVisible(true)} activeOpacity={0.7}>
            <View style={[styles.rowInfo, styles.rowInfoFlex]}>
              <Ionicons name="language-outline" size={20} color={colors.primary} />
              <View style={styles.rowTextFlex}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{t('language.title')}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{currentLanguageLabel}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── APPEARANCE ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.appearance')}</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          <View style={styles.groupRow}>
            <View style={styles.rowInfo}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={isDark ? '#facc15' : colors.primary} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.theme')}</Text>
            </View>
          </View>
          <View style={styles.themePicker}>
            {[
              { id: 'light', labelKey: 'settings.themeLight', icon: 'sunny' },
              { id: 'system', labelKey: 'settings.themeSystem', icon: 'phone-portrait-outline' },
              { id: 'dark', labelKey: 'settings.themeDark', icon: 'moon' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.themeChip, { borderColor: colors.borderInput, backgroundColor: colors.inputBg }, themeMode === opt.id && styles.themeChipActive]}
                onPress={() => setThemeMode(opt.id)}
              >
                <Ionicons name={opt.icon} size={16} color={themeMode === opt.id ? '#fff' : colors.textSecondary} />
                <Text style={[styles.themeChipText, { color: colors.textSecondary }, themeMode === opt.id && { color: '#fff' }]}>{t(opt.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.groupDivider} />
          <View style={styles.groupRow}>
            <View style={[styles.rowInfo, styles.rowInfoFlex]}>
              <Ionicons name="color-palette-outline" size={20} color={colors.primary} />
              <View style={styles.rowTextFlex}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.dynamicBackground')}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{dynamicGradients ? t('settings.dynamicOn') : t('settings.dynamicOff')}</Text>
              </View>
            </View>
            <Switch value={dynamicGradients} onValueChange={setDynamicGradients} />
          </View>
        </View>

        {/* ── SOUND & HAPTICS ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.soundHaptics')}</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          <View style={styles.groupRow}>
            <View style={[styles.rowInfo, styles.rowInfoFlex]}>
              <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
              <View style={styles.rowTextFlex}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.hapticFeedback')}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{hapticsEnabled ? t('settings.hapticsOn') : t('settings.hapticsOff')}</Text>
              </View>
            </View>
            <Switch value={hapticsEnabled} onValueChange={setHapticsEnabled} />
          </View>
          <View style={styles.groupDivider} />
          <View style={styles.groupRow}>
            <View style={[styles.rowInfo, styles.rowInfoFlex]}>
              <Ionicons name="volume-medium-outline" size={20} color={colors.primary} />
              <View style={styles.rowTextFlex}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.appSounds')}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{soundsEnabled ? t('settings.appSoundsOn') : t('settings.appSoundsOff')}</Text>
              </View>
            </View>
            <Switch value={soundsEnabled} onValueChange={setSoundsEnabled} />
          </View>
          {soundsEnabled && (
            <>
              <View style={styles.groupDivider} />
              <TouchableOpacity style={styles.groupRow} onPress={() => previewSound('tap')} activeOpacity={0.7}>
                <View style={styles.rowInfo}>
                  <Ionicons name="play-circle-outline" size={20} color={colors.primary} />
                  <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.testSound')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </>
          )}
          <View style={styles.groupDivider} />
          <View style={styles.groupRow}>
            <View style={[styles.rowInfo, styles.rowInfoFlex]}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              <View style={styles.rowTextFlex}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.notificationSounds')}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{notificationSoundsEnabled ? t('settings.notificationSoundsOn') : t('settings.notificationSoundsSilent')}</Text>
              </View>
            </View>
            <Switch value={notificationSoundsEnabled} onValueChange={setNotificationSoundsEnabled} />
          </View>
        </View>

        {/* ── NEARBY ALERTS (PRIVACY-FIRST) ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.nearbyAlerts')}</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          <View style={styles.groupRow}>
            <View style={[styles.rowInfo, styles.rowInfoFlex]}>
              <Ionicons name="radio-outline" size={20} color={colors.primary} />
              <View style={styles.rowTextFlex}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.proximityToggle')}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                  {proximityEnabled ? t('settings.proximityOn') : t('settings.proximityOff')}
                </Text>
              </View>
            </View>
            <Switch
              value={proximityEnabled}
              disabled={!proximityReady}
              onValueChange={(value) => {
                if (value) {
                  setConsentVisible(true);
                } else {
                  setProximityEnabled(false);
                }
              }}
            />
          </View>
          {proximityEnabled && !bleAvailable && (
            <Text style={[styles.reportPrefHint, { color: colors.textMuted, paddingHorizontal: 16, paddingBottom: 12 }]}>
              {t('settings.proximityBleHint')}
            </Text>
          )}
          <View style={styles.groupDivider} />
          <View style={styles.groupRow}>
            <View style={[styles.rowInfo, styles.rowInfoFlex]}>
              <Ionicons name="alert-circle-outline" size={20} color="#ef4444" />
              <View style={styles.rowTextFlex}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.lockdownToggle')}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
                  {lockdownEnabled ? t('settings.lockdownOn') : t('settings.lockdownOff')}
                </Text>
              </View>
            </View>
            <Switch value={lockdownEnabled} onValueChange={setLockdownEnabled} />
          </View>
        </View>

        {/* ── REPORTING ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.reporting')}</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          <View style={styles.groupRow}>
            <View style={[styles.rowInfo, styles.rowInfoFlex]}>
              <Ionicons name="camera-outline" size={20} color={colors.primary} />
              <View style={styles.rowTextFlex}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.defaultReportMode')}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{t('settings.defaultReportHint')}</Text>
              </View>
            </View>
          </View>
          <View style={[styles.reportPrefRow, { paddingHorizontal: 16, paddingBottom: 14 }]}>
            <TouchableOpacity
              style={[styles.reportPrefChip, preference === REPORT_MODE_INSTANT && styles.reportPrefChipActive]}
              onPress={() => setPreference(REPORT_MODE_INSTANT)}
            >
              <Ionicons name="camera" size={16} color={preference === REPORT_MODE_INSTANT ? '#fff' : colors.primary} />
              <Text style={[styles.reportPrefChipText, preference === REPORT_MODE_INSTANT && styles.reportPrefChipTextActive]}>{t('settings.quickPhoto')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reportPrefChip, preference === REPORT_MODE_STANDARD && styles.reportPrefChipActive]}
              onPress={() => setPreference(REPORT_MODE_STANDARD)}
            >
              <Ionicons name="document-text-outline" size={16} color={preference === REPORT_MODE_STANDARD ? '#fff' : colors.textSecondary} />
              <Text style={[styles.reportPrefChipText, preference === REPORT_MODE_STANDARD && styles.reportPrefChipTextActive]}>{t('settings.standard')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.reportPrefHint, { color: colors.textMuted, paddingHorizontal: 16, paddingBottom: 12 }]}>
            {t('settings.reportModeTip')}
          </Text>
        </View>

        {/* ── MY REPORTS ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.myReports')}</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          {archivedReports.length === 0 ? (
            <View style={[styles.groupRow, { justifyContent: 'center' }]}>
              <Text style={[styles.rowSub, { color: colors.textMuted, fontStyle: 'italic' }]}>{t('settings.noArchived')}</Text>
            </View>
          ) : (
            archivedReports.map((report, i) => (
              <View key={report.id}>
                {i > 0 && <View style={styles.groupDivider} />}
                <View style={[styles.groupRow, { flexDirection: 'column', alignItems: 'flex-start', gap: 4 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                    <Text style={[styles.rowLabel, { color: colors.text, flex: 1 }]}>{report.title}</Text>
                    <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{new Date(report.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Text style={[styles.rowSub, { color: colors.textBody }]} numberOfLines={2}>{report.description}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── APP ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.app')}</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          <TouchableOpacity style={styles.groupRow} onPress={checkForUpdates}>
            <View style={styles.rowInfo}>
              <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.checkUpdates')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── ACCOUNT ACTIONS ── */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.accountActions')}</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface, borderColor: colors.borderInput }]}>
          <TouchableOpacity style={styles.groupRow} onPress={handleSignOut}>
            <View style={styles.rowInfo}>
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
              <Text style={[styles.rowLabel, { color: '#ef4444' }]}>{t('settings.signOut')}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Build Information */}
        <View style={styles.buildInfo}>
          <Text style={[styles.buildPowered, { color: colors.textMuted }]}>{t('settings.poweredBy')}</Text>
          <Text style={[styles.buildVersion, { color: colors.textMuted }]}>{t('settings.version')}</Text>
          <Text style={[styles.buildCopy, { color: colors.textMuted }]}>{t('settings.copyright')}</Text>
        </View>

    </ScrollView>

    <ProximityConsentModal
      visible={consentVisible}
      onAccept={() => {
        setConsentVisible(false);
        setProximityEnabled(true);
      }}
      onDecline={() => setConsentVisible(false)}
    />
    <LanguagePickerModal visible={languagePickerVisible} onClose={() => setLanguagePickerVisible(false)} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, alignItems: 'center' },
  timeBadge: { fontSize: 11, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  avatarWrapper: { position: 'relative', marginBottom: 12, marginTop: 10 },
  avatarImage: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: '#2563eb' },
  avatarPlaceholder: { width: 110, height: 110, borderRadius: 55, justifyContent: 'center', alignItems: 'center' },
  cameraBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: '#2563eb', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#ffffff' },
  emailText: { fontSize: 14, fontWeight: '500', marginBottom: 20 },
  // Section titles
  sectionTitle: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 20, marginLeft: 4 },
  // Grouped card
  settingsGroup: { width: '100%', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  groupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  groupDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e2e8f0', marginLeft: 16 },
  inlineInput: { marginHorizontal: 16, marginBottom: 14, padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 15 },
  rowInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowInfoFlex: { flex: 1, minWidth: 0, marginRight: 8 },
  rowTextFlex: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  // Report mode chips
  reportPrefRow: { flexDirection: 'row', gap: 8 },
  reportPrefChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  reportPrefChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  reportPrefChipText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  reportPrefChipTextActive: { color: '#ffffff' },
  reportPrefHint: { fontSize: 11, lineHeight: 15, fontStyle: 'italic' },
  themePicker: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  themeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  themeChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  themeChipText: { fontSize: 12, fontWeight: '700' },
  // Save button
  saveBtn: { width: '100%', backgroundColor: '#2563eb', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  // Build info
  buildInfo: { alignItems: 'center', marginTop: 32, marginBottom: 16, gap: 4 },
  buildPowered: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  buildVersion: { fontSize: 11, textAlign: 'center' },
  buildCopy: { fontSize: 11, textAlign: 'center' },
});