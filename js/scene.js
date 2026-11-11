/* Cena 3D: um único canvas fixo. Cada "ator" (laptop, console, globo) segue um
   elemento .slot do DOM, então o 3D acompanha o layout em qualquer largura. */
(function () {
  'use strict';
  var T = window.THREE;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function range(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }

  function create(canvas, opts) {
    opts = opts || {};
    var renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { return null; }
    if (!renderer.getContext()) return null;

    var W = 1, H = 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(26, 1, 0.1, 100);
    camera.position.set(0, 0, 14);

    var pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;

    var key = new T.DirectionalLight(0xffffff, 1.6);
    key.position.set(5, 7, 9);
    scene.add(key);
    var rim = new T.DirectionalLight(0xffb070, 0.9);
    rim.position.set(-7, 2, -4);
    scene.add(rim);

    var loader = new T.TextureLoader();
    var maxAniso = renderer.capabilities.getMaxAnisotropy();
    function tex(url) {
      var t = loader.load(url);
      t.encoding = T.sRGBEncoding;
      t.anisotropy = Math.min(8, maxAniso);
      return t;
    }

    /* ---------- geometria ---------- */
    function slab(w, h, r, depth, bevel) {
      var s = new T.Shape(), x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y);
      s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      var g = new T.ExtrudeGeometry(s, { depth: depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 14 });
      g.translate(0, 0, -depth / 2);
      return g;
    }

    function roundedScreenTexture(url, radius) {
      // desenha a captura num canvas com cantos arredondados (para a tela do celular)
      var c = document.createElement('canvas'); c.width = 390; c.height = 844;
      var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = Math.min(8, maxAniso);
      var img = new Image();
      img.onload = function () {
        var x = c.getContext('2d'), w = c.width, h = c.height, r = radius;
        x.beginPath(); x.moveTo(r, 0); x.arcTo(w, 0, w, h, r); x.arcTo(w, h, 0, h, r); x.arcTo(0, h, 0, 0, r); x.arcTo(0, 0, w, 0, r); x.closePath(); x.clip();
        x.drawImage(img, 0, 0, w, h);
        t.needsUpdate = true;
      };
      img.src = url;
      return t;
    }

    function keyboardTexture() {
      var c = document.createElement('canvas'); c.width = 1024; c.height = 400;
      var x = c.getContext('2d');
      x.fillStyle = '#17181b'; x.fillRect(0, 0, 1024, 400);
      var rows = [14, 14, 14, 13, 12], y = 10, kh = 58, gap = 8;
      function key(px, py, w, h) {
        x.fillStyle = '#0b0c0e'; x.beginPath();
        var r = 7; x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.fill();
        x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(px + 6, py + 3, w - 12, 2);
      }
      rows.forEach(function (n) {
        var kw = (1024 - 20 - gap * (n - 1)) / n;
        for (var i = 0; i < n; i++) key(10 + i * (kw + gap), y, kw, kh);
        y += kh + gap;
      });
      // última fileira com barra de espaço
      var kw = 62, px = 10;
      for (var i = 0; i < 3; i++) { key(px, y, kw, kh); px += kw + gap; }
      key(px, y, 1024 - 20 - 7 * (kw + gap) + gap - gap, kh); px = 1024 - 10 - 4 * (kw + gap) + gap;
      for (var j = 0; j < 4; j++) { key(px, y, kw, kh); px += kw + gap; }
      var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = Math.min(8, maxAniso);
      return t;
    }

    var ALU = new T.MeshStandardMaterial({ color: 0xbfc2c6, metalness: 1, roughness: 0.36 });
    var GLASS = new T.MeshStandardMaterial({ color: 0x050506, metalness: 0.3, roughness: 0.12 });

    function buildLaptop(screenUrl) {
      var g = new T.Group();
      var base = new T.Mesh(slab(3.2, 2.2, 0.13, 0.07, 0.015), ALU);
      base.rotation.x = -Math.PI / 2; g.add(base);
      var kb = new T.Mesh(new T.PlaneGeometry(2.86, 1.12), new T.MeshStandardMaterial({ map: keyboardTexture(), roughness: 0.7, metalness: 0.1 }));
      kb.rotation.x = -Math.PI / 2; kb.position.set(0, 0.0512, -0.36); g.add(kb);
      var pad = new T.Mesh(new T.PlaneGeometry(1.15, 0.7), new T.MeshStandardMaterial({ color: 0xb2b5b9, metalness: 1, roughness: 0.22 }));
      pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.0512, 0.64); g.add(pad);

      var lid = new T.Group(); lid.position.set(0, 0.052, -1.08); g.add(lid);
      var shell = new T.Mesh(slab(3.2, 2.12, 0.13, 0.035, 0.012), ALU);
      shell.position.set(0, 1.06, -0.03); lid.add(shell);
      var bezel = new T.Mesh(new T.PlaneGeometry(3.1, 2.02), GLASS);
      bezel.position.set(0, 1.06, 0.001); lid.add(bezel);
      var mat = new T.MeshBasicMaterial({ map: tex(screenUrl), toneMapped: false });
      var screen = new T.Mesh(new T.PlaneGeometry(2.98, 1.8625), mat);
      screen.position.set(0, 1.075, 0.003); lid.add(screen);
      g.userData = { lid: lid, screen: mat };
      return g;
    }

    function buildPhone(screenUrl) {
      var g = new T.Group();
      var body = new T.Mesh(slab(0.8, 1.68, 0.13, 0.05, 0.018), new T.MeshStandardMaterial({ color: 0x2a2b2f, metalness: 1, roughness: 0.3 }));
      g.add(body);
      var face = new T.Mesh(new T.PlaneGeometry(0.78, 1.66), GLASS); face.position.z = 0.044; g.add(face);
      var screen = new T.Mesh(new T.PlaneGeometry(0.74, 1.6), new T.MeshBasicMaterial({ map: roundedScreenTexture(screenUrl, 44), transparent: true, toneMapped: false }));
      screen.position.z = 0.046; g.add(screen);
      return g;
    }

    function buildConsole(urls) {
      var g = new T.Group();
      var shellMat = new T.MeshPhysicalMaterial({ color: 0xefe4d0, roughness: 0.42, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3 });
      var body = new T.Mesh(slab(3.3, 1.46, 0.36, 0.2, 0.04), shellMat); g.add(body);
      var bezel = new T.Mesh(slab(1.98, 1.16, 0.08, 0.01, 0.004), GLASS); bezel.position.z = 0.138; g.add(bezel);
      var maps = urls.map(tex);
      var mat = new T.MeshBasicMaterial({ map: maps[0], toneMapped: false });
      var screen = new T.Mesh(new T.PlaneGeometry(1.82, 1.02375), mat); screen.position.z = 0.149; g.add(screen);

      var dark = new T.MeshStandardMaterial({ color: 0x1f4b3b, roughness: 0.5 });
      var dpad = new T.Group(); dpad.position.set(-1.3, 0.12, 0.14);
      dpad.add(new T.Mesh(new T.BoxGeometry(0.46, 0.15, 0.07), dark));
      dpad.add(new T.Mesh(new T.BoxGeometry(0.15, 0.46, 0.07), dark));
      g.add(dpad);
      var stick = new T.Mesh(new T.CylinderGeometry(0.11, 0.13, 0.09, 28), new T.MeshStandardMaterial({ color: 0x23262a, roughness: 0.6 }));
      stick.rotation.x = Math.PI / 2; stick.position.set(-1.3, -0.4, 0.16); g.add(stick);

      var cols = [0xd9878a, 0xf4b183, 0x2f6b52, 0xb9616a];
      [[0.19, 0], [0, 0.19], [-0.19, 0], [0, -0.19]].forEach(function (p, i) {
        var b = new T.Mesh(new T.CylinderGeometry(0.085, 0.085, 0.07, 28), new T.MeshStandardMaterial({ color: cols[i], roughness: 0.35 }));
        b.rotation.x = Math.PI / 2; b.position.set(1.3 + p[0], 0.12 + p[1], 0.15); g.add(b);
      });
      [-0.09, 0.09].forEach(function (dx) {
        var p = new T.Mesh(new T.CapsuleGeometry(0.028, 0.1, 4, 12), dark);
        p.rotation.z = Math.PI / 2.6; p.position.set(1.3 + dx, -0.44, 0.145); g.add(p);
      });
      g.userData = { maps: maps, screen: mat, index: 0 };
      return g;
    }

    function buildGlobe() {
      var g = new T.Group();
      var earth = new T.Mesh(new T.SphereGeometry(1.2, 72, 48), new T.MeshStandardMaterial({ map: tex('tex/earth.webp'), roughness: 0.62, metalness: 0.05 }));
      g.add(earth);
      var cl = loader.load('tex/clouds.webp');
      var clouds = new T.Mesh(new T.SphereGeometry(1.215, 64, 40), new T.MeshStandardMaterial({ color: 0xffffff, alphaMap: cl, transparent: true, opacity: 0.4, depthWrite: false, roughness: 1 }));
      g.add(clouds);
      var atmo = new T.Mesh(new T.SphereGeometry(1.34, 64, 40), new T.ShaderMaterial({
        transparent: true, side: T.BackSide, blending: T.AdditiveBlending, depthWrite: false,
        vertexShader: 'varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: 'varying vec3 n; void main(){ float i = pow(0.72 - dot(n, vec3(0.0,0.0,1.0)), 3.2); gl_FragColor = vec4(0.45,0.72,1.0,1.0) * i; }'
      }));
      g.add(atmo);
      g.userData = { earth: earth, clouds: clouds };
      return g;
    }

    /* ---------- atores ---------- */
    var actors = [];
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    function addActor(def) {
      var root = new T.Group(); root.visible = false; scene.add(root);
      var pivot = new T.Group(); root.add(pivot);
      def.build(pivot);
      actors.push({ slot: def.slot, section: def.section, root: root, pivot: pivot, fitW: def.fitW, fitH: def.fitH, update: def.update, onProgress: def.onProgress });
    }

    if (opts.match) addActor({
      slot: opts.match.slot, section: opts.match.section, fitW: 4.5, fitH: 3.3,
      build: function (p) {
        var lap = buildLaptop('img/match-home.webp'); lap.position.set(-0.35, -0.95, 0); p.add(lap);
        var ph = buildPhone('img/match-mobile.webp'); p.add(ph);
        p.userData = { lap: lap, ph: ph };
      },
      update: function (p, e, m, t) {
        var u = p.userData, open = ease(e * 0.55 + range(m, 0, 0.18) * 0.45);
        u.lap.userData.lid.rotation.x = lerp(Math.PI / 2, -0.24, open);
        u.lap.rotation.set(lerp(0.75, 0.2, open), lerp(-1.0, -0.42, open) + m * 0.5, 0);
        var k = ease(range(m, 0.3, 0.62));
        u.ph.visible = k > 0.001;
        u.ph.position.set(lerp(3.4, 1.72, k), lerp(-1.4, -0.32, k) + Math.sin(t * 1.1) * 0.03, lerp(0.2, 1.25, k));
        u.ph.rotation.set(-0.06, lerp(-1.6, -0.5, k) + m * 0.35, lerp(0.5, 0.09, k));
      }
    });

    if (opts.game) addActor({
      slot: opts.game.slot, section: opts.game.section, fitW: 3.9, fitH: 2.5, onProgress: opts.game.onProgress,
      build: function (p) { var c = buildConsole(opts.game.screens); p.add(c); p.userData = { c: c }; },
      update: function (p, e, m, t) {
        var c = p.userData.c, n = c.userData.maps.length;
        var i = clamp(Math.floor(m * n * 0.999), 0, n - 1);
        if (i !== c.userData.index) { c.userData.index = i; c.userData.screen.map = c.userData.maps[i]; c.userData.screen.needsUpdate = true; }
        var k = ease(e);
        c.rotation.set(lerp(-0.9, -0.14, k) + Math.sin(t * 0.8) * 0.03, lerp(1.1, 0.42, k) - m * 0.84, lerp(0.3, -0.04, k) + Math.sin(t * 0.6) * 0.02);
        c.position.y = Math.sin(t * 0.9) * 0.05;
      }
    });

    if (opts.globe) addActor({
      slot: opts.globe.slot, section: opts.globe.section, fitW: 2.9, fitH: 2.9,
      build: function (p) { var gl = buildGlobe(); p.add(gl); p.userData = { g: gl }; },
      update: function (p, e, m, t) {
        var g = p.userData.g;
        g.rotation.set(0.28, -0.95 + m * 1.15 + t * 0.03, -0.1);
        g.userData.clouds.rotation.y = t * 0.02;
        var s = lerp(0.72, 1, ease(e)); g.scale.setScalar(s);
      }
    });

    if (opts.atl) addActor({
      slot: opts.atl.slot, section: opts.atl.section, fitW: 4.1, fitH: 3.1,
      build: function (p) { var lap = buildLaptop('img/atl-home.webp'); lap.position.y = -0.95; p.add(lap); p.userData = { lap: lap }; },
      update: function (p, e, m, t) {
        var lap = p.userData.lap, open = ease(range(e, 0.25, 1));
        lap.userData.lid.rotation.x = lerp(Math.PI / 2, -0.2, open);
        lap.rotation.set(0.2 + Math.sin(t * 0.7) * 0.015, lerp(0.95, 0.5, open) - m * 1.0, 0);
      }
    });

    /* ---------- loop ---------- */
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      renderer.setSize(W, H, false);
      camera.aspect = W / H; camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', function (ev) {
      if (ev.pointerType === 'touch') return;
      pointer.tx = ev.clientX / W - 0.5; pointer.ty = ev.clientY / H - 0.5;
    }, { passive: true });

    var clock = new T.Clock(), drew = false, running = true;
    function frame() {
      if (!running) return;
      requestAnimationFrame(frame);
      var t = clock.getElapsedTime(), any = false;
      pointer.x += (pointer.tx - pointer.x) * 0.06; pointer.y += (pointer.ty - pointer.y) * 0.06;
      var visH = 2 * Math.tan(camera.fov * Math.PI / 360) * camera.position.z, visW = visH * camera.aspect;
      for (var i = 0; i < actors.length; i++) {
        var a = actors[i], r = a.slot.getBoundingClientRect();
        var on = r.width > 0 && r.bottom > -H * 0.15 && r.top < H * 1.15;
        a.root.visible = on;
        if (!on) continue;
        any = true;
        var s = a.section.getBoundingClientRect();
        var e = clamp((H - s.top) / H, 0, 1);
        var m = clamp(-s.top / Math.max(1, s.height - H), 0, 1);
        a.root.position.set(((r.left + r.width / 2) / W - 0.5) * visW, -((r.top + r.height / 2) / H - 0.5) * visH, 0);
        a.root.scale.setScalar(Math.min(r.width / W * visW / a.fitW, r.height / H * visH / a.fitH));
        a.pivot.rotation.set(pointer.y * 0.12, pointer.x * 0.18, 0);
        a.update(a.pivot, e, m, t);
        if (a.onProgress) a.onProgress(m);
      }
      if (any || drew) { renderer.render(scene, camera); drew = any; }
    }
    frame();
    document.addEventListener('visibilitychange', function () {
      var was = running; running = !document.hidden;
      if (running && !was) { clock.getDelta(); frame(); }
    });

    return { resize: resize };
  }

  window.Scene3D = { create: create };
})();
