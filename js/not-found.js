/**
 * Not-found module — renders a textmode heart + 404 message on the canvas.
 * Exposes NotFoundModule with: init / markDirty / draw
 *
 * Activated automatically by whale-bg.js whenever this file is loaded.
 * Only load this script on the 404 page.
 *
 * Draw this AFTER the whale so it always sits on top.
 *
 * @author trintlermint
 * @link https://github.com/humanbydefinition/textmode.js
 */
var NotFoundModule = (function () {
  'use strict';

  var HEART = [
    '   **   **   ',
    '  **** ****  ',
    ' *********** ',
    '  *********  ',
    '   *******   ',
    '    *****    ',
    '     ***     ',
    '      *      ',
  ];

  var HEART_W = 13;
  var HEART_H = HEART.length;

  var LINES = [
    '~ 404 ~',
    '',
    "you've drifted into uncharted waters",
    '',
    'go back & read my beautiful blogs  <3',
  ];

  var HR = 192, HG = 129, HB = 121;
  var AR = 134, AG = 122, AB = 222;
  var TR = 220, TG = 220, TB = 220;
  var TOTAL_H = HEART_H + 1 + LINES.length;

  return {
    init: function () {},
    markDirty: function () {},

    draw: function (tm, state) {
      var cols = state.cols, rows = state.rows;
      var hc   = state.hc,  hr   = state.hr;

      var startRow      = hr - Math.floor(TOTAL_H / 2);
      var heartColStart = hc - Math.floor(HEART_W / 2);

      for (var hy = 0; hy < HEART_H; hy++) {
        var row  = startRow + hy;
        if (row < 1 || row >= rows - 1) continue;
        var line = HEART[hy];

        for (var hx = 0; hx < line.length; hx++) {
          if (line[hx] !== '*') continue;
          var col = heartColStart + hx;
          if (col < 1 || col >= cols - 1) continue;

          var pulse = 0.70 + 0.30 * Math.abs(Math.sin(tm.frameCount * 0.04 + hx * 0.25));

          tm.char('*');
          tm.charColor(HR * pulse, HG * pulse, HB * pulse);
          tm.cellColor(Math.round(10 * pulse), Math.round(3 * pulse), Math.round(3 * pulse));
          tm.push();
          tm.translate(col - hc, row - hr);
          tm.rect(1, 1);
          tm.pop();
        }
      }

      var textStartRow = startRow + HEART_H + 1;

      for (var li = 0; li < LINES.length; li++) {
        var tline = LINES[li];
        if (!tline) continue;

        var trow = textStartRow + li;
        if (trow < 1 || trow >= rows - 1) continue;

        var lineStart = hc - Math.floor(tline.length / 2);
        var isTitle   = (li === 0);
        var isLast    = (li === LINES.length - 1);

        for (var ci = 0; ci < tline.length; ci++) {
          var ch = tline[ci];
          if (ch === ' ') continue;

          var tcol = lineStart + ci;
          if (tcol < 1 || tcol >= cols - 1) continue;

          var r, g, b;
          if (isTitle) {
            r = AR; g = AG; b = AB;
          } else if (isLast && ci >= tline.indexOf('<')) {
            r = HR; g = HG; b = HB;
          } else {
            r = TR; g = TG; b = TB;
          }

          tm.char(ch);
          tm.charColor(r, g, b);
          tm.cellColor(0, 0, 0);
          tm.push();
          tm.translate(tcol - hc, trow - hr);
          tm.rect(1, 1);
          tm.pop();
        }
      }
    }
  };
})();
