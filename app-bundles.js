/*
 * app-bundles.js — one-click app bundles for the XBJ APK store.
 *
 * A bundle is a named group of apps ("Live TV" = BBC iPlayer + ITVX + Channel 4 ...).
 * The user picks a bundle once and this walks them through installing every app in it,
 * instead of hunting down each APK by hand.
 *
 * IMPORTANT — what a web page can and cannot do on Android / Fire TV:
 *   A browser can never install an APK silently. Android always shows its own
 *   "Do you want to install this app?" screen for each package. So "install all"
 *   here means: queue the downloads, hand them over one at a time, and keep track
 *   of where the user is up to. The taps that remain are Android's, not ours.
 *   A fully silent multi-install needs a companion app (see README-bundles.md).
 *
 * Usage:
 *   <script src="app-bundles.js" data-manifest="bundles.json" defer></script>
 *   <div id="app-bundles"></div>                  <!-- cards render here -->
 *   <button data-bundle="live-tv">Live TV</button> <!-- or wire your own buttons -->
 *   Deep link: yoursite.com/?bundle=live-tv  (or #bundle=live-tv)
 */
(function() {
    "use strict";

    var SCRIPT = document.currentScript ||
        document.querySelector('script[src*="app-bundles"]');
    var MANIFEST_URL = (SCRIPT && SCRIPT.getAttribute("data-manifest")) || "bundles.json";

    /* Built-in fallback so the page still works if bundles.json can't be fetched
       (opened from file://, or dropped onto a host without the JSON alongside). */
    var FALLBACK_MANIFEST = {
        baseUrl: "https://karlbutlertts.github.io/xbj-apk-store/apks/",
        bundles: [{
            id: "live-tv",
            name: "Live TV",
            icon: "📺",
            description: "UK free-to-air live and catch-up players.",
            apps: [
                { id: "bbc-iplayer", name: "BBC iPlayer", file: "BBCiPlayer.apk" },
                { id: "itvx",        name: "ITVX",        file: "ITVX.apk" },
                { id: "channel4",    name: "Channel 4",   file: "Channel4.apk" },
                { id: "my5",         name: "My5",         file: "My5.apk" }
            ]
        }, {
            id: "tools",
            name: "Setup Tools",
            icon: "🛠️",
            description: "Install these first — they make everything else easier.",
            apps: [
                { id: "downloader", name: "Downloader", file: "Downloader.apk" }
            ]
        }]
    };

    /* A TV browser has no usable download manager, so those users get the
       Downloader URL to type in rather than a download button that goes nowhere. */
    var IS_TV = /AFT|Android TV|GoogleTV|BRAVIA|Web0S|SMART-TV/i.test(navigator.userAgent);

    var manifest = null;
    var state = null; // { bundle, queue: [app], index, done: {} }

    /* ---------------------------------------------------------------- utils */

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function appUrl(app) {
        if (app.url) return app.url;                    // explicit override
        var base = manifest.baseUrl || "";
        if (base && base.slice(-1) !== "/") base += "/";
        return base + app.file;
    }

    function findBundle(id) {
        for (var i = 0; i < manifest.bundles.length; i++) {
            if (manifest.bundles[i].id === id) return manifest.bundles[i];
        }
        return null;
    }

    function copy(text, button) {
        var restore = button.textContent;
        function ok() {
            button.textContent = "Copied";
            setTimeout(function() { button.textContent = restore; }, 1500);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(ok, function() { legacy(); });
        } else {
            legacy();
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
    }

    /* Each download is fired from a real click on a real anchor. Browsers throttle
       or silently drop batches of programmatic downloads, which is why the queue
       hands over one app at a time instead of firing them all at once. */
    function startDownload(app) {
        var link = el("a");
        link.href = appUrl(app);
        link.setAttribute("download", app.file || (app.name + ".apk"));
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
            var card = el("button", "bundle-card");
            card.type = "button";
            card.setAttribute("data-bundle", bundle.id);

            card.appendChild(el("span", "bundle-card__icon", bundle.icon || "📦"));
            card.appendChild(el("span", "bundle-card__name", bundle.name));
            if (bundle.description) {
                card.appendChild(el("span", "bundle-card__desc", bundle.description));
            }
            card.appendChild(el("span", "bundle-card__count",
                bundle.apps.length + (bundle.apps.length === 1 ? " app" : " apps")));

            var names = el("span", "bundle-card__apps",
                bundle.apps.map(function(a) { return a.name; }).join(" · "));
            card.appendChild(names);

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
        var close = el("button", "bundle-modal__close", "✕");
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
        document.addEventListener("keydown", function(e) {
            if (!overlay.hidden && (e.key === "Escape" || e.key === "Backspace" && e.target === overlay)) {
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
        if (!bundle) {
            console.warn("[app-bundles] No bundle with id:", id);
            return;
        }
        state = { bundle: bundle, queue: null, index: 0, done: {} };
        overlay.hidden = false;
        document.body.classList.add("bundle-modal-open");
        renderPicker();
        overlay.querySelector(".bundle-modal").scrollTop = 0;
    }

    /* Step 1 — choose which apps in the bundle to install. */
    function renderPicker() {
        var bundle = state.bundle;
        modalTitle.textContent = (bundle.icon ? bundle.icon + " " : "") + bundle.name;
        modalBody.innerHTML = "";
        modalFoot.innerHTML = "";

        var intro = el("p", "bundle-note", IS_TV
            ? "Open the Downloader app on your TV and enter each address below. Android will ask you to confirm each install — that prompt can't be skipped."
            : "Tick the apps you want, then work through them one at a time. Android asks you to confirm every install — that prompt can't be skipped, so this queues them up rather than doing it behind your back.");
        modalBody.appendChild(intro);

        var list = el("div", "bundle-list");
        bundle.apps.forEach(function(app) {
            var row = el("label", "bundle-row");

            var box = el("input");
            box.type = "checkbox";
            box.className = "bundle-row__check";
            box.checked = true;
            box.value = app.id;

            var name = el("span", "bundle-row__name", app.name);
            var meta = el("span", "bundle-row__meta", app.file || "");

            row.appendChild(box);
            row.appendChild(name);
            row.appendChild(meta);
            list.appendChild(row);
        });
        modalBody.appendChild(list);

        var selectAll = el("button", "bundle-btn bundle-btn--ghost", "Select all / none");
        selectAll.type = "button";
        selectAll.addEventListener("click", function() {
            var boxes = list.querySelectorAll(".bundle-row__check");
            var turnOn = Array.prototype.every.call(boxes, function(b) { return !b.checked; });
            Array.prototype.forEach.call(boxes, function(b) { b.checked = turnOn; });
        });

        var go = el("button", "bundle-btn bundle-btn--primary",
            IS_TV ? "Show install codes" : "Install these apps");
        go.type = "button";
        go.addEventListener("click", function() {
            var chosen = [];
            Array.prototype.forEach.call(list.querySelectorAll(".bundle-row__check"), function(b) {
                if (b.checked) {
                    chosen.push(bundle.apps.filter(function(a) { return a.id === b.value; })[0]);
                }
            });
            if (!chosen.length) return;
            state.queue = chosen;
            state.index = 0;
            if (IS_TV) renderTvList(); else renderQueue();
        });

        modalFoot.appendChild(selectAll);
        modalFoot.appendChild(go);
        go.focus();
    }

    /* Step 2a — TV: every address at once, since the user types them into Downloader. */
    function renderTvList() {
        modalBody.innerHTML = "";
        modalFoot.innerHTML = "";

        modalBody.appendChild(el("p", "bundle-note",
            "In Downloader, enter each address in turn. Install the app, press Back, then move to the next one."));

        state.queue.forEach(function(app, i) {
            var item = el("div", "bundle-step");
            item.appendChild(el("span", "bundle-step__num", String(i + 1)));

            var main = el("div", "bundle-step__main");
            main.appendChild(el("div", "bundle-step__name", app.name));
            main.appendChild(el("div", "bundle-step__url", appUrl(app)));
            item.appendChild(main);

            var copyBtn = el("button", "bundle-btn bundle-btn--ghost", "Copy");
            copyBtn.type = "button";
            copyBtn.addEventListener("click", function() { copy(appUrl(app), copyBtn); });
            item.appendChild(copyBtn);

            modalBody.appendChild(item);
        });

        var copyAll = el("button", "bundle-btn bundle-btn--ghost", "Copy all addresses");
        copyAll.type = "button";
        copyAll.addEventListener("click", function() {
            copy(state.queue.map(function(a) { return a.name + ": " + appUrl(a); }).join("\n"), copyAll);
        });

        var back = el("button", "bundle-btn bundle-btn--primary", "Done");
        back.type = "button";
        back.addEventListener("click", closeModal);

        modalFoot.appendChild(copyAll);
        modalFoot.appendChild(back);
        back.focus();
    }

    /* Step 2b — phone/browser: hand over one download at a time and track progress. */
    function renderQueue() {
        modalBody.innerHTML = "";
        modalFoot.innerHTML = "";

        var total = state.queue.length;
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

        var action = el("button", "bundle-btn bundle-btn--primary", "");
        action.type = "button";
        modalFoot.appendChild(action);

        var skip = el("button", "bundle-btn bundle-btn--ghost", "Skip this one");
        skip.type = "button";
        modalFoot.appendChild(skip);

        function paint() {
            var done = state.index;
            bar.style.width = Math.round((done / total) * 100) + "%";

            rows.forEach(function(r, i) {
                r.row.classList.toggle("is-current", i === state.index);
                r.row.classList.toggle("is-done", i < state.index);
                if (i < state.index) {
                    r.status.textContent = state.done[r.app.id] === "skipped"
                        ? "Skipped" : "Sent to your downloads";
                } else if (i === state.index) {
                    r.status.textContent = "Up next";
                }
            });

            if (state.index >= total) {
                counter.textContent = "All done — open each downloaded file to finish installing.";
                action.textContent = "Close";
                skip.hidden = true;
                action.onclick = closeModal;
            } else {
                var app = state.queue[state.index];
                counter.textContent = "App " + (state.index + 1) + " of " + total + " — " + app.name;
                action.textContent = "Download " + app.name;
                skip.hidden = false;
                action.onclick = function() {
                    startDownload(app);
                    state.done[app.id] = "downloaded";
                    state.index++;
                    paint();
                };
                skip.onclick = function() {
                    state.done[app.id] = "skipped";
                    state.index++;
                    paint();
                };
            }
            action.focus();
        }

        paint();
    }

    /* ---------------------------------------------------------------- styles */

    function injectStyles() {
        if (document.getElementById("bundle-styles")) return;
        var style = el("style");
        style.id = "bundle-styles";
        style.textContent = [
            ".bundle-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}",
            ".bundle-card{display:flex;flex-direction:column;gap:6px;text-align:left;padding:18px;border:1px solid rgba(255,255,255,.15);border-radius:14px;background:rgba(255,255,255,.06);color:inherit;font:inherit;cursor:pointer;transition:transform .15s,background .15s,border-color .15s}",
            ".bundle-card:hover,.bundle-card:focus-visible{transform:translateY(-2px);background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.4);outline:none}",
            ".bundle-card__icon{font-size:2rem}",
            ".bundle-card__name{font-size:1.15rem;font-weight:700}",
            ".bundle-card__desc{font-size:.85rem;opacity:.75}",
            ".bundle-card__count{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;opacity:.6}",
            ".bundle-card__apps{font-size:.78rem;opacity:.55;line-height:1.4}",

            ".bundle-modal-open{overflow:hidden}",
            ".bundle-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:16px;z-index:9999}",
            /* display:flex above beats the browser's [hidden] rule, so restate it — without this the closed overlay stays invisible but swallows every click on the page. */
            ".bundle-overlay[hidden]{display:none}",
            ".bundle-modal{width:min(560px,100%);max-height:88vh;overflow:auto;background:#15161a;color:#f4f4f5;border:1px solid rgba(255,255,255,.15);border-radius:16px;display:flex;flex-direction:column}",
            ".bundle-modal__head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.1)}",
            ".bundle-modal__title{margin:0;font-size:1.25rem}",
            ".bundle-modal__close{background:none;border:none;color:inherit;font-size:1.1rem;cursor:pointer;padding:6px;border-radius:6px}",
            ".bundle-modal__close:hover,.bundle-modal__close:focus-visible{background:rgba(255,255,255,.15);outline:none}",
            ".bundle-modal__body{padding:18px 20px;display:flex;flex-direction:column;gap:14px}",
            ".bundle-modal__foot{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;padding:16px 20px;border-top:1px solid rgba(255,255,255,.1)}",

            ".bundle-note{margin:0;font-size:.88rem;line-height:1.5;opacity:.8}",
            ".bundle-list{display:flex;flex-direction:column;gap:2px}",
            ".bundle-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer}",
            ".bundle-row:hover{background:rgba(255,255,255,.07)}",
            ".bundle-row__check{width:18px;height:18px;accent-color:#7c5cff;flex-shrink:0}",
            ".bundle-row__name{flex:1;font-weight:600}",
            ".bundle-row__meta{font-size:.75rem;opacity:.5}",

            ".bundle-steps{display:flex;flex-direction:column;gap:4px}",
            ".bundle-step{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04)}",
            ".bundle-step.is-current{background:rgba(124,92,255,.18);box-shadow:inset 0 0 0 1px rgba(124,92,255,.5)}",
            ".bundle-step.is-done{opacity:.55}",
            ".bundle-step__num{width:26px;height:26px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.12);font-size:.8rem;font-weight:700}",
            ".bundle-step__main{flex:1;min-width:0}",
            ".bundle-step__name{font-weight:600}",
            ".bundle-step__status{font-size:.78rem;opacity:.7}",
            ".bundle-step__url{font-size:.8rem;opacity:.7;word-break:break-all;font-family:ui-monospace,Menlo,Consolas,monospace}",

            ".bundle-progress{height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}",
            ".bundle-progress__bar{height:100%;width:0;background:#7c5cff;transition:width .3s ease}",

            ".bundle-btn{font:inherit;font-weight:600;padding:10px 18px;border-radius:10px;border:1px solid transparent;cursor:pointer;transition:background .15s,border-color .15s}",
            ".bundle-btn--primary{background:#7c5cff;color:#fff}",
            ".bundle-btn--primary:hover,.bundle-btn--primary:focus-visible{background:#6b4bf0;outline:none}",
            ".bundle-btn--ghost{background:transparent;color:inherit;border-color:rgba(255,255,255,.25)}",
            ".bundle-btn--ghost:hover,.bundle-btn--ghost:focus-visible{background:rgba(255,255,255,.12);outline:none}",
            "@media (max-width:480px){.bundle-modal__foot{flex-direction:column-reverse}.bundle-btn{width:100%}}"
        ].join("");
        document.head.appendChild(style);
    }

    /* ---------------------------------------------------------------- boot */

    function wireTriggers() {
        document.querySelectorAll("[data-bundle]").forEach(function(node) {
            if (node.classList.contains("bundle-card")) return; // rendered cards already wired
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

    function start(data) {
        manifest = data;
        injectStyles();
        buildModal();
        document.querySelectorAll("#app-bundles, .app-bundles").forEach(renderCards);
        wireTriggers();
        deepLink();
    }

    function boot() {
        fetch(MANIFEST_URL, { cache: "no-cache" })
            .then(function(res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(start)
            .catch(function(err) {
                console.warn("[app-bundles] Using built-in bundles —", MANIFEST_URL, "not loaded:", err.message);
                start(FALLBACK_MANIFEST);
            });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
