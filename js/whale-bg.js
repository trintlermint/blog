/**
 * Textmode background coordinator.
 *
 * Requires (loaded before this file):
 *   textmode.umd.js   — textmode.js runtime
 *   whale.js          — WhaleModule   (wave physics + whale entity)
 *   page-sep.js       — PageSepModule (page & read-more separators)
 *   gradient.js       — GradientModule (description box gradient)
 *
 * Draw order each frame:
 *   1. WhaleModule.drawBackground  — wave propagation + water (clears canvas)
 *   2. PageSepModule.drawPageSeps  — page seps (whale overwrites = dissolve effect)
 *   3. GradientModule.draw         — ASCII gradient below .description (whale swims through)
 *   4. WhaleModule.drawWhale       — whale entity
 *   5. PageSepModule.drawRmSeps    — read-more seps (always on top)
 *
 * @author trintlermint
 * @link https://github.com/humanbydefinition/textmode.js
 */
(function () {
  if (typeof textmode       === 'undefined') return;
  if (typeof WhaleModule    === 'undefined') return;
  if (typeof PageSepModule  === 'undefined') return;
  if (typeof GradientModule === 'undefined') return;

  var tm = textmode.create({
    width:     window.innerWidth,
    height:    window.innerHeight,
    fontSize:  16,
    frameRate: 60,
  });

  var canvas = null;
  (function () {
    var canvases = document.querySelectorAll('canvas');
    for (var i = canvases.length - 1; i >= 0; i--) {
      canvas = canvases[i];
      canvas.style.position      = 'fixed';
      canvas.style.top           = '0';
      canvas.style.left          = '0';
      canvas.style.zIndex        = '-1';
      canvas.style.pointerEvents = 'none';
      break;
    }
  })();

  var contextLost = false;
  if (canvas) {
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      contextLost = true;
    });
    canvas.addEventListener('webglcontextrestored', function () {
      contextLost = false;
      WhaleModule.init(tm, state);
      PageSepModule.init(tm, state);
      GradientModule.init(tm, state);
      if (typeof TikzSimModule !== 'undefined') TikzSimModule.init(tm, state);
    });
  }

  var state = {
    cols: 0, rows: 0,
    hc:   0, hr:   0,
    cur:  null, prev: null,
    mouseVpY: -9999,
  };

  document.addEventListener('mousemove', function (e) {
    state.mouseVpY = e.clientY;
  }, { passive: true });

  function scheduleUpdate() {
    WhaleModule.markDirty();
    PageSepModule.markDirty();
    GradientModule.markDirty();
    if (typeof TikzSimModule !== 'undefined') TikzSimModule.markDirty();
  }
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate, { passive: true });

  tm.setup(function () {
    WhaleModule.init(tm, state);
    PageSepModule.init(tm, state);
    GradientModule.init(tm, state);
    if (typeof TikzSimModule !== 'undefined') TikzSimModule.init(tm, state);

    setTimeout(function () {
      var cover = document.getElementById('whale-cover');
      if (cover) {
        cover.classList.add('fade-out');
        setTimeout(function () { cover.remove(); }, 600);
      }
    }, 1000);
  });

  var MOBILE_BREAKPOINT = 768;
  var isMobile = window.innerWidth < MOBILE_BREAKPOINT;
  var frameCount = 0;

  tm.draw(function () {
    if (contextLost) return;
    if (isMobile && (++frameCount & 1)) return;

    if (isMobile) {
      tm.background(0);
      PageSepModule.drawPageSeps(tm, state);
      GradientModule.draw(tm, state);
      if (typeof TikzSimModule !== 'undefined') TikzSimModule.draw(tm, state);
      PageSepModule.drawRmSeps(tm, state);
      if (typeof NotFoundModule !== 'undefined') NotFoundModule.draw(tm, state);
      return;
    }

    tm.background(0);
    PageSepModule.drawPageSeps(tm, state);
    GradientModule.draw(tm, state);
    if (typeof TikzSimModule !== 'undefined') TikzSimModule.draw(tm, state);
    PageSepModule.drawRmSeps(tm, state);
    if (typeof NotFoundModule !== 'undefined') NotFoundModule.draw(tm, state);
  });

  var resizeTimer = null;
  tm.windowResized(function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = null;
      tm.resizeCanvas(window.innerWidth, window.innerHeight);
      WhaleModule.init(tm, state);
      PageSepModule.init(tm, state);
      GradientModule.init(tm, state);
      if (typeof TikzSimModule !== 'undefined') TikzSimModule.init(tm, state);
    }, 150);
  });
})();
