document.addEventListener("DOMContentLoaded", function() {
    console.log("✅ Typing effect script loaded successfully.");

    // Select the text element
    const textElement = document.querySelector("#dynamic-text");

    if (!textElement) {
        console.error("❌ ERROR: Element #dynamic-text not found!");
        return;
    }

    // Define the words to cycle through
    const words = ["REELS", "HOOKS", "COVERS", "& MORE"];
    let index = 0;

    // Function to change text
    function changeText() {
        textElement.style.opacity = 0; // Fade out effect
        setTimeout(() => {
            textElement.textContent = words[index];
            textElement.style.opacity = 1; // Fade in effect
            index = (index + 1) % words.length;
        }, 300); // Smooth transition delay
    }

    // Start the text animation
    setInterval(changeText, 1500); // Change text every 1.5 seconds
});
