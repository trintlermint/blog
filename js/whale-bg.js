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

  // Fix canvas as background behind all page content
  (function () {
    var canvases = document.querySelectorAll('canvas');
    for (var i = canvases.length - 1; i >= 0; i--) {
      var c = canvases[i];
      c.style.position      = 'fixed';
      c.style.top           = '0';
      c.style.left          = '0';
      c.style.zIndex        = '-1';
      c.style.pointerEvents = 'none';
      break;
    }
  })();

  // Shared state — grid dimensions and wave arrays (owned by WhaleModule.init)
  var state = {
    cols: 0, rows: 0,
    hc:   0, hr:   0,
    cur:  null, prev: null,
    mouseVpY: -9999,
  };

  // Mouse Y for separator hover detection
  document.addEventListener('mousemove', function (e) {
    state.mouseVpY = e.clientY;
  }, { passive: true });

  // Scroll / resize: notify all modules to refresh element positions
  function scheduleUpdate() {
    WhaleModule.markDirty();
    PageSepModule.markDirty();
    GradientModule.markDirty();
    if (typeof TikzSimModule !== 'undefined') TikzSimModule.markDirty();
  }
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate, { passive: true });

  // ---- lifecycle --------------------------------------------------------------

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

  var MOBILE_BREAKPOINT = 768;  // px — matches Bootstrap sm breakpoint

  tm.draw(function () {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      // Mobile: skip wave physics and whale entirely, just clear the canvas
      tm.background(0);
      PageSepModule.drawPageSeps(tm, state);
      GradientModule.draw(tm, state);
      if (typeof TikzSimModule !== 'undefined') TikzSimModule.draw(tm, state);
      PageSepModule.drawRmSeps(tm, state);
      if (typeof NotFoundModule !== 'undefined') NotFoundModule.draw(tm, state);  // 404 page only
      return;
    }

    tm.background(0);                         // clear canvas (whale disabled)
    PageSepModule.drawPageSeps(tm, state);   // page seps   (before whale)
    GradientModule.draw(tm, state);          // desc gradient (before whale)
    if (typeof TikzSimModule !== 'undefined') TikzSimModule.draw(tm, state);
    PageSepModule.drawRmSeps(tm, state);     // read-more seps (always on top)
    if (typeof NotFoundModule !== 'undefined') NotFoundModule.draw(tm, state);  // 404 page only
  });

  tm.windowResized(function () {
    tm.resizeCanvas(window.innerWidth, window.innerHeight);
    WhaleModule.init(tm, state);
    PageSepModule.init(tm, state);
    GradientModule.init(tm, state);
    if (typeof TikzSimModule !== 'undefined') TikzSimModule.init(tm, state);
  });
})();
