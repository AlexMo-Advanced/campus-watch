import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const CARD_W = 1080;
const CARD_H = 1350;

function severityColors(severity) {
  switch (severity) {
    case 'Crisis':
      return ['#9333ea', '#581c87'];
    case 'High':
      return ['#dc2626', '#991b1b'];
    case 'Medium':
      return ['#d97706', '#92400e'];
    case 'Low':
      return ['#16a34a', '#166534'];
    default:
      return ['#2563eb', '#1e40af'];
  }
}

const ReportShareCard = forwardRef(function ReportShareCard({ report }, ref) {
  if (!report) return null;

  const gradient = severityColors(report.severity);
  const statusLabel = (report.status || 'pending').replace('_', ' ').toUpperCase();

  return (
    <View ref={ref} style={styles.offscreen} collapsable={false}>
      <View style={styles.card}>
        <LinearGradient colors={gradient} style={styles.headerBand}>
          <View style={styles.brandRow}>
            <Ionicons name="shield-checkmark" size={28} color="#ffffff" />
            <Text style={styles.brandText}>Campus Watch</Text>
          </View>
          <Text style={styles.headerLabel}>Incident Alert</Text>
        </LinearGradient>

        {report.image_url ? (
          <Image source={{ uri: report.image_url }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Ionicons name="alert-circle" size={64} color="#64748b" />
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{report.category || 'General'}</Text>
            </View>
            <View style={[styles.badge, styles.severityBadge]}>
              <Text style={styles.badgeText}>{report.severity || 'Low'}</Text>
            </View>
            <View style={[styles.badge, styles.statusBadge]}>
              <Text style={styles.badgeText}>{statusLabel}</Text>
            </View>
          </View>

          <Text style={styles.title}>{report.title}</Text>

          <View style={styles.metaBlock}>
            <View style={styles.metaRow}>
              <Ionicons name="location" size={18} color="#2563eb" />
              <Text style={styles.metaText}>{report.location || 'Campus location not specified'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="time" size={18} color="#2563eb" />
              <Text style={styles.metaText}>
                {new Date(report.created_at).toLocaleString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            {report.latitude != null && report.longitude != null && (
              <View style={styles.metaRow}>
                <Ionicons name="navigate" size={18} color="#2563eb" />
                <Text style={styles.metaText}>
                  {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionLabel}>Full Description</Text>
          <Text style={styles.description}>{report.description}</Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Shared via Campus Watch</Text>
            <Text style={styles.footerHash}>#CampusWatch #CampusSafety</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

export default ReportShareCard;

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: 0,
    width: CARD_W,
    height: CARD_H,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  headerBand: {
    paddingHorizontal: 40,
    paddingTop: 48,
    paddingBottom: 32,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  brandText: { color: '#ffffff', fontSize: 28, fontWeight: '900', letterSpacing: 0.5 },
  headerLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 18, fontWeight: '600' },
  heroImage: { width: '100%', height: 420 },
  heroPlaceholder: {
    width: '100%',
    height: 420,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { flex: 1, padding: 40 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  badge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  severityBadge: { backgroundColor: '#fef3c7' },
  statusBadge: { backgroundColor: '#f1f5f9' },
  badgeText: { color: '#1e293b', fontSize: 16, fontWeight: '800' },
  title: { fontSize: 42, fontWeight: '900', color: '#0f172a', lineHeight: 50, marginBottom: 24 },
  metaBlock: { gap: 12, marginBottom: 28, backgroundColor: '#f8fafc', borderRadius: 16, padding: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaText: { flex: 1, fontSize: 18, color: '#334155', fontWeight: '600', lineHeight: 24 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  description: { fontSize: 22, color: '#334155', lineHeight: 32, flex: 1 },
  footer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#e2e8f0',
  },
  footerText: { fontSize: 16, color: '#64748b', fontWeight: '600' },
  footerHash: { fontSize: 16, color: '#2563eb', fontWeight: '800', marginTop: 4 },
});
