import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import MapView, { Marker } from '../components/CustomMapView';
import CommentSection from '../components/CommentSection';
import ReportLikeButton from '../components/ReportLikeButton';
import ShareReportSheet from '../components/ShareReportSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { NOTIFICATION_TYPES } from '../lib/notifications';
import { useNotifications } from '../lib/NotificationContext';
import { useTabBarScrollHandler } from '../lib/TabBarScrollContext';
import { getTabBarClearance } from '../lib/tabBarLayout';
import { useAppTheme } from '../hooks/useAppTheme';
import { useTheme } from '../lib/ThemeContext';
import { getSeverityGradient } from '../lib/theme';
import { useNetwork } from '../lib/NetworkContext';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { onScroll, scrollEventThrottle } = useTabBarScrollHandler();
  const { notifySelfAction, checkNearbyReports } = useNotifications();
  const tabBarPadding = getTabBarClearance(insets);
  const { isDark, colors: themeColors } = useTheme();
  const { isOnline } = useNetwork();
  // Bridge theme color keys to component usage
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
    warningBg: isDark ? '#451a03' : '#fffbeb',
    crisis: isDark ? '#c084fc' : '#9333ea',
    crisisBg: isDark ? '#3b0764' : '#faf5ff',
    pillBg: themeColors.chip,
    placeholder: themeColors.surfaceSecondary,
  };
  const styles = getStyles(colors);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [actionMenuReport, setActionMenuReport] = useState(null);
  const [shareReport, setShareReport] = useState(null);
  const [feedMode, setFeedMode] = useState('Active'); // 'Active' | 'Archive'

  // Filters State
  const [currentUser, setCurrentUser] = useState(null);
  const [timeFilter, setTimeFilter] = useState('All Time'); // All Time, 24h, 7d
  const [severityFilter, setSeverityFilter] = useState('All'); // All, High, Medium, Low
  const [postedByMe, setPostedByMe] = useState(false);

  const fetchReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          profiles:user_id (
            id,
            display_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Auto-delete resolved reports older than 10 days
      const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const toDelete = (data || []).filter(
        (r) =>
          r.status === 'resolved' &&
          now - new Date(r.created_at).getTime() > TEN_DAYS_MS
      );
      if (toDelete.length > 0) {
        await supabase
          .from('reports')
          .delete()
          .in('id', toDelete.map((r) => r.id));
      }

      const remaining = (data || []).filter(
        (r) => !toDelete.some((d) => d.id === r.id)
      );
      setReports(remaining);
      checkNearbyReports(remaining);
    } catch (err) {
      console.error('Error fetching reports:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();

    const channel = supabase
      .channel('home-feed-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        fetchReports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleResolve = async (item) => {
    if (!isOnline) { Alert.alert('Offline', 'You need an internet connection to resolve alerts.'); return; }
    Alert.alert(
      'Resolve Alert',
      'Are you sure you want to mark this alert as resolved? It will be archived.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('reports')
                .update({ status: 'resolved' })
                .eq('id', item.id);
              if (error) throw error;
              await notifySelfAction(NOTIFICATION_TYPES.ALERT_RESOLVED, item);
              fetchReports();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleRevive = async (item) => {
    if (!isOnline) { Alert.alert('Offline', 'You need an internet connection to revive alerts.'); return; }
    Alert.alert(
      'Revive Alert',
      'Move this alert back to the active feed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('reports')
                .update({ status: 'pending' })
                .eq('id', item.id);
              if (error) throw error;
              fetchReports();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (item) => {
    if (!isOnline) { Alert.alert('Offline', 'You need an internet connection to delete alerts.'); return; }
    Alert.alert(
      'Delete Alert',
      'Are you sure you want to delete this alert? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('reports')
                .delete()
                .eq('id', item.id);
              if (error) throw error;
              await notifySelfAction(NOTIFICATION_TYPES.ALERT_DELETED, item);
              if (selectedReport?.id === item.id) setSelectedReport(null);
              fetchReports();
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleLongPress = (item) => {
    const isOwner = currentUser?.id === item.user_id;
    const canResolve = isOwner && item.status !== 'resolved';
    const canRevive = isOwner && item.status === 'resolved';

    if (Platform.OS === 'ios') {
      const options = ['Cancel', 'Open Full Alert & Comments', 'Share Alert'];
      if (canResolve) options.push('Resolve Alert');
      if (canRevive) options.push('Revive Alert');
      if (isOwner) options.push('Delete Alert');
      
      const destructiveIndex = options.indexOf('Delete Alert');
      
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 0,
          destructiveButtonIndex: destructiveIndex !== -1 ? destructiveIndex : undefined,
        },
        (buttonIndex) => {
          const selectedOption = options[buttonIndex];
          if (selectedOption === 'Open Full Alert & Comments') setSelectedReport(item);
          if (selectedOption === 'Share Alert') setShareReport(item);
          if (selectedOption === 'Resolve Alert') handleResolve(item);
          if (selectedOption === 'Revive Alert') handleRevive(item);
          if (selectedOption === 'Delete Alert') handleDelete(item);
        }
      );
    } else {
      setActionMenuReport(item);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved':
        return colors.success;
      case 'under_review':
        return colors.warning;
      default:
        return colors.danger;
    }
  };

  const getFilteredReports = () => {
    return reports.filter(r => {
      // Feed mode: Active shows non-resolved, Archive shows only resolved
      if (feedMode === 'Active' && r.status === 'resolved') return false;
      if (feedMode === 'Archive' && r.status !== 'resolved') return false;

      // Posted By Me Filter
      if (postedByMe && r.user_id !== currentUser?.id) return false;

      // Time Filter (only relevant in Active mode)
      if (feedMode === 'Active') {
        const reportDate = new Date(r.created_at);
        const now = new Date();
        if (timeFilter === '24h' && (now - reportDate) > 24 * 60 * 60 * 1000) return false;
        if (timeFilter === '7d' && (now - reportDate) > 7 * 24 * 60 * 60 * 1000) return false;
      }

      // Severity Filter
      if (severityFilter !== 'All') {
        const severity = r.severity || 'Low';
        if (severity !== severityFilter) return false;
      }

      return true;
    });
  };


  const renderItem = ({ item, index }) => {
    const author = item.profiles;
    const isOwner = currentUser?.id === item.user_id;
    let authorName = item.is_anonymous
      ? 'Anonymous Student'
      : author?.display_name || author?.email?.split('@')[0] || 'Student';

    if (isOwner) {
      authorName = 'You' + (item.is_anonymous ? ' (Anonymous)' : '');
    }

    const avatarUrl = !item.is_anonymous ? author?.avatar_url : null;

    return (
      <Animated.View entering={FadeInDown.delay(index * 100)}>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={() => setSelectedReport(item)}
          onLongPress={() => handleLongPress(item)}
          delayLongPress={400}
        >
        <LinearGradient colors={getSeverityGradient(item.severity, isDark)} style={styles.cardGradient}>
        {/* Author Header Bar */}
        <View style={styles.authorRow}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.authorAvatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons
                name={item.is_anonymous ? 'person-circle-outline' : 'person'}
                size={22}
                color={colors.icon}
              />
            </View>
          )}
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{authorName}</Text>
            <Text style={styles.authorSubtext}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {item.image_url && (
          <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
        )}

        <View style={styles.cardBody}>
          <View style={styles.badgeRow}>
            <Text style={styles.categoryBadge}>{item.category || 'General'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>
                {(item.status || 'pending').replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardLocation}>
            <Ionicons name="location-outline" size={14} color={colors.icon} /> {item.location}
          </Text>
          <Text style={styles.cardDescription} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={styles.cardFooterRow}>
            <Text style={styles.cardFooter}>
              {item.is_anonymous ? 'Submitted Anonymously' : 'Verified Post'}
            </Text>
            <Text style={styles.tapToExpandText}>Hold for options →</Text>
          </View>
        </View>
        </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <LinearGradient colors={colors.gradientBg} style={styles.container}>
      {!isOnline && (
        <View style={styles.offlineBar}>
          <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
          <Text style={styles.offlineBarText}>Showing cached data — offline</Text>
        </View>
      )}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity 
            style={[styles.filterChip, postedByMe && styles.filterChipActive]} 
            onPress={() => setPostedByMe(!postedByMe)}>
            <Ionicons name="person" size={14} color={postedByMe ? "#fff" : colors.icon} />
            <Text style={[styles.filterChipText, postedByMe && styles.filterChipTextActive]}>Posted by Me</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterChip, timeFilter === '24h' && styles.filterChipActive]} 
            onPress={() => setTimeFilter(timeFilter === '24h' ? 'All Time' : '24h')}>
            <Ionicons name="time" size={14} color={timeFilter === '24h' ? "#fff" : colors.icon} />
            <Text style={[styles.filterChipText, timeFilter === '24h' && styles.filterChipTextActive]}>Last 24h</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.filterChip, severityFilter === 'High' && styles.filterChipActive]} 
            onPress={() => setSeverityFilter(severityFilter === 'High' ? 'All' : 'High')}>
            <Ionicons name="warning" size={14} color={severityFilter === 'High' ? "#fff" : colors.icon} />
            <Text style={[styles.filterChipText, severityFilter === 'High' && styles.filterChipTextActive]}>High</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterChip, severityFilter === 'Crisis' && styles.filterChipActive]} 
            onPress={() => setSeverityFilter(severityFilter === 'Crisis' ? 'All' : 'Crisis')}>
            <Ionicons name="alert-circle" size={14} color={severityFilter === 'Crisis' ? "#fff" : colors.icon} />
            <Text style={[styles.filterChipText, severityFilter === 'Crisis' && styles.filterChipTextActive]}>Crisis</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Active / Archive toggle slider */}
        <View style={styles.feedModeToggleWrapper}>
          <View style={styles.feedModeToggle}>
            <TouchableOpacity
              style={[styles.feedModeBtn, feedMode === 'Active' && styles.feedModeBtnActive]}
              onPress={() => setFeedMode('Active')}
            >
              <Ionicons name="radio-button-on" size={14} color={feedMode === 'Active' ? '#fff' : colors.textSub} />
              <Text style={[styles.feedModeBtnText, feedMode === 'Active' && styles.feedModeBtnTextActive]}>Active</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.feedModeBtn, feedMode === 'Archive' && styles.feedModeBtnActive, feedMode === 'Archive' && styles.feedModeBtnArchiveActive]}
              onPress={() => setFeedMode('Archive')}
            >
              <Ionicons name="archive" size={14} color={feedMode === 'Archive' ? '#fff' : colors.textSub} />
              <Text style={[styles.feedModeBtnText, feedMode === 'Archive' && styles.feedModeBtnTextActive]}>Archive</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FlatList
        data={getFilteredReports()}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarPadding }]}
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              fetchReports();
            }}
          />
        }
      />

      {/* Action Menu Modal */}
      <Modal visible={!!actionMenuReport} transparent animationType="fade" onRequestClose={() => setActionMenuReport(null)}>
        <TouchableOpacity
          style={styles.actionMenuOverlay}
          activeOpacity={1}
          onPress={() => setActionMenuReport(null)}
        >
          <View style={styles.actionMenuBox}>
            <Text style={styles.actionMenuTitle}>{actionMenuReport?.title}</Text>
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                const rep = actionMenuReport;
                setActionMenuReport(null);
                setSelectedReport(rep);
              }}
            >
              <Ionicons name="expand" size={18} color={colors.primary} />
              <Text style={styles.actionMenuText}>Open Full Alert & Comments</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                const rep = actionMenuReport;
                setActionMenuReport(null);
                setShareReport(rep);
              }}
            >
              <Ionicons name="share-social-outline" size={18} color={colors.primary} />
              <Text style={styles.actionMenuText}>Share Alert</Text>
            </TouchableOpacity>

            {actionMenuReport && currentUser?.id === actionMenuReport.user_id && actionMenuReport.status !== 'resolved' && (
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  const rep = actionMenuReport;
                  setActionMenuReport(null);
                  handleResolve(rep);
                }}
              >
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.actionMenuText}>Resolve Alert</Text>
              </TouchableOpacity>
            )}

            {actionMenuReport && currentUser?.id === actionMenuReport.user_id && actionMenuReport.status === 'resolved' && (
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  const rep = actionMenuReport;
                  setActionMenuReport(null);
                  handleRevive(rep);
                }}
              >
                <Ionicons name="refresh-circle" size={18} color={colors.primary} />
                <Text style={styles.actionMenuText}>Revive Alert</Text>
              </TouchableOpacity>
            )}

            {actionMenuReport && currentUser?.id === actionMenuReport.user_id && (
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  const rep = actionMenuReport;
                  setActionMenuReport(null);
                  handleDelete(rep);
                }}
              >
                <Ionicons name="trash" size={18} color={colors.danger} />
                <Text style={[styles.actionMenuText, { color: colors.danger }]}>Delete Alert</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Detail & Comments Modal */}
      <Modal
        visible={!!selectedReport}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSelectedReport(null)}
      >
        {selectedReport && (
          <KeyboardAvoidingView
            style={styles.modalContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedReport(null)}>
                <Ionicons name="arrow-back" size={20} color={colors.textMain} />
                <Text style={styles.backBtnText}>Back to Feed</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Incident Details</Text>
              <TouchableOpacity style={styles.shareHeaderBtn} onPress={() => setShareReport(selectedReport)}>
                <Ionicons name="share-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {selectedReport.image_url && (
                <Image
                  source={{ uri: selectedReport.image_url }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />
              )}

              <View style={styles.modalBadgeRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.categoryBadge, { marginRight: 8 }]}>{selectedReport.category || 'General'}</Text>
                  {selectedReport.severity && (
                    <Text style={[
                      styles.categoryBadge,
                      selectedReport.severity === 'Crisis' ? { backgroundColor: '#fce7f3', color: '#9d174d' } :
                      selectedReport.severity === 'High' ? { backgroundColor: '#fee2e2', color: '#dc2626' } :
                      selectedReport.severity === 'Medium' ? { backgroundColor: '#fef3c7', color: '#d97706' } :
                      selectedReport.severity === 'Low' ? { backgroundColor: '#dcfce7', color: '#16a34a' } :
                      {}
                    ]}>
                      {selectedReport.severity}
                    </Text>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedReport.status) }]}>
                  <Text style={styles.statusText}>
                    {(selectedReport.status || 'pending').replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.modalTitle}>{selectedReport.title}</Text>

              <View style={styles.modalActionRow}>
                <ReportLikeButton reportId={selectedReport.id} colors={colors} />
                <TouchableOpacity
                  style={[styles.shareInlineBtn, { backgroundColor: colors.primaryBg, borderColor: colors.primaryBorder }]}
                  onPress={() => setShareReport(selectedReport)}
                >
                  <Ionicons name="share-social-outline" size={16} color={colors.primary} />
                  <Text style={[styles.shareInlineText, { color: colors.primary }]}>Share</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.metaBox}>
                <Text style={styles.metaText}>
                  <Ionicons name="location-outline" size={14} color={colors.icon} /> Location: {selectedReport.location}
                </Text>
                <Text style={styles.metaText}>
                  <Ionicons name="time-outline" size={14} color={colors.icon} /> Logged: {new Date(selectedReport.created_at).toLocaleString()}
                </Text>
                {currentUser?.id === selectedReport.user_id && selectedReport.status !== 'resolved' && (
                  <TouchableOpacity
                    style={styles.resolveBtnDetail}
                    onPress={() => {
                       handleResolve(selectedReport);
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={styles.resolveBtnDetailText}>Resolve Alert</Text>
                  </TouchableOpacity>
                )}
                {currentUser?.id === selectedReport.user_id && (
                  <TouchableOpacity
                    style={[styles.resolveBtnDetail, { backgroundColor: colors.danger, marginTop: 8 }]}
                    onPress={() => {
                       handleDelete(selectedReport);
                    }}
                  >
                    <Ionicons name="trash" size={16} color="#fff" />
                    <Text style={styles.resolveBtnDetailText}>Delete Alert</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.sectionHeaderLabel}>Full Description</Text>
              <Text style={styles.modalDescription}>{selectedReport.description}</Text>

              {/* Mini-map for geo-tagged reports */}
              {selectedReport.latitude != null && selectedReport.longitude != null && (
                <>
                  <Text style={[styles.sectionHeaderLabel, { marginTop: 16 }]}>Incident Location</Text>
                  <View style={styles.miniMapContainer}>
                    <MapView
                      style={styles.miniMap}
                      initialRegion={{
                        latitude: selectedReport.latitude,
                        longitude: selectedReport.longitude,
                        latitudeDelta: 0.003,
                        longitudeDelta: 0.003,
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                      pointerEvents="none"
                    >
                      <Marker
                        coordinate={{ latitude: selectedReport.latitude, longitude: selectedReport.longitude }}
                        pinColor={
                          selectedReport.status === 'resolved' ? colors.success
                          : selectedReport.status === 'under_review' ? colors.warning
                          : colors.danger
                        }
                      />
                    </MapView>
                  </View>
                </>
              )}

              <View style={styles.divider} />

              <CommentSection
                reportId={selectedReport.id}
                report={selectedReport}
                colors={colors}
                isDark={isDark}
                channelPrefix="home_comments"
              />
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </Modal>

      <ShareReportSheet
        visible={!!shareReport}
        report={shareReport}
        isDark={isDark}
        onClose={() => setShareReport(null)}
      />
    </LinearGradient>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  offlineBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#92400e', paddingVertical: 6 },
  offlineBarText: { color: '#fef3c7', fontSize: 12, fontWeight: '600' },
  filterSection: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 0, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  filterScroll: { flexDirection: 'row', marginBottom: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  feedModeToggleWrapper: { alignItems: 'center', paddingBottom: 12 },
  feedModeToggle: { flexDirection: 'row', backgroundColor: colors.placeholder, borderRadius: 20, padding: 3 },
  feedModeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 7, borderRadius: 18, gap: 6 },
  feedModeBtnActive: { backgroundColor: colors.primary },
  feedModeBtnArchiveActive: { backgroundColor: colors.warning },
  feedModeBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSub },
  feedModeBtnTextActive: { color: '#ffffff' },
  filterChipText: { fontSize: 13, color: colors.textSub, fontWeight: '600', marginLeft: 4 },
  filterChipTextActive: { color: '#ffffff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  listContent: { padding: 16 },
  card: { borderRadius: 12, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.cardBorder, elevation: 2, backgroundColor: colors.cardBg },
  cardGradient: { },
  
  authorRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  authorAvatar: { width: 38, height: 38, borderRadius: 19, marginRight: 10, backgroundColor: colors.pillBg },
  avatarPlaceholder: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.placeholder, justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: colors.border },
  authorInfo: { justifyContent: 'center' },
  authorName: { fontSize: 14, fontWeight: '700', color: colors.textMain },
  authorSubtext: { fontSize: 11, color: colors.textSub, marginTop: 1 },

  cardImage: { width: '100%', height: 180 },
  cardBody: { padding: 16 },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryBadge: { backgroundColor: colors.primaryBg, color: colors.primary, fontWeight: '700', fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: '#ffffff', fontWeight: '700', fontSize: 10 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.textMain, marginBottom: 4 },
  cardLocation: { fontSize: 13, color: colors.textSub, marginBottom: 8 },
  cardDescription: { fontSize: 14, color: colors.textBody, lineHeight: 20, marginBottom: 12 },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardFooter: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  tapToExpandText: { fontSize: 11, color: colors.primary, fontWeight: '700' },

  actionMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  actionMenuBox: { width: '80%', backgroundColor: colors.cardBg, borderRadius: 12, padding: 20 },
  actionMenuTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14, color: colors.textMain },
  actionMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  actionMenuText: { marginLeft: 10, fontSize: 14, fontWeight: '600', color: colors.textBody },

  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.cardBorder, backgroundColor: colors.headerBg },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backBtnText: { marginLeft: 6, fontSize: 15, fontWeight: '700', color: colors.textMain },
  modalHeaderTitle: { fontSize: 16, fontWeight: '700', color: colors.textSub, flex: 1, textAlign: 'center' },
  shareHeaderBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalContent: { padding: 20 },
  modalImage: { width: '100%', height: 220, borderRadius: 12, marginBottom: 16 },
  modalBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: colors.textMain, marginBottom: 8 },
  modalActionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  shareInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 12,
  },
  shareInlineText: { fontSize: 14, fontWeight: '800' },
  metaBox: { backgroundColor: colors.headerBg, padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: colors.cardBorder },
  metaText: { fontSize: 13, color: colors.textBody, marginBottom: 4 },
  sectionHeaderLabel: { fontSize: 13, fontWeight: '700', color: colors.textSub, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  modalDescription: { fontSize: 15, color: colors.textBody, lineHeight: 22, marginBottom: 10 },
  divider: { height: 1, backgroundColor: colors.cardBorder, marginVertical: 20 },
  resolveBtnDetail: { backgroundColor: colors.success, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  resolveBtnDetailText: { color: '#ffffff', fontWeight: '700', fontSize: 14, marginLeft: 6 },

  miniMapContainer: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  miniMap: { width: '100%', height: 180 },
});