import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image'; // Use expo-image for better performance, or react-native Image

const { width: screenWidth } = Dimensions.get('window');

export default function ImageCarousel({ imageUrls, width = screenWidth, height = 300, isImmersive = false }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.floor(event.nativeEvent.contentOffset.x / slideSize);
    if (index !== activeIndex && index >= 0 && index < imageUrls.length) {
      setActiveIndex(index);
    }
  };

  return (
    <View style={[{ width, height }, isImmersive && styles.immersiveContainer]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={{ flex: 1 }}
      >
        {imageUrls.map((url, index) => (
          <View key={index} style={{ width, height }}>
            {isImmersive ? (
              <>
                <Image
                  source={{ uri: url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  blurRadius={25}
                />
                <View style={styles.blurTint} />
                <Image
                  source={{ uri: url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                />
              </>
            ) : (
              <Image source={{ uri: url }} style={{ width, height }} contentFit="cover" />
            )}
          </View>
        ))}
      </ScrollView>

      {/* Pagination Dots */}
      <View style={styles.paginationContainer}>
        {imageUrls.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  immersiveContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  blurTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  inactiveDot: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});
