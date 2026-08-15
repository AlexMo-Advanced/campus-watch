import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  heightForSize,
  pointInRect,
  snapWidgetDimensions,
  widthFractionForWidth,
} from '../../lib/dashboardLayout';
import { useFeedback } from '../../lib/useFeedback';
import { renderDashboardWidget } from './DashboardWidgetContent';

const SPRING = { damping: 18, stiffness: 240, mass: 0.85 };
const HANDLE = 22;
const CORNERS = ['tl', 'tr', 'bl', 'br'];

function clamp(value, min, max) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

export default function DashboardEditableGrid({
  layout,
  editMode,
  colors,
  widgetProps,
  trashBounds,
  onTrashHoverChange,
  onEnterEditMode,
  onUpdateWidget,
  onRemoveWidget,
}) {
  const [gridWidth, setGridWidth] = useState(0);

  const onGridLayout = useCallback((event) => {
    setGridWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View style={styles.grid} onLayout={onGridLayout}>
      {layout.map((item) => (
        <DashboardWidgetTile
          key={item.id}
          item={item}
          editMode={editMode}
          colors={colors}
          widgetProps={widgetProps}
          gridWidth={gridWidth}
          trashBounds={trashBounds}
          onTrashHoverChange={onTrashHoverChange}
          onEnterEditMode={onEnterEditMode}
          onUpdateWidget={onUpdateWidget}
          onRemoveWidget={onRemoveWidget}
          canRemove={layout.length > 1}
        />
      ))}
    </View>
  );
}

function DashboardWidgetTile({
  item,
  editMode,
  colors,
  widgetProps,
  gridWidth,
  trashBounds,
  onTrashHoverChange,
  onEnterEditMode,
  onUpdateWidget,
  onRemoveWidget,
  canRemove,
}) {
  const { tabLongPress, medium } = useFeedback({ silent: editMode });
  const wiggle = useSharedValue(0);
  const scale = useSharedValue(1);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const editModeSv = useSharedValue(editMode ? 1 : 0);
  const gridWidthSv = useSharedValue(gridWidth || 1);

  const baseHeight = heightForSize(item.size);
  const baseWidthFraction = widthFractionForWidth(item.width);
  const previewHeight = useSharedValue(baseHeight);
  const previewWidthFraction = useSharedValue(baseWidthFraction);
  const resizeBaseHeight = useSharedValue(baseHeight);
  const resizeBaseWidth = useSharedValue(baseWidthFraction);

  useEffect(() => {
    gridWidthSv.value = gridWidth || 1;
  }, [gridWidth, gridWidthSv]);

  useEffect(() => {
    previewHeight.value = heightForSize(item.size);
    previewWidthFraction.value = widthFractionForWidth(item.width);
    resizeBaseHeight.value = heightForSize(item.size);
    resizeBaseWidth.value = widthFractionForWidth(item.width);
  }, [item.size, item.width, previewHeight, previewWidthFraction, resizeBaseHeight, resizeBaseWidth]);

  useEffect(() => {
    editModeSv.value = editMode ? 1 : 0;
    if (editMode) {
      wiggle.value = withRepeat(
        withSequence(withTiming(-1.2, { duration: 90 }), withTiming(1.2, { duration: 90 })),
        -1,
        true
      );
    } else {
      wiggle.value = withTiming(0, { duration: 120 });
      scale.value = withSpring(1, SPRING);
      dragX.value = withSpring(0, SPRING);
      dragY.value = withSpring(0, SPRING);
    }
  }, [editMode, editModeSv, wiggle, scale, dragX, dragY]);

  const commitResize = useCallback(
    (height, widthFraction) => {
      const snapped = snapWidgetDimensions(height, widthFraction);
      if (snapped.size !== item.size || snapped.width !== item.width) {
        medium();
        onUpdateWidget(item.id, snapped);
      }
    },
    [item.id, item.size, item.width, medium, onUpdateWidget]
  );

  const checkTrashHover = useCallback(
    (absoluteX, absoluteY) => {
      if (!canRemove || !trashBounds) {
        onTrashHoverChange?.(false);
        return;
      }
      onTrashHoverChange?.(pointInRect(absoluteX, absoluteY, trashBounds));
    },
    [canRemove, onTrashHoverChange, trashBounds]
  );

  const handleDrop = useCallback(
    (absoluteX, absoluteY) => {
      onTrashHoverChange?.(false);
      if (!canRemove || !trashBounds) return;
      if (pointInRect(absoluteX, absoluteY, trashBounds)) {
        medium();
        onRemoveWidget(item.id);
      }
    },
    [canRemove, item.id, medium, onRemoveWidget, onTrashHoverChange, trashBounds]
  );

  const makeCornerGesture = useCallback(
    (corner) =>
      Gesture.Pan()
        .enabled(editMode)
        .onBegin(() => {
          resizeBaseHeight.value = previewHeight.value;
          resizeBaseWidth.value = previewWidthFraction.value;
        })
        .onUpdate((e) => {
          const cw = gridWidthSv.value || 1;
          const startH = resizeBaseHeight.value;
          const startW = resizeBaseWidth.value;
          if (corner === 'br') {
            previewHeight.value = clamp(startH + e.translationY, 110, 250);
            previewWidthFraction.value = clamp(startW + e.translationX / cw, 0.485, 1);
          } else if (corner === 'bl') {
            previewHeight.value = clamp(startH + e.translationY, 110, 250);
            previewWidthFraction.value = clamp(startW - e.translationX / cw, 0.485, 1);
          } else if (corner === 'tr') {
            previewHeight.value = clamp(startH - e.translationY, 110, 250);
            previewWidthFraction.value = clamp(startW + e.translationX / cw, 0.485, 1);
          } else {
            previewHeight.value = clamp(startH - e.translationY, 110, 250);
            previewWidthFraction.value = clamp(startW - e.translationX / cw, 0.485, 1);
          }
        })
        .onEnd(() => {
          runOnJS(commitResize)(previewHeight.value, previewWidthFraction.value);
        }),
    [commitResize, editMode, gridWidthSv, previewHeight, previewWidthFraction, resizeBaseHeight, resizeBaseWidth]
  );

  const bodyPan = Gesture.Pan()
    .enabled(editMode && canRemove)
    .activeOffsetX([-14, 14])
    .activeOffsetY([-14, 14])
    .onBegin(() => {
      scale.value = withSpring(1.04, SPRING);
    })
    .onUpdate((e) => {
      dragX.value = e.translationX;
      dragY.value = e.translationY;
      runOnJS(checkTrashHover)(e.absoluteX, e.absoluteY);
    })
    .onEnd((e) => {
      runOnJS(handleDrop)(e.absoluteX, e.absoluteY);
      dragX.value = withSpring(0, SPRING);
      dragY.value = withSpring(0, SPRING);
      scale.value = withSpring(1, SPRING);
    });

  const tileStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      { rotate: `${wiggle.value * editModeSv.value * 0.4}deg` },
      { scale: scale.value },
    ],
  }));

  const wrapStyle = useAnimatedStyle(() => {
    const widthPx = Math.max(gridWidthSv.value * 0.485, gridWidthSv.value * previewWidthFraction.value);
    return {
      width: widthPx,
      minHeight: previewHeight.value,
    };
  });

  const cardSizeStyle = useAnimatedStyle(() => ({
    minHeight: previewHeight.value,
  }));

  const cornerGestures = useMemo(
    () => ({
      tl: makeCornerGesture('tl'),
      tr: makeCornerGesture('tr'),
      bl: makeCornerGesture('bl'),
      br: makeCornerGesture('br'),
    }),
    [makeCornerGesture]
  );

  const isAi = item.type === 'ai_briefing';
  const borderColor =
    item.type === 'security_index' ? widgetProps.statusInfo?.color : colors.border;

  return (
    <Animated.View style={[styles.tileWrap, wrapStyle]}>
      <GestureDetector gesture={bodyPan}>
        <Animated.View style={[tileStyle, styles.tileInner]}>
          <Pressable
            onLongPress={() => {
              tabLongPress();
              onEnterEditMode();
            }}
            delayLongPress={380}
            style={[
              styles.card,
              isAi && styles.cardAi,
              {
                backgroundColor: isAi ? 'transparent' : colors.surface,
                borderColor: editMode ? colors.primary : borderColor,
                borderWidth: editMode ? 2 : item.type === 'security_index' ? 2 : 1,
              },
            ]}
          >
            <Animated.View style={[styles.cardBody, cardSizeStyle]}>
              {editMode && (
                <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.editBadgeText}>EDIT</Text>
                </View>
              )}

              <View style={[styles.cardInner, isAi && styles.cardInnerAi]}>
                {renderDashboardWidget(item.type, widgetProps)}
              </View>
            </Animated.View>
          </Pressable>

          {editMode &&
            CORNERS.map((corner) => (
              <GestureDetector key={corner} gesture={cornerGestures[corner]}>
                <View
                  style={[
                    styles.resizeHandle,
                    styles[`handle_${corner}`],
                    { backgroundColor: colors.primary, borderColor: colors.surface },
                  ]}
                >
                  <View style={[styles.handleDot, { backgroundColor: colors.surface }]} />
                </View>
              </GestureDetector>
            ))}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  tileWrap: { marginBottom: 2 },
  tileInner: { position: 'relative' },
  card: {
    borderRadius: 16,
    padding: 14,
    overflow: 'visible',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardAi: {
    padding: 0,
  },
  cardBody: { flex: 1 },
  cardInner: { flex: 1, overflow: 'hidden', borderRadius: 14 },
  cardInnerAi: {
    flex: 1,
    alignSelf: 'stretch',
  },
  editBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  editBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  resizeHandle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    elevation: 4,
  },
  handleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  handle_tl: { top: -HANDLE / 2, left: -HANDLE / 2 },
  handle_tr: { top: -HANDLE / 2, right: -HANDLE / 2 },
  handle_bl: { bottom: -HANDLE / 2, left: -HANDLE / 2 },
  handle_br: { bottom: -HANDLE / 2, right: -HANDLE / 2 },
});
