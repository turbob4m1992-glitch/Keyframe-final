(function () {
  "use strict";
  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.__KF_LITE === true;
  var isTouch = window.matchMedia("(hover: none)").matches || window.innerWidth < 900;

  /* ---------- PRELOADER (cinematic timecode intro, once per session) ---------- */
  var loader = document.getElementById("loader");
  var introDone = false;
  function finishIntro() {
    if (introDone) return;
    introDone = true;
    window.dispatchEvent(new CustomEvent("kf:intro"));
  }
  window.__kfIntroDone = function () { return introDone; };
  (function () {
    if (!loader) { finishIntro(); return; }
    var seen = false;
    try { seen = !!sessionStorage.getItem("kf-intro"); } catch (e) {}
    if (reduced || seen) {
      loader.parentNode.removeChild(loader);
      finishIntro();
      return;
    }
    try { sessionStorage.setItem("kf-intro", "1"); } catch (e) {}
    setTimeout(finishIntro, 4000); /* never leave content gated if rAF stalls in a background tab */
    var tcEl = loader.querySelector(".loader-tc");
    var barEl = loader.querySelector(".loader-bar i");
    var t0 = null, DUR = 1150;
    function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min((now - t0) / DUR, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var f = Math.min(23, Math.floor(eased * 24));
      tcEl.textContent = p >= 1 ? "00:00:01:00" : "00:00:00:" + pad(f);
      barEl.style.transform = "scaleX(" + eased + ")";
      if (p < 1) { requestAnimationFrame(step); return; }
      loader.classList.add("done");
      setTimeout(finishIntro, 420);
      setTimeout(function () { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 1500);
    }
    requestAnimationFrame(step);
  })();

  /* ---------- MOBILE MENU ---------- */
  var menuBtn = document.getElementById("menuBtn");
  var mobileMenu = document.getElementById("mobileMenu");
  function closeMenu() {
    root.classList.remove("menu-open");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
    if (mobileMenu) mobileMenu.setAttribute("aria-hidden", "true");
    if (window.__lenis) window.__lenis.start();
  }
  window.__kfCloseMenu = closeMenu;
  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener("click", function () {
      if (root.classList.contains("menu-open")) { closeMenu(); return; }
      root.classList.add("menu-open");
      menuBtn.setAttribute("aria-expanded", "true");
      mobileMenu.setAttribute("aria-hidden", "false");
      if (window.__lenis) window.__lenis.stop();
    });
    mobileMenu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ---------- THEME (localStorage + prefers-color-scheme + view transition wipe) ---------- */
  var themeBtn = document.getElementById("themeBtn");

  function readAccent() {
    return getComputedStyle(root).getPropertyValue("--accent").trim() || "#EBB54E";
  }
  var fieldColor = readAccent();

  function applyTheme(next) {
    root.setAttribute("data-theme", next);
    root.style.colorScheme = next;
    root.style.background = next === "light" ? "#F4F1EA" : "#08080A";
    var meta = document.getElementById("metaThemeColor");
    if (meta) meta.setAttribute("content", next === "light" ? "#F4F1EA" : "#08080A");
    try { localStorage.setItem("theme", next); } catch (e) {}
    fieldColor = readAccent();
    if (window.__kfFieldRetheme) window.__kfFieldRetheme();
  }

  themeBtn.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";

    var particlesContainer = document.getElementById("themeParticles");
    if (particlesContainer && !reduced) {
      particlesContainer.innerHTML = "";
      for (var i = 0; i < 3; i++) {
        var p = document.createElement("div");
        p.className = "particle";
        p.innerHTML = '<div class="particle-grain"></div>';
        p.style.animation = (next === "dark" ? "popParticleDark" : "popParticleLight") + " " + (0.6 + i*0.1) + "s ease-out " + (i*0.1) + "s forwards";
        particlesContainer.appendChild(p);
      }
      setTimeout(function() { particlesContainer.innerHTML = ""; }, 1000);
    }

    if (document.startViewTransition && !reduced) {
      var r = themeBtn.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var endR = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));
      root.classList.add("vt-active");
      var vt = document.startViewTransition(function () { applyTheme(next); });
      vt.ready.then(function () {
        root.animate(
          { clipPath: ["circle(0px at " + cx + "px " + cy + "px)", "circle(" + endR + "px at " + cx + "px " + cy + "px)"] },
          { duration: 620, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" }
        );
      }).catch(function () {});
      vt.finished.then(function () { root.classList.remove("vt-active"); })
        .catch(function () { root.classList.remove("vt-active"); });
    } else {
      applyTheme(next);
    }
  });


  /* ---------- MULTI CITY CLOCKS ---------- */
  var clockEls = Array.prototype.slice.call(document.querySelectorAll(".clock .time"));
  function tickClocks() {
    clockEls.forEach(function (el) {
      try {
        el.textContent = new Intl.DateTimeFormat("en-GB", {
          timeZone: el.getAttribute("data-tz"),
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
        }).format(new Date());
      } catch (e) { /* unsupported tz, leave default */ }
    });
  }
  tickClocks();
  setInterval(tickClocks, 1000);

  /* ---------- NAV TIMECODE + SCROLLED STATE + PLAYHEAD ---------- */
  var nav = document.getElementById("nav");
  var navtc = document.getElementById("navtc");
  var start = Date.now();
  function updateTimecode() {
    var f = Math.floor(((Date.now() - start) / 1000) * 24) % 24;
    var s = Math.floor((Date.now() - start) / 1000) % 60;
    var m = Math.floor((Date.now() - start) / 60000) % 60;
    navtc.textContent = "00:" + pad(m) + ":" + pad(s) + ":" + pad(f);
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  var playhead = document.getElementById("playhead");
  window.addEventListener("scroll", function () {
    if (window.scrollY > 40) nav.classList.add("scrolled");
    else nav.classList.remove("scrolled");
    if (playhead) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      playhead.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ")";
    }
  }, { passive: true });

  /* ---------- TESTIMONIALS (build columns) ---------- */
  var voices = [
    { n: "Abdulraheem Ghazal", r: "CEO, Safarin Steel", f: "\uD83C\uDDF6\uD83C\uDDE6", c: "QA", q: "Our films and LinkedIn campaign finally look like the company we are. The leads followed.", col: "#EBB54E" },
    { n: "Classified Artist [NDA]", r: "Recording Artist", f: "🇺🇸", c: "US", q: "Yousef rebuilt my entire identity. The brand finally looks like the music sounds.", col: "#E8556B" },
    { n: "[REDACTED] Architect", r: "Architect", f: "🇶🇦", c: "QA", q: "He turned rough sketches into 8K renders my clients could not stop looking at.", col: "#7CC4C0" },
    { n: "Lina Haddad", r: "Founder, Far7etna", f: "\uD83C\uDDEF\uD83C\uDDF4", c: "JO", q: "The platform feels like a film. Couples tell us the invitation alone made them cry.", col: "#C9A24B" },
    { n: "Omar Al Fahad", r: "Marketing Lead", f: "\uD83C\uDDE6\uD83C\uDDEA", c: "AE", q: "Briefed on Sunday, stunned by Thursday. The pace and the polish were both rare.", col: "#5B9BD5" },
    { n: "Reem Al Saud", r: "Brand Director", f: "\uD83C\uDDF8\uD83C\uDDE6", c: "SA", q: "Senior craft on every single deliverable. No hand-offs to juniors, no drop in quality.", col: "#C08457" },
    { n: "Daniel Brooks", r: "Startup Founder", f: "\uD83C\uDDFA\uD83C\uDDF8", c: "US", q: "The site loads instantly and still feels alive. Our demo bookings doubled in a month.", col: "#9B7EDE" },
    { n: "Maya Tannous", r: "Creative Producer", f: "\uD83C\uDDEF\uD83C\uDDF4", c: "JO", q: "Clear timeline, zero scope drama, and a final cut that outclassed the brief.", col: "#4FB3A4" }
  ];

  function initials(name) {
    var p = name.split(" ");
    return (p[0][0] + (p[1] ? p[1][0] : "")).toUpperCase();
  }
  function cardHTML(v) {
    return '<div class="vcard">' +
      '<div class="top">' +
        '<div class="av" style="background:' + v.col + '">' + initials(v.n) + '</div>' +
        '<div><div class="nm">' + v.n + ' <span>' + v.f + '</span></div>' +
        '<div class="rl">' + v.r + '</div></div>' +
      '</div>' +
      '<p class="q">' + v.q + '</p>' +
    '</div>';
  }
  function buildColumn(items, down) {
    var inner = items.map(cardHTML).join("");
    var run = '<div class="vrun">' + inner + inner + '</div>';
    return '<div class="vcol' + (down ? " down" : "") + '">' + run + '</div>';
  }
  var vi = document.getElementById("voicesInner");
  if (vi) {
    var colA = [voices[0], voices[1], voices[2]];
    var colB = [voices[3], voices[4], voices[5]];
    var colC = [voices[6], voices[7], voices[0]];
    vi.innerHTML = buildColumn(colA, false) + buildColumn(colB, true) + buildColumn(colC, false);
    if (window.innerWidth < 760) {
      vi.lastChild && vi.removeChild(vi.lastChild);
    }
  }

  /* ---------- GLOW CARDS (pointer spotlight) ---------- */
  var glowCards = document.querySelectorAll(".glow-card");
  window.addEventListener("pointermove", function (e) {
    for (var i = 0; i < glowCards.length; i++) {
      var c = glowCards[i];
      var r = c.getBoundingClientRect();
      if (e.clientX > r.left - 60 && e.clientX < r.right + 60 && e.clientY > r.top - 60 && e.clientY < r.bottom + 60) {
        c.style.setProperty("--mx", (e.clientX - r.left) + "px");
        c.style.setProperty("--my", (e.clientY - r.top) + "px");
      }
    }
  }, { passive: true });

  /* ---------- ATMOSPHERE FIELD: WebGL aurora shader, constellation fallback ---------- */
  var canvas = document.getElementById("field");
  function hexToRgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [parseInt(h.substr(0,2),16), parseInt(h.substr(2,2),16), parseInt(h.substr(4,2),16)];
  }

  function initAurora(gl) {
    var VS = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }";
    var FS = [
      "precision mediump float;",
      "uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse; uniform float u_scroll;",
      "uniform vec3 u_base; uniform vec3 u_gold; uniform vec3 u_teal; uniform float u_dark;",
      "vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }",
      "vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }",
      "vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }",
      "float snoise(vec2 v){",
      "  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);",
      "  vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);",
      "  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);",
      "  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i);",
      "  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));",
      "  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);",
      "  m = m*m; m = m*m;",
      "  vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5;",
      "  vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;",
      "  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);",
      "  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;",
      "  return 130.0 * dot(m, g);",
      "}",
      "float fbm(vec2 p){ float v = 0.0; float a = 0.55; for (int i = 0; i < 3; i++){ v += a * snoise(p); p = p * 2.05 + 17.3; a *= 0.5; } return v; }",
      "void main(){",
      "  vec2 uv = gl_FragCoord.xy / u_res;",
      "  vec2 st = uv; st.x *= u_res.x / u_res.y;",
      "  vec2 m = u_mouse / u_res; m.x *= u_res.x / u_res.y;",
      "  float md = distance(st, m);",
      "  vec2 p = st + (st - m) * smoothstep(0.55, 0.0, md) * 0.06;",
      "  float t = u_time * 0.045;",
      "  float drift = u_scroll * 0.00028;",
      "  float n1 = fbm(p * 1.3 + vec2(t * 0.7, -t * 0.35 + drift));",
      "  float n2 = fbm(p * 2.1 - vec2(t * 0.4, t * 0.55) + n1 * 0.55 + drift);",
      "  float ribbonG = smoothstep(0.12, 0.85, n1) * smoothstep(0.85, 0.15, abs(st.y - 0.38 + n2 * 0.34));",
      "  float ribbonT = smoothstep(0.18, 0.9, n2) * smoothstep(0.85, 0.2, abs(st.y - 0.72 + n1 * 0.28));",
      "  vec3 col = u_base;",
      "  col = mix(col, u_gold, ribbonG * mix(0.10, 0.20, u_dark));",
      "  col = mix(col, u_teal, ribbonT * mix(0.07, 0.14, u_dark));",
      "  col = mix(col, u_gold, smoothstep(0.4, 0.0, md) * mix(0.03, 0.06, u_dark));",
      "  float vig = smoothstep(1.35, 0.4, distance(uv, vec2(0.5, 0.42)));",
      "  col *= mix(mix(0.965, 0.8, u_dark), 1.0, vig);",
      "  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.014;",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n");

    function sh(src, type) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var vs = sh(VS, gl.VERTEX_SHADER), fs = sh(FS, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return false;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ["u_res","u_time","u_mouse","u_scroll","u_base","u_gold","u_teal","u_dark"].forEach(function (n) {
      U[n] = gl.getUniformLocation(prog, n);
    });

    /* half resolution: soft gradients hide it entirely, GPU cost drops 4x */
    var SCALE = 0.5;
    function size() {
      canvas.width = Math.max(2, Math.floor(window.innerWidth * SCALE));
      canvas.height = Math.max(2, Math.floor(window.innerHeight * SCALE));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.u_res, canvas.width, canvas.height);
    }
    function norm(v, fb) {
      var c = hexToRgb(v && v.indexOf("#") === 0 ? v : fb);
      return [c[0]/255, c[1]/255, c[2]/255];
    }
    var mx = window.innerWidth / 2, my = window.innerHeight * 0.4, cx = mx, cy = my;
    var t0 = performance.now();
    function frame(now) {
      cx += (mx - cx) * 0.05; cy += (my - cy) * 0.05;
      gl.uniform1f(U.u_time, (now - t0) / 1000);
      gl.uniform2f(U.u_mouse, cx * SCALE, canvas.height - cy * SCALE);
      gl.uniform1f(U.u_scroll, window.scrollY || 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function retheme() {
      var cs = getComputedStyle(root);
      var base = norm(cs.getPropertyValue("--bg").trim(), "#08080A");
      var gold = norm(cs.getPropertyValue("--accent").trim(), "#EBB54E");
      var teal = norm(cs.getPropertyValue("--accent-2").trim(), "#7CC4C0");
      gl.uniform3f(U.u_base, base[0], base[1], base[2]);
      gl.uniform3f(U.u_gold, gold[0], gold[1], gold[2]);
      gl.uniform3f(U.u_teal, teal[0], teal[1], teal[2]);
      gl.uniform1f(U.u_dark, root.getAttribute("data-theme") === "light" ? 0.0 : 1.0);
      if (reduced) frame(t0);
    }
    size();
    window.addEventListener("resize", size);
    retheme();
    window.__kfFieldRetheme = retheme;
    if (reduced) { frame(t0); return true; }
    window.addEventListener("pointermove", function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
    (function loop(now) { frame(now); requestAnimationFrame(loop); })(t0);
    return true;
  }

  function init2DField() {
    var ctx = canvas.getContext("2d");
    if (!ctx) { canvas.style.display = "none"; return; }
    var pts = [], W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
    var mouse = { x: -9999, y: -9999 };
    var isCanvasVisible = true;

    var heroSection = document.getElementById("hero");
    if (heroSection && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        isCanvasVisible = entries[0].isIntersecting;
        canvas.style.opacity = isCanvasVisible ? "" : "0";
      }).observe(heroSection);
    }

    function sizeField() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var target = Math.min(110, Math.floor((W * H) / 17000));
      pts = [];
      for (var i = 0; i < target; i++) {
        pts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35 });
      }
    }
    function drawField() {
      requestAnimationFrame(drawField);
      if (!isCanvasVisible) return;
      ctx.clearRect(0, 0, W, H);
      var rgb = hexToRgb(fieldColor.indexOf("#") === 0 ? fieldColor : "#EBB54E");
      var base = "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",";
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        var dxm = p.x - mouse.x, dym = p.y - mouse.y, dm = Math.sqrt(dxm*dxm + dym*dym);
        if (dm < 130) { p.x += dxm / dm * 0.8; p.y += dym / dm * 0.8; }
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = base + "0.55)"; ctx.fill();
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d = Math.sqrt(dx*dx + dy*dy);
          if (d < 128) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = base + (0.16 * (1 - d / 128)) + ")"; ctx.lineWidth = 1; ctx.stroke();
          }
        }
      }
    }
    sizeField();
    window.addEventListener("resize", sizeField);
    window.addEventListener("pointermove", function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    requestAnimationFrame(drawField);
  }

  var glCtx = null;
  try {
    glCtx = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  } catch (e) { glCtx = null; }
  var auroraOK = false;
  if (glCtx) { try { auroraOK = initAurora(glCtx); } catch (e) { auroraOK = false; } }
  if (!auroraOK) {
    /* a canvas locked to a failed WebGL context cannot fall back to 2D */
    if (!glCtx && !reduced) init2DField();
    else canvas.style.display = "none";
  }

  /* ---------- CUSTOM CURSOR (with context labels) ---------- */
  var cursorTick = null;
  if (!isTouch) {
    var dot = document.querySelector(".cursor-dot");
    var ring = document.querySelector(".cursor-ring");
    var ringLabel = ring.querySelector(".cursor-label");
    var mx = 24, my = 24; /* rest hidden at top-left until the pointer moves */
    var dx = mx, dy = my, rx = mx, ry = my;
    dot.style.opacity = "0"; ring.style.opacity = "0";

    window.addEventListener("pointermove", function (e) {
      mx = e.clientX; my = e.clientY;
      if (dot.style.opacity !== "1") { dot.style.opacity = "1"; ring.style.opacity = "1"; }
    }, { passive: true });
    document.addEventListener("mouseleave", function () { dot.style.opacity = "0"; ring.style.opacity = "0"; });
    document.addEventListener("mouseenter", function () { dot.style.opacity = "1"; ring.style.opacity = "1"; });

    cursorTick = function () {
      dx += (mx - dx) * 0.2; dy += (my - dy) * 0.2;
      rx += (mx - rx) * 0.1; ry += (my - ry) * 0.1;
      dot.style.transform = "translate3d(calc(" + dx + "px - 50%), calc(" + dy + "px - 50%), 0)";
      ring.style.transform = "translate3d(calc(" + rx + "px - 50%), calc(" + ry + "px - 50%), 0)";
    };

    document.querySelectorAll("a, button, .glow-card, .work-card").forEach(function (el) {
      el.addEventListener("pointerenter", function () { ring.classList.add("is-hover"); });
      el.addEventListener("pointerleave", function () { ring.classList.remove("is-hover"); });
    });
    document.querySelectorAll("[data-cursor]").forEach(function (el) {
      el.addEventListener("pointerenter", function () {
        ringLabel.textContent = el.getAttribute("data-cursor");
        ring.classList.add("has-label");
      });
      el.addEventListener("pointerleave", function () { ring.classList.remove("has-label"); });
    });
  }

  /* ---------- MAGNETIC BUTTONS (single shared ticker) ---------- */
  var magItems = [];
  if (!isTouch && !reduced) {
    document.querySelectorAll(".magnetic").forEach(function (el) {
      var m = { el: el, tx: 0, ty: 0, cx: 0, cy: 0, hover: false };
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        m.tx = (e.clientX - r.left - r.width / 2) * 0.35;
        m.ty = (e.clientY - r.top - r.height / 2) * 0.5;
        m.hover = true;
      });
      el.addEventListener("pointerleave", function () { m.tx = 0; m.ty = 0; m.hover = false; });
      magItems.push(m);
    });
  }

  /* ---------- MASTER TICKER (timecode + cursor + magnetics, one rAF) ---------- */
  function masterTick() {
    updateTimecode();
    if (cursorTick) cursorTick();
    for (var i = 0; i < magItems.length; i++) {
      var m = magItems[i];
      if (m.hover) { m.cx += (m.tx - m.cx) * 0.15; m.cy += (m.ty - m.cy) * 0.15; }
      else { m.cx += (0 - m.cx) * 0.08; m.cy += (0 - m.cy) * 0.08; }
      if (m.hover || Math.abs(m.cx) > 0.05 || Math.abs(m.cy) > 0.05) {
        m.el.style.transform = "translate3d(" + m.cx + "px, " + m.cy + "px, 0)";
      }
    }
    requestAnimationFrame(masterTick);
  }
  requestAnimationFrame(masterTick);

  /* ---------- BACK TO TOP ---------- */
  document.getElementById("toTop").addEventListener("click", function () {
    if (window.__lenis) window.__lenis.scrollTo(0, { duration: 1.6 });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ---------- NATIVE SCROLL OBSERVERS (gated behind the intro) ---------- */
  function initScrollObservers() {
  if (!reduced && "IntersectionObserver" in window) {
    var easing = "cubic-bezier(0.16, 1, 0.3, 1)";
    var revealObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(e, i) {
        if (e.isIntersecting) {
          var el = e.target;
          el.style.transitionDelay = Math.min(i * 70, 280) + "ms";
          el.style.opacity = 1;
          el.style.transform = "translateY(0)";
          el.style.filter = "blur(0px)";
          el.addEventListener("transitionend", function onEnd() {
            el.removeEventListener("transitionend", onEnd);
            el.style.transitionDelay = "";
            el.style.filter = "";
            el.style.willChange = "";
          });
          revealObserver.unobserve(el);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll(".reveal").forEach(function(el) {
      el.style.opacity = 0;
      el.style.transform = "translateY(42px)";
      el.style.filter = "blur(10px)";
      el.style.willChange = "opacity, transform, filter";
      el.style.transition = "opacity 1s " + easing + ", transform 1s " + easing + ", filter 1s " + easing;
      revealObserver.observe(el);
    });

    var countObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          var el = e.target;
          var end = parseFloat(el.getAttribute("data-count"));
          var suf = el.getAttribute("data-suffix") || "";
          var start = 0, dur = 1600, startT = performance.now();
          function update(t) {
            var p = Math.min((t - startT) / dur, 1);
            var v = start + (end - start) * (1 - Math.pow(1 - p, 3));
            el.textContent = Math.round(v) + suf;
            if (p < 1) requestAnimationFrame(update);
          }
          requestAnimationFrame(update);
          countObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll("[data-count]").forEach(function(el) { countObserver.observe(el); });

    var stepObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) { e.target.classList.add("on"); } 
        else { e.target.classList.remove("on"); }
      });
    }, { threshold: 0.5, rootMargin: "-10% 0px -40% 0px" });
    document.querySelectorAll(".step").forEach(function(el) { stepObserver.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function(el) { el.style.opacity = 1; el.style.transform = "none"; });
  }
  }
  if (introDone) initScrollObservers();
  else window.addEventListener("kf:intro", initScrollObservers, { once: true });

  /* ---------- HERO PERSPECTIVE & INTERACTIVE NAV ---------- */
  var heroPerspective = document.getElementById("heroPerspective");
  var heroCard = document.getElementById("heroCard");
  var viewNav = document.getElementById("viewNav");
  var viewLight = document.getElementById("viewLight");
  var viewBtns = document.querySelectorAll(".view-btn");
  var btnList = document.getElementById("btnList");
  var btnGrid = document.getElementById("btnGrid");
  var workSection = document.getElementById("work");
  
  if (btnList && btnGrid && workSection) {
    window.__kfSetView = function (grid) { workSection.classList.toggle("is-grid-view", grid); };
    btnGrid.addEventListener("click", function () {
      if (window.__kfViewClick) window.__kfViewClick(true); else window.__kfSetView(true);
    });
    btnList.addEventListener("click", function () {
      if (window.__kfViewClick) window.__kfViewClick(false); else window.__kfSetView(false);
    });
    
    viewBtns.forEach(function(btn) {
      btn.addEventListener("mouseenter", function() { btn.classList.add("hover"); });
      btn.addEventListener("mouseleave", function() { btn.classList.remove("hover"); btn.classList.remove("press"); });
      btn.addEventListener("mousedown", function() { btn.classList.add("press"); });
      btn.addEventListener("mouseup", function() { btn.classList.remove("press"); });
    });
  }

  var easeOutQuint = function(t) { return 1 - Math.pow(1 - t, 5); };
  var easeInQuad = function(t) { return t * t; };
  var calculateAngle = function(element, cursorX, cursorY) {
    var r = element.getBoundingClientRect();
    var cx = r.left + r.width / 2;
    var cy = r.top + r.height / 2;
    var ang = Math.atan2(cursorY - cy, cursorX - cx) * (180 / Math.PI);
    return (ang + 180) % 360;
  };

  if (!reduced) {
    var maxRotateX = 14, maxRotateY = 30, smoothing = 0.12;
    var targetX = 0, targetY = 0, rotX = 0, rotY = 0, raf = 0;
    
    var onMove = function(e) {
      // Hero Perspective
      if (heroCard && heroPerspective) {
        var r = heroCard.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        var dist = Math.hypot(dx, dy);
        var falloff = dist <= 1 ? 1 : Math.max(0, 1 - (dist - 1) / 2);
        
        targetX = Math.max(-1, Math.min(1, dy)) * maxRotateX * falloff;
        targetY = -Math.max(-1, Math.min(1, dx)) * maxRotateY * falloff;
      }

      // Interactive Nav logic
      if (viewNav && viewLight) {
        var nr = viewNav.getBoundingClientRect();
        var cx = nr.left + nr.width / 2;
        var cy = nr.top + nr.height / 2;
        var lx = e.clientX;
        var ly = e.clientY;
        viewLight.style.transform = "translate(" + (lx - nr.left) + "px," + (ly - nr.top) + "px)";
        
        var dX = lx - cx;
        var dY = ly - cy;
        var dDist = Math.hypot(dX, dY);
        var ang = Math.atan2(dY, dX);
        var mOff = 3;
        var dRad = nr.width * 2;
        var shDist = Math.min(mOff, (dDist / dRad) * mOff);
        var oX = Math.cos(ang) * shDist;
        var oY = Math.sin(ang) * shDist;
        var sx = -oX, sy = -oY;
        
        viewNav.style.boxShadow = 
          (sx * 2.6) + "px " + (sy * 2.6) + "px 1.5px rgba(0, 0, 0, 0.081), " +
          (sx * 5.8) + "px " + (sy * 5.8) + "px 3.4px rgba(0, 0, 0, 0.12), " +
          (sx * 9.8) + "px " + (sy * 9.8) + "px 5.6px rgba(0, 0, 0, 0.15), " +
          (sx * 14.8) + "px " + (sy * 14.8) + "px 8.5px rgba(0, 0, 0, 0.174), " +
          (sx * 21.3) + "px " + (sy * 21.3) + "px 12.3px rgba(0, 0, 0, 0.195), " +
          (sx * 30.1) + "px " + (sy * 30.1) + "px 17.4px rgba(0, 0, 0, 0.216), " +
          (sx * 42.7) + "px " + (sy * 42.7) + "px 24.6px rgba(0, 0, 0, 0.24), " +
          (sx * 62.1) + "px " + (sy * 62.1) + "px 35.8px rgba(0, 0, 0, 0.27), " +
          (sx * 95.6) + "px " + (sy * 95.6) + "px 55.1px rgba(0, 0, 0, 0.309), " +
          (sx * 170) + "px " + (sy * 170) + "px 98px rgba(0, 0, 0, 0.39)";
          
        var lRad = 400;
        var inRad = lRad / 3, outRad = lRad * 1.3;
        var iT = 0;
        if (dDist > inRad && dDist <= outRad) iT = (dDist - inRad) / (outRad - inRad);
        else if (dDist > outRad) iT = 1;
        var op = easeInQuad(iT);
        var g1 = document.getElementById("viewGlare1");
        var g2 = document.getElementById("viewGlare2");
        var g3 = document.getElementById("viewGlare3");
        if (g1) g1.style.opacity = op;
        if (g2) g2.style.opacity = op;
        if (g3) g3.style.opacity = op;
        
        var iT2 = dDist <= lRad * 1.4 ? dDist / (lRad * 1.4) : 1;
        viewBtns.forEach(function(b) {
          var bg = b.querySelector('.button-bg');
          if (bg) {
            var bAng = calculateAngle(b, lx, ly);
            var scY = 10 - easeOutQuint(iT2) * 10;
            bg.style.transform = "rotateZ(" + bAng + "deg) scaleY(" + scY + ")";
          }
        });
      }
    };
    
    var onLeave = function() { targetX = 0; targetY = 0; };
    
    var tick = function() {
      if (heroPerspective && heroCard) {
        rotX += (targetX - rotX) * smoothing;
        rotY += (targetY - rotY) * smoothing;
        var lift = Math.min(1, Math.hypot(rotX / maxRotateX, rotY / maxRotateY));
        
        heroPerspective.style.setProperty("--rx", rotX.toFixed(2) + "deg");
        heroPerspective.style.setProperty("--ry", rotY.toFixed(2) + "deg");
        heroPerspective.style.setProperty("--lift", lift.toFixed(3));
      }
      raf = requestAnimationFrame(tick);
    };
    
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    tick();
  }

  /* ---------- TEXT DECRYPT (timecode-style scramble on mono labels) ---------- */
  if (!reduced && "IntersectionObserver" in window) {
    var SCRAMBLE_CHARS = "KEYFRAM3810#/:_";
    var scrambleObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        scrambleObs.unobserve(en.target);
        var el = en.target, final = el.getAttribute("data-final") || "", t0 = null, DUR = 700;
        function tickScramble(now) {
          if (t0 === null) t0 = now;
          var p = Math.min((now - t0) / DUR, 1);
          var solved = Math.floor(p * final.length);
          var out = final.slice(0, solved);
          for (var i = solved; i < final.length; i++) {
            var ch = final[i];
            out += (ch === " " || ch === "/") ? ch : SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0];
          }
          el.textContent = out;
          if (p < 1) requestAnimationFrame(tickScramble);
          else el.textContent = final;
        }
        requestAnimationFrame(tickScramble);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll(".eyebrow, .glow-card .idx, .work-meta .cat").forEach(function (el) {
      var txt = el.textContent;
      if (!txt || !txt.trim()) return;
      el.setAttribute("data-final", txt);
      scrambleObs.observe(el);
    });
  }

  /* ---------- NAV: current page indicator ---------- */
  /* This is the Insights page, so the Insights nav item stays highlighted the
     whole time. The home-section scroll spy lives on the home page only. */
  (function () {
    var insightsItem = document.querySelector('.nav-links .nav-item a[href="#"]');
    if (insightsItem) insightsItem.parentElement.classList.add("active");
  })();

  /* ---------- CONSOLE SIGNATURE ---------- */
  try {
    console.log("%cKEYFRAME GLOBAL", "font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 600; color: #EBB54E;");
    console.log("%cStrategy in Motion  |  yousef@keyframeglobal.com", "font-family: monospace; font-size: 11px; letter-spacing: 0.18em; color: #7CC4C0;");
  } catch (e) {}
})();