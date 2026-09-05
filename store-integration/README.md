# Applying this to xbj-apk-store

The integration is done and tested — it just couldn't be pushed from the session that
wrote it (no write access to `karlbutlertts/xbj-apk-store`), so it's here as a patch.

From a clone of `xbj-apk-store`:

```sh
git checkout -b app-bundles
cp /path/to/type/app-bundles.js /path/to/type/bundles.json .
git apply /path/to/type/store-integration/index.html.patch
git add app-bundles.js bundles.json index.html
git commit -m "Add app bundles to the store home page"
git push -u origin app-bundles
```

If `git apply` complains that the patch doesn't apply, `index.html` has moved on since
it was written. `git apply -3 index.html.patch` will usually sort it; failing that the
four changes are small enough to make by hand — they're listed below.

## What the patch changes in index.html

Four hunks, no existing behaviour touched:

1. **`renderHome()`** — one line, `+ bundlesRowHtml()`, placing the bundles between the
   hero and *Recently updated*.
2. **`bundlesRowHtml()`** — a new function returning an empty `.row` section for the
   script to fill. Returns `''` when `app-bundles.js` hasn't loaded, so a missing or
   failed script leaves Home exactly as it is now.
3. **`setView()`** — calls `window.refreshAppBundles()` after the render, because
   `viewBody.innerHTML = ...` wipes the cards. This is also what makes the bundles
   follow a projector-model change or an Entertainment unlock: both already go through
   `setView`/`refreshView`.
4. **End of `<body>`** — the `<script src="app-bundles.js" defer>` tag, after the shell
   script so `visibleApps()` and `appHref()` are defined.

## What was verified in a browser

Loaded against the real `apps.json`, signed in as an A5 Pro buyer:

- Bundle cards render on Home in the store's own styling (they read `--accent` /
  `--accent-deep`, so changing the brand colour carries them along).
- Live TV shows iPlayer, Channel 4, My5, ITVX. Netflix appears in Streaming greyed as
  *Already installed* and is left out of the install queue — its `preinstalled` flag.
- Unlocking Entertainment adds the Sports and Movies bundles on the next render;
  they're absent while it's locked.
- Existing store behaviour is unchanged: app cards still download, and preinstalled
  cards still open the "already on your projector" modal rather than downloading.
- Escape and the remote's Back button close the bundle modal; the cards are `<button>`
  elements with `nav-focusable`, so D-pad navigation reaches them.

One thing the sandbox couldn't check: `AndroidBridge.downloadApp()` was exercised with
a stub, not the real Projector Guy App. The call is the same shape the card links
already use — `downloadApp(href, name)` — so it should behave identically, but it's
worth one run on a projector before you tell buyers about it.
