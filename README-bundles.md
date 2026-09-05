# App bundles — install a whole set of apps in one go

A **bundle** is a named group of apps: tap *Live TV* and you get BBC iPlayer, ITVX,
Channel 4, My5, UKTV Play and STV Player, instead of finding each APK yourself.

| File | What it is |
| --- | --- |
| `bundles.json` | The list of bundles and the apps in each. Edit this, nothing else. |
| `app-bundles.js` | Drop-in script: renders the bundle cards and runs the install walkthrough. |
| `bundles-demo.html` | A working page you can open to see it, and copy the markup from. |

## What "install all at once" can actually mean

A web page can never install an APK silently — Android shows its own
*"Do you want to install this app?"* screen for every package, and there is no
browser API that skips it. Anything claiming otherwise is either an app with
special privileges or malware.

So there are three levels, and this repo implements the first:

**1. Guided bundle install (what's here now).** One tap starts the bundle; the page
downloads the apps one at a time and tracks where you are up to, so the user just
keeps confirming Android's prompt and pressing *Next*. Six apps go from "find and
download six files" to "press Next six times". No special permissions, works today,
works on any device.

**2. A companion installer app (true one-tap).** A small APK the user sideloads
*once*. It reads this same `bundles.json` from your site, downloads each APK, and
fires them at the system installer back to back. On stock Android there is still one
confirmation per app, but the user never touches a browser or a file manager — and
the app can show real progress, verify checksums, and skip apps already installed.
The manifest is deliberately app-readable so this is a drop-in later:

```kotlin
// Sketch: for each app in the bundle, download then hand to the package installer.
val session = packageInstaller.openSession(
    packageInstaller.createSession(
        PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
    )
)
session.openWrite("apk", 0, apkFile.length()).use { out -> apkFile.inputStream().copyTo(out) }
session.commit(pendingIntent.intentSender)   // Android shows its confirm screen here
```

Needs `REQUEST_INSTALL_PACKAGES` in the manifest, and the user granting
"Install unknown apps" to your installer once.

**3. Genuinely silent installs.** Only for a device provisioned as *device owner*
(`adb shell dpm set-device-owner ...` on a freshly reset device) or a managed/MDM
fleet. Fine for boxes you set up yourself before handing over; not something a
customer can turn on from a website.

## Adding it to your site

```html
<div id="app-bundles"></div>
<script src="app-bundles.js" data-manifest="bundles.json" defer></script>
```

That renders a card per bundle. To trigger a bundle from a button you already have,
give it a `data-bundle` attribute:

```html
<button data-bundle="live-tv">📺 Live TV bundle</button>
```

Deep links work too, so you can put one on a QR code or in a support message:

```
https://yoursite.com/?bundle=live-tv
```

If `bundles.json` can't be loaded, the script falls back to a small built-in list so
the page never renders empty.

## Editing the bundles

```json
{
  "baseUrl": "https://karlbutlertts.github.io/xbj-apk-store/apks/",
  "bundles": [
    {
      "id": "live-tv",
      "name": "Live TV",
      "icon": "📺",
      "description": "UK free-to-air live and catch-up players.",
      "apps": [
        { "id": "itvx", "name": "ITVX", "file": "ITVX.apk", "package": "air.ITVMobilePlayer" }
      ]
    }
  ]
}
```

- `file` is appended to `baseUrl`. Set `url` on an app instead to point somewhere
  else entirely — including a store deep link such as
  `amzn://apps/android?p=com.example` or `market://details?id=com.example`, which is
  the cleaner route for any app that's already in the Amazon Appstore or Play Store.
- `package` isn't used by the web page; it's there so a companion app can check
  whether the app is already installed.
- **Check the filenames match what's actually in your `apks/` folder** — the ones in
  `bundles.json` are the expected names, not verified against the live store.

## Fire TV / Android TV

The script detects TV browsers and switches to a list of addresses with copy buttons,
because TV browsers have no usable download manager. Users type each address into
Downloader. The Setup Tools bundle leads with Downloader itself for that reason.

## One thing worth checking

Re-hosting other companies' APKs (iPlayer, ITVX, Netflix and so on) is their call,
not yours, and the big ones do send takedowns. Where an app is already on the Amazon
Appstore or Play Store, pointing an entry's `url` at the store deep link gives users
auto-updates and keeps you out of it — the bundle experience is identical either way.
