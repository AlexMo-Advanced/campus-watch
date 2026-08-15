import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const WidgetTrashBin = forwardRef(function WidgetTrashBin({ colors, active, bottomInset = 0 }, ref) {
  const rootRef = useRef(null);
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  React.useEffect(() => {
    scale.value = withSpring(active ? 1.08 : 1, { damping: 14, stiffness: 220 });
    glow.value = withTiming(active ? 1 : 0, { duration: 160 });
  }, [active, glow, scale]);

  useImperativeHandle(ref, () => ({
    measureInWindow: (callback) => rootRef.current?.measureInWindow(callback),
  }));

  const binStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderColor: glow.value > 0.5 ? '#ef4444' : colors.border,
    backgroundColor: glow.value > 0.5 ? 'rgba(239,68,68,0.18)' : colors.surfaceSecondary,
  }));

  return (
    <View
      ref={rootRef}
      style={[styles.wrap, { bottom: bottomInset + 12 }]}
      collapsable={false}
    >
      <Animated.View style={[styles.bin, binStyle]}>
        <Ionicons name={active ? 'trash' : 'trash-outline'} size={28} color={active ? '#ef4444' : colors.textSecondary} />
        <Text style={[styles.label, { color: active ? '#ef4444' : colors.textSecondary }]}>
          {active ? 'Release to remove' : 'Drop here to remove'}
        </Text>
      </Animated.View>
    </View>
  );
});

export default WidgetTrashBin;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 20,
  },
  bin: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: { fontSize: 13, fontWeight: '800' },
});
