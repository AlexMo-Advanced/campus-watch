# Campus Watch — Custom Sounds

## Can I use my own sounds?

**Yes.** Replace any file in this folder with your own audio. Keep the **same filename** so the app finds it automatically.

## Interaction sounds (in-app)

| File | Used for |
|------|----------|
| `tap.wav` | General taps, buttons |
| `tab_press.wav` | Tab bar taps |
| `tab_long_press.wav` | Long-press (Report picker, comments) |
| `bar_press.wav` | Nav bar drag / press |
| `medium.wav` | Camera shutter, medium actions |
| `success.wav` | Report posted, AI reply |
| `warning.wav` | Warnings |
| `error.wav` | Errors |
| `like.wav` | Liking comments/reports |
| `send.wav` | Sending comments / AI messages |

**Tips:**
- Keep clips **under 300ms** for UI sounds (short & snappy)
- `.wav` or `.mp3` both work for in-app playback
- After replacing files, reload the app (no new build needed for in-app SFX)

## Notification sounds (lock screen / banner)

| File | Used for |
|------|----------|
| `alert.wav` | New campus alerts |
| `comment.wav` | Comments & replies |
| `like_notification.wav` | Likes on your content |
| `success.wav` | Alert resolved |

**Tips:**
- Use **.wav** for best iOS/Android compatibility
- Keep under **30 seconds** (iOS limit)
- **Requires a new EAS build** after adding or changing notification sound files

## Regenerate defaults

If you delete the defaults and want the built-in tones back:

```bash
node scripts/generate-sounds.js
```

## Change which sound plays where

Edit `lib/soundAssets.js` to point at different filenames or add new keys.
