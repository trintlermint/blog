/**
 * Whale module — Lissajous-curve entity, wave physics, colour-proximity camouflage.
 * Exposes WhaleModule with: init / markDirty / drawBackground / drawWhale
 *
 * drawBackground: wave propagation + water render (clears canvas via tm.background).
 * drawWhale:      whale entity only — call after drawBackground and any pre-whale layers.
 *
 * @author trintlermint
 * @link https://github.com/humanbydefinition/textmode.js
 */
var WhaleModule = (function () {
  'use strict';

  var DAMP  = 0.955;
  var CHARS = " .'`~:;-=+*#%&@";

  var WHALE_ART = [
    '       .                   ',
    '      ":"                  ',
    '    ___:____     |"\\/"|      ',
    '  ,\'        `.    \\  /      ',
    '  |  O        \\___/  |      ',
    '~^~^~^~^~^~^~^~^~^~^~^~^~',
  ];

  var WHALE_BASE = { r: 146, g: 74,  b: 65  };  // #924a41
  var WHALE_HIGH = { r: 192, g: 129, b: 121 };  // #c08179

  var TRAIL_LEN          = 80;
  var TAIL_RIPPLE_OFFSET = 30;

  var COLOR_MAP = [
    { sel: 'h1, h3, h4, h5, h6', rgb: [255, 255, 255] },
    { sel: 'h2',                  rgb: [192, 129, 121] },  // #c08179
    { sel: 'a',                   rgb: [73,  58,  165] },  // #493aa5
    { sel: '.slogan',             rgb: [134, 122, 222] },  // #867ade
    { sel: '.alert-success',      rgb: [134, 122, 222] },  // #867ade
    { sel: 'blockquote',          rgb: [58,  58,  58]  },  // #3a3a3a
  ];

  var BLEND_RADIUS = 280;
  var MAX_BLEND    = 0.6;

  var colorTargets = [];
  var whaleData    = null;
  var whaleTrail   = [];
  var dirty        = true;
  var timer        = null;

  function precomputeCols(art) {
    var h    = art.length;
    var w    = Math.max.apply(null, art.map(function (l) { return l.length; }));
    var cols = [];
    for (var fx = 0; fx < w; fx++) {
      var col = [];
      for (var fy = 0; fy < h; fy++) {
        var ch = art[fy][fx];
        if (ch && ch !== ' ') col.push({ ch: ch, vert: fy - Math.floor(h / 2) });
      }
      if (col.length) cols.push(col);
    }
    return { cols: cols, h: h, w: w };
  }

  function updateColorTargets() {
    colorTargets = [];
    for (var m = 0; m < COLOR_MAP.length; m++) {
      var els = document.querySelectorAll(COLOR_MAP[m].sel);
      var rgb = COLOR_MAP[m].rgb;
      for (var e = 0; e < els.length; e++) {
        var r = els[e].getBoundingClientRect();
        if (r.bottom < -BLEND_RADIUS || r.top  > window.innerHeight + BLEND_RADIUS) continue;
        if (r.right  < -BLEND_RADIUS || r.left > window.innerWidth  + BLEND_RADIUS) continue;
        colorTargets.push({
          cx: (r.left + r.right)  / 2,
          cy: (r.top  + r.bottom) / 2,
          rgb: rgb
        });
      }
    }
    dirty = false;
  }

  function getBlendedColor(vpx, vpy, bR, bG, bB) {
    if (!colorTargets.length) return { r: bR, g: bG, b: bB };
    var best = Infinity, bestRGB = null;
    for (var t = 0; t < colorTargets.length; t++) {
      var ct = colorTargets[t];
      var dx = vpx - ct.cx, dy = vpy - ct.cy;
      var d  = Math.sqrt(dx * dx + dy * dy);
      if (d < best) { best = d; bestRGB = ct.rgb; }
    }
    if (!bestRGB || best > BLEND_RADIUS) return { r: bR, g: bG, b: bB };
    var f = (1 - best / BLEND_RADIUS) * MAX_BLEND;
    return {
      r: bR + (bestRGB[0] - bR) * f,
      g: bG + (bestRGB[1] - bG) * f,
      b: bB + (bestRGB[2] - bB) * f
    };
  }

  function drop(state, x, y, force) {
    x = Math.round(x); y = Math.round(y);
    var cols = state.cols, rows = state.rows;
    if (x < 1 || x >= cols - 1 || y < 1 || y >= rows - 1) return;
    var i = y * cols + x;
    state.cur[i] += force;
    if (x > 1)       state.cur[i - 1]    += force * 0.40;
    if (x < cols-2)  state.cur[i + 1]    += force * 0.40;
    if (y > 1)       state.cur[i - cols] += force * 0.35;
    if (y < rows-2)  state.cur[i + cols] += force * 0.35;
  }

  return {
    init: function (tm, state) {
      state.cols = tm.grid.cols;
      state.rows = tm.grid.rows;
      state.hc   = Math.floor(state.cols / 2);
      state.hr   = Math.floor(state.rows / 2);
      state.cur  = new Float32Array(state.cols * state.rows);
      state.prev = new Float32Array(state.cols * state.rows);
      whaleTrail = [];
      whaleData  = precomputeCols(WHALE_ART);
      updateColorTargets();
    },

    markDirty: function () {
      dirty = true;
      if (!timer) {
        timer = setTimeout(function () {
          timer = null;
          updateColorTargets();
        }, 200);
      }
    },

    drawBackground: function (tm, state) {
      if (!state.cur) return;

      var cols = state.cols, rows = state.rows;
      var hc   = state.hc,  hr   = state.hr;
      var time = tm.frameCount / 60;

      if (tm.frameCount % 60 === 0 && dirty) updateColorTargets();

      var sx    = Math.sin(time * 0.7)  * (cols * 0.38) + Math.sin(time * 1.9 + 1.2) * (cols * 0.12);
      var sy    = Math.cos(time * 0.5)  * (rows * 0.35) + Math.cos(time * 1.7 + 0.8) * (rows * 0.10);
      var headX = cols / 2 + sx;
      var headY = rows / 2 + sy;

      whaleTrail.unshift({ x: headX, y: headY });
      if (whaleTrail.length > TRAIL_LEN) whaleTrail.length = TRAIL_LEN;

      if (tm.frameCount % 2 === 0) drop(state, headX, headY, 4);
      if (whaleTrail.length > 10 && tm.frameCount % 4 === 0) {
        var tail = whaleTrail[Math.min(whaleTrail.length - 1, TAIL_RIPPLE_OFFSET)];
        drop(state, tail.x, tail.y, 1.5);
      }

      var cur = state.cur, prev = state.prev, next = prev;
      for (var y = 1; y < rows - 1; y++) {
        var yo = y * cols;
        for (var x = 1; x < cols - 1; x++) {
          var i = yo + x;
          next[i] = ((cur[i-1] + cur[i+1] + cur[i-cols] + cur[i+cols]) * 0.5 - prev[i]) * DAMP;
        }
      }
      for (var yg = rows - 2; yg >= 1; yg--) {
        var ygo = yg * cols;
        for (var xg = 1; xg < cols - 1; xg++) {
          next[ygo + xg] += next[(yg - 1) * cols + xg] * 0.01;
        }
      }
      state.prev = state.cur;
      state.cur  = next;

      tm.background(0);
      for (var yw = 0; yw < rows; yw++) {
        var ywo = yw * cols;
        for (var xw = 0; xw < cols; xw++) {
          var h = state.cur[ywo + xw];
          var a = Math.abs(h);
          if (a < 0.06) continue;
          var ci     = Math.min(Math.floor(a * 2.0), CHARS.length - 1);
          var bright = Math.min(a * 50, 255);
          var wr = Math.min(bright * 0.50, 130);
          var wg = Math.min(bright * 0.30 + 15, 100);
          var wb = Math.min(bright * 0.25 + 10,  80);
          tm.char(CHARS[ci]);
          tm.charColor(wr, wg, wb);
          tm.cellColor(Math.min(a * 3, 12), Math.min(a * 2, 8), Math.min(a, 5));
          tm.push();
          tm.translate(xw - hc, yw - hr);
          tm.rect(1, 1);
          tm.pop();
        }
      }
    },

    drawWhale: function (tm, state) {
      if (!state.cur || !whaleData) return;

      var cols    = state.cols, rows = state.rows;
      var hc      = state.hc,  hr   = state.hr;
      var artCols = whaleData.cols;
      var spacing = 1.8;

      for (var col = 0; col < artCols.length; col++) {
        var trailPos = Math.floor(col * spacing);
        if (trailPos >= whaleTrail.length) break;

        var pos  = whaleTrail[trailPos];
        var fade = 1.0 - (col / artCols.length) * 0.7;
        var hr2  = 1.0 - (col / artCols.length);  // head ratio (1 = head, 0 = tail)

        var bR = WHALE_BASE.r + (WHALE_HIGH.r - WHALE_BASE.r) * hr2;
        var bG = WHALE_BASE.g + (WHALE_HIGH.g - WHALE_BASE.g) * hr2;
        var bB = WHALE_BASE.b + (WHALE_HIGH.b - WHALE_BASE.b) * hr2;
        bR *= fade; bG *= fade; bB *= fade;

        var vpx     = (pos.x / cols) * window.innerWidth;
        var vpy     = (pos.y / rows) * window.innerHeight;
        var blended = getBlendedColor(vpx, vpy, bR, bG, bB);

        for (var p = 0; p < artCols[col].length; p++) {
          var ch   = artCols[col][p].ch;
          var vert = artCols[col][p].vert;
          var gx   = Math.round(pos.x);
          var gy   = Math.round(pos.y) + vert;
          tm.char(ch);
          tm.charColor(blended.r, blended.g, blended.b);
          tm.cellColor(Math.floor(fade * 3), Math.floor(fade), Math.floor(fade));
          tm.push();
          tm.translate(gx - hc, gy - hr);
          tm.rect(1, 1);
          tm.pop();
        }
      }
    }
  };
})();
