/* Animações de scroll, temas por seção e ligação com a cena 3D. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, body = doc.body;
  var $ = function (s, c) { return (c || doc).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || doc).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var loader = $('#loader');

  /* ---------- relógio e copiar ---------- */
  var clock = $('#clock');
  try {
    var fmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    var tick = function () { clock.textContent = fmt.format(new Date()); };
    tick(); setInterval(tick, 20000);
  } catch (e) { clock.textContent = ''; }

  $$('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function (ok) { btn.textContent = ok ? 'Copiado' : 'Selecionado'; setTimeout(function () { btn.textContent = 'Copiar'; }, 1800); };
      var select = function () { var r = doc.createRange(); r.selectNodeContents(btn.previousElementSibling); var s = getSelection(); s.removeAllRanges(); s.addRange(r); done(false); };
      try { navigator.clipboard.writeText(text).then(function () { done(true); }, select); } catch (e) { select(); }
    });
  });

  /* ---------- filmes: tocar ao clicar, um de cada vez ---------- */
  var films = $$('.film');
  films.forEach(function (f) {
    var v = $('video', f), btn = $('.film-play', f);
    btn.addEventListener('click', function () {
      films.forEach(function (o) { if (o !== f) $('video', o).pause(); });
      f.classList.add('playing'); v.controls = true;
      var p = v.play(); if (p && p.catch) p.catch(function () { f.classList.remove('playing'); });
    });
    v.addEventListener('error', function () { f.classList.remove('playing'); });
    v.addEventListener('play', function () { f.classList.add('playing'); films.forEach(function (o) { if (o !== f) $('video', o).pause(); }); });
  });

  /* ---------- temas por seção ---------- */
  var themed = $$('[data-theme]');
  function pickTheme() {
    var mid = window.innerHeight * 0.5, cur = themed[0];
    for (var i = 0; i < themed.length; i++) { if (themed[i].getBoundingClientRect().top <= mid) cur = themed[i]; }
    var t = cur.getAttribute('data-theme');
    if (body.getAttribute('data-theme') !== t) body.setAttribute('data-theme', t);
  }
  pickTheme();
  window.addEventListener('scroll', pickTheme, { passive: true });
  window.addEventListener('resize', pickTheme);

  /* ---------- barra de progresso ---------- */
  var bar = $('#bar');
  function progress() {
    var max = root.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
  }
  window.addEventListener('scroll', progress, { passive: true }); progress();

  /* ---------- menu some ao descer e volta ao subir ---------- */
  var topEl = $('.top'), lastY = window.scrollY;
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    if (Math.abs(y - lastY) < 6) return;
    topEl.classList.toggle('away', y > lastY && y > window.innerHeight * 0.6);
    lastY = y;
  }, { passive: true });

  /* ---------- ChosenZen: idade e fase conforme o scroll ---------- */
  var PHASES = [
    { age: 14, name: 'Fase 1 · Família', desc: 'Uma noite em casa. Contar ou esconder o que aconteceu na escola.' },
    { age: 14, name: 'Fase 2 · Escola', desc: 'A prova de recuperação. Colar de verdade ou provar a inocência.' },
    { age: 19, name: 'Fase 3 · Juventude', desc: 'Primeiro emprego no Café Ipê. O Dinheiro entra na conta.' },
    { age: 35, name: 'Fase 4 · Vida adulta', desc: 'Casa cheia. Seu filho chega calado, acusado como você foi.' },
    { age: 72, name: 'Fase 5 · Velhice', desc: 'Tarde de domingo na mesma casa, 58 anos depois.' }
  ];
  var lifeAge = $('#life-age'), lifeName = $('#life-name'), lifeDesc = $('#life-desc'), lifeTrack = $$('#life-track i'), lifeIdx = 0;
  function setPhase(m) {
    var i = Math.max(0, Math.min(PHASES.length - 1, Math.floor(m * PHASES.length * 0.999)));
    if (i === lifeIdx) return; lifeIdx = i;
    lifeAge.textContent = PHASES[i].age; lifeName.textContent = PHASES[i].name; lifeDesc.textContent = PHASES[i].desc;
    lifeTrack.forEach(function (el, k) { el.classList.toggle('on', k <= i); });
  }

  /* ---------- cena 3D ---------- */
  var scene3d = false, sceneMade = false;
  function canGL() {
    if (!window.THREE || !window.Scene3D || reduce) return false;
    try { var c = doc.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }
  // a cena é criada depois da entrada, para não travar a primeira animação
  function makeScene() {
    if (sceneMade || !scene3d) return; sceneMade = true;
    var made = null;
    try {
      made = window.Scene3D.create($('#gl'), {
        match: { slot: $('#slot-match'), section: $('#match') },
        game: { slot: $('#slot-game'), section: $('#chosenzen'), onProgress: setPhase,
          screens: ['img/cz-f1.webp', 'img/cz-f2.webp', 'img/cz-f3.webp', 'img/cz-f4.webp', 'img/cz-f5.webp'] },
        globe: { slot: $('#slot-globe'), section: $('#geomosaico') },
        atl: { slot: $('#slot-atl'), section: $('#atlanticoseg') }
      });
    } catch (e) { made = null; }
    if (!made) { root.classList.remove('gl'); $('#gl').style.display = 'none'; }
  }
  scene3d = canGL();
  if (scene3d) root.classList.add('gl'); else $('#gl').style.display = 'none';

  /* ---------- sem GSAP ou com movimento reduzido: página estática ---------- */
  function finishLoader() { if (loader) loader.classList.add('done'), loader.style.display = 'none'; }
  if (!hasGsap || reduce) {
    finishLoader(); makeScene();
    $$('#manifesto-text .mw').forEach(function (w) { w.style.opacity = 1; });
    return;
  }

  var gsap = window.gsap, ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);

  /* ---------- scroll suave (só desktop) ---------- */
  var lenis = null;
  if (window.Lenis && fine) {
    try {
      lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } catch (e) { lenis = null; }
  }
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      var target = $(a.getAttribute('href')); if (!target) return;
      ev.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
      else target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ---------- divisão de texto em palavras ---------- */
  function splitWords(el) {
    var out = [];
    [].slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        var frag = doc.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(' ')); return; }
          var w = doc.createElement('span'); w.className = 'w';
          var i = doc.createElement('span'); i.textContent = part; w.appendChild(i); frag.appendChild(w); out.push(i);
        });
        el.replaceChild(frag, node);
      } else if (node.nodeType === 1) {
        var w = doc.createElement('span'); w.className = 'w';
        el.replaceChild(w, node); w.appendChild(node); node.style.display = 'inline-block'; out.push(node);
      }
    });
    return out;
  }

  $$('[data-split]').forEach(function (el) {
    var words = splitWords(el);
    gsap.from(words, { yPercent: 115, duration: 1, ease: 'power4.out', stagger: 0.07,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });

  /* ---------- hero ---------- */
  var letters = $('#hero-letters');
  letters.innerHTML = letters.textContent.split('').map(function (c) { return '<span class="ch">' + c + '</span>'; }).join('');
  var intro = gsap.timeline({ paused: true, defaults: { ease: 'power4.out' } });
  intro.from('#hero-bg img', { scale: 1.25, duration: 2.4, ease: 'power2.out' }, 0)
    .from('#hero-letters .ch', { yPercent: 120, opacity: 0, duration: 1.2, stagger: 0.05 }, 0.1)
    .from('#hero-me', { yPercent: 14, opacity: 0, duration: 1.3 }, 0.35)
    .from('#hero-sur', { opacity: 0, x: 40, duration: 1 }, 0.8)
    .from('.hero-meta .wrap > *, .hero-foot .wrap > *', { opacity: 0, y: 24, duration: 1, stagger: 0.08 }, 0.9);

  var mm = gsap.matchMedia();
  mm.add('(min-width: 761px)', function () {
    gsap.to('#hero-name', { '--wd': 62, yPercent: 30, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  });
  mm.add('(max-width: 760px)', function () {
    gsap.to('#hero-name', { yPercent: 40, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  });
  gsap.to('#hero-bg', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('#hero-me', { yPercent: 8, scale: 1.06, transformOrigin: '50% 100%', ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('#hero-sur', { xPercent: -30, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* ---------- loader ---------- */
  var counter = { v: 0 }, num = $('#loader-n');
  var ready = new Promise(function (res) {
    var img = $('#hero-bg img'), n = 0, need = 2;
    var ok = function () { if (++n >= need) res(); };
    if (img.complete) ok(); else { img.addEventListener('load', ok); img.addEventListener('error', ok); }
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(ok, ok); else ok();
    setTimeout(res, 2200);
  });
  var opened = false;
  function open() {
    if (opened) return; opened = true;
    gsap.to(loader, { yPercent: -100, duration: 0.9, ease: 'power4.inOut', onComplete: finishLoader });
    intro.play(0);
    ST.refresh();
    setTimeout(makeScene, 700);
  }
  gsap.to(counter, { v: 100, duration: 1.2, ease: 'power2.inOut', onUpdate: function () { num.textContent = Math.round(counter.v); },
    onComplete: function () { ready.then(open); } });
  // trava de segurança: a tela de entrada nunca fica presa
  setTimeout(function () { open(); setTimeout(function () { finishLoader(); intro.progress(1); }, 2500); }, 3400);

  /* ---------- manifesto: palavras acendem com o scroll ---------- */
  var mt = $('#manifesto-text');
  (function () {
    var wrapText = function (node) {
      if (node.nodeType === 3) {
        var frag = doc.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(doc.createTextNode(' ')); return; }
          var s = doc.createElement('span'); s.className = 'mw'; s.textContent = p; frag.appendChild(s);
        });
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === 1) { [].slice.call(node.childNodes).forEach(wrapText); }
    };
    [].slice.call(mt.childNodes).forEach(wrapText);
    var words = $$('.mw', mt);
    ST.create({ trigger: mt, start: 'top 80%', end: 'bottom 45%', scrub: true,
      onUpdate: function (self) {
        var p = self.progress * words.length;
        for (var i = 0; i < words.length; i++) words[i].style.opacity = i < p ? 1 : 0.16;
      } });
  })();

  /* ---------- números ---------- */
  $$('[data-count]').forEach(function (el) {
    var to = +el.getAttribute('data-count'), o = { v: to > 1000 ? to - 40 : 0 };
    el.textContent = Math.round(o.v);
    gsap.to(o, { v: to, duration: 1.6, ease: 'power3.out', onUpdate: function () { el.textContent = Math.round(o.v); },
      scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  /* ---------- capítulos ---------- */
  $$('.chapter').forEach(function (ch) {
    var word = $('.chapter-word', ch);
    gsap.fromTo(word, { xPercent: 18 }, { xPercent: -18, ease: 'none', scrollTrigger: { trigger: ch, start: 'top bottom', end: 'bottom top', scrub: true } });
    $$('.c-block, .c-head .lead, .c-head .n', ch).forEach(function (b) {
      gsap.from(b, { y: 50, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: b, start: 'top 86%', once: true } });
    });
    if (!scene3d) {
      gsap.from($('.slot img', ch), { scale: 0.86, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: ch, start: 'top 60%', once: true } });
    }
  });

  /* ---------- galeria horizontal (desktop) ---------- */
  mm.add('(min-width: 900px)', function () {
    var track = $('#hgal-track'), sec = $('#telas');
    var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
    gsap.to(track, { x: function () { return -dist(); }, ease: 'none',
      scrollTrigger: { trigger: sec, start: 'center center', end: function () { return '+=' + dist(); }, pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 } });
  });

  /* ---------- fundos com parallax ---------- */
  [['#process-img', '.process'], ['#contact-img', '.contact']].forEach(function (p) {
    gsap.fromTo(p[0], { yPercent: -12 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: p[1], start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* ---------- listas, trajetória e blocos ---------- */
  gsap.from('.rows a', { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07, scrollTrigger: { trigger: '.rows', start: 'top 85%', once: true } });
  gsap.to('#tl-fill', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '#tl', start: 'top 70%', end: 'bottom 70%', scrub: true } });
  $$('.tl li').forEach(function (li) {
    gsap.from(li.children, { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1, scrollTrigger: { trigger: li, start: 'top 88%', once: true } });
  });
  $$('.film, .about-text > *, .faith > *, .skill-grid > *, .contact-grid > *, .process blockquote, .facts li').forEach(function (el) {
    gsap.from(el, { y: 36, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  gsap.fromTo('.about-photo img', { yPercent: 8, scale: 1.04 }, { yPercent: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: '.about-photo', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ---------- cursor ---------- */
  if (fine) {
    var cur = $('#cursor'), cx = 0, cy = 0, tx = 0, ty = 0;
    window.addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; cur.classList.add('on'); }, { passive: true });
    doc.addEventListener('pointerleave', function () { cur.classList.remove('on'); });
    gsap.ticker.add(function () { cx += (tx - cx) * 0.22; cy += (ty - cy) * 0.22; cur.style.transform = 'translate(' + cx + 'px,' + cy + 'px)'; });
    $$('a, button').forEach(function (el) {
      el.addEventListener('pointerenter', function () { cur.classList.add('big'); });
      el.addEventListener('pointerleave', function () { cur.classList.remove('big'); });
    });
  }

  window.addEventListener('load', function () { ST.refresh(); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { ST.refresh(); });
})();
