(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var nodes = document.querySelectorAll("[data-reveal]");

  if (!reduce && "IntersectionObserver" in window) {
    document.documentElement.classList.add("reveal");
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    for (var i = 0; i < nodes.length; i++) observer.observe(nodes[i]);
  }

  var links = document.querySelectorAll(".nav a[data-nav]");
  var ids = ["work", "jammin", "consulting", "contact"];

  function spy() {
    var current = "";
    for (var k = 0; k < ids.length; k++) {
      var el = document.getElementById(ids[k]);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= 140) current = ids[k];
    }
    for (var n = 0; n < links.length; n++) {
      var href = links[n].getAttribute("href");
      if (current && href === "#" + current) links[n].setAttribute("aria-current", "true");
      else links[n].removeAttribute("aria-current");
    }
  }

  spy();
  window.addEventListener("scroll", spy, { passive: true });
  window.addEventListener("resize", spy);
})();
