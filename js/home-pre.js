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
    setTimeout(finishIntro, 5000);            /* never gate content on a stalled rAF */
    setTimeout(function () { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 8000);

    root.classList.add("kf-intro-lock");
    var svg = document.getElementById("introLogo");
    var fx = document.getElementById("introFx");
    if (!svg || !fx || !fx.getContext) {       /* very old browser: just get out of the way */
      loader.parentNode.removeChild(loader); finishIntro(); return;
    }
    var ctx = fx.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    function sizeFx() {
      fx.width = Math.floor(innerWidth * DPR); fx.height = Math.floor(innerHeight * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    sizeFx(); addEventListener("resize", sizeFx);

    /* ---- path prep: main outline first, then counters, fragments last ---- */
    var raw = [].slice.call(svg.querySelectorAll("#igStroke .ip"));
    var items = raw.map(function (p) {
      var L = p.getTotalLength();
      p.style.strokeDasharray = L + " " + L;
      p.style.strokeDashoffset = L;
      return { el: p, len: L };
    }).sort(function (a, b) { return b.len - a.len; });
    var total = items.reduce(function (s, it) { return s + it.len; }, 0);
    /* stagger: each path draws over its share, starting at 55% of the previous one */
    var cursor = 0;
    items.forEach(function (it) {
      var share = it.len / total;
      it.t0 = cursor; it.t1 = Math.min(cursor + share * 1.9, 1);
      cursor += share * 0.62;
    });

    function svgToScreen(pt) {
      var r = svg.getBoundingClientRect();
      return { x: r.left + (pt.x / 480) * r.width, y: r.top + (pt.y / 494.5) * r.height };
    }
    var stageRect = function () {
      var r = svg.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, rad: Math.max(r.width, r.height) / 2 };
    };

    /* ---- particles ---- */
    var parts = [], bolts = [];
    function spark(x, y, burst, ang, mag) {
      var a = ang !== undefined ? ang : Math.random() * 6.283;
      var m = mag !== undefined ? mag : (burst ? 2 + Math.random() * 5 : 0.4 + Math.random() * 1.6);
      var c = Math.random();
      parts.push({
        x: x, y: y, vx: Math.cos(a) * m, vy: Math.sin(a) * m,
        life: 1, decay: burst ? 0.012 + Math.random() * 0.014 : 0.03 + Math.random() * 0.05,
        w: burst ? 1 + Math.random() * 1.8 : 0.6 + Math.random() * 1.2,
        col: c < 0.55 ? "204,255,0" : (c < 0.82 ? "255,255,255" : "124,196,192"),
        g: burst ? 0.045 : 0.01
      });
    }
    function bolt(x, y) {
      var seg = [], n = 3 + Math.floor(Math.random() * 3), px = x, py = y;
      var a = Math.random() * 6.283;
      for (var i = 0; i < n; i++) {
        a += (Math.random() - 0.5) * 2.2;
        px += Math.cos(a) * (7 + Math.random() * 16);
        py += Math.sin(a) * (7 + Math.random() * 16);
        seg.push([px, py]);
      }
      bolts.push({ x: x, y: y, seg: seg, life: 1 });
    }
    function drawFx(now) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      ctx.globalCompositeOperation = "lighter";
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        if (p.att) {
          var dxx = p.ax - p.x, dyy = p.ay - p.y;
          var dist = Math.sqrt(dxx * dxx + dyy * dyy);
          if (dist < 9) { parts.splice(i, 1); continue; }   /* swallowed */
          var f = p.as / Math.max(dist * 0.045, 1);
          p.vx += (dxx / dist) * f; p.vy += (dyy / dist) * f;
          p.vx *= 0.992; p.vy *= 0.992;
        } else {
          p.vy += p.g; p.vx *= 0.985; p.vy *= 0.985;
        }
        p.x += p.vx; p.y += p.vy; p.life -= p.decay;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        ctx.strokeStyle = "rgba(" + p.col + "," + (p.life * 0.9) + ")";
        ctx.lineWidth = p.w * p.life;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4);
        ctx.stroke();
      }
      for (var j = bolts.length - 1; j >= 0; j--) {
        var b = bolts[j];
        b.life -= 0.14;
        if (b.life <= 0) { bolts.splice(j, 1); continue; }
        ctx.strokeStyle = "rgba(230,255,140," + (b.life * 0.8) + ")";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(b.x, b.y);
        for (var k = 0; k < b.seg.length; k++) ctx.lineTo(b.seg[k][0], b.seg[k][1]);
        ctx.stroke();
      }
      for (var wv = waves.length - 1; wv >= 0; wv--) {
        var W = waves[wv];
        if (W.delay && W.delay > 0) { W.delay -= 16; continue; }
        W.r += W.v; W.v *= 0.985; W.a -= 0.014;
        if (W.a <= 0) { waves.splice(wv, 1); continue; }
        ctx.lineWidth = W.w;
        ctx.strokeStyle = "rgba(" + (W.col || "255,255,255") + "," + (W.a * 0.85) + ")";
        ctx.beginPath(); ctx.arc(W.cx, W.cy, W.r, 0, 6.283); ctx.stroke();
      }
      for (var st = streaks.length - 1; st >= 0; st--) {
        var S = streaks[st];
        S.life -= S.decay;
        if (S.life <= 0) { streaks.splice(st, 1); continue; }
        var grow = Math.pow(1 - S.life, 0.55);
        var r1, r2;
        if (S.rev) { r2 = 20 + (1 - grow) * S.len; r1 = Math.max(r2 - S.len * 0.3 * S.life, 10); }
        else { r1 = 14 + grow * S.len * 0.22; r2 = 14 + grow * S.len; }
        ctx.lineWidth = S.w * S.life;
        ctx.strokeStyle = "rgba(" + S.col + "," + (S.life * 0.75) + ")";
        ctx.beginPath();
        ctx.moveTo(S.cx + Math.cos(S.a) * r1, S.cy + Math.sin(S.a) * r1);
        ctx.lineTo(S.cx + Math.cos(S.a) * r2, S.cy + Math.sin(S.a) * r2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      if (core && core.r > 0.5) {
        /* photon ring */
        ctx.beginPath(); ctx.arc(core.x, core.y, core.r + 2.5, 0, 6.283);
        ctx.strokeStyle = "rgba(255,255,255," + (0.75 * core.glow) + ")"; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.beginPath(); ctx.arc(core.x, core.y, core.r + 6, 0, 6.283);
        ctx.strokeStyle = "rgba(204,255,0," + (0.4 * core.glow) + ")"; ctx.lineWidth = 5; ctx.stroke();
        /* the hole itself: pure darkness */
        ctx.beginPath(); ctx.arc(core.x, core.y, core.r, 0, 6.283);
        ctx.fillStyle = "#000"; ctx.fill();
      }
    }

    /* ---- timeline: draw -> charge -> black hole collapse ---- */
    var DRAW = 2050, CHARGE = 420, COLLAPSE = 950;
    var phase = 0, t0 = null, lastBolt = 0, lastFlick = 0, endFired = false;
    var waves = [], streaks = [], core = null, bh = null;
    var strokeG = svg.querySelector("#igStroke");
    var stage = loader.querySelector(".intro-stage");

    function skipAhead() {
      if (phase >= 2) return;
      phase = 2;
      t0 = performance.now() - (DRAW + CHARGE);
      svg.style.opacity = 1;
    }

    function endCollapse() {
      if (endFired) return;
      endFired = true;
      loader.classList.add("kf-boom");        /* stage gone; only the dying core remains */
      /* a few last embers drifting at the center, then the site surfaces from black */
      var s = stageRect();
      for (var i = 0; i < 7; i++) {
        parts.push({
          x: s.cx + (Math.random() - 0.5) * 14, y: s.cy + (Math.random() - 0.5) * 14,
          vx: (Math.random() - 0.5) * 0.7, vy: (Math.random() - 0.5) * 0.7,
          life: 1, decay: 0.012 + Math.random() * 0.02,
          w: 0.5 + Math.random() * 0.9, col: Math.random() < 0.5 ? "204,255,0" : "255,255,255", g: 0
        });
      }
      setTimeout(function () { loader.classList.add("kf-reveal"); finishIntro(); }, 200);
      setTimeout(function () {
        root.classList.remove("kf-intro-lock");
        if (loader.parentNode) loader.parentNode.removeChild(loader);
      }, 1500);
    }

    function frame(now) {
      if (t0 === null) t0 = now;
      var t = now - t0;

      if (phase === 0) {
        var p = Math.min(t / DRAW, 1);
        var head = null, e = 1 - Math.pow(1 - p, 2);
        items.forEach(function (it) {
          var lp = (e - it.t0) / (it.t1 - it.t0);
          lp = Math.max(0, Math.min(lp, 1));
          it.el.style.strokeDashoffset = it.len * (1 - lp);
          if (lp > 0 && lp < 1) head = svgToScreen(it.el.getPointAtLength(it.len * lp));
        });
        if (head) {
          for (var i = 0; i < 3; i++) spark(head.x, head.y, false);
          if (now - lastBolt > 90 + Math.random() * 120) { bolt(head.x, head.y); lastBolt = now; }
        }
        if (now - lastFlick > 70 + Math.random() * 120) {
          svg.style.opacity = (0.74 + Math.random() * 0.26).toFixed(2);
          lastFlick = now;
        }
        if (p >= 1) phase = 1;

      } else if (phase === 1) {
        /* CHARGE: the mark destabilizes; gravity is winning */
        var cp = Math.min((t - DRAW) / CHARGE, 1);
        var s1 = stageRect();
        strokeG.style.strokeWidth = (2.4 + cp * 2.2).toFixed(2);
        stage.style.transform = "scale(" + (1 - cp * 0.05).toFixed(4) + ")";
        if (now - lastFlick > 36) {
          svg.style.opacity = (0.65 + Math.random() * 0.35).toFixed(2);
          lastFlick = now;
        }
        for (var j = 0; j < 5; j++) {
          var a1 = Math.random() * 6.283;
          var R1 = s1.rad * (1.15 + Math.random() * 0.85);
          var m1 = 3 + Math.random() * 3;
          parts.push({
            x: s1.cx + Math.cos(a1) * R1, y: s1.cy + Math.sin(a1) * R1,
            vx: -Math.cos(a1) * m1, vy: -Math.sin(a1) * m1,
            life: 1, decay: 0.035 + Math.random() * 0.03,
            w: 0.6 + Math.random() * 1.1,
            col: Math.random() < 0.6 ? "204,255,0" : "255,255,255", g: 0
          });
        }
        if (now - lastBolt > 70) {
          var pe = svgToScreen(items[0].el.getPointAtLength(Math.random() * items[0].len));
          bolt(pe.x, pe.y); lastBolt = now;
        }
        if (cp >= 1) { phase = 2; svg.style.opacity = 1; }

      } else if (phase === 2) {
        /* COLLAPSE: the logo eats itself into darkness */
        var k = Math.min((t - DRAW - CHARGE) / COLLAPSE, 1);
        var fall = k * k;                                  /* accelerating fall */
        if (!bh) {
          var s2 = stageRect();
          bh = s2.rad > 1 ? s2 : { cx: innerWidth / 2, cy: innerHeight / 2, rad: Math.min(innerWidth, innerHeight) * 0.22 };
        }
        var cx = bh.cx, cy = bh.cy;

        stage.style.transform = "scale(" + Math.max(0.95 * (1 - fall), 0.0001).toFixed(4) +
                                ") rotate(" + (fall * 65).toFixed(1) + "deg)";
        svg.style.opacity = Math.max(0, 1 - fall * 1.15).toFixed(2);
        if (now - lastFlick > 40) {
          strokeG.style.strokeWidth = (4.6 - fall * 2.5 + Math.random()).toFixed(2);
          lastFlick = now;
        }

        /* accretion spiral: matter orbits in and is swallowed */
        if (k < 0.8) {
          for (var q = 0; q < 8; q++) {
            var a2 = Math.random() * 6.283;
            var R2 = bh.rad * (0.5 + Math.random() * 1.3) + 30;
            var px = cx + Math.cos(a2) * R2, py = cy + Math.sin(a2) * R2;
            var tang = a2 + 1.5708 * (Math.random() < 0.85 ? 1 : -1);
            var sp = 2 + Math.random() * 2.5;
            parts.push({
              x: px, y: py,
              vx: Math.cos(tang) * sp, vy: Math.sin(tang) * sp,
              life: 1, decay: 0.006 + Math.random() * 0.008,
              w: 0.6 + Math.random() * 1.4,
              col: Math.random() < 0.5 ? "204,255,0" : (Math.random() < 0.7 ? "255,255,255" : "124,196,192"),
              g: 0, att: true, ax: cx, ay: cy, as: 2.6
            });
          }
        }
        /* light dragged inward */
        if (Math.random() < 0.5 && k < 0.85) {
          streaks.push({
            cx: cx, cy: cy, a: Math.random() * 6.283,
            len: 90 + Math.random() * 260, w: 0.5 + Math.random() * 1.2,
            life: 1, decay: 0.05 + Math.random() * 0.04,
            col: Math.random() < 0.55 ? "224,255,120" : "255,255,255", rev: true
          });
        }
        /* the event horizon: grows as it feeds, then dies with its meal */
        var coreR = Math.sin(Math.min(k * 1.15, 1) * Math.PI) * bh.rad * 0.55;
        core = k < 1 ? { x: cx, y: cy, r: Math.max(coreR, 0), glow: Math.sin(k * Math.PI) } : null;

        if (k >= 1) { core = null; endCollapse(); }
      }

      drawFx(now);
      if (!endFired || parts.length || bolts.length || streaks.length || waves.length || core) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
    loader.addEventListener("click", skipAhead);
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape" || e.key === "Enter") { skipAhead(); document.removeEventListener("keydown", esc); }
    });
    requestAnimationFrame(frame);
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
    { n: "Abdulraheem Ghazal", r: "CEO, Safarin Steel", f: "\uD83C\uDDEF\uD83C\uDDF4", c: "JO", q: "Keyframe understood our business, not just our brand. The site and identity finally match the company we are. We are proud to show it to our clients.", col: "#EBB54E" },
    { n: "Elena C.", r: "Founder, L'Atelier Elena", f: "\uD83C\uDDFA\uD83C\uDDF8", c: "US", q: "Professional, responsive, and highly skilled. He understood my vision from the start and patiently revised every detail until I was completely satisfied. I highly recommend him without hesitation.", col: "#EBB54E" },
    { n: "Steve F.", r: "Small Business Owner, Repeat Client", f: "\uD83C\uDDFA\uD83C\uDDF8", c: "US", q: "As always, excellent work done on time with extra attention to detail. Yousef always makes sure to under promise and over deliver.", col: "#7CC4C0" },
    { n: "Brandon S.", r: "Video Producer, Repeat Client", f: "\uD83C\uDDFA\uD83C\uDDF8", c: "US", q: "Yousef came to the rescue again. His ability to work efficiently and effectively has been consistent since we first started working together.", col: "#9B7EDE" },
    { n: "Sammy F.", r: "Music Producer", f: "\uD83C\uDDFA\uD83C\uDDF8", c: "US", q: "Yousef is great to work with and knows what he is doing, quickly and efficiently. My work is very high end, and Yousef handled everything to perfection.", col: "#E8556B" },
    { n: "[NDA]", r: "Instagram Campaign, Qatar", f: "\uD83C\uDDF6\uD83C\uDDE6", c: "QA", q: "Punctuality and creativity.", col: "#C9A24B" },
    { n: "[NDA]", r: "Luxury Residential Project, US", f: "\uD83C\uDDFA\uD83C\uDDF8", c: "US", q: "His communication, creativity, and dedication were remarkable. He went above and beyond to deliver outstanding results on time.", col: "#C08457" },
    { n: "[REDACTED]", r: "Video Production Client, US", f: "\uD83C\uDDFA\uD83C\uDDF8", c: "US", q: "Keyframe is a blessing and I am thankful for their diligence in helping me service my clients.", col: "#4FB3A4" },
    { n: "[NDA]", r: "Google Ads and Web, US", f: "\uD83C\uDDFA\uD83C\uDDF8", c: "US", q: "Keyframe is diligent and very conscientious about the work.", col: "#5B9BD5" },
    { n: "[REDACTED]", r: "Website Client, US", f: "\uD83C\uDDFA\uD83C\uDDF8", c: "US", q: "Keyframe delivers beyond expectations.", col: "#D98A2E" },
    { n: "[NDA]", r: "Web and Email Client, US", f: "\uD83C\uDDFA\uD83C\uDDF8", c: "US", q: "Simply the best. Work is always excellent.", col: "#EBB54E" },
    { n: "[REDACTED]", r: "Video Editing Client, US", f: "\uD83C\uDDFA\uD83C\uDDF8", c: "US", q: "Consistency is the word I think of when it comes to Keyframe!", col: "#7CC4C0" },
    { n: "[NDA]", r: "Design Client, US", f: "\uD83C\uDDFA\uD83C\uDDF8", c: "US", q: "Above and beyond the call of duty, every time!", col: "#E8556B" },
    { n: "[REDACTED]", r: "Video Editing Client, US", f: "\uD83C\uDDFA\uD83C\uDDF8", c: "US", q: "That is my guy. This time he exceeded my expectations!", col: "#9B7EDE" },
    { n: "[NDA]", r: "Website Client, US", f: "\uD83C\uDDFA\uD83C\uDDF8", c: "US", q: "Even takes care of business while on vacation!", col: "#C9A24B" }
  ];

  function initials(name) {
    var clean = name.replace(/[^A-Za-z ]/g, " ").trim();
    if (!clean) return "\u2022";
    var p = clean.split(/\s+/);
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
  var colA = [], colB = [], colC = [];
  voices.forEach(function (v, i) { [colA, colB, colC][i % 3].push(v); });
  vi.innerHTML = buildColumn(colA, false) + buildColumn(colB, true) + buildColumn(colC, false);
  if (window.innerWidth < 760) {
    vi.lastChild && vi.removeChild(vi.lastChild);
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

  /* ---------- NAV: ACTIVE SECTION INDICATOR ---------- */
  if ("IntersectionObserver" in window) {
    var navAnchors = {};
    document.querySelectorAll(".nav-item a").forEach(function (a) {
      navAnchors[a.getAttribute("href")] = a.parentElement;
    });
    var sectionObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = "#" + (en.target.id === "hero" ? "top" : en.target.id);
        for (var k in navAnchors) navAnchors[k].classList.toggle("active", k === id);
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    ["hero", "work", "services", "method", "voices", "contact"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) sectionObs.observe(el);
    });
  }

  /* ---------- CONSOLE SIGNATURE ---------- */
  try {
    console.log("%cKEYFRAME GLOBAL", "font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 600; color: #EBB54E;");
    console.log("%cStrategy in Motion  |  yousef@keyframeglobal.com", "font-family: monospace; font-size: 11px; letter-spacing: 0.18em; color: #7CC4C0;");
  } catch (e) {}
})();