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
});
