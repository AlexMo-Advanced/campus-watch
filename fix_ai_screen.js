const fs = require('fs');
const path = 'c:\\Users\\alexm\\campus-watch\\screens\\AIChatScreen.js';
let content = fs.readFileSync(path, 'utf8');

const badBlock = `  resourceStep: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  resourceStepText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
});`;

// Find the last occurrence of the bad block
const lastIndex = content.lastIndexOf(badBlock);

if (lastIndex !== -1) {
  // Keep the last occurrence but remove the extra "});" that preceded it
  // Actually, wait, the user says:
  // "find the StyleSheet.create block that ends around line 289 with an extra "});" followed by orphaned properties resourceStep and a duplicate resourceStepText, then merge those two properties into the object and remove the stray closing "});" so there's only one StyleSheet.create call."

  // But the file actually has these bad blocks injected everywhere!
  // So the best approach is to split by the bad block, and join with '});'
  // EXCEPT for the very last one at the end of StyleSheet.create, which should just be the properties followed by '});'
  
  // Let's just remove ALL occurrences of the bad block and replace with '});'
  content = content.split(badBlock).join('});');
  
  // Then, append the correct styles at the end before the final });
  content = content.replace(
    /}\);\s*$/,
    `  resourceStep: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  resourceStepText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
});`
  );
  
  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed AIChatScreen.js');
} else {
  console.log('Bad block not found!');
}
