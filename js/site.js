document.addEventListener("DOMContentLoaded", function() {
  if (typeof gsap === "undefined") {
    console.warn("GSAP is not loaded. Magic Bento interactions disabled.");
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.__KF_LITE) return;
  
  var cards = document.querySelectorAll(".magic-bento-card");
  var workSection = document.getElementById("work");
  if (!cards.length || !workSection) return;

  var glowColor = "var(--glow-rgb)";
  var spotlightRadius = 300;

  /* Only run the pointer math while the work section is near the viewport */
  var workNear = false;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      workNear = entries[0].isIntersecting;
      if (!workNear) {
        spotOp(0);
        for (var i = 0; i < cards.length; i++) cards[i].style.setProperty("--glow-intensity", "0");
      }
    }, { rootMargin: "200px" }).observe(workSection);
  } else {
    workNear = true;
  }
  
  // Global Spotlight
  var spotlight = document.createElement("div");
  spotlight.className = "global-spotlight";
  document.body.appendChild(spotlight);
  
  var isInsideSection = false;
  var spotX = gsap.quickTo(spotlight, "left", { duration: 0.1, ease: "power2.out" });
  var spotY = gsap.quickTo(spotlight, "top", { duration: 0.1, ease: "power2.out" });
  var spotOp = gsap.quickTo(spotlight, "opacity", { duration: 0.2, ease: "power2.out" });
  
  document.addEventListener("mousemove", function(e) {
    if (!workNear) return;
    if (!window.matchMedia("(hover: hover)").matches) return; // Only run on hover-capable devices

    // Phase 1: BATCH READS
    var sectionRect = workSection.getBoundingClientRect();
    var cardRects = [];
    for (var i = 0; i < cards.length; i++) {
      cardRects.push(cards[i].getBoundingClientRect());
    }
    
    // Phase 2: BATCH WRITES
    isInsideSection = (e.clientX >= sectionRect.left && e.clientX <= sectionRect.right && e.clientY >= sectionRect.top && e.clientY <= sectionRect.bottom);
    
    if (!isInsideSection) {
      spotOp(0);
      for (var j = 0; j < cards.length; j++) cards[j].style.setProperty("--glow-intensity", "0");
      return;
    }
    
    var proximity = spotlightRadius * 0.5;
    var fadeDist = spotlightRadius * 0.75;
    var minDistance = Infinity;
    
    for (var k = 0; k < cards.length; k++) {
      var cr = cardRects[k];
      var cx = cr.left + cr.width / 2;
      var cy = cr.top + cr.height / 2;
      var dist = Math.hypot(e.clientX - cx, e.clientY - cy) - Math.max(cr.width, cr.height) / 2;
      var effDist = Math.max(0, dist);
      minDistance = Math.min(minDistance, effDist);
      
      var glowInt = 0;
      if (effDist <= proximity) glowInt = 1;
      else if (effDist <= fadeDist) glowInt = (fadeDist - effDist) / (fadeDist - proximity);
      
      var relX = ((e.clientX - cr.left) / cr.width) * 100;
      var relY = ((e.clientY - cr.top) / cr.height) * 100;
      
      cards[k].style.setProperty("--glow-x", relX + "%");
      cards[k].style.setProperty("--glow-y", relY + "%");
      cards[k].style.setProperty("--glow-intensity", glowInt);
    }
    
    spotX(e.clientX);
    spotY(e.clientY);
    
    var tOp = minDistance <= proximity ? 0.8 : (minDistance <= fadeDist ? ((fadeDist - minDistance) / (fadeDist - proximity)) * 0.8 : 0);
    spotOp(tOp);
  });
  
  document.addEventListener("mouseleave", function() {
    isInsideSection = false;
    spotOp(0);
    cards.forEach(function(c) { c.style.setProperty("--glow-intensity", "0"); });
  });
  
  // Per Card Logic (Tilt, Magnetism, Particles, Ripple)
  cards.forEach(function(card) {
    card.classList.add("particle-container");
    
    // Tilt & Magnetism
    card.addEventListener("mousemove", function(e) {
      if (!window.matchMedia("(hover: hover)").matches) return;
      var cr = card.getBoundingClientRect(); // Single read per card is ok here since it's isolated
      var x = e.clientX - cr.left;
      var y = e.clientY - cr.top;
      var cx = cr.width / 2;
      var cy = cr.height / 2;
      
      var rx = ((y - cy) / cy) * -5;
      var ry = ((x - cx) / cx) * 5;
      var mx = (x - cx) * 0.05;
      var my = (y - cy) * 0.05;
      
      gsap.to(card, { rotationX: rx, rotationY: ry, x: mx, y: my, duration: 0.1, ease: "power2.out", transformPerspective: 1000, overwrite: "auto" });
    });
    
    card.addEventListener("mouseleave", function() {
      gsap.to(card, { rotationX: 0, rotationY: 0, x: 0, y: 0, duration: 0.3, ease: "power2.out", overwrite: "auto" });
    });
    
    // Ripple Click
    card.addEventListener("click", function(e) {
      var cr = card.getBoundingClientRect();
      var x = e.clientX - cr.left;
      var y = e.clientY - cr.top;
      var maxD = Math.max(Math.hypot(x,y), Math.hypot(x-cr.width,y), Math.hypot(x,y-cr.height), Math.hypot(x-cr.width,y-cr.height));
      
      var ripple = document.createElement("div");
      ripple.style.cssText = "position:absolute; width:"+(maxD*2)+"px; height:"+(maxD*2)+"px; border-radius:50%; background:radial-gradient(circle, rgba("+glowColor+", 0.4) 0%, rgba("+glowColor+", 0.2) 30%, transparent 70%); left:"+(x-maxD)+"px; top:"+(y-maxD)+"px; pointer-events:none; z-index:1000;";
      card.appendChild(ripple);
      
      gsap.fromTo(ripple, { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.8, ease: "power2.out", onComplete: function() { ripple.remove(); } });
    });
    
    // Particles
    var particles = [];
    var pTimeouts = [];
    card.addEventListener("mouseenter", function() {
      if (!window.matchMedia("(hover: hover)").matches) return;
      var cr = card.getBoundingClientRect();
      for (var i = 0; i < 12; i++) {
        (function(idx) {
          var tid = setTimeout(function() {
            var p = document.createElement("div");
            p.className = "particle";
            p.style.cssText = "position:absolute; width:4px; height:4px; border-radius:50%; background:rgba("+glowColor+",1); box-shadow:0 0 6px rgba("+glowColor+",0.6); pointer-events:none; z-index:100; left:"+(Math.random()*cr.width)+"px; top:"+(Math.random()*cr.height)+"px;";
            card.appendChild(p);
            particles.push(p);
            
            gsap.fromTo(p, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)" });
            gsap.to(p, { x: (Math.random()-0.5)*100, y: (Math.random()-0.5)*100, rotation: Math.random()*360, duration: 2+Math.random()*2, ease: "none", repeat: -1, yoyo: true });
            gsap.to(p, { opacity: 0.3, duration: 1.5, ease: "power2.inOut", repeat: -1, yoyo: true });
          }, idx * 100);
          pTimeouts.push(tid);
        })(i);
      }
    });
    
    card.addEventListener("mouseleave", function() {
      pTimeouts.forEach(clearTimeout);
      pTimeouts = [];
      particles.forEach(function(p) {
        gsap.to(p, { scale: 0, opacity: 0, duration: 0.3, ease: "back.in(1.7)", onComplete: function() { p.remove(); } });
      });
      particles = [];
    });
  });
});

/* ==== next block ==== */

document.addEventListener("DOMContentLoaded", function () {
  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.__KF_LITE === true;

  if (typeof gsap === "undefined" || window.__KF_LITE) { root.classList.add("no-gsap"); return; }
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- 1. LENIS SMOOTH SCROLL (synced with ScrollTrigger) ---------- */
  var lenis = null;
  var isTouch = window.matchMedia("(hover: none)").matches;
  if (typeof Lenis !== "undefined" && !reduced && !isTouch) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    window.__lenis = lenis;
    root.classList.add("kf-smooth");
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* Anchor routing, with or without Lenis */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (ev) {
      var id = a.getAttribute("href");
      if (!id || id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      ev.preventDefault();
      if (window.__kfCloseMenu) window.__kfCloseMenu();
      if (lenis) {
        lenis.scrollTo(target, { offset: -70, duration: 1.5, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
      } else {
        target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
      }
    });
  });

  if (reduced) return;

  /* ---------- 2. SCROLL VELOCITY SKEW ON MARQUEES ---------- */
  if (lenis) {
    var skewHero = gsap.quickTo(".hero-marquee", "skewX", { duration: 0.4, ease: "power2.out" });
    var skewCine = gsap.quickTo(".cine-marquee", "skewX", { duration: 0.4, ease: "power2.out" });
    lenis.on("scroll", function (e) {
      var sk = gsap.utils.clamp(-4, 4, (e.velocity || 0) * 0.22);
      skewHero(sk);
      skewCine(sk);
    });
  }

  /* ---------- 3. HERO + CTA CHARACTER REVEALS ---------- */
  function animateChars(el, opts) {
    opts = opts || {};
    if (typeof SplitType === "undefined") { gsap.set(el, { opacity: 1 }); return; }
    var split = new SplitType(el, { types: "lines, chars", tagName: "span" });
    gsap.set(el, { opacity: 1 });
    if (!split.chars || !split.chars.length) return;
    var vars = {
      yPercent: 0, rotateX: 0, opacity: 1,
      duration: 0.8, stagger: 0.02, ease: "back.out(1.5)",
      delay: opts.delay || 0,
      onComplete: function () { split.revert(); }
    };
    if (opts.onScroll) vars.scrollTrigger = { trigger: el, start: "top 88%", once: true };
    gsap.fromTo(split.chars, { yPercent: 110, rotateX: 90, opacity: 0 }, vars);
  }

  var heroTitle = document.querySelector(".hero-title");
  function playHero() { if (heroTitle) animateChars(heroTitle, { delay: 0.15 }); }
  if (window.__kfIntroDone && window.__kfIntroDone()) playHero();
  else window.addEventListener("kf:intro", playHero, { once: true });

  var ctaTitle = document.querySelector(".cta .reveal-text");
  if (ctaTitle) animateChars(ctaTitle, { onScroll: true });

  /* ---------- 4. SECTION HEADING MASKED WORD REVEALS ---------- */
  document.querySelectorAll(".split-h").forEach(function (h) {
    if (typeof SplitType === "undefined") { gsap.set(h, { opacity: 1 }); return; }
    var split = new SplitType(h, { types: "lines, words", tagName: "span" });
    gsap.set(h, { opacity: 1 });
    if (!split.words || !split.words.length) return;
    gsap.fromTo(split.words,
      { yPercent: 115 },
      {
        yPercent: 0, duration: 1.05, stagger: 0.04, ease: "power4.out",
        scrollTrigger: { trigger: h, start: "top 88%", once: true },
        onComplete: function () { split.revert(); }
      });
  });

  /* ---------- 5. HERO SCROLL-OUT CHOREOGRAPHY ---------- */
  gsap.to(".hero .wrap", {
    y: -70, opacity: 0.35, ease: "none",
    scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom 35%", scrub: true }
  });
  gsap.to(".scroll-cue", {
    opacity: 0, ease: "none",
    scrollTrigger: { trigger: "#hero", start: "top top", end: "18% top", scrub: true }
  });

  /* ---------- 6. SCROLL-DRIVEN FALLBACKS (Safari / Firefox without SDA) ---------- */
  var sda = window.CSS && CSS.supports && CSS.supports("animation-timeline: view()");
  if (!sda) root.classList.add("no-sda");

  var workSection = document.getElementById("work");
  var pinTriggers = [];

  if (!sda) {
    /* Horizontal pinned reel, mirroring the CSS scroll-driven version */
    var mm = gsap.matchMedia();
    mm.add("(min-width: 900px)", function () {
      var pinEl = document.getElementById("workPin");
      var track = document.getElementById("workTrack");
      if (!pinEl || !track || (workSection && workSection.classList.contains("is-grid-view"))) return;
      workSection.classList.add("js-pin");
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth + 64); };
      var tween = gsap.to(track, {
        x: function () { return -dist(); },
        ease: "none",
        scrollTrigger: {
          trigger: pinEl, start: "top 90px",
          end: function () { return "+=" + dist(); },
          scrub: true, pin: true, anticipatePin: 1, invalidateOnRefresh: true
        }
      });
      var drift = gsap.fromTo(".work-visual .mesh",
        { x: "2.5%" },
        {
          x: "-2.5%", ease: "none",
          scrollTrigger: {
            trigger: pinEl, start: "top 90px",
            end: function () { return "+=" + dist(); },
            scrub: true, invalidateOnRefresh: true
          }
        });
      pinTriggers = [tween.scrollTrigger, drift.scrollTrigger];
      return function () {
        workSection.classList.remove("js-pin");
        pinTriggers = [];
        gsap.set(track, { clearProps: "x" });
        gsap.set(".work-visual .mesh", { clearProps: "x" });
      };
    });

    /* Method timeline fill */
    var methodFill = document.getElementById("methodFill");
    if (methodFill) {
      gsap.to(methodFill, {
        width: "100%", ease: "none",
        scrollTrigger: { trigger: ".method-track", start: "top 80%", end: "top 30%", scrub: true }
      });
    }

    /* Giant footer wordmark parallax */
    var giant = document.getElementById("cineGiant");
    if (giant) {
      gsap.fromTo(giant,
        { yPercent: 16, opacity: 0, scale: 0.88 },
        {
          yPercent: 0, opacity: 1, scale: 1, ease: "none",
          scrollTrigger: { trigger: ".curtain", start: "top bottom", end: "bottom bottom", scrub: true }
        });
    }
  }

  /* ---------- 7. GRID / REEL TOGGLE (morphs cards via view transitions) ---------- */
  if (workSection) {
    document.querySelectorAll("#workTrack .work-card").forEach(function (card, i) {
      card.style.viewTransitionName = "kfcard-" + i;
    });
    var applyView = function (grid) {
      if (grid) {
        pinTriggers.forEach(function (st) { st.disable(true); });
        workSection.classList.remove("js-pin");
        gsap.set("#workTrack", { clearProps: "x" });
        gsap.set(".work-visual .mesh", { clearProps: "x" });
      }
      if (window.__kfSetView) window.__kfSetView(grid);
      if (!grid && pinTriggers.length) {
        workSection.classList.add("js-pin");
        pinTriggers.forEach(function (st) { st.enable(); });
      }
      ScrollTrigger.refresh();
    };
    window.__kfViewClick = function (grid) {
      if (workSection.classList.contains("is-grid-view") === grid) return;
      if (document.startViewTransition) {
        var vt = document.startViewTransition(function () { applyView(grid); });
        vt.finished.then(function () { ScrollTrigger.refresh(); }).catch(function () {});
      } else {
        applyView(grid);
      }
    };
  }

  /* Services are a static bento grid now; the old stacked-deck scroll effect was removed. */
});