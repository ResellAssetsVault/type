(function() {
    var s1 = document.getElementById("splash-1");
    var s2 = document.getElementById("splash-2");
    var s3 = document.getElementById("app-screen");

    function show(el) {
        if (!el) return;
        el.classList.add("active");
    }
    function hide(el) {
        if (!el) return;
        el.classList.remove("active");
    }

    // Splash 1 → Splash 2 after progress bar finishes (2.4s)
    setTimeout(function() {
        hide(s1);
        show(s2);
    }, 2600);

    // Splash 2 → App Screen (entering mode) after 3.5s
    setTimeout(function() {
        hide(s2);
        show(s3);
    }, 6500);

    // Animate hero dots on app screen
    setTimeout(function() {
        var hdots = document.querySelectorAll(".hdot");
        var ci = 0;
        setInterval(function() {
            hdots[ci].classList.remove("active");
            ci = (ci + 1) % hdots.length;
            hdots[ci].classList.add("active");
        }, 3000);
    }, 7000);

    // Animate splash-2 dot indicator
    var s2dots = document.querySelectorAll(".s2-dots .dot");
    var di = 0;
    setTimeout(function() {
        setInterval(function() {
            s2dots[di].classList.remove("active");
            di = (di + 1) % s2dots.length;
            s2dots[di].classList.add("active");
        }, 1000);
    }, 2700);
})();
