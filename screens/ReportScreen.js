import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  REPORT_MODE_INSTANT,
  REPORT_MODE_STANDARD,
} from '../lib/reportPreferences';
import { useReportMode } from '../lib/ReportModeContext';
import { useTabBarHiddenLock } from '../lib/TabBarScrollContext';
import { useLockdown } from '../lib/LockdownContext';
import InstantReportCameraScreen from './InstantReportCameraScreen';
import InstantReportDetailsScreen from './InstantReportDetailsScreen';
import StandardReportScreen from './StandardReportScreen';

export default function ReportScreen({ navigation }) {
  const { preference, consumeLaunchMode, ready } = useReportMode();
  const { setReportingActive } = useLockdown();
  const [mode, setMode] = useState(REPORT_MODE_STANDARD);
  const [instantStep, setInstantStep] = useState('camera');
  const [photoUri, setPhotoUri] = useState(null);
  const inDetailsRef = useRef(false);
  const isFocused = useIsFocused();

  useTabBarHiddenLock(isFocused && mode === REPORT_MODE_INSTANT);

  useFocusEffect(
    useCallback(() => {
      setReportingActive(true);
      return () => setReportingActive(false);
    }, [setReportingActive])
  );

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;

      if (inDetailsRef.current) return;

      const launchMode = consumeLaunchMode() ?? preference;
      setMode(launchMode);
      setInstantStep('camera');
      setPhotoUri(null);
    }, [ready, preference, consumeLaunchMode])
  );

  const handlePhotoTaken = (uri) => {
    setPhotoUri(uri);
    setInstantStep('details');
    inDetailsRef.current = true;
  };

  const handleRetake = () => {
    setPhotoUri(null);
    setInstantStep('camera');
    inDetailsRef.current = false;
  };

  const handlePostSuccess = () => {
    inDetailsRef.current = false;
    setPhotoUri(null);
    setInstantStep('camera');
    navigation.navigate('Campus Feed');
  };

  const switchToInstant = () => {
    setMode(REPORT_MODE_INSTANT);
    setInstantStep('camera');
    setPhotoUri(null);
    inDetailsRef.current = false;
  };

  const switchToStandard = () => {
    setMode(REPORT_MODE_STANDARD);
    setInstantStep('camera');
    setPhotoUri(null);
    inDetailsRef.current = false;
  };

  const handleCameraClose = () => {
    navigation.navigate('Home');
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (mode === REPORT_MODE_INSTANT) {
    if (instantStep === 'details' && photoUri) {
      return (
        <InstantReportDetailsScreen
          photoUri={photoUri}
          onRetake={handleRetake}
          onSuccess={handlePostSuccess}
        />
      );
    }

    return (
      <InstantReportCameraScreen
        onPhotoTaken={handlePhotoTaken}
        onSwitchToStandard={switchToStandard}
        onClose={handleCameraClose}
      />
    );
  }

  return (
    <StandardReportScreen
      navigation={navigation}
      onSwitchToInstant={switchToInstant}
    />
  );
}
