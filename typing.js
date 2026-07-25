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

    // Apps carousel — targets #apps-carousel or .apps-carousel
    function initCarousel(container) {
        const items = Array.from(container.children);
        if (items.length === 0) return;

        // Build track
        const track = document.createElement("div");
        track.className = "carousel-track";
        items.forEach(function(item) {
            item.classList.add("carousel-item");
            track.appendChild(item);
        });

        const wrapper = document.createElement("div");
        wrapper.className = "carousel-wrapper";
        wrapper.appendChild(track);

        const prevBtn = document.createElement("button");
        prevBtn.className = "carousel-btn carousel-btn--prev";
        prevBtn.innerHTML = "&#8249;";
        prevBtn.setAttribute("aria-label", "Previous");

        const nextBtn = document.createElement("button");
        nextBtn.className = "carousel-btn carousel-btn--next";
        nextBtn.innerHTML = "&#8250;";
        nextBtn.setAttribute("aria-label", "Next");

        container.innerHTML = "";
        container.classList.add("carousel-container");
        container.appendChild(prevBtn);
        container.appendChild(wrapper);
        container.appendChild(nextBtn);

        let currentIndex = 0;

        function getItemWidth() {
            if (!items[0]) return 200;
            var style = getComputedStyle(items[0]);
            return items[0].offsetWidth + parseInt(style.marginRight || 0) + 12;
        }

        function getVisibleCount() {
            return Math.max(1, Math.floor(wrapper.offsetWidth / getItemWidth()));
        }

        function scrollTo(index) {
            var maxIndex = Math.max(0, items.length - getVisibleCount());
            currentIndex = Math.min(Math.max(index, 0), maxIndex);
            track.style.transform = "translateX(-" + (currentIndex * getItemWidth()) + "px)";
            prevBtn.disabled = currentIndex === 0;
            nextBtn.disabled = currentIndex >= maxIndex;
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

        // Inject styles once
        if (!document.getElementById("carousel-styles")) {
            var style = document.createElement("style");
            style.id = "carousel-styles";
            style.textContent = [
                ".carousel-container{position:relative;display:flex;align-items:center;gap:8px;overflow:hidden}",
                ".carousel-wrapper{flex:1;overflow:hidden}",
                ".carousel-track{display:flex;gap:12px;transition:transform .35s ease}",
                ".carousel-item{flex:0 0 auto}",
                ".carousel-btn{background:rgba(255,255,255,.15);border:none;color:#fff;font-size:2rem;line-height:1;padding:8px 14px;cursor:pointer;border-radius:6px;transition:background .2s;flex-shrink:0}",
                ".carousel-btn:hover{background:rgba(255,255,255,.3)}",
                ".carousel-btn:disabled{opacity:.3;cursor:default}"
            ].join("");
            document.head.appendChild(style);
        }

        scrollTo(0);
        window.addEventListener("resize", function() { scrollTo(currentIndex); });
    }

    document.querySelectorAll("#apps-carousel, .apps-carousel").forEach(initCarousel);
});
