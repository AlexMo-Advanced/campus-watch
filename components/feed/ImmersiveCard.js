import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import ImageCarousel from './ImageCarousel';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchReportLikeMeta, toggleReportLike } from '../../lib/likes';
import { supabase } from '../../lib/supabase';
import { useFeedback } from '../../lib/useFeedback';
import { TAB_BAR_HEIGHT, TAB_BAR_BOTTOM_GAP } from '../../lib/tabBarLayout';

// Severity background gradients for cards with no image
const SEVERITY_BG = {
  Crisis: ['#1a0533', '#3b0764', '#6b21a8'],
  High: ['#1a0505', '#450a0a', '#7f1d1d'],
  Medium: ['#1a0e00', '#451a03', '#78350f'],
  Low: ['#001a0a', '#052e16', '#14532d'],
  default: ['#0a0f1e', '#1e293b', '#0f172a'],
};

// Status badge colors (matching HomeScreen.js)
function getStatusColor(status) {
  switch (status) {
    case 'resolved':
      return '#16a34a';
    case 'under_review':
      return '#d97706';
    default:
      return '#dc2626';
  }
}

function formatTimestamp(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getSeverityAccent(severity) {
  switch (severity) {
    case 'Crisis': return 'rgba(168,85,247,0.85)';
    case 'High':   return 'rgba(239,68,68,0.85)';
    case 'Medium': return 'rgba(245,158,11,0.85)';
    default:       return 'rgba(99,102,241,0.85)';
  }
}

// ---------- Inline Like Button (white, vertical, TikTok-style) ----------
function ImmersiveLikeButton({ reportId }) {
  const { tap, like } = useFeedback();
  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  const refresh = useCallback(async () => {
    if (!reportId) return;
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
    const meta = await fetchReportLikeMeta(reportId, user?.id);
    setLikeCount(meta.likeCount);
    setLikedByMe(meta.likedByMe);
  }, [reportId]);

  useEffect(() => {
    refresh();
    if (!reportId) return undefined;
    const channel = supabase
      .channel(`immersive_likes_${reportId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_likes', filter: `report_id=eq.${reportId}` }, () => refresh())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [reportId, refresh]);

  const handlePress = async () => {
    if (!userId) { Alert.alert('Sign In Required', 'Please sign in to like reports.'); return; }
    tap();
    setLoading(true);
    try {
      const next = await toggleReportLike(reportId, userId, likedByMe);
      setLikedByMe(next);
      setLikeCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
      if (next) like();
    } catch { /* silent */ } finally { setLoading(false); }
  };

  return (
    <TouchableOpacity style={actionStyles.actionBtn} onPress={handlePress} disabled={loading} activeOpacity={0.7}>
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name={likedByMe ? 'heart' : 'heart-outline'} size={28} color={likedByMe ? '#ef4444' : '#fff'} />
      )}
      <Text style={actionStyles.actionLabel}>{likeCount > 0 ? `${likeCount}` : 'Like'}</Text>
    </TouchableOpacity>
  );
}

// ---------- Main Component ----------
export default function ImmersiveCard({ report, isActive, onComment, onExpand, onShare, height }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const severityBg = SEVERITY_BG[report.severity] ?? SEVERITY_BG.default;
  const hasImage = !!report.image_url;
  // Position content above the tab bar area
  const tabBarClearance = TAB_BAR_HEIGHT + Math.max(insets.bottom + TAB_BAR_BOTTOM_GAP, TAB_BAR_BOTTOM_GAP);

  return (
    <View style={[styles.card, { height, width }]}>
      {/* ── Background layer ── */}
      {report.image_urls && report.image_urls.length > 0 ? (
        <ImageCarousel imageUrls={report.image_urls} width={width} height={height} isImmersive={true} />
      ) : hasImage ? (
        <>
          {/* Blurred full-bleed backdrop so no black bars show */}
          <Image
            source={{ uri: report.image_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={25}
            priority={isActive ? 'normal' : 'low'}
          />
          {/* Dark tint over blurred backdrop */}
          <View style={styles.blurTint} />
          {/* Sharp image, properly contained to preserve aspect ratio */}
          <Image
            source={{ uri: report.image_url }}
            style={styles.mainImage}
            contentFit="contain"
            transition={200}
            priority={isActive ? 'high' : 'low'}
          />
        </>
      ) : (
        <LinearGradient colors={severityBg} style={StyleSheet.absoluteFill} />
      )}

      {/* Bottom gradient scrim for text legibility */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.5, 1]}
        style={[styles.scrim, { height: height * 0.55 }]}
      />

      {/* Top scrim */}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent']}
        style={styles.topScrim}
      />

      {/* Top-right: Status badge */}
      <View style={styles.topRight}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) }]}>
          <Text style={styles.statusText}>
            {(report.status || 'pending').replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ── Right-side action column (TikTok-style) ── */}
      <View style={[actionStyles.actionColumn, { bottom: tabBarClearance + 20 }]}>
        <ImmersiveLikeButton reportId={report.id} />

        <TouchableOpacity
          style={actionStyles.actionBtn}
          onPress={() => onComment?.(report)}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-outline" size={26} color="#fff" />
          <Text style={actionStyles.actionLabel}>Comment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={actionStyles.actionBtn}
          onPress={() => onExpand?.(report)}
          activeOpacity={0.7}
        >
          <Ionicons name="expand-outline" size={26} color="#fff" />
          <Text style={actionStyles.actionLabel}>Expand</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={actionStyles.actionBtn}
          onPress={() => onShare?.(report)}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={26} color="#fff" />
          <Text style={actionStyles.actionLabel}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* ── Bottom overlay: content ── */}
      <View style={[styles.overlay, { bottom: tabBarClearance + 10 }]}>
        {/* Severity + Category row */}
        <View style={styles.badgeRow}>
          {report.severity && report.severity !== 'Low' && (
            <View style={[styles.severityPill, { backgroundColor: getSeverityAccent(report.severity) }]}>
              <Text style={styles.severityPillText}>{report.severity.toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>{report.category || 'General'}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {report.title}
        </Text>

        {/* Location */}
        {!!report.location && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.75)" />
            <Text style={styles.locationText} numberOfLines={1}>
              {report.location}
            </Text>
          </View>
        )}

        {/* Description */}
        <Text style={styles.description} numberOfLines={3}>
          {report.description}
        </Text>

        {/* Footer: author + timestamp */}
        <View style={styles.footer}>
          <View style={styles.authorRow}>
            <Ionicons
              name={report.is_anonymous ? 'person-circle-outline' : 'person'}
              size={14}
              color="rgba(255,255,255,0.65)"
            />
            <Text style={styles.authorText}>
              {report.is_anonymous
                ? 'Anonymous Student'
                : report.profiles?.display_name || 'Student'}
            </Text>
          </View>
          <Text style={styles.timestamp}>{formatTimestamp(report.created_at)}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Action column styles ──
const actionStyles = StyleSheet.create({
  actionColumn: {
    position: 'absolute',
    right: 10,
    bottom: 180,
    alignItems: 'center',
    gap: 20,
    zIndex: 10,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 3,
  },
  actionLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

// ── Card styles ──
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#000',
  },
  blurTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  mainImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  topRight: {
    position: 'absolute',
    top: 54,
    right: 16,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  overlay: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 70, // leave room for action column on the right
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  severityPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  severityPillText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  categoryPillText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 11,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  locationText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    flex: 1,
  },
  description: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  authorText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '500',
  },
  timestamp: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
  },
});
