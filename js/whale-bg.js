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

  // Throttled scroll/resize update
  var targetsDirty = true;
  var targetsTimer = null;
  function scheduleTargetUpdate() {
    targetsDirty = true;
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

    // Render whale with camouflage
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
  });

  tm.windowResized(function () {
    tm.resizeCanvas(window.innerWidth, window.innerHeight);
    init();
  });
})();
