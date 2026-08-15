import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/ThemeContext';

const SCHOOLS = [
  { id: 'gpchs', label: 'Grande Prairie Composite High School', short: 'GPCHS' },
];

export default function OnboardingScreen({ onComplete }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [classrooms, setClassrooms] = useState(['']);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [loading, setLoading] = useState(false);

  const addClassroom = () => {
    if (classrooms.length >= 5) return;
    setClassrooms([...classrooms, '']);
  };

  const updateClassroom = (index, value) => {
    const updated = [...classrooms];
    updated[index] = value;
    setClassrooms(updated);
  };

  const removeClassroom = (index) => {
    if (classrooms.length === 1) return;
    setClassrooms(classrooms.filter((_, i) => i !== index));
  };

  const handleComplete = async () => {
    if (!fullName.trim()) {
      Alert.alert('Missing Info', 'Please enter your full name.');
      return;
    }
    if (!selectedSchool) {
      Alert.alert('Missing Info', 'Please select your school.');
      return;
    }

    const filledClassrooms = classrooms.map((c) => c.trim()).filter(Boolean);

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.auth.updateUser({
        data: {
          display_name: fullName.trim(),
          school: selectedSchool,
          classrooms: filledClassrooms,
          onboarding_complete: true,
        },
      });

      await supabase.from('profiles').upsert({
        id: user.id,
        display_name: fullName.trim(),
        school: selectedSchool,
        classrooms: filledClassrooms,
        updated_at: new Date().toISOString(),
      });

      onComplete();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={colors.backgroundGradient} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.heroRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="shield-checkmark" size={32} color="#2563eb" />
            </View>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Welcome to CampusWatch</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Let's set up your profile so we can personalize your campus safety experience.
          </Text>

          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Full Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.borderInput, color: colors.text }]}
              placeholder="e.g. Alex Johnson"
              placeholderTextColor={colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
          </View>

          {/* School Selection */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Your School</Text>
            {SCHOOLS.map((school) => (
              <TouchableOpacity
                key={school.id}
                style={[
                  styles.schoolOption,
                  { backgroundColor: colors.surface, borderColor: colors.borderInput },
                  selectedSchool === school.id && styles.schoolOptionActive,
                ]}
                onPress={() => setSelectedSchool(school.id)}
                activeOpacity={0.8}
              >
                <View style={styles.schoolOptionLeft}>
                  <View style={[styles.schoolIconBadge, selectedSchool === school.id && { backgroundColor: '#2563eb' }]}>
                    <Ionicons name="school" size={18} color={selectedSchool === school.id ? '#fff' : '#2563eb'} />
                  </View>
                  <View style={styles.schoolTextGroup}>
                    <Text style={[styles.schoolLabel, { color: colors.text }, selectedSchool === school.id && { color: '#2563eb', fontWeight: '800' }]}>
                      {school.label}
                    </Text>
                    <Text style={[styles.schoolShort, { color: colors.textMuted }]}>{school.short}</Text>
                  </View>
                </View>
                {selectedSchool === school.id && (
                  <Ionicons name="checkmark-circle" size={22} color="#2563eb" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Classrooms */}
          <View style={styles.fieldGroup}>
            <View style={styles.classroomHeader}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                Classroom(s) <Text style={{ color: colors.textMuted }}>(up to 5)</Text>
              </Text>
              {classrooms.length < 5 && (
                <TouchableOpacity style={styles.addClassroomBtn} onPress={addClassroom}>
                  <Ionicons name="add-circle" size={20} color="#2563eb" />
                  <Text style={styles.addClassroomText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
            {classrooms.map((room, index) => (
              <View key={index} style={styles.classroomRow}>
                <TextInput
                  style={[styles.input, styles.classroomInput, { backgroundColor: colors.inputBg, borderColor: colors.borderInput, color: colors.text }]}
                  placeholder={`e.g. Room ${200 + index + 1}`}
                  placeholderTextColor={colors.textMuted}
                  value={room}
                  onChangeText={(v) => updateClassroom(index, v)}
                />
                {classrooms.length > 1 && (
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeClassroom(index)}>
                    <Ionicons name="close-circle" size={22} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <Text style={[styles.classroomHint, { color: colors.textMuted }]}>
              Optional — helps us show alerts relevant to your area.
            </Text>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.continueBtn, loading && { opacity: 0.7 }]}
            onPress={handleComplete}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.continueBtnText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 24 },
  heroRow: { alignItems: 'center', marginBottom: 16 },
  heroBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  fieldGroup: { marginBottom: 24 },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
  },
  schoolOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  schoolOptionActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  schoolOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  schoolIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  schoolTextGroup: { flex: 1 },
  schoolLabel: { fontSize: 14, fontWeight: '600' },
  schoolShort: { fontSize: 11, marginTop: 2 },
  classroomHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  addClassroomBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addClassroomText: { color: '#2563eb', fontWeight: '700', fontSize: 13 },
  classroomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  classroomInput: { flex: 1 },
  removeBtn: { padding: 4 },
  classroomHint: { fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
