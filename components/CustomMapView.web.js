import React from 'react';
import { View, Text } from 'react-native';

export default function MapView(props) {
  return (
    <View style={[{ backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', minHeight: 200 }, props.style]}>
      <Text style={{ color: '#94a3b8', padding: 16, textAlign: 'center' }}>
        Interactive map view is available on mobile devices.
      </Text>
    </View>
  );
}

export const Marker = () => null;
export const Callout = () => null;
