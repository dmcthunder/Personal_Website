(function () {
  var sheetQuery = window.matchMedia("(max-width: 1100px)");
  var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var windows = Array.prototype.slice.call(document.querySelectorAll(".window"));
  var z = 20;

  function isSheet() {
    return sheetQuery.matches;
  }

  function reduced() {
    return reduceQuery.matches;
  }

  function syncChrome() {
    windows.forEach(function (win) {
      var open = win.classList.contains("is-open");
      var minimised = win.classList.contains("is-minimized");
      document.querySelectorAll('[data-open="' + win.id + '"]').forEach(function (btn) {
        var running = open;
        btn.setAttribute("aria-pressed", running ? "true" : "false");
        btn.classList.toggle("is-running", running);
        btn.classList.toggle("is-minimized", minimised);
      });
      if (isSheet() && win.classList.contains("is-front") && open) {
        win.setAttribute("role", "dialog");
        win.setAttribute("aria-modal", "true");
      } else {
        win.setAttribute("role", "region");
        win.removeAttribute("aria-modal");
      }
    });
    var anyFront = document.querySelector(".window.is-open.is-front");
    document.body.classList.toggle("has-sheet", Boolean(isSheet() && anyFront));
    var active = activeWindow();
    document.querySelectorAll(".topbar [data-open]").forEach(function (btn) {
      if (active && btn.getAttribute("data-open") === active.id) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }

  function activeWindow() {
    return windows
      .filter(function (win) {
        if (!win.classList.contains("is-open") || win.classList.contains("is-minimized")) return false;
        if (isSheet() && !win.classList.contains("is-front")) return false;
        return true;
      })
      .sort(function (a, b) {
        return (parseInt(a.style.zIndex, 10) || 0) - (parseInt(b.style.zIndex, 10) || 0);
      })
      .pop();
  }

  function focusWindow(win) {
    z += 1;
    win.style.zIndex = String(z);
    windows.forEach(function (item) {
      item.classList.toggle("is-active", item === win);
    });
    syncChrome();
  }

  function openWindow(id) {
    var win = document.getElementById(id);
    if (!win) return;
    if (isSheet()) {
      windows.forEach(function (item) {
        item.classList.remove("is-front");
      });
      win.classList.add("is-front");
      win.style.left = "";
      win.style.top = "";
      win.style.right = "";
    }
    win.classList.remove("is-minimized", "is-closing");
    win.classList.add("is-open");
    focusWindow(win);
    var closeBtn = win.querySelector(".traffic-close");
    if (closeBtn) closeBtn.focus();
  }

  function finishClose(win) {
    win.classList.remove("is-open", "is-closing", "is-front", "is-minimized", "is-zoomed", "is-active");
    syncChrome();
  }

  function closeWindow(win, restoreEl) {
    if (!win || !win.classList.contains("is-open")) return;
    var done = function () {
      finishClose(win);
      if (restoreEl && typeof restoreEl.focus === "function") restoreEl.focus();
    };
    if (reduced()) {
      done();
      return;
    }
    win.classList.add("is-closing");
    var settled = false;
    var settle = function () {
      if (settled) return;
      settled = true;
      win.removeEventListener("animationend", settle);
      done();
    };
    win.addEventListener("animationend", settle);
    window.setTimeout(settle, 280);
  }

  function minimise(win) {
    if (isSheet()) {
      closeWindow(win, document.querySelector('#dock [data-open="' + win.id + '"]'));
      return;
    }
    win.classList.add("is-minimized");
    win.classList.remove("is-active");
    syncChrome();
    var dockBtn = document.querySelector('#dock [data-open="' + win.id + '"]');
    if (dockBtn) dockBtn.focus();
  }

  function zoom(win) {
    if (isSheet()) return;
    win.classList.toggle("is-zoomed");
    if (win.classList.contains("is-zoomed")) {
      var parent = win.offsetParent || document.body;
      var maxWidth = Math.min(860, parent.clientWidth - 96);
      var left = win.getBoundingClientRect().left - parent.getBoundingClientRect().left;
      var maxLeft = Math.max(12, parent.clientWidth - maxWidth - 72);
      if (left > maxLeft) {
        win.style.right = "auto";
        win.style.left = maxLeft + "px";
      }
    }
    focusWindow(win);
  }

  function enableDrag(win) {
    var bar = win.querySelector(".titlebar");
    if (!bar) return;
    bar.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || isSheet()) return;
      if (event.target.closest("button")) return;
      focusWindow(win);
      var parent = win.offsetParent || document.body;
      var origin = parent.getBoundingClientRect();
      var rect = win.getBoundingClientRect();
      var shiftX = event.clientX - rect.left;
      var shiftY = event.clientY - rect.top;
      bar.setPointerCapture(event.pointerId);

      function onMove(ev) {
        var dock = document.querySelector(".dock");
        var dockTop = dock ? dock.getBoundingClientRect().top : origin.bottom - 96;
        var left = ev.clientX - origin.left - shiftX;
        var top = ev.clientY - origin.top - shiftY;
        var maxLeft = Math.max(8, origin.width - 140);
        var maxTop = Math.max(60, dockTop - origin.top - 48);
        left = Math.min(Math.max(8, left), maxLeft);
        top = Math.min(Math.max(60, top), maxTop);
        win.style.right = "auto";
        win.style.left = left + "px";
        win.style.top = top + "px";
      }

      function onUp() {
        bar.removeEventListener("pointermove", onMove);
        bar.removeEventListener("pointerup", onUp);
        bar.removeEventListener("pointercancel", onUp);
      }

      bar.addEventListener("pointermove", onMove);
      bar.addEventListener("pointerup", onUp);
      bar.addEventListener("pointercancel", onUp);
    });
  }

  document.addEventListener("click", function (event) {
    var hashLink = event.target.closest("a[href='#']");
    if (hashLink) event.preventDefault();
    var opener = event.target.closest("[data-open]");
    if (opener) {
      openWindow(opener.getAttribute("data-open"));
      return;
    }
    var filter = event.target.closest("[data-filter]");
    if (filter) {
      var name = filter.getAttribute("data-filter");
      document.querySelectorAll("[data-filter]").forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn === filter ? "true" : "false");
      });
      document.querySelectorAll(".job").forEach(function (job) {
        var tracks = (job.getAttribute("data-tracks") || "").split(/\s+/);
        var show = name === "all" || tracks.indexOf(name) !== -1;
        job.classList.toggle("is-hidden", !show);
      });
      return;
    }
    var win = event.target.closest(".window");
    if (!win) return;
    if (event.target.closest(".traffic-close")) closeWindow(win, document.querySelector('#dock [data-open="' + win.id + '"]'));
    else if (event.target.closest(".traffic-min")) minimise(win);
    else if (event.target.closest(".traffic-zoom")) zoom(win);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      var current = activeWindow();
      if (!current) return;
      event.preventDefault();
      closeWindow(current, document.querySelector('#dock [data-open="' + current.id + '"]'));
      return;
    }
    if (event.key !== "Tab" || !isSheet()) return;
    var dialog = activeWindow();
    if (!dialog) return;
    var items = Array.prototype.slice.call(dialog.querySelectorAll("button, a[href]")).filter(function (el) {
      return !el.closest(".job.is-hidden") && el.offsetParent !== null;
    });
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  windows.forEach(function (win) {
    win.addEventListener("pointerdown", function () {
      focusWindow(win);
    });
    enableDrag(win);
  });

  function onSheetChange() {
    if (isSheet()) {
      windows.forEach(function (win) {
        win.style.left = "";
        win.style.top = "";
        win.style.right = "";
        win.classList.remove("is-minimized", "is-zoomed", "is-front");
      });
    }
    syncChrome();
  }

  if (sheetQuery.addEventListener) sheetQuery.addEventListener("change", onSheetChange);
  else if (sheetQuery.addListener) sheetQuery.addListener(onSheetChange);

  focusWindow(document.getElementById("win-quotes"));
  focusWindow(document.getElementById("win-work"));
  syncChrome();
})();
