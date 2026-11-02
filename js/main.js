/* Ribhu Mukherjee · portfolio
   main.js: sound, page routing with the wipe transition, tabs, sliders, count-up, contact form.
   Exposes window.RM for the background and 3D scene scripts. */
(function () {
  "use strict";
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ================= sound (off until asked) ================= */
  var AC = null, master = null, soundOn = false, soundBtn = document.getElementById("sound"), soundLabel = document.getElementById("sound-label");
  function initAudio() {
    var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return false;
    AC = new Ctx(); master = AC.createGain(); master.gain.value = 0; master.connect(AC.destination);
    var lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; var pad = AC.createGain(); pad.gain.value = .05; lp.connect(pad); pad.connect(master);
    [110, 164.8, 220, 277.2].forEach(function (f, i) {
      var o = AC.createOscillator(); o.type = i % 2 ? "sine" : "triangle"; o.frequency.value = f;
      var tr = AC.createGain(); tr.gain.value = .25; var l = AC.createOscillator(); l.frequency.value = .05 + i * .03; var la = AC.createGain(); la.gain.value = .2; l.connect(la); la.connect(tr.gain); l.start();
      o.connect(tr); tr.connect(lp); o.start();
    });
    return true;
  }
  function pop(pitch, vol, type) {
    if (!soundOn || !AC) return;
    var t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(pitch * 1.8, t); o.frequency.exponentialRampToValueAtTime(pitch, t + .09);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .3);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + .32);
  }
  function bootChime() { [392, 523, 659, 784].forEach(function (f, i) { setTimeout(function () { pop(f, .09, "square"); }, i * 90); }); }
  soundBtn.addEventListener("click", function () {
    if (!AC && !initAudio()) { soundLabel.textContent = "No audio"; return; }
    soundOn = !soundOn; if (AC.state === "suspended") AC.resume();
    master.gain.setTargetAtTime(soundOn ? 1 : 0, AC.currentTime, .3);
    soundBtn.setAttribute("aria-pressed", String(soundOn)); soundLabel.textContent = soundOn ? "Sound on" : "Sound";
    if (soundOn) pop(520, .1);
  });

  /* ================= pages + wipe transition ================= */
  var pages = [].slice.call(document.querySelectorAll(".page")), dockLinks = [].slice.call(document.querySelectorAll(".dock a"));
  var wipe = [].slice.call(document.querySelectorAll(".wipe i")), current = null, busy = false, onPage = [];
  function show(id) {
    pages.forEach(function (p) { p.classList.toggle("active", p.id === id); });
    dockLinks.forEach(function (a) { if (a.dataset.go === id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    current = id; window.scrollTo(0, 0);
    document.title = id === "home" ? "Ribhu Mukherjee" : "Ribhu Mukherjee · " + document.getElementById(id).getAttribute("aria-label");
    onPage.forEach(function (f) { f(id); });
  }
  function go(id, push) {
    if (!document.getElementById(id) || id === current || busy) return;
    if (push) history.pushState(null, "", "#" + id);
    pop(300 + pages.map(function (p) { return p.id; }).indexOf(id) * 50, .05);
    if (reduceMotion || !wipe[0].animate) { show(id); return; }
    busy = true;
    var dur = 900;
    wipe.forEach(function (el, i) {
      el.animate([{ transform: "translateX(100%)" }, { transform: "translateX(0%)", offset: .45 }, { transform: "translateX(0%)", offset: .55 }, { transform: "translateX(-100%)" }],
        { duration: dur, delay: i * 90, easing: "cubic-bezier(.7,0,.3,1)", fill: "none" });
    });
    setTimeout(function () { show(id); }, dur * .5 + 90);
    setTimeout(function () { busy = false; }, dur + 200);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("[data-go]"); if (!a) return;
    e.preventDefault(); go(a.dataset.go, true);
  });
  addEventListener("popstate", function () { var id = location.hash.slice(1) || "home"; if (document.getElementById(id)) { busy = false; go(id, false); } });
  addEventListener("keydown", function (e) {
    if (e.target.closest && e.target.closest("input, textarea, [role=tab]")) return;
    var ids = pages.map(function (p) { return p.id; }), i = ids.indexOf(current);
    if (e.key === "PageDown") { e.preventDefault(); go(ids[Math.min(ids.length - 1, i + 1)], true); }
    if (e.key === "PageUp") { e.preventDefault(); go(ids[Math.max(0, i - 1)], true); }
  });

  /* ================= tabs ================= */
  document.querySelectorAll("[data-tabs]").forEach(function (box) {
    var tabs = [].slice.call(box.querySelectorAll("[role=tab]"));
    function pick(t, focus) {
      tabs.forEach(function (x) { var on = x === t; x.setAttribute("aria-selected", String(on)); x.tabIndex = on ? 0 : -1; document.getElementById(x.getAttribute("aria-controls")).hidden = !on; });
      if (focus) t.focus(); pop(440, .04);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { pick(t); });
      t.addEventListener("keydown", function (e) { var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (d) { e.preventDefault(); pick(tabs[(i + d + tabs.length) % tabs.length], true); } });
    });
  });

  /* ================= sliders ================= */
  document.querySelectorAll("[data-slider]").forEach(function (track) {
    var page = track.closest(".page"), dots = page.querySelector(".dots"), items = [].slice.call(track.children), timer = null;
    items.forEach(function () { dots.appendChild(document.createElement("i")); });
    var dotEls = [].slice.call(dots.children);
    function step() { return items[1] ? items[1].offsetLeft - items[0].offsetLeft : track.clientWidth; }
    function idx() { return Math.round(track.scrollLeft / step()); }
    function paint() { var i = idx(); dotEls.forEach(function (d, k) { d.classList.toggle("on", k === i); }); }
    function move(d) {
      var max = track.scrollWidth - track.clientWidth - 2, to = track.scrollLeft + d * step();
      if (d > 0 && track.scrollLeft >= max) to = 0; else if (d < 0 && track.scrollLeft <= 2) to = max + 2;
      track.scrollTo({ left: to, behavior: reduceMotion ? "auto" : "smooth" }); pop(d > 0 ? 480 : 400, .04);
    }
    page.querySelectorAll("button.nav").forEach(function (b) { b.addEventListener("click", function () { move(+b.dataset.dir); restart(); }); });
    track.addEventListener("scroll", paint, { passive: true }); paint();
    function restart() { if (timer) clearInterval(timer); timer = null; if (track.hasAttribute("data-auto") && !reduceMotion && current === page.id) timer = setInterval(function () { if (!track.matches(":hover")) move(1); }, 4200); }
    onPage.push(function (id) { if (id === page.id) { track.scrollLeft = 0; paint(); } restart(); });
  });

  /* ================= count-up on About ================= */
  var counts = [].slice.call(document.querySelectorAll("[data-count]"));
  onPage.push(function (id) {
    if (id !== "about") return;
    counts.forEach(function (el) {
      var to = +el.dataset.count, t0 = performance.now(), d = reduceMotion ? 0 : 1300;
      (function tick(now) { var k = d ? Math.min(1, (now - t0) / d) : 1; el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))) + "+"; if (k < 1) requestAnimationFrame(tick); })(t0);
    });
  });

  /* ================= contact ================= */
  document.getElementById("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var n = document.getElementById("f-name").value.trim(), s = document.getElementById("f-subject").value.trim() || "Hello Ribhu", m = document.getElementById("f-msg").value.trim();
    location.href = "mailto:iribhumukherjee@gmail.com?subject=" + encodeURIComponent(s) + "&body=" + encodeURIComponent(m + (n ? "\n\n— " + n : ""));
  });
  var copyBtn = document.getElementById("copy"), copyL = document.getElementById("copy-l");
  copyBtn.addEventListener("click", function () {
    var el = document.getElementById("email");
    function sel() { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); copyL.textContent = "Selected"; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(el.textContent).then(function () { copyL.textContent = "Copied"; pop(700, .08); }, sel); else sel();
    setTimeout(function () { copyL.textContent = "Copy"; }, 1800);
  });

  /* ================= shared API for the other scripts ================= */
  window.RM = { pop: pop, bootChime: bootChime, onPage: onPage, clamp: clamp, reduceMotion: reduceMotion, current: function () { return current; } };

  /* ================= open the page from the URL hash ================= */
  var first = location.hash.slice(1);
  show(pages.some(function (p) { return p.id === first; }) ? first : "home");
})();
