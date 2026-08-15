const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../lib/i18n/locales');
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));

function keys(obj, prefix = '') {
  let result = [];
  for (const key of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      result = result.concat(keys(obj[key], full));
    } else {
      result.push(full);
    }
  }
  return result;
}

function get(obj, dotPath) {
  return dotPath.split('.').reduce((o, k) => o && o[k], obj);
}

function set(obj, dotPath, val) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

const enKeys = keys(en);

for (const lang of ['zh', 'fr', 'es', 'fil', 'hi']) {
  const filePath = path.join(localesDir, `${lang}.json`);
  const locale = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const localeKeys = keys(locale);

  for (const key of enKeys) {
    if (!localeKeys.includes(key)) {
      set(locale, key, get(en, key));
    }
  }

  for (const key of localeKeys) {
    if (!enKeys.includes(key)) {
      const parts = key.split('.');
      let cur = locale;
      for (let i = 0; i < parts.length - 1; i += 1) cur = cur[parts[i]];
      delete cur[parts[parts.length - 1]];
    }
  }

  fs.writeFileSync(filePath, `${JSON.stringify(locale, null, 2)}\n`);
  console.log(`Synced ${lang}.json`);
}
