import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { WidgetRegistry } from '../widgets/WidgetRegistry';

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
};

export default function DraggableWidget({ 
  item, 
  colWidth, 
  rowHeight, 
  isEditing, 
  onDragEnd, 
  onResizeEnd,
  onRemove
}) {
  const isDragging = useSharedValue(false);
  const isResizing = useSharedValue(false);
  
  const translateX = useSharedValue(item.grid_x * colWidth);
  const translateY = useSharedValue(item.grid_y * rowHeight);
  const width = useSharedValue(item.width * colWidth);
  const height = useSharedValue(item.height * rowHeight);
  
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startW = useSharedValue(0);
  const startH = useSharedValue(0);

  // Jiggle animation state
  const rotation = useSharedValue(0);

  // Sync with external updates (e.g. initial load or swap)
  useEffect(() => {
    if (!isDragging.value) {
      translateX.value = withSpring(item.grid_x * colWidth, SPRING_CONFIG);
      translateY.value = withSpring(item.grid_y * rowHeight, SPRING_CONFIG);
    }
    if (!isResizing.value) {
      width.value = withSpring(item.width * colWidth, SPRING_CONFIG);
      height.value = withSpring(item.height * rowHeight, SPRING_CONFIG);
    }
  }, [item.grid_x, item.grid_y, item.width, item.height, colWidth, rowHeight]);

  // Jiggle effect when editing
  useEffect(() => {
    if (isEditing) {
      // Small random offset so they don't all jiggle in perfect sync
      const randomDelay = Math.random() * 200;
      setTimeout(() => {
        if (isEditing) {
          rotation.value = withRepeat(
            withSequence(
              withTiming(-1, { duration: 120 }),
              withTiming(1, { duration: 120 })
            ),
            -1,
            true
          );
        }
      }, randomDelay);
    } else {
      rotation.value = withTiming(0);
    }
  }, [isEditing]);

  const dragGesture = Gesture.Pan()
    .enabled(isEditing)
    .onStart(() => {
      isDragging.value = true;
      startX.value = translateX.value;
      startY.value = translateY.value;
      // Stop jiggle on the dragged item
      rotation.value = withTiming(0);
    })
    .onUpdate((e) => {
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;
    })
    .onEnd((e) => {
      isDragging.value = false;
      
      // If dragged near the bottom of the screen, remove it (assume bottom 150px)
      if (e.absoluteY > Dimensions.get('window').height - 150) {
        runOnJS(onRemove)(item.id);
        return;
      }
      
      const finalX = startX.value + e.translationX;
      const finalY = startY.value + e.translationY;
      
      const newGridX = Math.round(finalX / colWidth);
      const newGridY = Math.round(finalY / rowHeight);
      
      // Clamp values roughly to grid boundaries (12 cols max)
      const clampedX = Math.max(0, Math.min(newGridX, 12 - item.width));
      const clampedY = Math.max(0, newGridY); // No strict bottom limit, scrolls vertically
      
      runOnJS(onDragEnd)(item.id, clampedX, clampedY);
    });

  const resizeGesture = Gesture.Pan()
    .enabled(isEditing)
    .onStart(() => {
      isResizing.value = true;
      startW.value = width.value;
      startH.value = height.value;
    })
    .onUpdate((e) => {
      width.value = Math.max(colWidth, startW.value + e.translationX);
      height.value = Math.max(rowHeight, startH.value + e.translationY);
    })
    .onEnd((e) => {
      isResizing.value = false;
      const finalW = startW.value + e.translationX;
      const finalH = startH.value + e.translationY;
      
      const newWidth = Math.round(finalW / colWidth);
      const newHeight = Math.round(finalH / rowHeight);
      
      const clampedW = Math.max(2, Math.min(newWidth, 12 - item.grid_x));
      const clampedH = Math.max(2, newHeight);
      
      runOnJS(onResizeEnd)(item.id, clampedW, clampedH);
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotation.value}deg` },
        { scale: isDragging.value ? 1.05 : 1 }
      ],
      width: width.value,
      height: height.value,
      zIndex: isDragging.value || isResizing.value ? 100 : 1,
    };
  });

  const WidgetComponent = WidgetRegistry[item.widget_type]?.component;

  if (!WidgetComponent) return null;

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={styles.widgetContentWrapper}>
          <WidgetComponent width={item.width} height={item.height} />
        </View>
        
        {isEditing && (
          <GestureDetector gesture={resizeGesture}>
            <View style={styles.resizeHandle}>
              <View style={styles.resizeHandleInner} />
            </View>
          </GestureDetector>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    padding: 8, // Gap between widgets
  },
  widgetContentWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  resizeHandle: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 6,
    zIndex: 10
  },
  resizeHandleInner: {
    width: 16,
    height: 16,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#3b82f6',
    borderBottomRightRadius: 8,
  }
});
