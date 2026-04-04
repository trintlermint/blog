/**
 * Textmode Whale Background
 * A Lissajous-curve whale entity swimming through water with wave propagation.
 * Whale color: #924a41 / #c08179 base, camouflages toward nearby page elements.
 *
 * @author trintlermint
 * @link https://github.com/humanbydefinition/textmode.js
 */
(function () {
  if (typeof textmode === 'undefined') return;

  var isMobile = window.innerWidth < 768;

  var tm = textmode.create({
    width: window.innerWidth,
    height: window.innerHeight,
    fontSize: 16,
    frameRate: 60,
  });

  // Style the canvas as a fixed background behind all page content
  (function styleCanvas() {
    var canvases = document.querySelectorAll('canvas');
    for (var i = canvases.length - 1; i >= 0; i--) {
      var c = canvases[i];
      c.style.position = 'fixed';
      c.style.top = '0';
      c.style.left = '0';
      c.style.zIndex = '-1';
      c.style.pointerEvents = 'none';
      break;
    }
  })();

  var cols, rows, cur, prev;

  var DAMP = 0.955;
  var CHARS = " .'`~:;-=+*#%&@";
  var TAIL_RIPPLE_OFFSET = 30;
  var WHALE = [
    '       .                   ',
    '      ":"                  ',
    '    ___:____     |"\\/"|      ',
    '  ,\'        `.    \\  /      ',
    '  |  O        \\___/  |      ',
    '~^~^~^~^~^~^~^~^~^~^~^~^~',
  ];

  function precomputeCols(art) {
    var h = art.length;
    var w = Math.max.apply(null, art.map(function (l) { return l.length; }));
    var artCols = [];
    for (var fx = 0; fx < w; fx++) {
      var col = [];
      for (var fy = 0; fy < h; fy++) {
        var ch = art[fy][fx];
        if (ch && ch !== ' ') col.push({ ch: ch, vert: fy - Math.floor(h / 2) });
      }
      if (col.length) artCols.push(col);
    }
    return { cols: artCols, h: h, w: w };
  }

  var whaleData = precomputeCols(WHALE);
  var whaleTrail = [];
  var TRAIL_LEN = 80;

  // Color proximity system
  // Base whale colors: #924a41 and #c08179
  var WHALE_BASE = { r: 146, g: 74, b: 65 };    // #924a41
  var WHALE_HIGH = { r: 192, g: 129, b: 121 };   // #c08179
  // Separator color: WHALE_BASE dimmed to 68%
  var SEP_R = Math.round(WHALE_BASE.r * 0.68);
  var SEP_G = Math.round(WHALE_BASE.g * 0.68);
  var SEP_B = Math.round(WHALE_BASE.b * 0.68);

  // Element color mapping
  var COLOR_MAP = [
    { sel: 'h1, h3, h4, h5, h6',   rgb: [255, 255, 255] },  // white
    { sel: 'h2',                     rgb: [192, 129, 121] },  // #c08179
    { sel: 'a',                      rgb: [73, 58, 165]   },  // #493aa5
    { sel: '.slogan',                rgb: [134, 122, 222] },  // #867ade
    { sel: '.alert-success',         rgb: [134, 122, 222] },  // #867ade
    { sel: 'blockquote',             rgb: [58, 58, 58]    },  // #3a3a3a
  ];

  // Cached element rects with their colors (viewport coords)
  var colorTargets = [];
  var BLEND_RADIUS = 280;  // pixels, how close before blending starts
  var MAX_BLEND = 0.6;     // max blend factor, stronger camouflage

  function updateColorTargets() {
    colorTargets = [];
    for (var m = 0; m < COLOR_MAP.length; m++) {
      var els = document.querySelectorAll(COLOR_MAP[m].sel);
      var rgb = COLOR_MAP[m].rgb;
      for (var e = 0; e < els.length; e++) {
        var rect = els[e].getBoundingClientRect();
        // Skip elements not in or near viewport
        if (rect.bottom < -BLEND_RADIUS || rect.top > window.innerHeight + BLEND_RADIUS) continue;
        if (rect.right < -BLEND_RADIUS || rect.left > window.innerWidth + BLEND_RADIUS) continue;
        colorTargets.push({
          cx: (rect.left + rect.right) / 2,
          cy: (rect.top + rect.bottom) / 2,
          w: rect.width,
          h: rect.height,
          rgb: rgb
        });
      }
    }
  }

  // Read-more separator — canvas-rendered "/// :: READ MORE :: ///" bar
  var RM_TEXT = '/// :: READ MORE :: ///';
  var RM_DIM  = 0.28;  // brightness of outer fill slashes vs central text

  var readMoreSeps = [];
  var rmSepsDirty  = true;

  function initReadMoreHandlers() {
    var els = document.querySelectorAll('.read-more-sep');
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        var href = el.getAttribute('data-href');
        function go() { window.location.href = href; }
        el.addEventListener('click', go);
        el.addEventListener('touchstart', function (e) {
          e.preventDefault();
          go();
        }, { passive: false });
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') go();
        });
      })(els[i]);
    }
  }

  function updateReadMoreSeps() {
    readMoreSeps = [];
    var els = document.querySelectorAll('.read-more-sep');
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      readMoreSeps.push({ vpY: r.top + r.height / 2 });
    }
    rmSepsDirty = false;
  }

  // Page separators — horizontal character lines drawn on canvas at each .page-sep element
  var pageSeps = [];
  var sepsDirty = true;
  var sepColStart = 0, sepColEnd = 0;  // shared content bounds for all seps on the page

  function updatePageSeps() {
    pageSeps = [];
    var els = document.querySelectorAll('.page-sep');
    if (!els.length) { sepsDirty = false; return; }

    // Full canvas width — the canvas sits behind all page content so sidebar/TOC
    // appear on top regardless, no need to clip the separator line.
    sepColStart = 1;
    sepColEnd   = cols - 1;

    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      pageSeps.push({
        chars: els[i].getAttribute('data-chars') || '---://-',
        vpY:   r.top + r.height / 2
      });
    }
    sepsDirty = false;
  }

  // Throttled scroll/resize update
  var targetsDirty = true;
  var targetsTimer = null;
  function scheduleTargetUpdate() {
    targetsDirty = true;
    sepsDirty = true;
    rmSepsDirty = true;
    if (!targetsTimer) {
      targetsTimer = setTimeout(function () {
        targetsTimer = null;
        updateColorTargets();
        targetsDirty = false;
      }, 200);
    }
  }
  window.addEventListener('scroll', scheduleTargetUpdate, { passive: true });
  window.addEventListener('resize', scheduleTargetUpdate, { passive: true });

  // Mouse Y tracking for separator hover magnification
  var mouseVpY = -9999;
  document.addEventListener('mousemove', function (e) { mouseVpY = e.clientY; }, { passive: true });

  // Find blended color for a given viewport position
  function getBlendedColor(vpx, vpy, baseR, baseG, baseB) {
    if (colorTargets.length === 0) return { r: baseR, g: baseG, b: baseB };

    var closestDist = Infinity;
    var closestRGB = null;

    for (var t = 0; t < colorTargets.length; t++) {
      var ct = colorTargets[t];
      var dx = vpx - ct.cx;
      var dy = vpy - ct.cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closestRGB = ct.rgb;
      }
    }

    if (!closestRGB || closestDist > BLEND_RADIUS) {
      return { r: baseR, g: baseG, b: baseB };
    }

    // Linear blend: 0 at BLEND_RADIUS, MAX_BLEND at distance 0
    var factor = (1 - closestDist / BLEND_RADIUS) * MAX_BLEND;
    return {
      r: baseR + (closestRGB[0] - baseR) * factor,
      g: baseG + (closestRGB[1] - baseG) * factor,
      b: baseB + (closestRGB[2] - baseB) * factor
    };
  }
  // FUCKKKKKK
  // convert grid coords to viewport pixel coords
  function gridToViewport(gx, gy) {
    return {
      x: (gx / cols) * window.innerWidth,
      y: (gy / rows) * window.innerHeight
    };
  }

  function init() {
    cols = tm.grid.cols;
    rows = tm.grid.rows;
    cur = new Float32Array(cols * rows);
    prev = new Float32Array(cols * rows);
    whaleTrail = [];
    updateColorTargets();
    updatePageSeps();
    updateReadMoreSeps();
  }

  function drop(x, y, force) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 1 || x >= cols - 1 || y < 1 || y >= rows - 1) return;
    var i = y * cols + x;
    cur[i] += force;
    if (x > 1) cur[i - 1] += force * 0.4;
    if (x < cols - 2) cur[i + 1] += force * 0.4;
    if (y > 1) cur[i - cols] += force * 0.35;
    if (y < rows - 2) cur[i + cols] += force * 0.35;
  }

  tm.setup(function () {
    init();
    initReadMoreHandlers();
    setTimeout(function () {
      var cover = document.getElementById('whale-cover');
      if (cover) {
        cover.classList.add('fade-out');
        setTimeout(function () { cover.remove(); }, 600);
      }
    }, 1000);
  });

  tm.draw(function () {
    if (!cur) return;
    var time = tm.frameCount / 60;

    // Refresh color targets periodically (every 60 frames ~ 1s)
    if (tm.frameCount % 60 === 0 && targetsDirty) {
      updateColorTargets();
      targetsDirty = false;
    }

    if (!isMobile) {
      // Lissajous curve
      var sx = Math.sin(time * 0.7) * (cols * 0.38) +
               Math.sin(time * 1.9 + 1.2) * (cols * 0.12);
      var sy = Math.cos(time * 0.5) * (rows * 0.35) +
               Math.cos(time * 1.7 + 0.8) * (rows * 0.1);

      var headX = cols / 2 + sx;
      var headY = rows / 2 + sy;

      whaleTrail.unshift({ x: headX, y: headY });
      if (whaleTrail.length > TRAIL_LEN) whaleTrail.length = TRAIL_LEN;

      if (tm.frameCount % 2 === 0) drop(headX, headY, 4);
      if (whaleTrail.length > 10 && tm.frameCount % 4 === 0) {
        var tail = whaleTrail[Math.min(whaleTrail.length - 1, TAIL_RIPPLE_OFFSET)];
        drop(tail.x, tail.y, 1.5);
      }

      // Wave propagation
      var next = prev;
      for (var y = 1; y < rows - 1; y++) {
        var yo = y * cols;
        for (var x = 1; x < cols - 1; x++) {
          var i = yo + x;
          next[i] = ((cur[i - 1] + cur[i + 1] + cur[i - cols] + cur[i + cols]) * 0.5 - prev[i]) * DAMP;
        }
      }
      for (var yg = rows - 2; yg >= 1; yg--) {
        var ygo = yg * cols;
        for (var xg = 1; xg < cols - 1; xg++) {
          next[ygo + xg] += next[(yg - 1) * cols + xg] * 0.01;
        }
      }
      prev = cur;
      cur = next;

      // Render water (keeps blue-green tint — only the whale camouflages)
      tm.background(0);
      var hc = Math.floor(cols / 2);
      var hr = Math.floor(rows / 2);

      for (var yw = 0; yw < rows; yw++) {
        var ywo = yw * cols;
        for (var xw = 0; xw < cols; xw++) {
          var h = cur[ywo + xw];
          var a = Math.abs(h);
          if (a < 0.06) continue;

          var ci = Math.min(Math.floor(a * 2.0), CHARS.length - 1);
          var bright = Math.min(a * 50, 255);
          // Water ripples: subtle rust/copper tint to match whale palette
          var wr = Math.min(bright * 0.5, 130);
          var wg = Math.min(bright * 0.3 + 15, 100);
          var wb = Math.min(bright * 0.25 + 10, 80);

          tm.char(CHARS[ci]);
          tm.charColor(wr, wg, wb);
          tm.cellColor(Math.min(a * 3, 12), Math.min(a * 2, 8), Math.min(a * 1, 5));
          tm.push();
          tm.translate(xw - hc, yw - hr);
          tm.rect(1, 1);
          tm.pop();
        }
      }
    } else {
      tm.background(0);
      var hc = Math.floor(cols / 2);
      var hr = Math.floor(rows / 2);
    }

    // Render page separators (before whale — whale overwrites = dissolve-through effect)
    if (sepsDirty) updatePageSeps();
    var cellH = window.innerHeight / rows;   // pixel height of one grid row
    for (var si = 0; si < pageSeps.length; si++) {
      var sep = pageSeps[si];
      var sepRow = Math.round((sep.vpY / window.innerHeight) * rows);
      if (sepRow < 1 || sepRow >= rows - 1) continue;
      var chars = sep.chars, clen = chars.length;

      // Hover detection: mouse within one cell height of separator row
      var hovering = Math.abs(mouseVpY - sep.vpY) < cellH;

      // Normal: 1 row. Hovered: 3 rows (centre full brightness, outer rows at 40%).
      // Three rows ≈ +25% apparent height increase as a soft glow effect.
      var rowOffsets = hovering ? [-1, 0, 1] : [0];
      var rowDims    = hovering ? [0.4, 1.0, 0.4] : [1.0];

      for (var ri = 0; ri < rowOffsets.length; ri++) {
        var dr = rowOffsets[ri];
        var rr = sepRow + dr;
        if (rr < 1 || rr >= rows - 1) continue;
        var dim = rowDims[ri];
        for (var cx = sepColStart; cx < sepColEnd; cx++) {
          var sch = chars[cx % clen];
          if (sch === ' ') continue;
          tm.char(sch);
          tm.charColor(SEP_R * dim, SEP_G * dim, SEP_B * dim);
          tm.cellColor(3 * dim, 1 * dim, 1 * dim);
          tm.push();
          tm.translate(cx - hc, rr - hr);
          tm.rect(1, 1);
          tm.pop();
        }
      }
    }

    // Render whale with camouflage
    if (!isMobile) {
      var artCols = whaleData.cols;
      var spacing = 1.8;
      for (var col = 0; col < artCols.length; col++) {
        var trailPos = Math.floor(col * spacing);
        if (trailPos >= whaleTrail.length) break;
        var pos = whaleTrail[trailPos];
        var fade = 1.0 - (col / artCols.length) * 0.7;

        // Base brightness ramp from WHALE_HIGH (head) to WHALE_BASE (tail)
        var headRatio = 1.0 - (col / artCols.length);
        var bR = WHALE_BASE.r + (WHALE_HIGH.r - WHALE_BASE.r) * headRatio;
        var bG = WHALE_BASE.g + (WHALE_HIGH.g - WHALE_BASE.g) * headRatio;
        var bB = WHALE_BASE.b + (WHALE_HIGH.b - WHALE_BASE.b) * headRatio;

        // Apply fade
        bR *= fade;
        bG *= fade;
        bB *= fade;

        // Get viewport position for this part of the whale
        var vp = gridToViewport(pos.x, pos.y);

        // Blend toward nearby element colors
        var blended = getBlendedColor(vp.x, vp.y, bR, bG, bB);

        for (var p = 0; p < artCols[col].length; p++) {
          var ch = artCols[col][p].ch;
          var vert = artCols[col][p].vert;
          var gx = Math.round(pos.x);
          var gy = Math.round(pos.y) + vert;

          tm.char(ch);
          tm.charColor(blended.r, blended.g, blended.b);
          tm.cellColor(Math.floor(fade * 3), Math.floor(fade * 1), Math.floor(fade * 1));
          tm.push();
          tm.translate(gx - hc, gy - hr);
          tm.rect(1, 1);
          tm.pop();
        }
      }
    }

    // Render read-more separators AFTER whale so they always paint on top
    if (rmSepsDirty) updateReadMoreSeps();
    var rmLen       = RM_TEXT.length;
    var rmTextStart = hc - Math.floor(rmLen / 2);

    for (var rmi = 0; rmi < readMoreSeps.length; rmi++) {
      var rm = readMoreSeps[rmi];
      var rmRow = Math.round((rm.vpY / window.innerHeight) * rows);
      if (rmRow < 1 || rmRow >= rows - 1) continue;

      var rmHov = Math.abs(mouseVpY - rm.vpY) < cellH;
      var rmOff = rmHov ? [-1, 0, 1] : [0];
      var rmDim = rmHov ? [0.4, 1.0, 0.4] : [1.0];

      for (var rri = 0; rri < rmOff.length; rri++) {
        var rrr = rmRow + rmOff[rri];
        if (rrr < 1 || rrr >= rows - 1) continue;
        var rd = rmDim[rri];

        for (var rcx = 1; rcx < cols - 1; rcx++) {
          var ti = rcx - rmTextStart;
          var rch, rbright;
          if (ti >= 0 && ti < rmLen) {
            rch     = RM_TEXT[ti];
            rbright = rd;
          } else {
            rch     = '/';
            rbright = rd * RM_DIM;
          }
          if (rch === ' ') continue;
          tm.char(rch);
          tm.charColor(SEP_R * rbright, SEP_G * rbright, SEP_B * rbright);
          tm.cellColor(3 * rbright, 1 * rbright, 1 * rbright);
          tm.push();
          tm.translate(rcx - hc, rrr - hr);
          tm.rect(1, 1);
          tm.pop();
        }
      }
    }
  });

  tm.windowResized(function () {
    isMobile = window.innerWidth < 768;
    tm.resizeCanvas(window.innerWidth, window.innerHeight);
    init();
  });
})();
