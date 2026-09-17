import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, useMemo } from 'react';
import { View } from 'react-native';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

export const Marker = () => null;
export const Callout = () => null;

const CustomMapView = forwardRef((props, ref) => {
  const {
    initialRegion,
    region,
    children,
    style,
    showsUserLocation = true,
    userLocation,
    onPress,
    onMapReady,
  } = props;

  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const [isSatellite, setIsSatellite] = useState(false);

  const lat = region?.latitude ?? initialRegion?.latitude ?? 55.1707;
  const lng = region?.longitude ?? initialRegion?.longitude ?? -118.7947;
  const userLat = userLocation?.latitude ?? null;
  const userLng = userLocation?.longitude ?? null;

  const markerData = useMemo(() => {
    return React.Children.toArray(children)
      .filter(child => child?.props?.coordinate)
      .map(child => ({
        id: child.props.id || `marker-${child.props.coordinate.latitude}-${child.props.coordinate.longitude}`,
        lat: child.props.coordinate.latitude,
        lng: child.props.coordinate.longitude,
        title: child.props.title || '',
        pinColor: child.props.pinColor || '#dc2626',
      }));
  }, [children]);

  const onPressRef = useRef(onPress);
  useEffect(() => {
    onPressRef.current = onPress;
  }, [onPress]);

  useImperativeHandle(ref, () => ({
    animateToRegion: (newRegion) => {
      if (mapRef.current) {
        mapRef.current.flyTo([newRegion.latitude, newRegion.longitude], 14);
      }
    },
    fitToCoordinates: (coords) => {
      if (mapRef.current && coords.length > 0) {
        const bounds = L.latLngBounds(coords.map(c => [c.latitude, c.longitude]));
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const normalLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    });
    
    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: '© Esri World Imagery' }
    );

    const map = L.map(containerRef.current, { 
      zoomControl: false, 
      layers: [normalLayer] 
    }).setView([userLat ?? lat, userLng ?? lng], userLat ? 15 : 14);

    mapRef.current = map;
    map.normalLayer = normalLayer;
    map.satelliteLayer = satelliteLayer;

    map.on('click', (e) => {
      if (onPressRef.current) {
        onPressRef.current({ nativeEvent: { coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng } } });
      }
    });

    onMapReady?.();

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map && userLat == null && (region?.latitude || initialRegion?.latitude)) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, userLat, region, initialRegion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    markerData.forEach(m => {
      const icon = L.divIcon({
        className: 'custom-pin-container',
        html: `<div style="width: 18px; height: 18px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.4); background-color: ${m.pinColor};"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      const mk = L.marker([m.lat, m.lng], { icon }).addTo(map);
      if (m.title) mk.bindPopup(`<b>${m.title}</b>`);
      markersRef.current.push(mk);
    });
  }, [markerData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showsUserLocation) return;

    const uIcon = L.divIcon({
      className: 'user-pin-container',
      html: `
        <div style="
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(37, 99, 235, 0.18);
          border: 2px solid rgba(255,255,255,0.95);
          box-shadow: 0 0 0 6px rgba(37,99,235,0.25), 0 4px 12px rgba(0,0,0,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
          position: relative;
        ">
          🧭
          <div style="position: absolute; width: 8px; height: 8px; background: #2563eb; border-radius: 50%; border: 2px solid #ffffff;"></div>
        </div>
      `,
      iconSize: [36, 36], iconAnchor: [18, 18]
    });

    if (userLat && userLng) {
      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker([userLat, userLng], { icon: uIcon, zIndexOffset: 1000 }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([userLat, userLng]);
      }
    } else {
      map.locate({ setView: true, watch: true, enableHighAccuracy: true, maxZoom: 15 });
      const onLocationFound = (e) => {
        if (!userMarkerRef.current) {
          userMarkerRef.current = L.marker(e.latlng, { icon: uIcon, zIndexOffset: 1000 }).addTo(map);
        } else {
          userMarkerRef.current.setLatLng(e.latlng);
        }
      };
      map.on('locationfound', onLocationFound);

      return () => {
        map.stopLocate();
        map.off('locationfound', onLocationFound);
        if (userMarkerRef.current) {
          map.removeLayer(userMarkerRef.current);
          userMarkerRef.current = null;
        }
      };
    }
  }, [showsUserLocation, userLat, userLng]);

  const toggleLayer = () => {
    const map = mapRef.current;
    if (!map) return;
    if (isSatellite) {
      map.removeLayer(map.satelliteLayer);
      map.addLayer(map.normalLayer);
    } else {
      map.removeLayer(map.normalLayer);
      map.addLayer(map.satelliteLayer);
    }
    setIsSatellite(!isSatellite);
  };

  return (
    <View style={[{ width: '100%', height: style?.height || 400, position: 'relative' }, style]}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#f8fafc', zIndex: 0 }} />
      <button 
        onClick={toggleLayer} 
        title="Switch map layer"
        style={{
          position: 'absolute',
          right: 14,
          bottom: 90,
          zIndex: 1000,
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: 'none',
          background: isSatellite ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isSatellite ? '🗺️' : '🛰️'}
      </button>
    </View>
  );
});

export default CustomMapView;
