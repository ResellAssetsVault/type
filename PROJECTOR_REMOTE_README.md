# XBJ Projector Remote Control

A Progressive Web App (PWA) remote control for XBJ projectors that works when you lose or break your physical remote. Install it on your home screen for quick access.

## Features

✅ **Network Discovery** - Automatically scans your WiFi network for XBJ projectors
✅ **Full Remote Control** - Power, volume, navigation, input, menu controls
✅ **Home Screen Install** - Save as a standalone app on iOS or Android
✅ **Offline Support** - Service Worker caches essential app data
✅ **No Remote Needed** - Control your projector with your phone

## How to Use

### On Your Phone

1. **Install to Home Screen:**
   - **iOS**: Open in Safari → Share → Add to Home Screen
   - **Android**: Open in Chrome → Menu → Install app

2. **Launch the App:**
   - Tap the "XBJ Remote" icon on your home screen

3. **Find Your Projector:**
   - Tap "Scan for Projectors"
   - The app will search your local network
   - Wait for it to find your XBJ projector

4. **Connect & Control:**
   - Tap "Connect" next to your projector
   - Use the on-screen remote to control it

## Files Included

```
projector-remote.html      - Main UI with all controls
projector-remote.js        - Projector discovery and control logic
service-worker.js          - PWA service worker for offline support
manifest.json              - PWA manifest for home screen install
```

## Remote Controls

### Power
- Power On/Off button

### Navigation
- D-Pad: Up, Down, Left, Right
- OK Button: Select/Confirm
- Back Button: Go back

### Volume
- Volume Up/Down buttons
- Volume slider

### Input
- Next Input / Previous Input

### Menu
- Menu button
- Home button

## How Discovery Works

The app uses multiple methods to find your projector:

1. **HTTP Port Scanning** - Checks common projector ports (8080, 8000, 80, 9000)
2. **Local Subnet Scanning** - Uses WebRTC to detect your local network and scans it
3. **mDNS (if available)** - Looks for projector broadcasts on the network

The scan takes 10-30 seconds depending on your network size.

## Network Requirements

- Your phone and projector must be on the same WiFi network
- Projector must be powered on and connected to WiFi
- Port 8080 (or similar) must be accessible on the projector

## API Endpoints (Projector Side)

The app expects your XBJ projector to support these API endpoints:

```
GET /api/device/info              - Device information
GET /api/device/status            - Current projector status
POST /api/control/power/[on|off|toggle]
POST /api/control/volume/[up|down|value]
POST /api/control/brightness/[up|down|value]
POST /api/control/input/[next|prev|hdmi1|hdmi2]
POST /api/control/mute
POST /api/control/unmute
POST /api/control/menu/toggle
POST /api/control/navigate/[up|down|left|right|select|back|home]
```

If your projector doesn't support these endpoints, you can modify the API calls in `projector-remote.js`.

## Troubleshooting

### Projector Not Found

1. **Check WiFi**: Ensure both phone and projector are on same WiFi
2. **Power On**: Projector must be powered on
3. **IP Range**: If on different subnets, scanning may not work
4. **Firewall**: Check if projector firewall allows HTTP on port 8080

### Connection Fails

- Try manually entering the projector's IP address (need to modify UI)
- Check if projector API is running on a different port
- Verify projector API is enabled in projector settings

### Controls Not Working

- Ensure projector is actually connected (green indicator in app)
- Check projector API response format
- Some commands may not be supported on older projector models

## Development

### Local Testing

```html
<!-- Test with mock projector -->
<script>
  window.mockProjector = true;
  
  // Override fetch to simulate projector responses
  window.originalFetch = fetch;
  window.fetch = function(...args) {
    if (args[0].includes('/api/control/')) {
      return Promise.resolve(new Response('OK'));
    }
    return window.originalFetch(...args);
  };
</script>
```

### Custom API

If your XBJ projector uses different API endpoints:

1. Modify the endpoints in `projector-remote.js` (lines ~150-160)
2. Update the HTTP scanning logic to match your projector's API
3. Ensure CORS is handled properly (may need proxy)

## Browser Compatibility

- ✅ iOS 12.2+ (PWA via Safari)
- ✅ Android 5.0+ (Chrome, Firefox, Edge)
- ✅ Desktop browsers (for testing)

## Security Notes

- The app connects directly to your projector on the local network
- No data is sent to external servers
- Service Worker enables offline-first architecture
- CORS may prevent remote network access (by design)

## License

This is part of the ResellAssetsVault project.

## Support

For issues with:
- **Discovery**: Check network connectivity and firewall
- **Controls**: Verify projector API compatibility
- **Installation**: Ensure browser supports PWA (Safari, Chrome, Edge)

## Future Enhancements

- [ ] Manual IP entry for projectors on different networks
- [ ] Preset scene saving (brightness, input combos)
- [ ] Voice control via Web Speech API
- [ ] Multi-projector support
- [ ] Command recording and playback
- [ ] Battery optimization tips
- [ ] Dark mode (already included!)
