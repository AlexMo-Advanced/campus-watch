import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        {/* This viewport tag is critical for making the app render at
            phone width instead of desktop width on iOS Safari. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        {/* Preload the vector icon fonts so Ionicons (and other
            @expo/vector-icons sets) render as glyphs instead of squares
            on first paint. */}
        <link
          rel="preload"
          href="/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        {/* @font-face is required — preload alone fetches the file but
            never registers the font family, causing the ▯ fallback glyph. */}
        <style>{`
          @font-face {
            font-family: 'Ionicons';
            src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf') format('truetype');
            font-display: block;
          }
          @font-face {
            font-family: 'MaterialIcons';
            src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf') format('truetype');
            font-display: block;
          }
          @font-face {
            font-family: 'FontAwesome';
            src: url('/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome.ttf') format('truetype');
            font-display: block;
          }
        `}</style>

        {/* Disable body scrolling on web to make ScrollViews work more
            like they do on native. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}