import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTabBarScrollControls } from '../../lib/TabBarScrollContext';
import ImmersiveCard from './ImmersiveCard';

export default function ImmersiveFeed({ reports, onComment, onExpand, onShare }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const { showTabBar } = useTabBarScrollControls();

  useEffect(() => {
    showTabBar?.();
  }, [showTabBar]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const handleLayout = useCallback((e) => {
    setContainerHeight(e.nativeEvent.layout.height);
  }, []);

  const renderItem = useCallback(
    ({ item, index }) => (
      <ImmersiveCard
        report={item}
        isActive={index === activeIndex}
        onComment={onComment}
        onExpand={onExpand}
        onShare={onShare}
        height={containerHeight}
      />
    ),
    [activeIndex, onComment, onExpand, onShare, containerHeight]
  );

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {containerHeight > 0 && (
        <FlatList
          data={reports}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={containerHeight}
          snapToAlignment="start"
          getItemLayout={(_data, index) => ({
            length: containerHeight,
            offset: containerHeight * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          scrollEventThrottle={16}
          initialNumToRender={2}
          windowSize={3}
          maxToRenderPerBatch={2}
          removeClippedSubviews
          style={{ flex: 1 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
