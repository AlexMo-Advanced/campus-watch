import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import MapView, { Callout, Marker } from '../components/CustomMapView';
import CommentSection from '../components/CommentSection';
import ReportLikeButton from '../components/ReportLikeButton';
import ShareReportSheet from '../components/ShareReportSheet';
import { LinearGradient } from 'expo-linear-gradient';
import { NOTIFICATION_TYPES } from '../lib/notifications';
import { useNotifications } from '../lib/NotificationContext';
import { supabase } from '../lib/supabase';
import { useTabBarScrollControls } from '../lib/TabBarScrollContext';
import { useTheme } from '../lib/ThemeContext';

const DEFAULT_REGION = {
  latitude: 55.1707,
  longitude: -118.7947,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapScreen() {
  const { hideTabBar, showTabBar } = useTabBarScrollControls();
  const { notifySelfAction, checkNearbyReports } = useNotifications();
  const { isDark, colors: themeColors } = useTheme();
  const colors = {
    background: themeColors.background,
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
    success: isDark ? '#4ade80' : '#16a34a',
    warning: isDark ? '#fbbf24' : '#d97706',
    placeholder: themeColors.surfaceSecondary,
  };
  const styles = getStyles(colors);
  
  const mapRef = useRef(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [shareReport, setShareReport] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);

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
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const validReports = (data || []).filter(
        (r) => r.latitude != null && r.longitude != null &&
               !isNaN(r.latitude) && !isNaN(r.longitude)
      );
      setReports(validReports);
      checkNearbyReports(validReports);
    } catch (err) {
      console.error('Error fetching map reports:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const initUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = loc.coords;
        setUserLocation({ latitude, longitude });
        setMapRegion({ latitude, longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 });
        return;
      }
    } catch (_) {}
    setMapRegion(DEFAULT_REGION);
  };

  // Auto-center after map ready (fallback if GPS was slow)
  const autoCenterMap = async (reportList) => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }, 600);
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        };
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        setMapRegion(region);
        mapRef.current?.animateToRegion(region, 800);
        return;
      }
    } catch (_) {}

    if (reportList.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(
        reportList.map((r) => ({ latitude: r.latitude, longitude: r.longitude })),
        { edgePadding: { top: 80, right: 60, bottom: 160, left: 60 }, animated: true }
      );
    }
  };

  const recenterToUser = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Enable location access to recenter the map.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      };
      mapRef.current?.animateToRegion(region, 600);
    } catch (err) {
      Alert.alert('Location Error', 'Could not get your current location.');
    }
  };

  useEffect(() => {
    initUserLocation();
    fetchReports();

    const channel = supabase
      .channel('map-reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        fetchReports();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Once data is loaded AND map is ready, auto-center
  useEffect(() => {
    if (!loading && mapReady) {
      autoCenterMap(reports);
    }
  }, [loading, mapReady]);

  const getMarkerColor = (status) => {
    switch (status) {
      case 'resolved': return colors.success;
      case 'under_review': return colors.warning;
      default: return colors.danger;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved': return colors.success;
      case 'under_review': return colors.warning;
      default: return colors.danger;
    }
  };

  const handleResolve = async (item) => {
    Alert.alert('Resolve Alert', 'Mark this alert as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('reports').update({ status: 'resolved' }).eq('id', item.id);
            if (error) throw error;
            await notifySelfAction(NOTIFICATION_TYPES.ALERT_RESOLVED, item);
            fetchReports();
            setSelectedReport(null);
          } catch (err) { Alert.alert('Error', err.message); }
        }
      }
    ]);
  };

  const handleDelete = async (item) => {
    Alert.alert('Delete Alert', 'Delete this alert? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('reports').delete().eq('id', item.id);
            if (error) throw error;
            await notifySelfAction(NOTIFICATION_TYPES.ALERT_DELETED, item);
            setSelectedReport(null);
            fetchReports();
          } catch (err) { Alert.alert('Error', err.message); }
        }
      }
    ]);
  };

  if (loading || !mapRegion) {
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{!mapRegion ? 'Finding your location…' : 'Loading campus map…'}</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion || DEFAULT_REGION}
        userLocation={userLocation}
        showsUserLocation
        showsMyLocationButton={false}
        onMapReady={() => {
          setMapReady(true);
        }}
        onRegionChangeStart={() => hideTabBar?.()}
        onRegionChangeComplete={() => showTabBar?.()}
      >
        {reports.map((report) => (
          <Marker
            key={report.id}
            coordinate={{ latitude: report.latitude, longitude: report.longitude }}
            pinColor={getMarkerColor(report.status)}
            title={report.title}
            onPress={() => setSelectedReport(report)}
          >
            <Callout onPress={() => setSelectedReport(report)}>
              <View style={styles.calloutBox}>
                <Text style={styles.calloutTitle} numberOfLines={2}>{report.title}</Text>
                <View style={styles.calloutBadgeRow}>
                  <Text style={styles.calloutCategory}>{report.category || 'General'}</Text>
                  <View style={[styles.calloutStatus, { backgroundColor: getMarkerColor(report.status) }]}>
                    <Text style={styles.calloutStatusText}>{(report.status || 'pending').replace('_', ' ').toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.calloutLocation} numberOfLines={1}>
                  {report.location}
                </Text>
                <Text style={styles.calloutTap}>Tap to view details →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Empty state overlay */}
      {reports.length === 0 && !loading && (
        <View style={styles.emptyMapOverlay}>
          <View style={styles.emptyMapCard}>
            <Ionicons name="map-outline" size={32} color={colors.icon} />
            <Text style={styles.emptyMapTitle}>No Mapped Incidents</Text>
            <Text style={styles.emptyMapSub}>Reports submitted with GPS location will appear as pins here.</Text>
          </View>
        </View>
      )}

      {/* Floating recenter button */}
      <TouchableOpacity style={styles.recenterBtn} onPress={recenterToUser}>
        <Ionicons name="navigate" size={20} color={colors.primary} />
      </TouchableOpacity>

      {/* Report count badge */}
      <View style={styles.countBadge}>
        <Ionicons name="map-outline" size={14} color="#fff" />
        <Text style={styles.countText}>{reports.length} incident{reports.length !== 1 ? 's' : ''} mapped</Text>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { label: 'Pending', color: colors.danger },
          { label: 'Under Review', color: colors.warning },
          { label: 'Resolved', color: colors.success },
        ].map(({ label, color }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Detail Modal */}
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
                <Text style={styles.backBtnText}>Back to Map</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Incident Details</Text>
              <TouchableOpacity style={styles.shareHeaderBtn} onPress={() => setShareReport(selectedReport)}>
                <Ionicons name="share-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {selectedReport.image_url && (
                <Image source={{ uri: selectedReport.image_url }} style={styles.modalImage} resizeMode="cover" />
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
                  <Text style={styles.statusText}>{(selectedReport.status || 'pending').replace('_', ' ').toUpperCase()}</Text>
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
                  <Ionicons name="location-outline" size={14} color={colors.icon} /> {selectedReport.location}
                </Text>
                <Text style={styles.metaText}>
                  <Ionicons name="time-outline" size={14} color={colors.icon} /> {new Date(selectedReport.created_at).toLocaleString()}
                </Text>
                {currentUser?.id === selectedReport.user_id && selectedReport.status !== 'resolved' && (
                  <TouchableOpacity style={styles.resolveBtnDetail} onPress={() => handleResolve(selectedReport)}>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={styles.resolveBtnDetailText}>Resolve Alert</Text>
                  </TouchableOpacity>
                )}
                {currentUser?.id === selectedReport.user_id && (
                  <TouchableOpacity style={[styles.resolveBtnDetail, { backgroundColor: colors.danger, marginTop: 8 }]} onPress={() => handleDelete(selectedReport)}>
                    <Ionicons name="trash" size={16} color="#fff" />
                    <Text style={styles.resolveBtnDetailText}>Delete Alert</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Embedded mini-map */}
              <Text style={styles.sectionHeaderLabel}>Incident Location</Text>
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
                    pinColor={getMarkerColor(selectedReport.status)}
                  />
                </MapView>
              </View>

              <Text style={styles.sectionHeaderLabel}>Full Description</Text>
              <Text style={styles.modalDescription}>{selectedReport.description}</Text>

              <View style={styles.divider} />

              <CommentSection
                reportId={selectedReport.id}
                report={selectedReport}
                colors={colors}
                isDark={isDark}
                channelPrefix="map_comments"
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
  map: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.textSub },

  markerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },

  calloutBox: {
    width: 200,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  calloutTitle: { fontSize: 13, fontWeight: '700', color: colors.textMain, marginBottom: 6 },
  calloutBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  calloutCategory: { fontSize: 10, fontWeight: '700', color: colors.primary, backgroundColor: colors.primaryBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  calloutStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  calloutStatusText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  calloutLocation: { fontSize: 11, color: colors.textSub, marginBottom: 6 },
  calloutTap: { fontSize: 10, color: colors.primary, fontWeight: '700', textAlign: 'right' },

  recenterBtn: {
    position: 'absolute',
    right: 16,
    bottom: 160,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  countBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.headerBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  countText: { color: colors.textMain, fontSize: 12, fontWeight: '700' },

  legend: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    padding: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, color: colors.textMain, fontWeight: '600' },

  // Modal styles
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
  categoryBadge: { backgroundColor: colors.primaryBg, color: colors.primary, fontWeight: '700', fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: '#ffffff', fontWeight: '700', fontSize: 10 },
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
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  miniMap: { width: '100%', height: 180 },

  emptyMapOverlay: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  emptyMapCard: {
    backgroundColor: colors.cardBg, // fallback from rgba but will rely on colors
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyMapTitle: { fontSize: 15, fontWeight: '700', color: colors.textMain },
  emptyMapSub: { fontSize: 12, color: colors.textSub, textAlign: 'center', maxWidth: 240 },
});
