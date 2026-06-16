function initTypingEffect() {
    var textElement = document.querySelector("#dynamic-text") || document.querySelector(".hero-dynamic-text");

    if (!textElement) { return; }

    // Ensure opacity transition works on Android TV WebView
    textElement.style.transition = "opacity 0.3s ease";
    textElement.style.opacity = "1";

    var words = ["REELS", "HOOKS", "COVERS", "& MORE"];
    var index = 0;

    function changeText() {
        textElement.style.opacity = "0";
        setTimeout(function() {
            index = (index + 1) % words.length;
            textElement.textContent = words[index];
            textElement.style.opacity = "1";
        }, 300);
    }

    setInterval(changeText, 1500);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTypingEffect);
} else {
    initTypingEffect();
}
