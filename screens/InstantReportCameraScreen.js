import { Ionicons } from '@expo/vector-icons';
import { Camera as VisionCamera, useCameraDevice, useCameraPermission as useVisionCameraPermission } from 'react-native-vision-camera';
import { CameraView, useCameraPermissions as useExpoCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeedback } from '../lib/useFeedback';

export default function InstantReportCameraScreen({ onPhotoTaken, onSwitchToStandard, onClose }) {
  const insets = useSafeAreaInsets();
  const { medium } = useFeedback();
  const cameraRef = useRef(null);
  const isWeb = Platform.OS === 'web';

  // Vision Camera (Native) hooks
  const visionPerm = useVisionCameraPermission();
  const [facing, setFacing] = useState('back');
  const device = useCameraDevice(facing);

  // Expo Camera (Web) hooks
  const [expoPerm, requestExpoPerm] = useExpoCameraPermissions();

  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState('off');

  const hasPermission = isWeb ? expoPerm?.granted : visionPerm.hasPermission;
  const requestPermission = isWeb ? requestExpoPerm : visionPerm.requestPermission;

  useEffect(() => {
    if (!hasPermission && hasPermission !== null) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const takePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      if (isWeb) {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
        if (photo?.uri) {
          onPhotoTaken(photo.uri);
        }
      } else {
        if (typeof cameraRef.current?.takePhoto !== 'function') {
          // Native bridge not ready — most likely the react-native-vision-camera
          // plugin is missing from app.json or the dev client needs a rebuild.
          throw new Error('takePhoto is not available on the camera ref. Rebuild the dev client after adding the react-native-vision-camera plugin to app.json.');
        }
        const photo = await cameraRef.current.takePhoto({ 
          qualityPrioritization: 'speed',
          enableShutterSound: false,
          flash: flash === 'on' ? 'on' : 'off',
        });
        if (photo?.path) {
          onPhotoTaken(`file://${photo.path}`);
        }
      }
    } catch (err) {
      // Log the real Vision Camera error so we can diagnose it.
      // CameraCaptureError exposes `.code` (e.g. 'capture/file-io-error') and `.message`.
      console.error('[CameraCapture] code:', err?.code, '| message:', err?.message, '| raw:', err);
      Alert.alert(
        'Camera Error',
        `Could not capture photo.\n\nCode: ${err?.code ?? 'unknown'}\nMessage: ${err?.message ?? String(err)}`,
      );
    } finally {
      setCapturing(false);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      onPhotoTaken(result.assets[0].uri);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.permissionScreen}>
        <Ionicons name="camera-outline" size={56} color="#94a3b8" />
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionSub}>Allow camera access to snap incident photos instantly.</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Enable Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.permissionLink} onPress={onSwitchToStandard}>
          <Text style={styles.permissionLinkText}>Use standard report instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isWeb ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing={facing}
          flash={flash}
        />
      ) : device ? (
        <VisionCamera
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          device={device}
          isActive={true}
          photo={true}
        />
      ) : (
        <View style={StyleSheet.absoluteFillObject} backgroundColor="#000" />
      )}

      {/* Top overlay */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.topBtn} onPress={onClose}>
          <Ionicons name="close" size={24} color="#ffffff" />
        </TouchableOpacity>

        <Animated.View entering={FadeInDown.duration(300)} style={styles.modeSelector}>
          <Pressable style={[styles.modeChip, styles.modeChipActive]} onPress={() => {}}>
            <Ionicons name="camera" size={14} color="#ffffff" />
            <Text style={styles.modeChipTextActive}>Quick Photo</Text>
          </Pressable>
          <Pressable style={styles.modeChip} onPress={onSwitchToStandard}>
            <Ionicons name="document-text-outline" size={14} color="#ffffff" />
            <Text style={styles.modeChipText}>Full Report</Text>
          </Pressable>
        </Animated.View>

        <TouchableOpacity
          style={styles.topBtn}
          onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
        >
          <Ionicons name={flash === 'on' ? 'flash' : 'flash-off'} size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.hintText}>Point at the incident and tap to capture</Text>

        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.sideBtn} onPress={pickFromGallery}>
            <Ionicons name="images-outline" size={26} color="#ffffff" />
            <Text style={styles.sideBtnLabel}>Gallery</Text>
          </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
          onPress={takePhoto}
          onPressIn={medium}
            disabled={capturing}
            activeOpacity={0.85}
          >
            <View style={styles.captureBtnInner}>
              {capturing ? (
                <ActivityIndicator color="#2563eb" />
              ) : (
                <View style={styles.captureBtnCore} />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sideBtn}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          >
            <Ionicons name="camera-reverse-outline" size={26} color="#ffffff" />
            <Text style={styles.sideBtnLabel}>Flip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  permissionScreen: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: { fontSize: 20, fontWeight: '800', color: '#f8fafc', marginTop: 16, marginBottom: 8 },
  permissionSub: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  permissionBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  permissionBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  permissionLink: { marginTop: 16, padding: 8 },
  permissionLinkText: { color: '#93c5fd', fontWeight: '600', fontSize: 14 },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    zIndex: 10,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 22,
    padding: 3,
    gap: 2,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  modeChipActive: { backgroundColor: '#2563eb' },
  modeChipText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  modeChipTextActive: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  hintText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 36,
  },
  sideBtn: { alignItems: 'center', gap: 4, width: 64 },
  sideBtnLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600' },
  captureBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnDisabled: { opacity: 0.6 },
  captureBtnInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtnCore: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
});
