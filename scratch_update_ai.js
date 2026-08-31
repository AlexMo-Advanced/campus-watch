const fs = require('fs');

let content = fs.readFileSync('c:\\Users\\alexm\\campus-watch\\screens\\AIChatScreen.js', 'utf8');

// Replace imports
content = content.replace(
  "import { LinearGradient } from 'expo-linear-gradient';",
  "import { LinearGradient } from 'expo-linear-gradient';\nimport { BlurView } from 'expo-blur';"
);

// Replace animations with springify
content = content.replace(/FadeInDown\.duration\(\d+\)/g, "FadeInDown.springify()");
content = content.replace(/FadeInUp\.delay\(\d+\)\.duration\(\d+\)/g, (match) => match.replace(/\.duration\(\d+\)/, ".springify()"));
content = content.replace(/FadeInUp\.duration\(\d+\)/g, "FadeInUp.springify()");
content = content.replace(/FadeInLeft\.delay\([^)]+\)\.duration\(\d+\)/g, (match) => match.replace(/\.duration\(\d+\)/, ".springify()"));
content = content.replace(/FadeInLeft\.duration\(\d+\)/g, "FadeInLeft.springify()");
content = content.replace(/FadeInRight\.duration\(\d+\)/g, "FadeInRight.springify()");

// 1. Change Header to Glassmorphism & Floating
content = content.replace(
  /style=\\{\\[styles\.header, \{ paddingTop: insets\.top \+ 4, backgroundColor: headerBg, borderBottomColor: isDark \? '[^']+' : '[^']+' \}\\]\\}/g,
  "style={[styles.header, { marginTop: insets.top + 8, borderColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.6)' }]}\n        >\n          <BlurView intensity={isDark ? 30 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />"
);

// 2. Change Input Bar to Glassmorphism
content = content.replace(
  /\{ backgroundColor: inputBarBg, borderTopColor: isDark \? '[^']+' : '[^']+' \},/g,
  "{ borderColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.6)' },\n      ]}\n    >\n      <BlurView intensity={isDark ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFillObject, { borderRadius: 24 }]} />"
);
content = content.replace(/inputBarOuter: \{/, "inputBarOuter: {\n    borderRadius: 24,\n    marginHorizontal: 12,\n    overflow: 'hidden',");

// 3. Change AI Chat bubbles to Glassmorphism
content = content.replace(
  /backgroundColor: isDark \? 'rgba\(30, 41, 59, 0.9\)' : 'rgba\(255, 255, 255, 0.92\)', borderColor: isDark \? '#334155' : '#e2e8f0'/g,
  "backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.5)', borderColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.6)', overflow: 'hidden'"
);
content = content.replace(
  /<Text style=\\{\\[styles\.bubbleText, \{ color: isUser \? '#ffffff' : \(isDark \? '#e2e8f0' : '#0f172a'\) \}\\]\\}>/g,
  "{!isUser && <BlurView intensity={isDark ? 20 : 40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />}\n          <Text style={[styles.bubbleText, { color: isUser ? '#ffffff' : (isDark ? '#e2e8f0' : '#0f172a') }]}>"
);
content = content.replace(
  /<TypingDots color="#2563eb" \/>/g,
  "<BlurView intensity={isDark ? 20 : 40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />\n        <TypingDots color=\"#2563eb\" />"
);

// 4. Update Header Styling
content = content.replace(
  /header: \{\n    flexDirection: 'row',/g,
  "header: {\n    flexDirection: 'row',\n    marginHorizontal: 16,\n    borderRadius: 20,\n    overflow: 'hidden',\n    borderWidth: 1,"
);

// 5. Add thinking indicator structure
const typingIndicatorRegex = /const TypingIndicator = \(\) => \(\s*<Animated\.View entering=\{FadeInLeft\.springify\(\)\} style=\{styles\.messageRow\}>\s*<View style=\{\[styles\.aiAvatar, \{ backgroundColor: isDark \? '#1e3a5f' : '#dbeafe' \}\]\}>\s*<Ionicons name="sparkles" size=\{14\} color="#2563eb" \/>\s*<\/View>\s*<View style=\{\[styles\.bubble, styles\.bubbleAI, styles\.typingBubble, \{ backgroundColor: isDark \? 'rgba\(30, 41, 59, 0\.4\)' : 'rgba\(255, 255, 255, 0\.5\)', borderColor: isDark \? 'rgba\(51, 65, 85, 0\.4\)' : 'rgba\(226, 232, 240, 0\.6\)', overflow: 'hidden' \}\]\}>\s*<BlurView intensity=\{isDark \? 20 : 40\} tint=\{isDark \? 'dark' : 'light'\} style=\{StyleSheet\.absoluteFillObject\} \/>\s*<TypingDots color="#2563eb" \/>\s*<\/View>\s*<\/Animated\.View>\s*\);/m;

const newTypingIndicator = `const TypingIndicator = () => (
    <Animated.View entering={FadeInLeft.springify()} style={styles.messageRow}>
      <View style={[styles.aiAvatar, { backgroundColor: isDark ? '#1e3a5f' : '#dbeafe' }]}>
        <Ionicons name="sparkles" size={14} color="#2563eb" />
      </View>
      <View style={{ gap: 6 }}>
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.resourceStep}>
          <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
          <Text style={[styles.resourceStepText, { color: colors.textSecondary }]}>Accessing Live Location...</Text>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(800).springify()} style={styles.resourceStep}>
          <Ionicons name="document-text-outline" size={12} color={colors.textSecondary} />
          <Text style={[styles.resourceStepText, { color: colors.textSecondary }]}>Fetching Campus Reports...</Text>
        </Animated.View>
        <Animated.View entering={FadeInUp.delay(1500).springify()} style={styles.resourceStep}>
          <Ionicons name="analytics-outline" size={12} color={colors.textSecondary} />
          <Text style={[styles.resourceStepText, { color: colors.textSecondary }]}>Analyzing Context...</Text>
        </Animated.View>
        <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.5)', borderColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.6)', overflow: 'hidden', alignSelf: 'flex-start' }]}>
          <BlurView intensity={isDark ? 20 : 40} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
          <TypingDots color="#2563eb" />
        </View>
      </View>
    </Animated.View>
  );`;

content = content.replace(typingIndicatorRegex, newTypingIndicator);

// 6. Append resourceStep styles
content = content.replace(
  /\}\);/g,
  "  resourceStep: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },\n  resourceStepText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },\n});"
);

fs.writeFileSync('c:\\Users\\alexm\\campus-watch\\screens\\AIChatScreen.js', content, 'utf8');
console.log('Script execution complete.');
