/**
 * TikzSimModule — textmode.js physics simulation renderer.
 * Follows the WhaleModule / PageSepModule / GradientModule pattern.
 *
 * Reads .tikz-ascii elements, parses data-tikzsim JSON config,
 * runs physics simulations, and renders ASCII characters within
 * each element's bounding box on the shared textmode.js canvas.
 *
 * @author trintlermint
 */
var TikzSimModule = (function () {
  'use strict';

  var sims = [];
  var dirty = true;

  var DEFAULT_CHARS = " .'`~:;-=+*#%&@";
  var DEFAULT_COLOR = [192, 129, 121];

  // ---- Simulation types -------------------------------------------------------

  function WaveSim(cfg) {
    var params = cfg.params || {};
    this.damping = params.damping || 0.955;
    this.speed = params.speed || 0.5;
    this.sources = params.sources || [];
    this.chars = cfg.chars || DEFAULT_CHARS;
    this.color = cfg.color || DEFAULT_COLOR;
    this.cols = 0;
    this.rows = 0;
    this.cur = null;
    this.prev = null;
    this.frame = 0;
  }

  WaveSim.prototype.resize = function (cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.cur = new Float32Array(cols * rows);
    this.prev = new Float32Array(cols * rows);
  };

  WaveSim.prototype.step = function () {
    var cols = this.cols, rows = this.rows;
    if (!this.cur || cols < 3 || rows < 3) return;

    this.frame++;

    for (var s = 0; s < this.sources.length; s++) {
      var sx = this.sources[s][0], sy = this.sources[s][1];
      if (sx >= 0 && sx < cols && sy >= 0 && sy < rows) {
        this.cur[sy * cols + sx] += Math.sin(this.frame * this.speed * 0.3) * 3;
      }
    }

    if (this.sources.length === 0) {
      var cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
      this.cur[cy * cols + cx] += Math.sin(this.frame * this.speed * 0.3) * 3;
    }

    var next = this.prev;
    for (var y = 1; y < rows - 1; y++) {
      var yo = y * cols;
      for (var x = 1; x < cols - 1; x++) {
        var i = yo + x;
        next[i] = ((this.cur[i - 1] + this.cur[i + 1] +
                     this.cur[i - cols] + this.cur[i + cols]) * 0.5 -
                    this.prev[i]) * this.damping;
      }
    }
    this.prev = this.cur;
    this.cur = next;
  };

  WaveSim.prototype.getHUD = function () {
    return [
      'D=' + this.damping.toFixed(3),
      's=' + this.speed.toFixed(2)
    ];
  };

  WaveSim.prototype.render = function (tm, state, region) {
    var cols = this.cols, rows = this.rows;
    var hc = state.hc, hr = state.hr;
    var chars = this.chars;
    var color = this.color;

    for (var y = 0; y < rows; y++) {
      var yo = y * cols;
      for (var x = 0; x < cols; x++) {
        var h = this.cur[yo + x];
        var a = Math.abs(h);
        if (a < 0.06) continue;
        var ci = Math.min(Math.floor(a * 2.0), chars.length - 1);
        var bright = Math.min(a * 3, 1.0);
        tm.char(chars[ci]);
        tm.charColor(color[0] * bright, color[1] * bright, color[2] * bright);
        tm.cellColor(0, 0, 0);
        tm.push();
        tm.translate(region.colStart + x - hc, region.rowStart + y - hr);
        tm.rect(1, 1);
        tm.pop();
      }
    }
  };

  // ---- Bounce simulation ----

  function BounceSim(cfg) {
    var params = cfg.params || {};
    this.gravity = params.gravity || 0.15;
    this.restitution = params.restitution || 0.8;
    this.ballChar = params.ball_char || 'O';
    this.floorChar = params.floor_char || '=';
    this.traceChar = params.trace_char || '.';
    this.color = cfg.color || DEFAULT_COLOR;
    this.cols = 0;
    this.rows = 0;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.trace = [];
    this.maxTrace = params.max_trace || 60;
  }

  BounceSim.prototype.resize = function (cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.x = Math.floor(cols * 0.2);
    this.y = 2;
    this.vx = 0.3;
    this.vy = 0;
    this.trace = [];
  };

  BounceSim.prototype.step = function () {
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;

    var floor = this.rows - 2;
    if (this.y >= floor) {
      this.y = floor;
      this.vy = -Math.abs(this.vy) * this.restitution;
      var maxV = Math.sqrt(2 * this.gravity * floor) * 0.85;
      if (Math.abs(this.vy) < 0.1) this.vy = -maxV;
    }

    if (this.y < 0) this.y = 0;

    if (this.x >= this.cols - 2) { this.x = this.cols - 3; this.vx = -Math.abs(this.vx); }
    if (this.x <= 1) { this.x = 2; this.vx = Math.abs(this.vx); }

    this.trace.push({ x: Math.round(this.x), y: Math.round(this.y) });
    if (this.trace.length > this.maxTrace) this.trace.shift();
  };

  BounceSim.prototype.getHUD = function () {
    return [
      'g=' + this.gravity.toFixed(2) + ' e=' + this.restitution.toFixed(2),
      'v=' + this.vy.toFixed(2),
      'q=' + Math.max(0, this.rows - 2 - Math.round(this.y)).toFixed(0)
    ];
  };

  BounceSim.prototype.render = function (tm, state, region) {
    var hc = state.hc, hr = state.hr;
    var color = this.color;
    var floor = this.rows - 1;

    for (var fx = 0; fx < this.cols; fx++) {
      tm.char(this.floorChar);
      tm.charColor(color[0] * 0.65, color[1] * 0.65, color[2] * 0.65);
      tm.cellColor(0, 0, 0);
      tm.push();
      tm.translate(region.colStart + fx - hc, region.rowStart + floor - hr);
      tm.rect(1, 1);
      tm.pop();
    }

    for (var t = 0; t < this.trace.length; t++) {
      var fade = (t + 1) / this.trace.length * 0.7;
      tm.char(this.traceChar);
      tm.charColor(color[0] * fade, color[1] * fade, color[2] * fade);
      tm.cellColor(0, 0, 0);
      tm.push();
      tm.translate(region.colStart + this.trace[t].x - hc,
                   region.rowStart + this.trace[t].y - hr);
      tm.rect(1, 1);
      tm.pop();
    }

    var bx = Math.round(this.x), by = Math.round(this.y);
    var ballChars = ['(', this.ballChar, ')'];
    for (var bi = 0; bi < 3; bi++) {
      var bCol = bx - 1 + bi;
      if (bCol < 0 || bCol >= this.cols) continue;
      tm.char(ballChars[bi]);
      tm.charColor(color[0], color[1], color[2]);
      var bgMul = bi === 1 ? 0.12 : 0.06;
      tm.cellColor(Math.floor(color[0] * bgMul), Math.floor(color[1] * bgMul), Math.floor(color[2] * bgMul));
      tm.push();
      tm.translate(region.colStart + bCol - hc, region.rowStart + by - hr);
      tm.rect(1, 1);
      tm.pop();
    }
  };

  // ---- Pendulum simulation ----

  function PendulumSim(cfg) {
    var params = cfg.params || {};
    this.length = params.length || 8;
    this.gravity = params.gravity || 0.5;
    this.damping = params.damping || 0.999;
    this.rodChar = params.rod_char || '|';
    this.bobChar = params.bob_char || 'O';
    this.traceChar = params.trace_char || '.';
    this.pivotChar = params.pivot_char || '+';
    this.color = cfg.color || DEFAULT_COLOR;
    this.cols = 0;
    this.rows = 0;
    this.angle = 0;
    this.angVel = 0;
    this.trace = [];
    this.maxTrace = params.max_trace || 40;
  }

  PendulumSim.prototype.resize = function (cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.angle = Math.PI / 3;
    this.angVel = 0;
    this.trace = [];
  };

  PendulumSim.prototype.step = function () {
    var acc = -(this.gravity / this.length) * Math.sin(this.angle);
    this.angVel += acc;
    this.angVel *= this.damping;
    this.angle += this.angVel;

    var pivotX = Math.floor(this.cols / 2);
    var pivotY = 1;
    var bobX = Math.round(pivotX + Math.sin(this.angle) * this.length);
    var bobY = Math.round(pivotY + Math.cos(this.angle) * this.length);

    this.trace.push({ x: bobX, y: bobY });
    if (this.trace.length > this.maxTrace) this.trace.shift();
  };

  PendulumSim.prototype.getHUD = function () {
    return [
      'l=' + this.length + ' g=' + this.gravity.toFixed(1),
      'th=' + this.angle.toFixed(2),
      'w=' + this.angVel.toFixed(3)
    ];
  };

  PendulumSim.prototype.render = function (tm, state, region) {
    var hc = state.hc, hr = state.hr;
    var color = this.color;
    var pivotX = Math.floor(this.cols / 2);
    var pivotY = 1;
    var bobX = Math.round(pivotX + Math.sin(this.angle) * this.length);
    var bobY = Math.round(pivotY + Math.cos(this.angle) * this.length);

    tm.char(this.pivotChar);
    tm.charColor(color[0], color[1], color[2]);
    tm.cellColor(0, 0, 0);
    tm.push();
    tm.translate(region.colStart + pivotX - hc, region.rowStart + pivotY - hr);
    tm.rect(1, 1);
    tm.pop();

    var dx = bobX - pivotX, dy = bobY - pivotY;
    var steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (var s = 1; s < steps; s++) {
      var rx = Math.round(pivotX + dx * s / steps);
      var ry = Math.round(pivotY + dy * s / steps);
      var rodCh = Math.abs(dx) > Math.abs(dy) * 2 ? '-' :
                  Math.abs(dy) > Math.abs(dx) * 2 ? '|' :
                  (dx > 0) === (dy > 0) ? '\\' : '/';
      tm.char(rodCh);
      tm.charColor(color[0] * 0.8, color[1] * 0.8, color[2] * 0.8);
      tm.cellColor(0, 0, 0);
      tm.push();
      tm.translate(region.colStart + rx - hc, region.rowStart + ry - hr);
      tm.rect(1, 1);
      tm.pop();
    }

    for (var t = 0; t < this.trace.length; t++) {
      var fade = (t + 1) / this.trace.length * 0.65;
      tm.char(this.traceChar);
      tm.charColor(color[0] * fade, color[1] * fade, color[2] * fade);
      tm.cellColor(0, 0, 0);
      tm.push();
      tm.translate(region.colStart + this.trace[t].x - hc,
                   region.rowStart + this.trace[t].y - hr);
      tm.rect(1, 1);
      tm.pop();
    }

    tm.char(this.bobChar);
    tm.charColor(color[0], color[1], color[2]);
    tm.cellColor(Math.floor(color[0] * 0.12), Math.floor(color[1] * 0.12), Math.floor(color[2] * 0.12));
    tm.push();
    tm.translate(region.colStart + bobX - hc, region.rowStart + bobY - hr);
    tm.rect(1, 1);
    tm.pop();
  };

  // ---- Spring simulation ----

  function SpringSim(cfg) {
    var params = cfg.params || {};
    this.stiffness = params.stiffness || 0.05;
    this.dampingCoeff = params.damping || 0.98;
    this.restLength = params.rest_length || 10;
    this.massChar = params.mass_char || '#';
    this.coilChar = params.coil_char || '~';
    this.wallChar = params.wall_char || '|';
    this.color = cfg.color || DEFAULT_COLOR;
    this.cols = 0;
    this.rows = 0;
    this.pos = 0;
    this.vel = 0;
  }

  SpringSim.prototype.resize = function (cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.pos = this.restLength + 5;
    this.vel = 0;
  };

  SpringSim.prototype.step = function () {
    var displacement = this.pos - this.restLength;
    var force = -this.stiffness * displacement;
    this.vel += force;
    this.vel *= this.dampingCoeff;
    this.pos += this.vel;
    if (this.pos < 2) { this.pos = 2; this.vel = Math.abs(this.vel) * 0.8; }
    if (this.pos >= this.cols - 3) { this.pos = this.cols - 4; this.vel = -Math.abs(this.vel) * 0.8; }
  };

  SpringSim.prototype.getHUD = function () {
    return [
      'k=' + this.stiffness.toFixed(2) + ' d=' + this.dampingCoeff.toFixed(2),
      'x=' + this.pos.toFixed(1),
      'v=' + this.vel.toFixed(2)
    ];
  };

  SpringSim.prototype.render = function (tm, state, region) {
    var hc = state.hc, hr = state.hr;
    var color = this.color;
    var midRow = Math.floor(this.rows / 2);
    var massX = Math.round(this.pos);

    tm.char(this.wallChar);
    tm.charColor(color[0] * 0.75, color[1] * 0.75, color[2] * 0.75);
    tm.cellColor(0, 0, 0);
    for (var wy = midRow - 1; wy <= midRow + 1; wy++) {
      tm.push();
      tm.translate(region.colStart - hc, region.rowStart + wy - hr);
      tm.rect(1, 1);
      tm.pop();
    }

    var coilChars = ['-', '/', '~', '\\'];
    for (var cx = 1; cx < massX; cx++) {
      var ch = coilChars[cx % coilChars.length];
      var coilBright = 0.6 + 0.3 * Math.sin(cx * 0.8);
      tm.char(ch);
      tm.charColor(color[0] * coilBright, color[1] * coilBright, color[2] * coilBright);
      tm.cellColor(0, 0, 0);
      tm.push();
      tm.translate(region.colStart + cx - hc, region.rowStart + midRow - hr);
      tm.rect(1, 1);
      tm.pop();
    }

    var massStr = '[M]';
    for (var m = 0; m < massStr.length; m++) {
      tm.char(massStr[m]);
      tm.charColor(color[0], color[1], color[2]);
      tm.cellColor(Math.floor(color[0] * 0.12), Math.floor(color[1] * 0.12), Math.floor(color[2] * 0.12));
      tm.push();
      tm.translate(region.colStart + massX + m - hc, region.rowStart + midRow - hr);
      tm.rect(1, 1);
      tm.pop();
    }
  };

  // ---- Collision simulation ----

  function CollisionSim(cfg) {
    var params = cfg.params || {};
    this.elastic = params.elastic !== false;
    this.color = cfg.color || DEFAULT_COLOR;
    this.color2 = params.color2 || [134, 122, 222];
    this.char1 = params.char1 || 'O';
    this.char2 = params.char2 || 'o';
    this.cols = 0;
    this.rows = 0;
    this.particles = [];
  }

  CollisionSim.prototype.resize = function (cols, rows) {
    this.cols = cols;
    this.rows = rows;
    var midY = Math.floor(rows / 2);
    this.particles = [
      { x: 3, y: midY, vx: 0.4, vy: 0, ch: this.char1, color: this.color, mass: 2 },
      { x: cols - 4, y: midY, vx: -0.2, vy: 0, ch: this.char2, color: this.color2, mass: 1 }
    ];
  };

  CollisionSim.prototype.step = function () {
    var p = this.particles;
    for (var i = 0; i < p.length; i++) {
      p[i].x += p[i].vx;
      p[i].y += p[i].vy;

      if (p[i].x <= 0) { p[i].x = 1; p[i].vx = Math.abs(p[i].vx); }
      if (p[i].x >= this.cols - 1) { p[i].x = this.cols - 2; p[i].vx = -Math.abs(p[i].vx); }
      if (p[i].y <= 0) { p[i].y = 1; p[i].vy = Math.abs(p[i].vy); }
      if (p[i].y >= this.rows - 1) { p[i].y = this.rows - 2; p[i].vy = -Math.abs(p[i].vy); }
    }

    for (var a = 0; a < p.length; a++) {
      for (var b = a + 1; b < p.length; b++) {
        var dx = p[b].x - p[a].x, dy = p[b].y - p[a].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 2) {
          if (this.elastic) {
            var m1 = p[a].mass, m2 = p[b].mass;
            var totalMass = m1 + m2;
            var v1x = p[a].vx, v1y = p[a].vy;
            var v2x = p[b].vx, v2y = p[b].vy;
            p[a].vx = (v1x * (m1 - m2) + 2 * m2 * v2x) / totalMass;
            p[a].vy = (v1y * (m1 - m2) + 2 * m2 * v2y) / totalMass;
            p[b].vx = (v2x * (m2 - m1) + 2 * m1 * v1x) / totalMass;
            p[b].vy = (v2y * (m2 - m1) + 2 * m1 * v1y) / totalMass;
          } else {
            var totalM = p[a].mass + p[b].mass;
            var nvx = (p[a].vx * p[a].mass + p[b].vx * p[b].mass) / totalM;
            var nvy = (p[a].vy * p[a].mass + p[b].vy * p[b].mass) / totalM;
            p[a].vx = nvx; p[a].vy = nvy;
            p[b].vx = nvx; p[b].vy = nvy;
          }
          var overlap = 2 - dist;
          if (dist > 0) {
            p[a].x -= dx / dist * overlap * 0.5;
            p[a].y -= dy / dist * overlap * 0.5;
            p[b].x += dx / dist * overlap * 0.5;
            p[b].y += dy / dist * overlap * 0.5;
          }
        }
      }
    }
  };

  CollisionSim.prototype.getHUD = function () {
    var p = this.particles;
    return [
      this.elastic ? 'elastic' : 'inelastic',
      'v1=' + p[0].vx.toFixed(2),
      'v2=' + p[1].vx.toFixed(2)
    ];
  };

  CollisionSim.prototype.render = function (tm, state, region) {
    var hc = state.hc, hr = state.hr;
    var p = this.particles;

    for (var i = 0; i < p.length; i++) {
      var px = Math.round(p[i].x), py = Math.round(p[i].y);
      var c = p[i].color;

      var arrowCh = p[i].vx > 0.1 ? '>' : p[i].vx < -0.1 ? '<' : '-';
      tm.char(arrowCh);
      tm.charColor(c[0] * 0.65, c[1] * 0.65, c[2] * 0.65);
      tm.cellColor(0, 0, 0);
      tm.push();
      tm.translate(region.colStart + px + (p[i].vx > 0 ? 1 : -1) - hc,
                   region.rowStart + py - hr);
      tm.rect(1, 1);
      tm.pop();

      tm.char(p[i].ch);
      tm.charColor(c[0], c[1], c[2]);
      tm.cellColor(Math.floor(c[0] * 0.05), Math.floor(c[1] * 0.05), Math.floor(c[2] * 0.05));
      tm.push();
      tm.translate(region.colStart + px - hc, region.rowStart + py - hr);
      tm.rect(1, 1);
      tm.pop();
    }
  };

  // ---- Chatter simulation ----

  function ChatterSim(cfg) {
    var params = cfg.params || {};
    this.surfaceRatio = params.surface_y || 0.5;
    this.amplitude = params.amplitude || 0.3;
    this.frequency = params.frequency || 2.0;
    this.decay = params.decay || 0.98;
    this.color = cfg.color || DEFAULT_COLOR;
    this.cols = 0;
    this.rows = 0;
    this.frame = 0;
    this.trail = [];
    this.maxTrail = params.max_trail || 60;
  }

  ChatterSim.prototype.resize = function (cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.trail = [];
    this.frame = 0;
  };

  ChatterSim.prototype.step = function () {
    this.frame++;
    var surfaceRow = Math.floor(this.rows * this.surfaceRatio);
    var amp = this.amplitude * this.rows * Math.pow(this.decay, this.frame * 0.05);
    var y = surfaceRow + amp * Math.sin(this.frame * this.frequency * 0.1);
    var x = this.frame % this.cols;
    this.trail.push({ x: x, y: Math.round(y) });
    if (this.trail.length > this.maxTrail) this.trail.shift();
  };

  ChatterSim.prototype.getHUD = function () {
    var surfaceRow = Math.floor(this.rows * this.surfaceRatio);
    var cur = this.trail.length > 0 ? this.trail[this.trail.length - 1] : { y: surfaceRow };
    var dist = Math.abs(cur.y - surfaceRow);
    return [
      'w=' + this.frequency.toFixed(1) + ' d=' + this.decay.toFixed(2),
      'y=' + (cur.y - surfaceRow).toFixed(0),
      'D=' + dist.toFixed(0)
    ];
  };

  ChatterSim.prototype.render = function (tm, state, region) {
    var hc = state.hc, hr = state.hr;
    var color = this.color;
    var surfaceRow = Math.floor(this.rows * this.surfaceRatio);

    for (var sx = 0; sx < this.cols; sx++) {
      var ch = sx % 3 === 0 ? '-' : ' ';
      if (ch === ' ') continue;
      tm.char(ch);
      tm.charColor(color[0] * 0.35, color[1] * 0.35, color[2] * 0.35);
      tm.cellColor(0, 0, 0);
      tm.push();
      tm.translate(region.colStart + sx - hc, region.rowStart + surfaceRow - hr);
      tm.rect(1, 1);
      tm.pop();
    }

    for (var t = 0; t < this.trail.length; t++) {
      var fade = (t + 1) / this.trail.length;
      var pt = this.trail[t];
      tm.char('.');
      tm.charColor(color[0] * fade * 0.6, color[1] * fade * 0.6, color[2] * fade * 0.6);
      tm.cellColor(0, 0, 0);
      tm.push();
      tm.translate(region.colStart + pt.x - hc, region.rowStart + pt.y - hr);
      tm.rect(1, 1);
      tm.pop();
    }

    if (this.trail.length > 0) {
      var cur = this.trail[this.trail.length - 1];
      tm.char('*');
      tm.charColor(color[0], color[1], color[2]);
      tm.cellColor(Math.floor(color[0] * 0.12), Math.floor(color[1] * 0.12), Math.floor(color[2] * 0.12));
      tm.push();
      tm.translate(region.colStart + cur.x - hc, region.rowStart + cur.y - hr);
      tm.rect(1, 1);
      tm.pop();
    }
  };

  // ---- Complementarity simulation ----

  function ComplementaritySim(cfg) {
    var params = cfg.params || {};
    this.gravity = params.gravity || 0.1;
    this.restitution = params.restitution || 0.6;
    this.speed = params.speed || 1;
    this.color = cfg.color || DEFAULT_COLOR;
    this.cols = 0;
    this.rows = 0;
    this.q = 0;
    this.v = 0;
    this.lambda = 0;
    this.lambdaDecay = 0;
    this.frame = 0;
  }

  ComplementaritySim.prototype.resize = function (cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.q = rows * 0.6;
    this.v = 0;
    this.lambda = 0;
    this.lambdaDecay = 0;
  };

  ComplementaritySim.prototype.step = function () {
    this.frame++;
    var skip = Math.round(1 / this.speed);
    if (skip > 1 && this.frame % skip !== 0) return;

    this.v += this.gravity;
    this.q -= this.v;

    var maxHeight = this.rows - 3;
    if (this.q <= 1) {
      this.lambda = Math.abs(this.v) * 15;
      this.lambdaDecay = this.lambda;
      this.v = -Math.abs(this.v) * this.restitution;
      this.q = 1;
      var maxV = Math.sqrt(2 * this.gravity * maxHeight) * 0.85;
      if (Math.abs(this.v) < 0.05) { this.v = -maxV; this.q = maxHeight * 0.4; }
    } else {
      this.lambda = 0;
    }

    if (this.q > maxHeight) this.q = maxHeight;

    if (this.lambdaDecay > 0.1) this.lambdaDecay *= 0.85;
    else this.lambdaDecay = 0;
  };

  ComplementaritySim.prototype.getHUD = function () {
    return [
      'g=' + this.gravity.toFixed(2) + ' e=' + this.restitution.toFixed(1),
      'q=' + Math.max(0, this.q).toFixed(1),
      'L=' + this.lambda.toFixed(2)
    ];
  };

  ComplementaritySim.prototype.render = function (tm, state, region) {
    var hc = state.hc, hr = state.hr;
    var color = this.color;
    var midCol = Math.floor(this.cols * 0.55);
    var floor = this.rows - 1;
    var barCol = Math.floor(this.cols * 0.75);

    for (var fx = 0; fx < midCol - 2; fx++) {
      tm.char('=');
      tm.charColor(color[0] * 0.5, color[1] * 0.5, color[2] * 0.5);
      tm.cellColor(0, 0, 0);
      tm.push();
      tm.translate(region.colStart + fx - hc, region.rowStart + floor - hr);
      tm.rect(1, 1);
      tm.pop();
    }

    var ballY = Math.round(this.rows - 1 - Math.max(0, this.q));
    if (ballY >= 0 && ballY < this.rows) {
      var ballX = Math.floor(midCol * 0.4);
      var bChars = ['(', 'O', ')'];
      for (var bi = 0; bi < 3; bi++) {
        var bCol = ballX - 1 + bi;
        if (bCol < 0 || bCol >= midCol - 2) continue;
        tm.char(bChars[bi]);
        tm.charColor(color[0], color[1], color[2]);
        var bgMul = bi === 1 ? 0.12 : 0.06;
        tm.cellColor(Math.floor(color[0] * bgMul), Math.floor(color[1] * bgMul), Math.floor(color[2] * bgMul));
        tm.push();
        tm.translate(region.colStart + bCol - hc, region.rowStart + ballY - hr);
        tm.rect(1, 1);
        tm.pop();
      }
    }

    var perpRow = Math.floor(this.rows * 0.5);
    var perpStr = 'q' + (this.lambda > 0.1 ? '=' : '>') + '0';
    for (var pi = 0; pi < perpStr.length; pi++) {
      tm.char(perpStr[pi]);
      tm.charColor(color[0] * 0.5, color[1] * 0.5, color[2] * 0.5);
      tm.cellColor(0, 0, 0);
      tm.push();
      tm.translate(region.colStart + midCol - 1 + pi - hc, region.rowStart + perpRow - hr);
      tm.rect(1, 1);
      tm.pop();
    }

    var barHeight = Math.min(Math.round(this.lambdaDecay), this.rows - 2);
    var barChars = '#@+-.';
    for (var by = 0; by < barHeight; by++) {
      var ci = Math.min(by, barChars.length - 1);
      var bBright = 1.0 - by / Math.max(barHeight, 1) * 0.6;
      for (var bw = -1; bw <= 1; bw++) {
        tm.char(barChars[ci]);
        tm.charColor(color[0] * bBright, color[1] * bBright, color[2] * bBright);
        tm.cellColor(0, 0, 0);
        tm.push();
        tm.translate(region.colStart + barCol + bw - hc, region.rowStart + (floor - 1 - by) - hr);
        tm.rect(1, 1);
        tm.pop();
      }
    }

    var lblStr = 'L';
    tm.char(lblStr);
    tm.charColor(color[0] * 0.6, color[1] * 0.6, color[2] * 0.6);
    tm.cellColor(0, 0, 0);
    tm.push();
    tm.translate(region.colStart + barCol - hc, region.rowStart + floor - hr);
    tm.rect(1, 1);
    tm.pop();
  };

  // ---- Relay simulation ----

  function RelaySim(cfg) {
    var params = cfg.params || {};
    this.threshold = params.threshold || 0.0;
    this.frequency = params.frequency || 0.3;
    this.onChar = params.on_char || '+';
    this.offChar = params.off_char || '-';
    this.color = cfg.color || DEFAULT_COLOR;
    this.color2 = params.color2 || [134, 122, 222];
    this.cols = 0;
    this.rows = 0;
    this.phase = 0;
    this.buffer = [];
  }

  RelaySim.prototype.resize = function (cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.buffer = [];
    this.phase = 0;
  };

  RelaySim.prototype.step = function () {
    this.phase += this.frequency * 0.05;
    var input = Math.sin(this.phase) + 0.3 * Math.sin(this.phase * 2.7);
    var output = input > this.threshold ? 1 : -1;
    this.buffer.push({ input: input, output: output });
    if (this.buffer.length > this.cols) this.buffer.shift();
  };

  RelaySim.prototype.getHUD = function () {
    var last = this.buffer.length > 0 ? this.buffer[this.buffer.length - 1] : { input: 0, output: 0 };
    return [
      'f=' + this.frequency.toFixed(2) + ' th=' + this.threshold.toFixed(1),
      'in=' + last.input.toFixed(2),
      'out=' + (last.output > 0 ? '+1' : '-1')
    ];
  };

  RelaySim.prototype.render = function (tm, state, region) {
    var hc = state.hc, hr = state.hr;
    var color = this.color;
    var color2 = this.color2;
    var inputZone = Math.floor(this.rows * 0.45);
    var threshRow = inputZone;
    var outputZone = this.rows - 1;

    for (var tx = 0; tx < this.cols; tx++) {
      var ch = tx % 4 === 0 ? '-' : ' ';
      if (ch === ' ') continue;
      tm.char(ch);
      tm.charColor(color[0] * 0.3, color[1] * 0.3, color[2] * 0.3);
      tm.cellColor(0, 0, 0);
      tm.push();
      tm.translate(region.colStart + tx - hc, region.rowStart + threshRow - hr);
      tm.rect(1, 1);
      tm.pop();
    }

    for (var bi = 0; bi < this.buffer.length; bi++) {
      var entry = this.buffer[bi];
      var bx = this.cols - this.buffer.length + bi;

      var inputRow = Math.round(threshRow - entry.input * (inputZone * 0.8));
      inputRow = Math.max(0, Math.min(this.rows - 1, inputRow));
      var iFade = (bi + 1) / this.buffer.length;
      tm.char('~');
      tm.charColor(color[0] * iFade, color[1] * iFade, color[2] * iFade);
      tm.cellColor(0, 0, 0);
      tm.push();
      tm.translate(region.colStart + bx - hc, region.rowStart + inputRow - hr);
      tm.rect(1, 1);
      tm.pop();

      var outRow = entry.output > 0 ?
        Math.floor(threshRow + 2) :
        Math.floor(outputZone - 1);
      var outCh = entry.output > 0 ? this.onChar : this.offChar;
      var outColor = entry.output > 0 ? color2 : color;
      tm.char(outCh);
      tm.charColor(outColor[0] * iFade * 0.8, outColor[1] * iFade * 0.8, outColor[2] * iFade * 0.8);
      tm.cellColor(0, 0, 0);
      tm.push();
      tm.translate(region.colStart + bx - hc, region.rowStart + outRow - hr);
      tm.rect(1, 1);
      tm.pop();
    }
  };

  // ---- Type registry ----

  var TYPES = {
    wave: WaveSim,
    bounce: BounceSim,
    pendulum: PendulumSim,
    spring: SpringSim,
    collision: CollisionSim,
    chatter: ChatterSim,
    complementarity: ComplementaritySim,
    relay: RelaySim
  };

  // ---- Module API ----

  function queryElements() {
    var els = document.querySelectorAll('.tikz-ascii');
    var newSims = [];
    for (var i = 0; i < els.length; i++) {
      var raw = els[i].getAttribute('data-tikzsim');
      if (!raw) continue;
      var existing = null;
      for (var j = 0; j < sims.length; j++) {
        if (sims[j].el === els[i]) { existing = sims[j]; break; }
      }
      if (existing) {
        newSims.push(existing);
      } else {
        try {
          var cfg = JSON.parse(raw);
          var Ctor = TYPES[cfg.type];
          if (!Ctor) continue;
          var sim = new Ctor(cfg);
          newSims.push({ el: els[i], sim: sim, ready: false });
          var loading = els[i].querySelector('.tikz-sim-loading');
          if (loading) loading.remove();
        } catch (e) {}
      }
    }
    sims = newSims;
    dirty = false;
  }

  return {
    init: function (tm, state) {
      if (sims.length === 0) queryElements();
      for (var i = sims.length - 1; i >= 0; i--) {
        if (!sims[i].el.isConnected) { sims.splice(i, 1); continue; }
        var r = sims[i].el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        var simCols = Math.max(Math.round((r.width / window.innerWidth) * state.cols), 4);
        var simRows = Math.max(Math.round((r.height / window.innerHeight) * state.rows), 4);
        sims[i].sim.resize(simCols, simRows);
        sims[i].ready = true;
      }
    },

    markDirty: function () {
      dirty = true;
    },

    draw: function (tm, state) {
      if (dirty) queryElements();

      for (var i = sims.length - 1; i >= 0; i--) {
        var entry = sims[i];
        if (!entry.el.isConnected) { sims.splice(i, 1); continue; }
        var r = entry.el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.bottom < 0 || r.top > window.innerHeight) continue;

        var simCols = Math.max(Math.round((r.width / window.innerWidth) * state.cols), 4);
        var simRows = Math.max(Math.round((r.height / window.innerHeight) * state.rows), 4);
        var colStart = Math.round((r.left / window.innerWidth) * state.cols);
        var rowStart = Math.round((r.top / window.innerHeight) * state.rows);

        if (!entry.ready || entry.sim.cols !== simCols || entry.sim.rows !== simRows) {
          entry.sim.resize(simCols, simRows);
          entry.ready = true;
        }

        entry.sim.step();
        entry.sim.render(tm, state, { colStart: colStart, rowStart: rowStart });

        var hc = state.hc, hr = state.hr;

        if (entry.sim.getHUD) {
          var hud = entry.sim.getHUD();
          var hudColor = entry.sim.color || DEFAULT_COLOR;
          for (var h = 0; h < hud.length; h++) {
            var line = hud[h];
            for (var c = 0; c < line.length; c++) {
              tm.char(line.charAt(c));
              tm.charColor(hudColor[0] * 0.4, hudColor[1] * 0.4, hudColor[2] * 0.4);
              tm.cellColor(0, 0, 0);
              tm.push();
              tm.translate(colStart + 1 + c - hc, rowStart + 1 + h - hr);
              tm.rect(1, 1);
              tm.pop();
            }
          }
        }

        var titleEl = entry.el.querySelector('.tikz-title');
        if (titleEl) {
          var titleText = titleEl.textContent || '';
          if (titleText.length > 0) {
            var titleRow = rowStart + simRows - 1;
            var titleStart = colStart + Math.floor((simCols - titleText.length) / 2);
            var tc = entry.sim.color || DEFAULT_COLOR;
            for (var ti = 0; ti < titleText.length; ti++) {
              tm.char(titleText.charAt(ti));
              tm.charColor(tc[0] * 0.5, tc[1] * 0.5, tc[2] * 0.5);
              tm.cellColor(0, 0, 0);
              tm.push();
              tm.translate(titleStart + ti - hc, titleRow - hr);
              tm.rect(1, 1);
              tm.pop();
            }
          }
        }
      }
    }
  };
})();
