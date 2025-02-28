document.addEventListener("DOMContentLoaded", function() {
    console.log("✅ Typing effect script loaded successfully.");

    // Select the text element
    const textElement = document.getElementById("dynamic-text");

    if (!textElement) {
        console.error("❌ ERROR: Element #dynamic-text not found!");
        return;
    }

    // Words to cycle through
    const words = ["REELS", "HOOKS", "COVERS", "& MORE"];
    let index = 0;

    // Function to change text
    function changeText() {
        textElement.textContent = words[index];
        index = (index + 1) % words.length;
    }

    // Start the typing effect
    setInterval(changeText, 1500); // Change text every 1.5 seconds
});
