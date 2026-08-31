import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet } from 'react-native';
import ImmersiveCard from './ImmersiveCard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ImmersiveFeed({ reports }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const renderItem = useCallback(
    ({ item, index }) => (
      <ImmersiveCard report={item} isActive={index === activeIndex} />
    ),
    [activeIndex]
  );

  return (
    <FlatList
      data={reports}
      renderItem={renderItem}
      keyExtractor={(item) => String(item.id)}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={SCREEN_HEIGHT}
      snapToAlignment="start"
      getItemLayout={(_data, index) => ({
        length: SCREEN_HEIGHT,
        offset: SCREEN_HEIGHT * index,
        index,
      })}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      initialNumToRender={2}
      windowSize={3}
      maxToRenderPerBatch={2}
      removeClippedSubviews
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
