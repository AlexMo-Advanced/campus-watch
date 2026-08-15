/**
 * Generates default short WAV sound effects for Campus Watch.
 * Replace any file in assets/sounds/ with your own — keep the same filename.
 *
 * Run: node scripts/generate-sounds.js
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');
const SAMPLE_RATE = 44100;

function writeWav(filePath, samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767 * 0.85), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

function tone(freq, durationMs, { volume = 0.35, fadeMs = 8 } = {}) {
  const count = Math.floor((SAMPLE_RATE * durationMs) / 1000);
  const samples = new Array(count).fill(0);
  for (let i = 0; i < count; i += 1) {
    const t = i / SAMPLE_RATE;
    const env = Math.min(1, i / ((fadeMs / 1000) * SAMPLE_RATE)) *
      Math.min(1, (count - i) / ((fadeMs / 1000) * SAMPLE_RATE));
    samples[i] = Math.sin(2 * Math.PI * freq * t) * volume * env;
  }
  return samples;
}

function sequence(parts) {
  return parts.flat();
}

function silence(ms) {
  return new Array(Math.floor((SAMPLE_RATE * ms) / 1000)).fill(0);
}

const PRESETS = {
  tap: () => tone(920, 35, { volume: 0.22 }),
  tab_press: () => tone(740, 40, { volume: 0.24 }),
  tab_long_press: () => sequence([tone(520, 55, { volume: 0.28 }), silence(10), tone(680, 45, { volume: 0.24 })]),
  bar_press: () => tone(420, 50, { volume: 0.2 }),
  medium: () => tone(610, 60, { volume: 0.3 }),
  success: () => sequence([
    tone(660, 55, { volume: 0.26 }),
    silence(12),
    tone(880, 70, { volume: 0.3 }),
  ]),
  warning: () => sequence([tone(440, 80, { volume: 0.28 }), silence(20), tone(440, 80, { volume: 0.28 })]),
  error: () => sequence([tone(220, 110, { volume: 0.32 }), silence(15), tone(180, 130, { volume: 0.3 })]),
  like: () => sequence([tone(880, 35, { volume: 0.2 }), silence(8), tone(1175, 55, { volume: 0.28 })]),
  send: () => sequence([tone(980, 30, { volume: 0.18 }), silence(6), tone(1240, 45, { volume: 0.24 })]),
  report_submitted: () => sequence([
    tone(523, 70, { volume: 0.28 }),
    silence(18),
    tone(659, 70, { volume: 0.3 }),
    silence(18),
    tone(784, 95, { volume: 0.34 }),
    silence(30),
    tone(988, 120, { volume: 0.32 }),
  ]),
  alert: () => sequence([
    tone(880, 90, { volume: 0.34 }),
    silence(40),
    tone(988, 120, { volume: 0.36 }),
  ]),
  comment: () => sequence([tone(740, 45, { volume: 0.24 }), silence(10), tone(988, 60, { volume: 0.26 })]),
  like_notification: () => sequence([tone(988, 40, { volume: 0.22 }), silence(10), tone(1318, 65, { volume: 0.28 })]),
};

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

Object.entries(PRESETS).forEach(([name, build]) => {
  const filePath = path.join(OUT_DIR, `${name}.wav`);
  writeWav(filePath, build());
  console.log(`Wrote ${filePath}`);
});

console.log('\nDone. Replace any .wav in assets/sounds/ with your own files (same names).');
