/**
 * Page-separator module — draws .page-sep and .read-more-sep markers on the canvas.
 * Exposes PageSepModule with: init / markDirty / drawPageSeps / drawRmSeps
 *
 * drawPageSeps: call BEFORE the whale so the whale overwrites it (dissolve effect).
 * drawRmSeps:   call AFTER  the whale so the bar always paints on top.
 *
 * @author trintlermint
 */
var PageSepModule = (function () {
  'use strict';

  // Separator colour: #924a41 dimmed to 68%
  var SEP_R = Math.round(146 * 0.68);  // 99
  var SEP_G = Math.round(74  * 0.68);  // 50
  var SEP_B = Math.round(65  * 0.68);  // 44

  var RM_TEXT = '/// :: READ MORE :: ///';
  var RM_DIM  = 0.55;  // fill-slash brightness relative to RM_R/G/B

  // Read-more separator uses a brighter base (#c08179) than the page-sep dimmed colour
  var RM_R = 192, RM_G = 129, RM_B = 121;

  var pageSeps    = [];
  var readMoreSeps = [];
  var sepColStart = 0, sepColEnd = 0;
  var pageDirty   = true;
  var rmDirty     = true;

  // ---- helpers ----------------------------------------------------------------

  function updatePageSeps(state) {
    pageSeps = [];
    var els = document.querySelectorAll('.page-sep');
    if (els.length) {
      sepColStart = 1;
      sepColEnd   = state.cols - 1;
      for (var i = 0; i < els.length; i++) {
        var r = els[i].getBoundingClientRect();
        pageSeps.push({
          chars: els[i].getAttribute('data-chars') || '---://-',
          vpY:   r.top + r.height / 2
        });
      }
    }
    pageDirty = false;
  }

  function updateReadMoreSeps(state) {
    readMoreSeps = [];
    var els = document.querySelectorAll('.read-more-sep');
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      readMoreSeps.push({ vpY: r.top + r.height / 2 });
    }
    rmDirty = false;
  }

  // ---- public API -------------------------------------------------------------

  return {
    init: function (tm, state) {
      sepColEnd = state.cols - 1;

      // Wire click / touch / keyboard handlers onto read-more elements
      var els = document.querySelectorAll('.read-more-sep');
      for (var i = 0; i < els.length; i++) {
        (function (el) {
          var href = el.getAttribute('data-href');
          function go() { window.location.href = href; }
          el.addEventListener('click', go);
          el.addEventListener('touchstart', function (e) {
            e.preventDefault(); go();
          }, { passive: false });
          el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') go();
          });
        })(els[i]);
      }

      updatePageSeps(state);
      updateReadMoreSeps(state);
    },

    markDirty: function () {
      pageDirty = true;
      rmDirty   = true;
    },

    // Page separators — call BEFORE whale draw.
    drawPageSeps: function (tm, state) {
      if (pageDirty) updatePageSeps(state);

      var rows     = state.rows;
      var hc       = state.hc,  hr = state.hr;
      var cellH    = window.innerHeight / rows;
      var mouseVpY = state.mouseVpY;

      for (var si = 0; si < pageSeps.length; si++) {
        var sep    = pageSeps[si];
        var sepRow = Math.round((sep.vpY / window.innerHeight) * rows);
        if (sepRow < 1 || sepRow >= rows - 1) continue;

        var chars    = sep.chars, clen = chars.length;
        var hovering = Math.abs(mouseVpY - sep.vpY) < cellH;
        var rowOff   = hovering ? [-1, 0, 1] : [0];
        var rowDim   = hovering ? [0.4, 1.0, 0.4] : [1.0];

        for (var ri = 0; ri < rowOff.length; ri++) {
          var rr  = sepRow + rowOff[ri];
          if (rr < 1 || rr >= rows - 1) continue;
          var dim = rowDim[ri];
          for (var cx = sepColStart; cx < sepColEnd; cx++) {
            var ch = chars[cx % clen];
            if (ch === ' ') continue;
            tm.char(ch);
            tm.charColor(SEP_R * dim, SEP_G * dim, SEP_B * dim);
            tm.cellColor(3 * dim, 1 * dim, 1 * dim);
            tm.push();
            tm.translate(cx - hc, rr - hr);
            tm.rect(1, 1);
            tm.pop();
          }
        }
      }
    },

    // Read-more separators — call AFTER whale draw so they always render on top.
    drawRmSeps: function (tm, state) {
      if (rmDirty) updateReadMoreSeps(state);

      var cols     = state.cols, rows = state.rows;
      var hc       = state.hc,  hr   = state.hr;
      var cellH    = window.innerHeight / rows;
      var mouseVpY = state.mouseVpY;
      var rmLen    = RM_TEXT.length;
      var rmStart  = hc - Math.floor(rmLen / 2);

      for (var rmi = 0; rmi < readMoreSeps.length; rmi++) {
        var rm    = readMoreSeps[rmi];
        var rmRow = Math.round((rm.vpY / window.innerHeight) * rows);
        if (rmRow < 1 || rmRow >= rows - 1) continue;

        var rmHov = Math.abs(mouseVpY - rm.vpY) < cellH;
        var rmOff = rmHov ? [-1, 0, 1] : [0];
        var rmDim = rmHov ? [0.4, 1.0, 0.4] : [1.0];

        for (var rri = 0; rri < rmOff.length; rri++) {
          var rrr = rmRow + rmOff[rri];
          if (rrr < 1 || rrr >= rows - 1) continue;
          var rd  = rmDim[rri];

          for (var rcx = 1; rcx < cols - 1; rcx++) {
            var ti  = rcx - rmStart;
            var rch, bright;
            if (ti >= 0 && ti < rmLen) { rch = RM_TEXT[ti]; bright = rd; }
            else                        { rch = '/';          bright = rd * RM_DIM; }
            if (rch === ' ') continue;
            tm.char(rch);
            tm.charColor(RM_R * bright, RM_G * bright, RM_B * bright);
            tm.cellColor(3 * bright, 1 * bright, 1 * bright);
            tm.push();
            tm.translate(rcx - hc, rrr - hr);
            tm.rect(1, 1);
            tm.pop();
          }
        }
      }
    }
  };
})();
