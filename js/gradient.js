/**
 * Gradient module — renders a descending ASCII character gradient below .description boxes.
 * Exposes GradientModule with: init / markDirty / draw
 *
 * The gradient uses chars #  @  +  -  , (dense→sparse, top→bottom) in the tag-cloud
 * colour palette (#c08179 fading to black), giving the description box a "bleeding edge"
 * into the canvas background.
 *
 * Draw this BEFORE the whale so the whale can swim through the gradient.
 *
 * @author trintlermint
 */
var GradientModule = (function () {
  'use strict';

  // Dense → sparse characters matching the user's request
  var GRAD_CHARS = ['#', '@', '+', '-', ','];

  // Tag-cloud colour: #c08179
  var BASE_R = 192, BASE_G = 129, BASE_B = 121;

  // Cache DOM refs so we can call getBoundingClientRect every frame cheaply
  var descNodes = [];

  function refreshNodes() {
    descNodes = Array.prototype.slice.call(document.querySelectorAll('.alert.description'));
  }

  return {
    init: function (tm, state) {
      refreshNodes();
    },

    markDirty: function () {
      // Re-query DOM nodes on resize (elements may be added/removed)
      refreshNodes();
    },

    // Renders gradient rows below each .description element.
    // Position is read every frame via getBoundingClientRect — truly sticky.
    // Call between drawBackground and drawWhale so the whale swims through it.
    draw: function (tm, state) {
      if (!descNodes.length) return;

      var cols    = state.cols, rows = state.rows;
      var hc      = state.hc,  hr   = state.hr;
      var numRows = GRAD_CHARS.length;

      for (var d = 0; d < descNodes.length; d++) {
        var r = descNodes[d].getBoundingClientRect();

        // Skip entirely when scrolled off-screen
        if (r.bottom < 0 || r.top > window.innerHeight) continue;

        var startRow = Math.round((r.bottom / window.innerHeight) * rows);
        // Inset by 1 col each side to align with the description's inner padding
        var colStart = Math.round((r.left   / window.innerWidth)  * cols) + 1;
        var colEnd   = Math.round(((r.left + r.width) / window.innerWidth) * cols) - 1;

        for (var gr = 0; gr < numRows; gr++) {
          var row = startRow + gr;
          if (row < 1 || row >= rows - 1) continue;

          // t: 0 = densest row (top), 1 = sparsest row (bottom)
          var t      = gr / (numRows - 1);
          var bright = 1.0 - t;
          var ch     = GRAD_CHARS[gr];

          for (var cx = colStart; cx < colEnd; cx++) {
            tm.char(ch);
            tm.charColor(BASE_R * bright, BASE_G * bright, BASE_B * bright);
            tm.cellColor(0, 0, 0);
            tm.push();
            tm.translate(cx - hc, row - hr);
            tm.rect(1, 1);
            tm.pop();
          }
        }
      }
    }
  };
})();
