/*
 * app-bundles.js — install a whole set of apps in one flow.
 *
 * A bundle is a named group of apps ("Live TV" = BBC iPlayer, ITVX, Channel 4, My5).
 * The buyer picks the bundle once and this walks them through every app in it,
 * instead of hunting each one down on the shelves.
 *
 * Built to sit on top of the xbj-apk-store shell, and to reuse what's already there
 * rather than keep a second copy of anything:
 *   - App data comes from apps.json — the same catalog the shelves are built from.
 *     Bundles are defined by TAG (livetv, streaming, sports, movies) or by explicit
 *     packageName, so adding an app to apps.json puts it in the right bundle with
 *     no change here.
 *   - If the store shell is on the page, its own helpers do the filtering:
 *     visibleApps() (projector model + the locked Entertainment section) and
 *     appHref(). Standalone, the same rules are applied locally.
 *   - Apps flagged "preinstalled" are shown as already on the projector, never queued.
 *   - Inside the Projector Guy App, installs are handed to AndroidBridge.downloadApp()
 *     exactly like the card links do, so they install in place instead of bouncing the
 *     user out to the system Downloads app.
 *
 * What "install all at once" can mean: Android shows its own confirm screen for every
 * package, and no web page can skip it. So the queue hands the apps over one at a time
 * and tracks where the user is up to — six apps become six Next presses instead of six
 * trips around the store. See README-bundles.md for the fully silent options.
 *
 * Usage:
 *   <div id="app-bundles"></div>
 *   <script src="app-bundles.js" data-manifest="bundles.json" defer></script>
 *   <button data-bundle="live-tv">Live TV</button>   <!-- or wire your own buttons -->
 *   Deep link: ?bundle=live-tv  (or #bundle=live-tv)
 */
(function() {
    "use strict";

    var SCRIPT = document.currentScript ||
        document.querySelector('script[src*="app-bundles"]');
    var MANIFEST_URL = (SCRIPT && SCRIPT.getAttribute("data-manifest")) || "bundles.json";

    var RAW_BASE = "https://raw.githubusercontent.com/karlbutlertts/xbj-apk-store/main/";

    /* Used only if bundles.json itself can't be loaded, so the page never renders empty. */
    var FALLBACK_MANIFEST = {
        catalogUrl: RAW_BASE + "apps.json",
        apkBaseUrl: RAW_BASE + "apks/",
        bundles: [
            { id: "live-tv",   name: "Live TV",   icon: "📺", description: "UK live and catch-up players.", tags: ["livetv"] },
            { id: "streaming", name: "Streaming", icon: "🍿", description: "The big subscription services.", tags: ["streaming"] }
        ]
    };

    /* TV browsers have no usable download manager, so those users are given the
       addresses to type into Downloader instead of a button that goes nowhere.
       The Projector Guy App is a WebView on a TV but it does have the bridge, so
       it takes the install path, not this one. */
    var IS_TV = /AFT|Android TV|GoogleTV|BRAVIA|Web0S|SMART-TV/i.test(navigator.userAgent);

    function hasBridge() {
        return !!(window.AndroidBridge && typeof window.AndroidBridge.downloadApp === "function");
    }

    var manifest = null;
    var catalog = [];   // raw apps.json contents, used when the shell isn't present
    var state = null;   // { bundle, queue, index, done }

    /* ------------------------------------------------- catalog (shared with store) */

    var HIDDEN_APP_PREFIX = "entertainment/";

    function isHiddenApp(a) {
        return typeof a.file === "string" && a.file.indexOf(HIDDEN_APP_PREFIX) === 0;
    }

    /* Prefer the store shell's own filtering when it's on the page — it knows the
       projector model the buyer picked and whether Entertainment is unlocked. */
    function availableApps() {
        if (typeof window.visibleApps === "function") {
            try {
                var shellList = window.visibleApps();
                /* Empty means the shell hasn't finished loading apps.json yet — use our
                   own copy for now, and redraw from the shell's list once it's there. */
                if (Array.isArray(shellList) && shellList.length) return shellList;
            } catch (e) { /* fall through */ }
        }
        var unlocked = typeof window.entertainmentIsUnlocked === "function" &&
            window.entertainmentIsUnlocked();
        return catalog.filter(function(a) {
            if (isHiddenApp(a) && !unlocked) return false;
            return true;   // standalone: no model chosen, so don't filter on it
        });
    }

    function appHref(a) {
        if (typeof window.appHref === "function") {
            try { return window.appHref(a); } catch (e) { /* fall through */ }
        }
        return a.url || (manifest.apkBaseUrl || RAW_BASE + "apks/") + a.file;
    }

    /* Apps in this bundle, in a sensible order: explicit `packages` keep the order
       they're listed in, `tags` follow catalog order. */
    function appsFor(bundle) {
        var pool = availableApps();

        if (Array.isArray(bundle.packages) && bundle.packages.length) {
            var picked = [];
            bundle.packages.forEach(function(pkg) {
                pool.forEach(function(a) {
                    if (a.packageName === pkg && picked.indexOf(a) === -1) picked.push(a);
                });
            });
            return picked;
        }

        var tags = bundle.tags || [];
        return pool.filter(function(a) {
            if (!Array.isArray(a.tags)) return false;
            for (var i = 0; i < tags.length; i++) {
                if (a.tags.indexOf(tags[i]) !== -1) return true;
            }
            return false;
        });
    }

    function findBundle(id) {
        for (var i = 0; i < manifest.bundles.length; i++) {
            if (manifest.bundles[i].id === id) return manifest.bundles[i];
        }
        return null;
    }

    /* apps.json sizes are display strings ("6 MB", "2.4 MB"). Good enough to warn
       someone that a bundle is a 200 MB download before they start it. */
    function totalSize(apps) {
        var mb = 0, known = false;
        apps.forEach(function(a) {
            var m = /^([\d.]+)\s*(k|m|g)b$/i.exec(String(a.size || "").trim());
            if (!m) return;
            known = true;
            var n = parseFloat(m[1]);
            var unit = m[2].toLowerCase();
            mb += unit === "g" ? n * 1024 : unit === "k" ? n / 1024 : n;
        });
        if (!known) return "";
        return mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : Math.round(mb) + " MB";
    }

    /* ---------------------------------------------------------------- utils */

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function copy(text, button) {
        var restore = button.textContent;
        function ok() {
            button.textContent = "Copied";
            setTimeout(function() { button.textContent = restore; }, 1500);
        }
        function legacy() {
            var box = el("textarea");
            box.value = text;
            box.style.position = "fixed";
            box.style.opacity = "0";
            document.body.appendChild(box);
            box.select();
            try { document.execCommand("copy"); ok(); } catch (e) { /* nothing else to try */ }
            document.body.removeChild(box);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(ok, legacy);
        } else {
            legacy();
        }
    }

    /* One app, one hand-off. Inside the app wrapper that's the bridge (installs in
       place); in a browser it's a real click on a real anchor, because browsers
       throttle or silently drop batches of programmatic downloads — which is the
       other reason the queue goes one at a time rather than firing them all off. */
    function startInstall(app) {
        var url = appHref(app);
        if (hasBridge()) {
            try {
                window.AndroidBridge.downloadApp(url, app.name);
                return;
            } catch (e) { /* fall back to a plain download */ }
        }
        var link = el("a");
        link.href = url;
        link.setAttribute("download", (app.file || app.name).split("/").pop());
        link.rel = "noopener";
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        setTimeout(function() { document.body.removeChild(link); }, 1000);
    }

    /* ---------------------------------------------------------------- cards */

    function renderCards(container) {
        container.classList.add("bundle-grid");
        container.innerHTML = "";

        manifest.bundles.forEach(function(bundle) {
            var apps = appsFor(bundle);
            if (!apps.length) return;   // nothing in the catalog for it yet, or locked

            var card = el("button", "bundle-card");
            card.type = "button";
            card.setAttribute("data-bundle", bundle.id);

            card.appendChild(el("span", "bundle-card__icon", bundle.icon || "📦"));
            card.appendChild(el("span", "bundle-card__name", bundle.name));
            if (bundle.description) {
                card.appendChild(el("span", "bundle-card__desc", bundle.description));
            }

            var size = totalSize(apps);
            card.appendChild(el("span", "bundle-card__count",
                apps.length + (apps.length === 1 ? " app" : " apps") + (size ? " · " + size : "")));
            card.appendChild(el("span", "bundle-card__apps",
                apps.map(function(a) { return a.name; }).join(" · ")));

            card.addEventListener("click", function() { openBundle(bundle.id); });
            container.appendChild(card);
        });
    }

    /* ---------------------------------------------------------------- modal */

    var overlay, modalBody, modalTitle, modalFoot;

    function buildModal() {
        overlay = el("div", "bundle-overlay");
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.hidden = true;

        var modal = el("div", "bundle-modal");

        var head = el("div", "bundle-modal__head");
        modalTitle = el("h2", "bundle-modal__title");
        var close = el("button", "bundle-modal__close nav-focusable", "✕");
        close.type = "button";
        close.setAttribute("aria-label", "Close");
        close.addEventListener("click", closeModal);
        head.appendChild(modalTitle);
        head.appendChild(close);

        modalBody = el("div", "bundle-modal__body");
        modalFoot = el("div", "bundle-modal__foot");

        modal.appendChild(head);
        modal.appendChild(modalBody);
        modal.appendChild(modalFoot);
        overlay.appendChild(modal);

        overlay.addEventListener("click", function(e) {
            if (e.target === overlay) closeModal();
        });
        /* Escape on a keyboard, Back on a remote. */
        document.addEventListener("keydown", function(e) {
            if (overlay.hidden) return;
            if (e.key === "Escape" || e.key === "Backspace" || e.key === "GoBack") {
                e.preventDefault();
                closeModal();
            }
        });

        document.body.appendChild(overlay);
    }

    function closeModal() {
        overlay.hidden = true;
        document.body.classList.remove("bundle-modal-open");
        state = null;
    }

    function openBundle(id) {
        var bundle = findBundle(id);
        if (!bundle) { console.warn("[app-bundles] no bundle:", id); return; }
        state = { bundle: bundle, queue: null, index: 0, done: {} };
        overlay.hidden = false;
        document.body.classList.add("bundle-modal-open");
        renderPicker();
        overlay.querySelector(".bundle-modal").scrollTop = 0;
    }

    /* Step 1 — pick which apps in the bundle to install. */
    function renderPicker() {
        var bundle = state.bundle;
        var apps = appsFor(bundle);

        modalTitle.textContent = (bundle.icon ? bundle.icon + " " : "") + bundle.name;
        modalBody.innerHTML = "";
        modalFoot.innerHTML = "";

        modalBody.appendChild(el("p", "bundle-note", IS_TV && !hasBridge()
            ? "Open Downloader on your projector and enter each address below. Android asks you to confirm every install — that prompt can't be skipped."
            : "Tick what you want, then work through them one at a time. Android asks you to confirm every install — that prompt can't be skipped, so this queues them up rather than installing behind your back."));

        if (!apps.length) {
            modalBody.innerHTML = "";
            modalBody.appendChild(el("p", "bundle-note",
                "Couldn't load the app list just now. Check your connection and try again."));
            var retry = el("button", "bundle-btn bundle-btn--primary nav-focusable", "Close");
            retry.type = "button";
            retry.addEventListener("click", closeModal);
            modalFoot.appendChild(retry);
            retry.focus();
            return;
        }

        var list = el("div", "bundle-list");
        var installable = [];

        apps.forEach(function(app) {
            var row = el("label", "bundle-row");
            var box = el("input");
            box.type = "checkbox";
            box.className = "bundle-row__check nav-focusable";
            box.value = app.packageName || app.file;

            if (app.preinstalled) {
                box.checked = false;
                box.disabled = true;
                row.classList.add("is-preinstalled");
            } else {
                box.checked = true;
                installable.push(app);
            }

            row.appendChild(box);
            row.appendChild(el("span", "bundle-row__name", app.name));
            row.appendChild(el("span", "bundle-row__meta",
                app.preinstalled ? "Already installed" : (app.size || "")));
            list.appendChild(row);
        });
        modalBody.appendChild(list);

        if (!installable.length) {
            modalBody.appendChild(el("p", "bundle-note",
                "Everything in this bundle is already on your projector."));
            var done = el("button", "bundle-btn bundle-btn--primary nav-focusable", "Close");
            done.type = "button";
            done.addEventListener("click", closeModal);
            modalFoot.appendChild(done);
            done.focus();
            return;
        }

        var selectAll = el("button", "bundle-btn bundle-btn--ghost nav-focusable", "Select all / none");
        selectAll.type = "button";
        selectAll.addEventListener("click", function() {
            var boxes = list.querySelectorAll(".bundle-row__check:not(:disabled)");
            var turnOn = Array.prototype.every.call(boxes, function(b) { return !b.checked; });
            Array.prototype.forEach.call(boxes, function(b) { b.checked = turnOn; });
        });

        var go = el("button", "bundle-btn bundle-btn--primary nav-focusable",
            IS_TV && !hasBridge() ? "Show install addresses" : "Install these apps");
        go.type = "button";
        go.addEventListener("click", function() {
            var chosen = [];
            Array.prototype.forEach.call(list.querySelectorAll(".bundle-row__check"), function(b) {
                if (!b.checked || b.disabled) return;
                apps.forEach(function(a) {
                    if ((a.packageName || a.file) === b.value) chosen.push(a);
                });
            });
            if (!chosen.length) return;
            state.queue = chosen;
            state.index = 0;
            if (IS_TV && !hasBridge()) renderAddressList(); else renderQueue();
        });

        modalFoot.appendChild(selectAll);
        modalFoot.appendChild(go);
        go.focus();
    }

    /* Step 2a — TV browser with no bridge: every address at once, to type into Downloader. */
    function renderAddressList() {
        modalBody.innerHTML = "";
        modalFoot.innerHTML = "";

        modalBody.appendChild(el("p", "bundle-note",
            "In Downloader, enter each address in turn. Install it, press Back, then move on to the next."));

        state.queue.forEach(function(app, i) {
            var item = el("div", "bundle-step");
            item.appendChild(el("span", "bundle-step__num", String(i + 1)));

            var main = el("div", "bundle-step__main");
            main.appendChild(el("div", "bundle-step__name", app.name));
            main.appendChild(el("div", "bundle-step__url", appHref(app)));
            item.appendChild(main);

            var copyBtn = el("button", "bundle-btn bundle-btn--ghost nav-focusable", "Copy");
            copyBtn.type = "button";
            copyBtn.addEventListener("click", function() { copy(appHref(app), copyBtn); });
            item.appendChild(copyBtn);

            modalBody.appendChild(item);
        });

        var copyAll = el("button", "bundle-btn bundle-btn--ghost nav-focusable", "Copy all addresses");
        copyAll.type = "button";
        copyAll.addEventListener("click", function() {
            copy(state.queue.map(function(a) { return a.name + ": " + appHref(a); }).join("\n"), copyAll);
        });

        var back = el("button", "bundle-btn bundle-btn--primary nav-focusable", "Done");
        back.type = "button";
        back.addEventListener("click", closeModal);

        modalFoot.appendChild(copyAll);
        modalFoot.appendChild(back);
        back.focus();
    }

    /* Step 2b — hand the apps over one at a time and keep track of where we are. */
    function renderQueue() {
        modalBody.innerHTML = "";
        modalFoot.innerHTML = "";

        var total = state.queue.length;
        var bridge = hasBridge();

        var progress = el("div", "bundle-progress");
        var bar = el("div", "bundle-progress__bar");
        progress.appendChild(bar);
        modalBody.appendChild(progress);

        var counter = el("p", "bundle-note");
        modalBody.appendChild(counter);

        var steps = el("div", "bundle-steps");
        modalBody.appendChild(steps);

        var rows = state.queue.map(function(app, i) {
            var row = el("div", "bundle-step");
            row.appendChild(el("span", "bundle-step__num", String(i + 1)));
            var main = el("div", "bundle-step__main");
            main.appendChild(el("div", "bundle-step__name", app.name));
            var status = el("div", "bundle-step__status", "Waiting");
            main.appendChild(status);
            row.appendChild(main);
            steps.appendChild(row);
            return { row: row, status: status, app: app };
        });

        var action = el("button", "bundle-btn bundle-btn--primary nav-focusable", "");
        action.type = "button";
        var skip = el("button", "bundle-btn bundle-btn--ghost nav-focusable", "Skip this one");
        skip.type = "button";
        modalFoot.appendChild(action);
        modalFoot.appendChild(skip);

        function paint() {
            bar.style.width = Math.round((state.index / total) * 100) + "%";

            rows.forEach(function(r, i) {
                r.row.classList.toggle("is-current", i === state.index);
                r.row.classList.toggle("is-done", i < state.index);
                if (i < state.index) {
                    r.status.textContent = state.done[r.app.name] === "skipped" ? "Skipped"
                        : bridge ? "Sent to the installer" : "Sent to your downloads";
                } else if (i === state.index) {
                    r.status.textContent = "Up next";
                }
            });

            if (state.index >= total) {
                counter.textContent = bridge
                    ? "All done — confirm any installs still waiting on screen."
                    : "All done — open each downloaded file to finish installing.";
                action.textContent = "Close";
                skip.hidden = true;
                action.onclick = closeModal;
            } else {
                var app = state.queue[state.index];
                counter.textContent = "App " + (state.index + 1) + " of " + total + " — " + app.name;
                action.textContent = (bridge ? "Install " : "Download ") + app.name;
                skip.hidden = false;
                action.onclick = function() {
                    startInstall(app);
                    state.done[app.name] = "sent";
                    state.index++;
                    paint();
                };
                skip.onclick = function() {
                    state.done[app.name] = "skipped";
                    state.index++;
                    paint();
                };
            }
            action.focus();
        }

        paint();
    }

    /* ---------------------------------------------------------------- styles */

    /* Colours come from the store shell's CSS variables (--accent, --accent-deep,
       --surface, --border), so swapping the brand accent there carries the bundles
       with it. The literals are fallbacks for standalone pages. */
    function injectStyles() {
        if (document.getElementById("bundle-styles")) return;
        var style = el("style");
        style.id = "bundle-styles";
        style.textContent = [
            ".bundle-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}",
            ".bundle-card{display:flex;flex-direction:column;gap:6px;text-align:left;padding:18px;border:1px solid var(--border,rgba(255,255,255,.15));border-radius:14px;background:var(--surface,rgba(255,255,255,.06));color:inherit;font:inherit;cursor:pointer;transition:transform .15s,background .15s,border-color .15s}",
            ".bundle-card:hover,.bundle-card:focus-visible,.bundle-card:focus{transform:translateY(-2px);background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.45);outline:none}",
            ".bundle-card__icon{font-size:2rem}",
            ".bundle-card__name{font-size:1.15rem;font-weight:700}",
            ".bundle-card__desc{font-size:.85rem;opacity:.75}",
            ".bundle-card__count{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;opacity:.6}",
            ".bundle-card__apps{font-size:.78rem;opacity:.55;line-height:1.4}",

            ".bundle-modal-open{overflow:hidden}",
            ".bundle-overlay{position:fixed;inset:0;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:16px;z-index:9999}",
            /* display:flex above beats the browser's [hidden] rule, so restate it —
               without this the closed overlay stays invisible but swallows every click. */
            ".bundle-overlay[hidden]{display:none}",
            ".bundle-modal{width:min(560px,100%);max-height:88vh;overflow:auto;background:var(--bg,#15161a);color:var(--text,#f4f4f5);border:1px solid var(--border,rgba(255,255,255,.15));border-radius:16px;display:flex;flex-direction:column}",
            ".bundle-modal__head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.1)}",
            ".bundle-modal__title{margin:0;font-size:1.25rem}",
            ".bundle-modal__close{background:none;border:none;color:inherit;font-size:1.1rem;cursor:pointer;padding:6px;border-radius:6px}",
            ".bundle-modal__close:hover,.bundle-modal__close:focus{background:rgba(255,255,255,.15);outline:none}",
            ".bundle-modal__body{padding:18px 20px;display:flex;flex-direction:column;gap:14px}",
            ".bundle-modal__foot{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;padding:16px 20px;border-top:1px solid rgba(255,255,255,.1)}",

            ".bundle-note{margin:0;font-size:.88rem;line-height:1.5;opacity:.8}",
            ".bundle-list{display:flex;flex-direction:column;gap:2px}",
            ".bundle-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer}",
            ".bundle-row:hover{background:rgba(255,255,255,.07)}",
            ".bundle-row.is-preinstalled{opacity:.5;cursor:default}",
            ".bundle-row__check{width:18px;height:18px;accent-color:var(--accent,#5aa6ff);flex-shrink:0}",
            ".bundle-row__name{flex:1;font-weight:600}",
            ".bundle-row__meta{font-size:.75rem;opacity:.55}",

            ".bundle-steps{display:flex;flex-direction:column;gap:4px}",
            ".bundle-step{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04)}",
            ".bundle-step.is-current{background:color-mix(in srgb,var(--accent,#5aa6ff) 18%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent,#5aa6ff) 55%,transparent)}",
            ".bundle-step.is-done{opacity:.55}",
            ".bundle-step__num{width:26px;height:26px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.12);font-size:.8rem;font-weight:700}",
            ".bundle-step__main{flex:1;min-width:0}",
            ".bundle-step__name{font-weight:600}",
            ".bundle-step__status{font-size:.78rem;opacity:.7}",
            ".bundle-step__url{font-size:.8rem;opacity:.7;word-break:break-all;font-family:ui-monospace,Menlo,Consolas,monospace}",

            ".bundle-progress{height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}",
            ".bundle-progress__bar{height:100%;width:0;background:var(--accent,#5aa6ff);transition:width .3s ease}",

            ".bundle-btn{font:inherit;font-weight:600;padding:10px 18px;border-radius:10px;border:1px solid transparent;cursor:pointer;transition:background .15s,border-color .15s}",
            ".bundle-btn--primary{background:var(--accent-deep,#2563d6);color:#fff}",
            ".bundle-btn--primary:hover,.bundle-btn--primary:focus{background:var(--accent,#5aa6ff);color:var(--accent-ink,#07111f);outline:none}",
            ".bundle-btn--ghost{background:transparent;color:inherit;border-color:rgba(255,255,255,.25)}",
            ".bundle-btn--ghost:hover,.bundle-btn--ghost:focus{background:rgba(255,255,255,.12);outline:none}",
            "@media (max-width:480px){.bundle-modal__foot{flex-direction:column-reverse}.bundle-btn{width:100%}}"
        ].join("");
        document.head.appendChild(style);
    }

    /* ---------------------------------------------------------------- boot */

    function wireTriggers() {
        document.querySelectorAll("[data-bundle]").forEach(function(node) {
            if (node.classList.contains("bundle-card")) return;   // rendered cards self-wire
            node.addEventListener("click", function(e) {
                e.preventDefault();
                openBundle(node.getAttribute("data-bundle"));
            });
        });
    }

    function deepLink() {
        var fromQuery = new URLSearchParams(window.location.search).get("bundle");
        var fromHash = (window.location.hash.match(/bundle=([\w-]+)/) || [])[1];
        var id = fromQuery || fromHash;
        if (id && findBundle(id)) openBundle(id);
    }

    function render() {
        var targets = document.querySelectorAll("#app-bundles, .app-bundles");
        targets.forEach(renderCards);
        return targets.length;
    }

    /* The store shell draws its bundles row only once refreshAppBundles exists, so a
       view rendered while we were still fetching has no container for us. Ask the
       shell to re-render that one time. Guarded on there being no container at all,
       so it can't loop. */
    function claimShellRow() {
        if (typeof window.refreshView !== "function") return;
        if (document.querySelector("#app-bundles, .app-bundles")) return;
        try { window.refreshView(); } catch (e) { /* shell not ready; next view will do it */ }
    }

    function start() {
        injectStyles();
        buildModal();
        render();
        wireTriggers();
        deepLink();
        /* The shell may unlock Entertainment or change the projector model after
           we've drawn the cards — let it tell us to redraw. */
        window.refreshAppBundles = render;
        claimShellRow();
        watchShellCatalog();
    }

    /* If the store shell is on the page but still fetching apps.json, our cards are
       drawn from our own copy — unfiltered by projector model. Redraw once the shell's
       list lands so model-specific apps (Netflix, Play Store) resolve correctly.
       Gives up after 15s rather than polling forever. */
    function watchShellCatalog() {
        if (typeof window.visibleApps !== "function") return;
        var ticks = 0;
        var timer = setInterval(function() {
            var ready = Array.isArray(window._allApps) && window._allApps.length;
            if (ready || ++ticks > 30) {
                clearInterval(timer);
                if (ready) render();
            }
        }, 500);
    }

    function getJSON(url) {
        return fetch(url, { cache: "no-cache" }).then(function(res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
        });
    }

    function loadCatalog() {
        /* The store shell has already fetched apps.json into window._allApps —
           reuse it rather than pulling the same file down twice. */
        if (Array.isArray(window._allApps) && window._allApps.length) {
            catalog = window._allApps;
            return Promise.resolve();
        }
        return getJSON(manifest.catalogUrl || RAW_BASE + "apps.json")
            .then(function(data) { catalog = Array.isArray(data) ? data : []; })
            .catch(function(err) {
                console.warn("[app-bundles] catalog not loaded:", err.message);
                catalog = [];
            });
    }

    function boot() {
        getJSON(MANIFEST_URL)
            .catch(function(err) {
                console.warn("[app-bundles] using built-in bundles —",
                    MANIFEST_URL, "not loaded:", err.message);
                return FALLBACK_MANIFEST;
            })
            .then(function(data) {
                manifest = data;
                return loadCatalog();
            })
            .then(start);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
