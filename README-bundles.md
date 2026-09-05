# App bundles — install a whole set of apps in one go

A **bundle** is a named group of apps: the buyer taps *Live TV* once and gets BBC
iPlayer, ITVX, Channel 4 and My5, instead of finding each one on the shelves.

| File | What it is |
| --- | --- |
| `app-bundles.js` | Drop-in script: renders the bundle cards and runs the install walkthrough. |
| `bundles.json` | Which bundles exist — currently just Live TV. App data is **not** duplicated here. |
| `bundles-demo.html` | A working page to see it and copy the markup from. |

## It reads apps.json, it doesn't copy it

`apps.json` in `xbj-apk-store` is already the source of truth, and its `tags` already
map onto the bundles. So a bundle is defined by tag, not by a second list of apps:

```json
{ "id": "live-tv", "name": "Live TV", "icon": "📺", "tags": ["livetv"] }
```

Add a new app to `apps.json` with `"tags": ["livetv"]` and it appears in the Live TV
bundle on the next load. Nothing here to update.

**Live TV is the only bundle right now.** To add another later, it's one block in
`bundles.json` — by tag:

```json
{ "id": "streaming", "name": "Streaming", "icon": "🍿", "tags": ["streaming"] }
```

or, for a hand-picked set, by package name, kept in the order you write them:

```json
{ "id": "essentials", "name": "Essentials",
  "packages": ["com.projectorguy.app", "com.esaba.downloader", "com.player.bear"] }
```

A bundle whose apps aren't in the catalog (or are locked) renders no card at all,
rather than an empty one.

The script also reuses the store shell's own logic when it's on the page:

- **`visibleApps()`** — so bundles respect the projector model the buyer picked and
  the locked Entertainment section. Live TV shows four apps while it's locked and six
  once it's unlocked, since Reezn and HD Streamz live under `apks/entertainment/`.
- **`appHref()`** — so URLs, including the `media.githubusercontent.com` override that
  Git LFS files like Roblox need, come out identical to the card links.
- **`window._allApps`** — reused rather than fetching `apps.json` a second time.
- **`preinstalled: true`** apps are shown greyed as *Already installed* and never queued.

Standalone (outside the shell) it fetches `apps.json` itself and applies the same rules,
minus model filtering, since no model has been chosen.

## Installing inside the Projector Guy App

When `AndroidBridge.downloadApp()` is present the queue uses it, exactly like the card
links do — so bundle installs happen in place instead of bouncing the user out to the
system Downloads app. The button reads *Install BBC iPlayer* rather than *Download*.

That's the important bit: **you already have the companion app**, so the good version
of this feature is available to you and not just theoretical.

## What "install all at once" can actually mean

A web page can never install an APK silently. Android shows its own *"Do you want to
install this app?"* screen for every package, and no browser API skips it. Three levels:

**1. Guided bundle install — what this is.** One tap starts the bundle; the apps are
handed over one at a time with progress tracked, so six apps become six Next presses
instead of six trips around the store. Works everywhere, today, no permissions.

**2. Bridge-driven queue — a small change to the Projector Guy App.** Today the bridge
takes one app at a time. Give it a bundle method and the app can hold the whole queue
itself: download in the background, install each in turn, survive the user leaving the
page, and skip anything already installed at the right version:

```java
@JavascriptInterface
public void installBundle(String json) {   // [{"url":..,"name":..,"packageName":..}, ...]
    // download each in turn, then hand to PackageInstaller;
    // Android still shows one confirm screen per app.
}
```

`app-bundles.js` calls `AndroidBridge.downloadApp()` per app, so adding
`installBundle()` is a small, additive change — the web side keeps working unchanged
on anything that doesn't have it.

**3. Genuinely silent installs.** Only where the app is *device owner*
(`adb shell dpm set-device-owner` on a freshly reset device) or the projector ships
with the app as a system/privileged app holding `INSTALL_PACKAGES`. That's realistic
for units you flash before sending out, not something a buyer enables from a web page.

## Adding it to the store

**This is already done and tested — see [`store-integration/`](store-integration/) for
the patch and the one-command apply.** It's a patch rather than a pushed branch only
because the session that wrote it had read-only access to `xbj-apk-store`.

The whole integration is four small hunks in `index.html`: a bundles row on Home, a
`refreshAppBundles()` call in `setView()`, and the script tag. On any other page it's
just:

```html
<div id="app-bundles"></div>
<script src="app-bundles.js" data-manifest="bundles.json" defer></script>
```

To trigger a bundle from a button, hub card, or sidebar item you already have:

```html
<button data-bundle="live-tv" class="nav-focusable">📺 Live TV bundle</button>
```

Deep links work too, which suits a QR code on the packaging or a support message:

```
https://karlbutlertts.github.io/xbj-apk-store/?bundle=live-tv
```

Two integration points worth wiring:

- Call `window.refreshAppBundles()` after `checkCode()` unlocks Entertainment or after
  `changeModel()`, so the cards redraw against the new filter. (It also redraws by
  itself once `_allApps` first loads.)
- Buttons get `nav-focusable` so the existing D-pad spatial navigation picks them up.
  The modal handles Escape and the remote's Back button.

## Fire TV / other TV browsers

Browsers on TV hardware get a list of addresses with copy buttons instead of download
buttons, since they have no usable download manager — the user types each into
Downloader. The Projector Guy App is a WebView on a TV but has the bridge, so it takes
the install path, not this one.
