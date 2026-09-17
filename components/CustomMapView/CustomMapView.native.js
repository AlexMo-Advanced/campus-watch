import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

// Dummy exports — screens pass <Marker> and <Callout> as children; this
// component reads their props directly and renders into Leaflet instead.
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

  const webViewRef = useRef(null);

  // ── Fix 4: Store onPress in a ref so the handleMessage callback never needs
  //    to be recreated and never triggers re-renders via closure captures.
  const onPressRef = useRef(onPress);
  useEffect(() => {
    onPressRef.current = onPress;
  }, [onPress]);

  // ── Stable primitive coords ────────────────────────────────────────────────
  const lat = region?.latitude ?? initialRegion?.latitude ?? 55.1707;
  const lng = region?.longitude ?? initialRegion?.longitude ?? -118.7947;
  const userLat = userLocation?.latitude ?? null;
  const userLng = userLocation?.longitude ?? null;

  // ── Fix 1: Stringify marker data to primitives so useMemo can do value
  //    comparison instead of reference comparison on the children array.
  const markerDataString = useMemo(() => {
    const markerArr = React.Children.toArray(children)
      .filter(child => child?.props?.coordinate)
      .map(child => ({
        id:
          child.props.id ||
          `marker-${child.props.coordinate.latitude}-${child.props.coordinate.longitude}`,
        lat: child.props.coordinate.latitude,
        lng: child.props.coordinate.longitude,
        title: child.props.title || '',
        pinColor: child.props.pinColor || '#dc2626',
      }));
    return JSON.stringify(markerArr);
  }, [children]);

  // ── Imperative map commands ────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    animateToRegion: (newRegion) => {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.map) {
            window.map.flyTo([${newRegion.latitude}, ${newRegion.longitude}], 14);
          }
          true;
        `);
      }
    },
    fitToCoordinates: (coords) => {
      if (webViewRef.current && coords.length > 0) {
        const boundsJson = JSON.stringify(
          coords.map(c => [c.latitude, c.longitude])
        );
        webViewRef.current.injectJavaScript(`
          if (window.map) {
            window.map.fitBounds(${boundsJson}, { padding: [50, 50] });
          }
          true;
        `);
      }
    },
  }));

  // ── Fix 2: Build HTML only from primitive deps — lat, lng, markerDataString,
  //    showsUserLocation. No object/array refs in the dep list.
  const leafletHtml = useMemo(() => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #f8fafc; }

          .custom-pin {
            width: 18px; height: 18px; border-radius: 50%;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.4);
          }
          .user-pin-container { background: transparent; border: none; }
          .user-pin {
            width: 36px; height: 36px; border-radius: 50%;
            background: rgba(37, 99, 235, 0.18);
            border: 2px solid rgba(255,255,255,0.95);
            box-shadow: 0 0 0 6px rgba(37,99,235,0.25), 0 4px 12px rgba(0,0,0,0.25);
            display: flex; align-items: center; justify-content: center;
            font-size: 16px;
          }
          .user-pin::after {
            content: '';
            position: absolute;
            width: 8px; height: 8px;
            background: #2563eb;
            border-radius: 50%;
            border: 2px solid #ffffff;
          }

          /* Single-button layer toggle — right side, above nav bar */
          #layer-toggle-btn {
            position: absolute;
            right: 14px;
            bottom: 90px;
            z-index: 1000;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: none;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }
          #layer-toggle-btn:active {
            transform: scale(0.92);
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          }
          #layer-toggle-btn.satellite-active {
            background: rgba(15, 23, 42, 0.85);
          }

          @media (prefers-color-scheme: dark) {
            #layer-toggle-btn {
              background: rgba(30, 41, 59, 0.85);
            }
            #layer-toggle-btn.satellite-active {
              background: rgba(15, 23, 42, 0.95);
            }
          }
        </style>
      </head>
      <body>
        <button id="layer-toggle-btn" onclick="toggleLayer()" title="Switch map layer">🛰️</button>
        <div id="map"></div>
        <script>
          // 1. Tile Layers
          var normalLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19, attribution: '© OpenStreetMap'
          });
          var satelliteLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 19, attribution: '© Esri World Imagery' }
          );

          // 2. Init map
          var map = L.map('map', { zoomControl: false, layers: [normalLayer] })
                      .setView([${userLat ?? lat}, ${userLng ?? lng}], ${userLat ? 15 : 14});
          window.map = map;
          ${userLat && userLng ? `
            (function() {
              var uIcon = L.divIcon({
                className: 'user-pin-container',
                html: '<div class="user-pin">🧭</div>',
                iconSize: [36, 36], iconAnchor: [18, 18]
              });
              window.userMarker = L.marker([${userLat}, ${userLng}], { icon: uIcon, zIndexOffset: 1000 }).addTo(map);
            })();
          ` : ''}

          // 3. Single-button toggle
          var isSatellite = false;
          function toggleLayer() {
            var btn = document.getElementById('layer-toggle-btn');
            if (isSatellite) {
              map.removeLayer(satelliteLayer);
              map.addLayer(normalLayer);
              btn.textContent = '🛰️';
              btn.classList.remove('satellite-active');
            } else {
              map.removeLayer(normalLayer);
              map.addLayer(satelliteLayer);
              btn.textContent = '🗺️';
              btn.classList.add('satellite-active');
            }
            isSatellite = !isSatellite;
          }

          // 4. Render markers dynamically
          window.customMarkers = [];
          window.updateMarkers = function(markersData) {
            window.customMarkers.forEach(function(m) { window.map.removeLayer(m); });
            window.customMarkers = [];
            markersData.forEach(function(m) {
              var icon = L.divIcon({
                className: 'custom-pin-container',
                html: '<div class="custom-pin" style="background-color:' + m.pinColor + ';"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              });
              var mk = L.marker([m.lat, m.lng], { icon: icon }).addTo(window.map);
              if (m.title) mk.bindPopup('<b>' + m.title + '</b>');
              window.customMarkers.push(mk);
            });
          };
          window.updateMarkers(${markerDataString});

          // 5. GPS blue dot — live updates when no fixed userLocation passed
          ${showsUserLocation && !userLat ? `
            map.locate({ setView: true, watch: true, enableHighAccuracy: true, maxZoom: 15 });
            function onLocationFound(e) {
              if (!window.userMarker) {
                var uIcon = L.divIcon({
                  className: 'user-pin-container',
                  html: '<div class="user-pin">🧭</div>',
                  iconSize: [36, 36], iconAnchor: [18, 18]
                });
                window.userMarker = L.marker(e.latlng, { icon: uIcon, zIndexOffset: 1000 }).addTo(map);
              } else {
                window.userMarker.setLatLng(e.latlng);
              }
            }
            map.on('locationfound', onLocationFound);
          ` : (showsUserLocation && userLat ? `
            map.locate({ setView: false, watch: true, enableHighAccuracy: true });
            function onLocationFound(e) {
              if (window.userMarker) {
                window.userMarker.setLatLng(e.latlng);
              }
            }
            map.on('locationfound', onLocationFound);
          ` : '')}

          // 6. Tap → post message (user-initiated clicks only; never fires on tile load)
          map.on('click', function(e) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'onPress',
                coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng }
              }));
            }
          });
        </script>
      </body>
    </html>
  `, [lat, lng, showsUserLocation, userLat, userLng, markerDataString]);

  // ── Fix 5: Inject markers dynamically instead of reloading the WebView html
  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.updateMarkers) {
          window.updateMarkers(${markerDataString});
        }
        true;
      `);
    }
  }, [markerDataString]);

  // ── Fix 3: Stable source object — only recreated when HTML string changes.
  const webViewSource = useMemo(() => ({ html: leafletHtml }), [leafletHtml]);

  // ── Fix 4: Stable onMessage callback — never re-created; reads latest onPress
  //    via ref so no stale closures and no dep-array churn.
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === 'onPress' && onPressRef.current) {
        onPressRef.current({ nativeEvent: { coordinate: data.coordinate } });
      }
    } catch (_) {}
  }, []); // empty deps — intentional; onPress accessed through ref

  return (
    <View style={[{ width: '100%', height: style?.height || 400 }, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={webViewSource}
        style={{ width: '100%', height: '100%' }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        geolocationEnabled={true}
        onMessage={handleMessage}
        onLoadEnd={() => onMapReady?.()}
      />
    </View>
  );
});

export default CustomMapView;