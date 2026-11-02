/* pcb-background.js: a full-screen canvas of PCB traces (straight runs with 45 degree jogs),
   vias, and signal pulses running along the traces. Traces near the cursor light up. */
(function () {
  "use strict";
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  (function () {
    var cv = document.getElementById("bg"), g = cv.getContext("2d"), off = document.createElement("canvas"), og = off.getContext("2d");
    var W, H, DPR, traces = [], vias = [], pulses = [], mouse = { x: -999, y: -999 };
    function build() {
      DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
      cv.width = off.width = W * DPR; cv.height = off.height = H * DPR;
      traces = []; vias = [];
      var cell = W < 700 ? 90 : 120, cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1, nodes = [];
      var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      for (var r = 0; r < rows; r++) { nodes[r] = []; for (var c = 0; c < cols; c++) nodes[r][c] = rnd() < .62 ? { x: c * cell + (rnd() - .5) * cell * .5, y: r * cell + (rnd() - .5) * cell * .5 } : null; }
      function link(a, b) {
        // octilinear: straight run, then 45 degree jog
        var dx = b.x - a.x, dy = b.y - a.y, adx = Math.abs(dx), ady = Math.abs(dy), pts = [a];
        if (adx > ady) pts.push({ x: a.x + Math.sign(dx) * (adx - ady), y: a.y }); else pts.push({ x: a.x, y: a.y + Math.sign(dy) * (ady - adx) });
        pts.push(b);
        var len = 0; for (var i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        traces.push({ pts: pts, len: len, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 });
      }
      for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
        var n = nodes[r][c]; if (!n) continue; var deg = 0;
        if (c + 1 < cols && nodes[r][c + 1] && rnd() < .55) { link(n, nodes[r][c + 1]); deg++; }
        if (r + 1 < rows && nodes[r + 1][c] && rnd() < .45) { link(n, nodes[r + 1][c]); deg++; }
        if (r + 1 < rows && c + 1 < cols && nodes[r + 1][c + 1] && rnd() < .2) { link(n, nodes[r + 1][c + 1]); deg++; }
        if (deg) vias.push(n);
      }
      og.setTransform(DPR, 0, 0, DPR, 0, 0); og.clearRect(0, 0, W, H);
      og.lineWidth = 1.4; og.strokeStyle = "rgba(160,140,235,.13)"; og.lineJoin = "round";
      traces.forEach(function (t) { og.beginPath(); og.moveTo(t.pts[0].x, t.pts[0].y); for (var i = 1; i < t.pts.length; i++) og.lineTo(t.pts[i].x, t.pts[i].y); og.stroke(); });
      vias.forEach(function (v) { og.beginPath(); og.arc(v.x, v.y, 3.2, 0, Math.PI * 2); og.fillStyle = "#171230"; og.fill(); og.lineWidth = 1.4; og.strokeStyle = "rgba(190,175,255,.28)"; og.stroke(); });
      pulses = []; for (var k = 0; k < Math.min(26, traces.length); k++) pulses.push(newPulse(Math.random()));
      draw(0);
    }
    function newPulse(p) { return { t: traces[(Math.random() * traces.length) | 0], p: p || 0, v: 70 + Math.random() * 110, red: Math.random() < .55 }; }
    function at(t, d) { for (var i = 1; i < t.pts.length; i++) { var a = t.pts[i - 1], b = t.pts[i], l = Math.hypot(b.x - a.x, b.y - a.y); if (d <= l || i === t.pts.length - 1) { var k = l ? Math.min(1, d / l) : 0; return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }; } d -= l; } return t.pts[0]; }
    function draw(dt) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(off, 0, 0);
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      // traces near the cursor light up
      g.lineWidth = 1.6; g.lineJoin = "round";
      traces.forEach(function (t) {
        var d = Math.hypot(t.mx - mouse.x, t.my - mouse.y); if (d > 190) return;
        g.strokeStyle = "rgba(241,90,70," + (.55 * (1 - d / 190)).toFixed(3) + ")";
        g.beginPath(); g.moveTo(t.pts[0].x, t.pts[0].y); for (var i = 1; i < t.pts.length; i++) g.lineTo(t.pts[i].x, t.pts[i].y); g.stroke();
      });
      if (reduceMotion) return;
      pulses.forEach(function (p, i) {
        p.p += p.v * dt / p.t.len; if (p.p >= 1) { pulses[i] = newPulse(0); return; }
        var d = p.p * p.t.len;
        for (var k = 0; k < 7; k++) {
          var q = at(p.t, Math.max(0, d - k * 5)), a = (1 - k / 7);
          g.fillStyle = p.red ? "rgba(255,90,60," + (a * .9).toFixed(3) + ")" : "rgba(190,170,255," + (a * .7).toFixed(3) + ")";
          g.beginPath(); g.arc(q.x, q.y, 2.2 * a + .4, 0, Math.PI * 2); g.fill();
        }
      });
    }
    addEventListener("pointermove", function (e) { mouse.x = e.clientX; mouse.y = e.clientY; if (reduceMotion) draw(0); }, { passive: true });
    var rt; addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(build, 150); });
    build();
    if (!reduceMotion) { var last = performance.now(); (function loop(now) { var dt = Math.min(.05, (now - last) / 1000); last = now; if (!document.hidden) draw(dt); requestAnimationFrame(loop); })(last); }
  })();
})();
