document.addEventListener("DOMContentLoaded", function() {
    console.log("✅ Typing effect script loaded successfully.");

    // Try multiple ways to select the element
    let textElement = document.querySelector("#dynamic-text") || document.querySelector(".hero-dynamic-text");

    if (!textElement) {
        console.error("❌ ERROR: Element #dynamic-text or .hero-dynamic-text not found!");
        return;
    }

    // Define words to cycle through
    const words = ["REELS", "HOOKS", "COVERS", "& MORE"];
    let index = 0;

    function changeText() {
        if (!textElement) return;
        textElement.style.opacity = 0;
        setTimeout(() => {
            textElement.textContent = words[index];
            textElement.style.opacity = 1;
            index = (index + 1) % words.length;
        }, 300);
    }

    // Start the text animation
    setInterval(changeText, 1500);

    // Wire up Downloader app download link
    const DOWNLOADER_URL = "https://karlbutlertts.github.io/xbj-apk-store/apks/Downloader.apk";
    const downloaderLinks = document.querySelectorAll("#downloader-link, .downloader-link, [data-downloader-app]");
    downloaderLinks.forEach(function(link) {
        link.href = DOWNLOADER_URL;
        link.setAttribute("download", "Downloader.apk");
    });

    // Apps carousel — targets #apps-carousel, .apps-carousel, #apps-grid, .apps-grid
    function initCarousel(container) {
        var items = Array.from(container.children);
        if (items.length === 0) return;

        // Build track — inline styles override any existing grid/flex CSS
        var track = document.createElement("div");
        track.style.cssText = "display:flex;gap:12px;transition:transform .35s ease;will-change:transform;";
        items.forEach(function(item) {
            item.style.flex = "0 0 auto";
            track.appendChild(item);
        });

        var wrapper = document.createElement("div");
        wrapper.style.cssText = "flex:1;overflow:hidden;min-width:0;";
        wrapper.appendChild(track);

        function makeBtn(symbol, label) {
            var btn = document.createElement("button");
            btn.innerHTML = symbol;
            btn.setAttribute("aria-label", label);
            btn.style.cssText = "background:rgba(255,255,255,.15);border:none;color:#fff;font-size:2rem;line-height:1;padding:8px 14px;cursor:pointer;border-radius:6px;transition:background .2s;flex-shrink:0;";
            btn.onmouseenter = function() { this.style.background = "rgba(255,255,255,.3)"; };
            btn.onmouseleave = function() { this.style.background = "rgba(255,255,255,.15)"; };
            return btn;
        }

        var prevBtn = makeBtn("&#8249;", "Previous");
        var nextBtn = makeBtn("&#8250;", "Next");

        // Override whatever layout the container had
        container.innerHTML = "";
        container.style.cssText = container.style.cssText + ";display:flex!important;align-items:center;gap:8px;overflow:hidden;";
        container.appendChild(prevBtn);
        container.appendChild(wrapper);
        container.appendChild(nextBtn);

        var currentIndex = 0;

        function getItemWidth() {
            if (!items[0]) return 200;
            return items[0].offsetWidth + 12;
        }

        function getVisibleCount() {
            return Math.max(1, Math.floor(wrapper.offsetWidth / getItemWidth()));
        }

        function scrollTo(index) {
            var maxIndex = Math.max(0, items.length - getVisibleCount());
            currentIndex = Math.min(Math.max(index, 0), maxIndex);
            track.style.transform = "translateX(-" + (currentIndex * getItemWidth()) + "px)";
            prevBtn.disabled = currentIndex === 0;
            prevBtn.style.opacity = currentIndex === 0 ? "0.3" : "1";
            prevBtn.style.cursor = currentIndex === 0 ? "default" : "pointer";
            nextBtn.disabled = currentIndex >= maxIndex;
            nextBtn.style.opacity = currentIndex >= maxIndex ? "0.3" : "1";
            nextBtn.style.cursor = currentIndex >= maxIndex ? "default" : "pointer";
        }

        prevBtn.addEventListener("click", function() { scrollTo(currentIndex - 1); });
        nextBtn.addEventListener("click", function() { scrollTo(currentIndex + 1); });

        // Touch swipe
        var touchStartX = 0;
        track.addEventListener("touchstart", function(e) {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });
        track.addEventListener("touchend", function(e) {
            var diff = touchStartX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) scrollTo(currentIndex + (diff > 0 ? 1 : -1));
        }, { passive: true });

        scrollTo(0);
        window.addEventListener("resize", function() { scrollTo(currentIndex); });
    }

    document.querySelectorAll("#apps-carousel, .apps-carousel, #apps-grid, .apps-grid").forEach(initCarousel);
});
