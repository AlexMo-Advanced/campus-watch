import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../lib/NetworkContext';

export default function OfflineBanner() {
  const { isOnline, wasOffline } = useNetwork();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-80)).current;
  const prevOnline = useRef(true);

  useEffect(() => {
    if (!isOnline) {
      // Slide in
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 260,
      }).start();
    } else if (prevOnline.current === false) {
      // Slide out after brief "back online" display
      setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -120,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 2000);
    }
    prevOnline.current = isOnline;
  }, [isOnline, translateY]);

  const isBackOnline = isOnline && wasOffline;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          top: 0,
          paddingTop: insets.top + 8,
          paddingBottom: 8,
          backgroundColor: isBackOnline ? '#16a34a' : '#dc2626',
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <Ionicons
        name={isBackOnline ? 'checkmark-circle' : 'cloud-offline-outline'}
        size={16}
        color="#fff"
      />
      <Text style={styles.text}>
        {isBackOnline ? 'Back online' : 'No internet connection'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
