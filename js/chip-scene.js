/* chip-scene.js: the Three.js hero. A QFP chip whose silicon die is the photo, gold bond wires,
   a spinning wafer, red HUD rings and eight floating components that react to hover, tap and drag.
   Needs three.js r128 and main.js (window.RM). */
(function () {
  "use strict";
  var RM = window.RM, pop = RM.pop, bootChime = RM.bootChime, onPage = RM.onPage, clamp = RM.clamp, reduceMotion = RM.reduceMotion;
  var ARCH = "assets/ribhu.jpg";

  var stage = document.getElementById("stage"), canvas = document.getElementById("gl"), heroActive = true;
  function fallback() {
    canvas.remove(); var d = document.createElement("div"); d.className = "fallback";
    var im = new Image(); im.src = ARCH; im.alt = "Ribhu Mukherjee"; d.appendChild(im); stage.insertBefore(d, stage.firstChild);
    document.getElementById("hint").hidden = true;
  }
  function start3D() {
    if (!window.THREE) { fallback(); return; }
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { fallback(); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .1, 60);
    camera.position.set(0, 0, 11.5);
    function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

    // studio environment for metal reflections: soft boxes + a red rim band
    (function () {
      var ec = document.createElement("canvas"); ec.width = 1024; ec.height = 512; var g = ec.getContext("2d");
      var bg = g.createLinearGradient(0, 0, 0, 512); bg.addColorStop(0, "#3a2d6e"); bg.addColorStop(.5, "#1a1533"); bg.addColorStop(1, "#08070f"); g.fillStyle = bg; g.fillRect(0, 0, 1024, 512);
      g.fillStyle = "#ffffff"; g.globalAlpha = .9; g.fillRect(180, 70, 220, 110); g.globalAlpha = .55; g.fillRect(620, 90, 160, 70);
      var rb = g.createRadialGradient(860, 260, 10, 860, 260, 170); rb.addColorStop(0, "rgba(255,70,50,1)"); rb.addColorStop(1, "rgba(255,70,50,0)"); g.globalAlpha = 1; g.fillStyle = rb; g.fillRect(600, 60, 420, 420);
      var tex = new THREE.CanvasTexture(ec); tex.encoding = THREE.sRGBEncoding;
      var es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })));
      var pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, .04).texture; pm.dispose();
    })();
    scene.add(new THREE.HemisphereLight(0xb9a8ff, 0x1a1030, .55));
    var key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-3, 5, 7); scene.add(key);
    var rim = new THREE.PointLight(0xff3b2a, 3.2, 14, 2); rim.position.set(3.2, -1, -2); scene.add(rim);
    var fillL = new THREE.PointLight(0x7c5cff, 1.8, 16, 2); fillL.position.set(-4, 2, 3); scene.add(fillL);

    var rig = new THREE.Group(); scene.add(rig);
    function rbox(w, h, d, r, seg) {
      var g = new THREE.BoxGeometry(w, h, d, seg || 8, seg || 8, seg || 8), p = g.attributes.position, n = g.attributes.normal;
      var v = new THREE.Vector3(), c = new THREE.Vector3(), o = new THREE.Vector3(), hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
      for (var i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i); c.set(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
        o.copy(v).sub(c); if (o.lengthSq() < 1e-12) o.fromBufferAttribute(n, i); o.normalize();
        n.setXYZ(i, o.x, o.y, o.z); p.setXYZ(i, c.x + o.x * r, c.y + o.y * r, c.z + o.z * r);
      }
      return g;
    }
    var cache = {};
    function M(kind) {
      if (cache[kind]) return cache[kind];
      var P = {
        epoxy: { color: "#1f1a33", roughness: .62, metalness: 0, clearcoat: .45, clearcoatRoughness: .5 },
        epoxy2: { color: "#2d2650", roughness: .55, metalness: 0, clearcoat: .5, clearcoatRoughness: .4 },
        silver: { color: "#d8d5e6", roughness: .22, metalness: 1 },
        gold: { color: "#e6b44c", roughness: .25, metalness: 1 },
        copper: { color: "#d77a43", roughness: .3, metalness: 1 },
        can: { color: "#3a2f6e", roughness: .4, metalness: .2, clearcoat: .8, clearcoatRoughness: .2 },
        red: { color: "#ff3b2a", roughness: .3, metalness: 0, emissive: "#ff2a14", emissiveIntensity: .6, clearcoat: 1 },
        dark: { color: "#0f0c1c", roughness: .7, metalness: 0 }
      }[kind];
      var m = new THREE.MeshPhysicalMaterial({ envMapIntensity: 1 });
      for (var k in P) m[k] = (k === "color" || k === "emissive") ? lin(P[k]) : P[k];
      return (cache[kind] = m);
    }
    function mesh(geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; }
    function label(text, w, h, color, size, weight) {
      var cv = document.createElement("canvas"); cv.width = 512; cv.height = Math.round(512 * h / w);
      var g = cv.getContext("2d"); g.fillStyle = color; g.font = (weight || 700) + " " + size + "px 'JetBrains Mono', monospace"; g.textAlign = "center"; g.textBaseline = "middle";
      text.split("\n").forEach(function (t, i, a) { g.fillText(t, 256, cv.height / 2 + (i - (a.length - 1) / 2) * size * 1.3); });
      var tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 4;
      return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, toneMapped: false }));
    }

    // --- wafer behind everything ---
    var wc = document.createElement("canvas"); wc.width = wc.height = 1024;
    (function () {
      var g = wc.getContext("2d"), R = 512;
      g.fillStyle = "#14102a"; g.fillRect(0, 0, 1024, 1024);
      var d = 58, gap = 6;
      for (var y = -R; y < R; y += d) for (var x = -R; x < R; x += d) {
        var cx = x + d / 2, cy = y + d / 2; if (Math.hypot(Math.abs(cx) + d / 2, Math.abs(cy) + d / 2) > R - 22) continue;
        var ang = Math.atan2(cy, cx), hue = (ang / Math.PI * 180 + 360 + Math.hypot(cx, cy) * .25) % 360;
        g.fillStyle = "hsl(" + hue.toFixed(0) + ",55%," + (34 + 8 * Math.sin(cx * .02 + cy * .015)).toFixed(0) + "%)";
        g.fillRect(512 + x + gap / 2, 512 + y + gap / 2, d - gap, d - gap);
        g.fillStyle = "rgba(10,8,22,.35)"; g.fillRect(512 + x + gap / 2 + 9, 512 + y + gap / 2 + 9, (d - gap) * .5, (d - gap) * .32);
      }
      var sh = g.createLinearGradient(0, 0, 1024, 1024); sh.addColorStop(0, "rgba(255,255,255,.22)"); sh.addColorStop(.45, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(255,255,255,.08)");
      g.fillStyle = sh; g.fillRect(0, 0, 1024, 1024);
    })();
    var wTex = new THREE.CanvasTexture(wc); wTex.encoding = THREE.sRGBEncoding; wTex.anisotropy = 8;
    var waferFace = new THREE.MeshPhysicalMaterial({ map: wTex, roughness: .22, metalness: .35, clearcoat: 1, clearcoatRoughness: .1 });
    var wafer = new THREE.Mesh(new THREE.CylinderGeometry(3.15, 3.15, .08, 128), [M("silver"), waferFace, M("silver")]);
    wafer.rotation.x = Math.PI / 2; wafer.position.set(.35, .15, -3.0); rig.add(wafer);

    // --- red HUD rings ---
    function ringTex(segs, ticks) {
      var c = document.createElement("canvas"); c.width = c.height = 1024; var g = c.getContext("2d"); g.translate(512, 512);
      g.strokeStyle = "rgba(255,70,50,.95)"; g.lineCap = "round";
      segs.forEach(function (s) { g.lineWidth = s[3]; g.beginPath(); g.arc(0, 0, s[0], s[1], s[2]); g.stroke(); });
      if (ticks) for (var i = 0; i < 120; i++) { var a = i / 120 * Math.PI * 2, r1 = 470, r2 = i % 10 ? 482 : 496; g.lineWidth = i % 10 ? 2 : 4; g.beginPath(); g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); g.stroke(); }
      var t = new THREE.CanvasTexture(c); return t;
    }
    function hud(tex, size, z, op) { var m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); m.position.set(.35, .15, z); rig.add(m); return m; }
    var ring1 = hud(ringTex([[440, 0, 1.9, 6], [440, 2.3, 3.4, 6], [440, 3.8, 5.6, 6], [410, .6, 1.2, 14], [410, 3.5, 4.4, 14]], true), 7.6, -2.8, .55);
    var ring2 = hud(ringTex([[500, .2, 1.4, 3], [500, 2.0, 4.0, 3], [500, 4.6, 5.9, 3], [380, 1.0, 2.6, 2], [380, 4.0, 5.2, 2]], false), 8.4, -2.9, .35);
    var glow = (function () { var c = document.createElement("canvas"); c.width = c.height = 256; var g = c.getContext("2d"), r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, "rgba(255,60,40,.85)"); r.addColorStop(.5, "rgba(255,40,30,.25)"); r.addColorStop(1, "rgba(255,40,30,0)"); g.fillStyle = r; g.fillRect(0, 0, 256, 256); return hud(new THREE.CanvasTexture(c), 7, -3.2, .55); })();

    // --- the main chip: its die is the photo ---
    var chip = new THREE.Group(), CW = 3.3, CH = 3.95, CD = .32, PW = 2.36, PH = 2.95, zTop = CD / 2;
    chip.add(mesh(rbox(CW, CH, CD, .12, 12), M("epoxy")));
    chip.add(mesh(rbox(PW + .22, PH + .22, .05, .022, 6), M("dark"), 0, -.05, zTop - .012));
    var dc = document.createElement("canvas"); dc.width = 640; dc.height = 800; var dTex = new THREE.CanvasTexture(dc); dTex.encoding = THREE.sRGBEncoding; dTex.anisotropy = 8;
    function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function paintDie(img) {
      var g = dc.getContext("2d"); g.clearRect(0, 0, 640, 800);
      g.save(); rr(g, 6, 6, 628, 788, 26); g.clip();
      var bg = g.createLinearGradient(0, 0, 0, 800); bg.addColorStop(0, "#3a2f6e"); bg.addColorStop(1, "#1a1533"); g.fillStyle = bg; g.fillRect(0, 0, 640, 800);
      if (img) g.drawImage(img, 0, 0, 640, 800);
      g.strokeStyle = "rgba(255,255,255,.05)"; g.lineWidth = 1; for (var x = 40; x < 640; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 800); g.stroke(); } for (var y = 40; y < 800; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(640, y); g.stroke(); }
      var vg = g.createLinearGradient(0, 560, 0, 800); vg.addColorStop(0, "rgba(18,15,34,0)"); vg.addColorStop(1, "rgba(18,15,34,.55)"); g.fillStyle = vg; g.fillRect(0, 0, 640, 800);
      g.restore();
      g.lineWidth = 10; g.strokeStyle = "#e6b44c"; rr(g, 6, 6, 628, 788, 26); g.stroke();
      dTex.needsUpdate = true;
    }
    paintDie(null);
    var photo = new Image(); photo.onload = function () { paintDie(photo); }; photo.src = ARCH;
    var die = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: dTex, transparent: true, toneMapped: false }));
    die.position.set(0, -.05, zTop + .025); chip.add(die);
    // scan line that sweeps the die on boot
    var scan = new THREE.Mesh(new THREE.PlaneGeometry(PW, .12), new THREE.MeshBasicMaterial({ color: 0xff4a30, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    scan.position.z = zTop + .03; chip.add(scan);
    // pins
    var pinMat = M("silver").clone(); pinMat.emissive = lin("#ff2a14"); pinMat.emissiveIntensity = 0;
    var sideG = rbox(.32, .085, .07, .03, 3), tbG = rbox(.085, .32, .07, .03, 3), nSide = 14, nTB = 11;
    for (var i = 0; i < nSide; i++) { var y = -1.6 + i * (3.2 / (nSide - 1)); chip.add(mesh(sideG, pinMat, CW / 2 + .14, y, -.04)); chip.add(mesh(sideG, pinMat, -CW / 2 - .14, y, -.04)); }
    for (i = 0; i < nTB; i++) { var x = -1.25 + i * (2.5 / (nTB - 1)); chip.add(mesh(tbG, pinMat, x, CH / 2 + .14, -.04)); chip.add(mesh(tbG, pinMat, x, -CH / 2 - .14, -.04)); }
    // bond wires from die pads to the pins
    var wireG = [];
    for (i = 0; i < nSide; i++) {
      var py = -1.6 + i * (3.2 / (nSide - 1)), dy = -.05 + (py + .05) * .88;
      [-1, 1].forEach(function (s) {
        var a = new THREE.Vector3(s * (PW / 2 + .04), dy, zTop + .03), b = new THREE.Vector3(s * (CW / 2 - .1), py, zTop + .005);
        var m = a.clone().lerp(b, .5); m.z += .16;
        chip.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, b), 10, .009, 5), M("gold")));
      });
    }
    var dot = mesh(new THREE.CylinderGeometry(.08, .08, .03, 24), M("red"), -CW / 2 + .3, CH / 2 - .27, zTop); dot.rotation.x = Math.PI / 2; chip.add(dot);
    var top1 = label("RM-0908 · EMBEDDED", 2.2, .2, "rgba(220,214,245,.75)", 34); top1.position.set(.12, CH / 2 - .27, zTop + .002); chip.add(top1);
    var bot1 = label("BOOT OK  ·  3+ YRS SILICON", 2.6, .2, "rgba(220,214,245,.6)", 30); bot1.position.set(0, -CH / 2 + .24, zTop + .002); chip.add(bot1);
    chip.position.set(.15, .1, 0); chip.rotation.set(-.08, -.28, .02);
    chip.userData = { part: { name: "RM-0908 · Ribhu Mukherjee", tip: "Embedded SW engineer at Qualcomm. Tap the chip to boot it.", pitch: 220 }, home: chip.position.clone(), base: new THREE.Euler(-.08, -.28, .02), s: 1, phase: 0, squish: 0, vel: 0, spin: 0, spinAcc: 0, hover: 0, push: new THREE.Vector3(), main: true };
    rig.add(chip);

    // --- small floating parts ---
    function qfp() { var g = new THREE.Group(); g.add(mesh(rbox(1.2, 1.2, .26, .08, 10), M("epoxy2"))); var pg = rbox(.07, .22, .05, .02, 3); for (var s = 0; s < 4; s++) for (var i = 0; i < 6; i++) { var t = -.4 + i * .16, p = mesh(pg, M("silver")); if (s < 2) p.position.set(t, s ? -.67 : .67, 0); else { p.rotation.z = Math.PI / 2; p.position.set(s === 2 ? .67 : -.67, t, 0); } g.add(p); } var d = mesh(new THREE.CylinderGeometry(.06, .06, .03, 20), M("red"), -.38, .38, .13); d.rotation.x = Math.PI / 2; g.add(d); var l = label("QCS\n8550", .7, .45, "rgba(220,214,245,.8)", 80); l.position.z = .135; g.add(l); return g; }
    function bga() { var g = new THREE.Group(); g.add(mesh(rbox(1.4, 1.4, .12, .05, 10), M("epoxy2"))); g.add(mesh(rbox(.95, .95, .16, .07, 10), M("silver"), 0, 0, .12)); var l = label("SoC", .6, .25, "rgba(40,30,80,.75)", 90); l.position.z = .205; g.add(l); return g; }
    function cap() { var g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(.32, .32, .86, 48), M("can"))); g.add(new THREE.Mesh(new THREE.CylinderGeometry(.326, .326, .78, 32, 1, true, -.4, .8), M("silver"))); g.add(mesh(new THREE.CylinderGeometry(.29, .29, .03, 40), M("silver"), 0, .435, 0)); var lg = new THREE.CylinderGeometry(.025, .025, .5, 10); g.add(mesh(lg, M("silver"), -.11, -.66, 0)); g.add(mesh(lg, M("silver"), .11, -.66, 0)); return g; }
    function res() { var g = new THREE.Group(); g.add(mesh(rbox(.9, .4, .28, .08, 8), M("dark"))); var cg = rbox(.19, .44, .32, .06, 6); g.add(mesh(cg, M("silver"), -.48, 0, 0)); g.add(mesh(cg, M("silver"), .48, 0, 0)); var l = label("103", .4, .2, "rgba(220,214,245,.85)", 150); l.position.z = .145; g.add(l); return g; }
    var ledMat = M("red");
    function led() { var g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(.24, .24, .36, 40), ledMat, 0, .05, 0)); g.add(mesh(new THREE.SphereGeometry(.24, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), ledMat, 0, .23, 0)); g.add(mesh(new THREE.CylinderGeometry(.29, .29, .06, 40), ledMat, 0, -.13, 0)); var lg = new THREE.CylinderGeometry(.025, .025, .55, 10); g.add(mesh(lg, M("silver"), -.09, -.44, 0)); g.add(mesh(lg, M("silver"), .09, -.4, 0)); return g; }
    function xtal() { var g = new THREE.Group(); g.add(mesh(rbox(.95, .4, .3, .14, 10), M("silver"))); g.add(mesh(rbox(1.0, .09, .34, .04, 4), M("dark"), 0, -.22, 0)); return g; }
    function ind() { var g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.TorusGeometry(.34, .14, 28, 64), M("dark"))); var wg = new THREE.TorusGeometry(.16, .022, 8, 24); for (var i = 0; i < 16; i++) { var a = i / 16 * Math.PI * 2, w = new THREE.Mesh(wg, M("copper")); w.position.set(Math.cos(a) * .34, Math.sin(a) * .34, 0); w.rotation.set(0, Math.PI / 2, a + Math.PI / 2, "ZYX"); g.add(w); } return g; }
    function jtag() { var g = new THREE.Group(); g.add(mesh(rbox(1.05, .26, .46, .07, 8), M("dark"))); var pg = rbox(.07, .5, .07, .025, 3); for (var r = 0; r < 2; r++) for (var i = 0; i < 5; i++) g.add(mesh(pg, M("gold"), -.4 + i * .2, .12, r ? .1 : -.1)); return g; }
    var PARTS = [
      { make: qfp, at: [-2.55, 1.75, -.9], s: .78, rot: [.35, .55, .25], name: "QCS8550 MCU", tip: "First Zephyr watchdog driver on QCS8550", pitch: 330 },
      { make: bga, at: [2.75, 1.85, -1.4], s: .72, rot: [.4, -.6, -.2], name: "SoC", tip: "8+ SoC platforms · DSP, Modem, UEFI", pitch: 280 },
      { make: cap, at: [2.65, .05, .7], s: .95, rot: [.25, .3, -.35], name: "Decoupling cap", tip: "Absorbed 30+ P0/P1 customer escalations", pitch: 300 },
      { make: xtal, at: [-2.6, -.35, .6], s: .95, rot: [.3, .6, .4], name: "32 kHz crystal", tip: "Timers & time sync · core platform services", pitch: 420 },
      { make: ind, at: [.9, 2.75, -1.6], s: .85, rot: [.2, .5, 0], name: "Power inductor", tip: "UEFI charging-mode feature for Samsung", pitch: 240 },
      { make: led, at: [-1.75, 2.45, 1.0], s: .8, rot: [.2, 0, -.3], name: "Status LED", tip: "Brought the DSP up from the primary bootloader", pitch: 520 },
      { make: res, at: [2.35, -1.95, 1.1], s: .8, rot: [.5, .45, .2], name: "0603 resistor", tip: "Closed a month-long MDM9205 heap corruption", pitch: 460 },
      { make: jtag, at: [-2.2, -2.15, 1.1], s: .78, rot: [.55, -.5, .15], name: "JTAG header", tip: "JTAG + Trace32 for silicon debug", pitch: 380 }
    ];
    var parts = [chip].concat(PARTS.map(function (d, i) {
      var g = d.make(); g.position.set(d.at[0], d.at[1], d.at[2]); g.rotation.set(d.rot[0], d.rot[1], d.rot[2]);
      g.userData = { part: d, home: g.position.clone(), base: new THREE.Euler(d.rot[0], d.rot[1], d.rot[2]), s: d.s, phase: (i + 1) * 1.7, squish: 0, vel: 0, spin: 0, spinAcc: 0, hover: 0, push: new THREE.Vector3() };
      rig.add(g); return g;
    }));

    // --- interaction ---
    var tip = document.getElementById("tip"), tipName = tip.querySelector("b"), tipText = tip.querySelector("span");
    var pointer = new THREE.Vector2(9, 9), target = { x: 0, y: 0 }, cur = { x: 0, y: 0 }, drag = null, orbit = { x: 0, y: 0 }, orbitCur = { x: 0, y: 0 };
    var ray = new THREE.Raycaster(), hovered = null, pinned = null, boot = 0, ringBoost = 0, tmp = new THREE.Vector3();
    function toNDC(e) { var r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }; }
    function rootOf(o) { while (o && !(o.userData && o.userData.part)) o = o.parent; return o; }
    function pick(p) { ray.setFromCamera(p, camera); var h = ray.intersectObjects(parts, true)[0]; return h ? rootOf(h.object) : null; }
    function showTip(g) { if (!g) { tip.classList.remove("on"); return; } tipName.textContent = g.userData.part.name; tipText.textContent = g.userData.part.tip; tip.classList.add("on"); }
    function placeTip() {
      var g = pinned || hovered; if (!g) return;
      var cr = canvas.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      var v = (g.userData.main ? tmp.set(0, CH / 2, 0).applyMatrix4(g.matrixWorld) : g.getWorldPosition(tmp)).project(camera);
      var x = cr.left - sr.left + (v.x + 1) / 2 * cr.width, y = cr.top - sr.top + (1 - v.y) / 2 * cr.height - (g.userData.main ? 10 : 40 * g.userData.s);
      tip.style.left = clamp(x, 120, sr.width - 120) + "px"; tip.style.top = Math.max(70, y) + "px";
    }
    function doBoot() { boot = 1; ringBoost = 3; bootChime(); }
    canvas.addEventListener("pointermove", function (e) {
      var p = toNDC(e); pointer.set(p.x, p.y); target.x = p.x; target.y = p.y;
      if (drag) { orbit.y = drag.oy + (e.clientX - drag.x) * .006; orbit.x = clamp(drag.ox + (e.clientY - drag.y) * .004, -.5, .5); return; }
      if (e.pointerType === "touch") return;
      var g = pick(p);
      if (g !== hovered) { hovered = g; pinned = null; showTip(g); if (g) pop(g.userData.part.pitch * 1.4, .025); }
      canvas.style.cursor = g ? "pointer" : "";
    });
    canvas.addEventListener("pointerleave", function () { pointer.set(9, 9); target.x = target.y = 0; if (!pinned) { hovered = null; showTip(null); } });
    canvas.addEventListener("pointerdown", function (e) {
      var p = toNDC(e), g = pick(p);
      if (g) { var u = g.userData; u.vel += u.main ? 4 : 7; if (!u.main) u.spin += 5; pinned = g; showTip(g); if (u.main) doBoot(); else pop(u.part.pitch, .12); return; }
      if (pinned) { pinned = null; showTip(hovered); }
      drag = { x: e.clientX, y: e.clientY, oy: orbit.y, ox: orbit.x }; canvas.style.cursor = "grabbing";
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    });
    function endDrag() { drag = null; canvas.style.cursor = ""; }
    canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);

    function resize() { var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.position.z = w / h < .8 ? 13.8 : w / h < 1.05 ? 12.4 : 11.5; camera.updateProjectionMatrix(); }
    addEventListener("resize", resize); resize();

    var introT = reduceMotion ? 1 : 0;
    function frame(t, dt) {
      var time = t * .001;
      introT = Math.min(1, introT + dt / 1.8);
      var e = 1 - Math.pow(1 - introT, 3);
      cur.x += (target.x - cur.x) * .05; cur.y += (target.y - cur.y) * .05;
      if (!drag) { orbit.y *= .96; orbit.x *= .96; }
      orbitCur.x += (orbit.x - orbitCur.x) * .12; orbitCur.y += (orbit.y - orbitCur.y) * .12;
      rig.rotation.y = cur.x * .25 + orbitCur.y + (1 - e) * .7;
      rig.rotation.x = -cur.y * .14 + orbitCur.x;
      ray.setFromCamera(pointer, camera);
      // rings, wafer, glow
      ringBoost *= Math.pow(.3, dt);
      var spinK = reduceMotion ? 0 : 1;
      ring1.rotation.z += spinK * (.12 + ringBoost) * dt; ring2.rotation.z -= spinK * (.07 + ringBoost * .6) * dt;
      wafer.rotation.y += spinK * (.06 + ringBoost * .3) * dt;
      wafer.scale.setScalar(.4 + .6 * e); ring1.scale.setScalar(.6 + .4 * e); ring2.scale.setScalar(.6 + .4 * e);
      glow.material.opacity = .45 + .25 * boot + (reduceMotion ? 0 : .08 * Math.sin(time * 1.4));
      // boot: pins light up, scanline sweeps the die
      boot = Math.max(0, boot - dt * .55);
      pinMat.emissiveIntensity = boot * 2.2;
      scan.material.opacity = boot > 0 ? Math.min(1, boot * 2) * .9 : 0;
      scan.position.y = -.05 + PH / 2 - (1 - boot) * PH * 1.15;
      scan.visible = boot > 0 && Math.abs(scan.position.y + .05) < PH / 2;
      ledMat.emissiveIntensity = reduceMotion ? .6 : .45 + .4 * (.5 + .5 * Math.sin(time * 2.4)) + boot;
      rim.intensity = 3.2 + boot * 4;
      parts.forEach(function (g, i) {
        var u = g.userData, ph = u.phase;
        u.vel += (-u.squish * 60 - u.vel * 7) * dt; u.squish += u.vel * dt;
        var q = clamp(u.squish, -.4, .7);
        u.spin *= Math.pow(.2, dt); u.spinAcc += u.spin * dt;
        u.hover += (((g === hovered || g === pinned) ? 1 : 0) - u.hover) * Math.min(1, dt * 10);
        if (!u.main) {
          tmp.copy(g.position).sub(ray.ray.origin); var along = tmp.dot(ray.ray.direction);
          var closest = ray.ray.origin.clone().add(ray.ray.direction.clone().multiplyScalar(along));
          var away = g.position.clone().sub(closest), d = away.length();
          var want = d < 1.2 && pointer.x < 5 && g !== hovered ? away.normalize().multiplyScalar((1.2 - d) * .5) : new THREE.Vector3();
          u.push.lerp(want, .08);
        }
        var fl = reduceMotion ? 0 : Math.sin(time * .6 + ph) * (u.main ? .06 : .12);
        var popIn = Math.min(1, Math.max(0, introT * 1.6 - i * .07)), pe = 1 - Math.pow(1 - popIn, 3);
        g.position.set(u.home.x + u.push.x, u.home.y + fl + u.push.y + (1 - pe) * -.8, u.home.z + u.push.z + u.hover * (u.main ? .1 : .25));
        var s = u.s * (.2 + .8 * pe) * (1 + u.hover * (u.main ? .02 : .1));
        g.scale.set(s * (1 + q * .12), s * (1 - q * .18), s * (1 + q * .12));
        var wob = reduceMotion ? 0 : 1;
        g.rotation.x = u.base.x + wob * Math.cos(time * .32 + ph) * (u.main ? .05 : .18);
        g.rotation.y = u.base.y + wob * Math.sin(time * .38 + ph) * (u.main ? .1 : .35) + u.spinAcc;
        g.rotation.z = u.base.z + wob * Math.sin(time * .27 + ph * 1.3) * (u.main ? .02 : .08);
      });
      placeTip();
      renderer.render(scene, camera);
    }
    function onShow(id) { heroActive = id === "home"; if (heroActive) { resize(); if (reduceMotion) frame(0, 0); } }
    onPage.push(onShow); onShow(RM.current());
    if (reduceMotion) { frame(0, 0); addEventListener("resize", function () { frame(0, 0); }); return; }
    var last = performance.now();
    function loop(now) { var dt = Math.min(.05, (now - last) / 1000); last = now; if (heroActive && !document.hidden) frame(now, dt); requestAnimationFrame(loop); }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) last = performance.now(); });
    frame(last, 0); requestAnimationFrame(loop);
  }


  start3D();
})();
