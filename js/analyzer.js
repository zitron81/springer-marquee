/**
 * Springer Elementary Marquee Maker - Readability & Hardware Constraint Analyzer
 * Checks font sizes, word count, overflow, WCAG contrast, and outdoor LED glare.
 */
(function (global) {
  'use strict';

  function parseHex(hex) {
    if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
    var clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    var num = parseInt(clean, 16);
    if (isNaN(num)) return { r: 0, g: 0, b: 0 };
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function channelLuminance(c) {
    var s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(hex) {
    var rgb = parseHex(hex);
    return (
      0.2126 * channelLuminance(rgb.r) +
      0.7152 * channelLuminance(rgb.g) +
      0.0722 * channelLuminance(rgb.b)
    );
  }

  function contrastRatio(hexA, hexB) {
    var l1 = relativeLuminance(hexA);
    var l2 = relativeLuminance(hexB);
    var brighter = Math.max(l1, l2);
    var darker = Math.min(l1, l2);
    return (brighter + 0.05) / (darker + 0.05);
  }

  function analyze(state, layoutMetrics) {
    var checks = [];
    var metrics = layoutMetrics || {
      lines: [],
      hasOverflow: false,
      minRenderedSize: null,
      totalWords: 0
    };

    var activeLines = metrics.lines || [];
    var hasBackgroundImage = Boolean(state.bgImage && state.bgImage.img);

    // 1. Exact export dimensions confirmation
    checks.push({
      level: 'ok',
      title: 'Exact Sign Format Ready',
      detail: 'Exports as an exact 256 × 96 px opaque JPG file.'
    });

    // 2. Empty canvas guidance
    if (activeLines.length === 0 && !hasBackgroundImage && (!state.overlays || state.overlays.length === 0)) {
      checks.push({
        level: 'warn',
        title: 'Canvas is empty',
        detail: 'Add text, choose a preset, or upload an image to preview it on the LED grid.'
      });
      return checks;
    }

    // 3. Font size check (uses actual rendered size after auto-fit)
    if (activeLines.length > 0) {
      var tooSmall = [];
      var borderline = [];
      for (var i = 0; i < activeLines.length; i++) {
        var line = activeLines[i];
        var rendered = Math.round(line.renderedSize * 10) / 10;
        if (rendered < 12) {
          tooSmall.push('Line ' + (line.index + 1) + ' (' + Math.floor(rendered) + 'px)');
        } else if (rendered < 14) {
          borderline.push('Line ' + (line.index + 1) + ' (' + Math.floor(rendered) + 'px)');
        }
      }

      if (tooSmall.length > 0) {
        checks.push({
          level: 'error',
          title: 'Text is too small for the LED marquee',
          detail: tooSmall.join(', ') + ' is under 12px tall. Shorten the wording or raise font size to at least 14px.'
        });
      } else if (borderline.length > 0) {
        checks.push({
          level: 'warn',
          title: 'Text is borderline small',
          detail: borderline.join(', ') + ' may look blocky from the street. Aim for 14px or larger.'
        });
      } else {
        checks.push({
          level: 'ok',
          title: 'Readable Text Size',
          detail: 'All text lines render at ' + Math.round(metrics.minRenderedSize) + 'px+ on the 96px tall display.'
        });
      }
    }

    // 4. Text overflow check when auto-fit is disabled
    if (metrics.hasOverflow) {
      checks.push({
        level: 'error',
        title: 'Text extends off-screen',
        detail: 'Turn on "Auto-fit long lines", shorten the text, or reduce font size.'
      });
    }

    // 5. Word count check for passing traffic
    if (metrics.totalWords > 10) {
      checks.push({
        level: 'warn',
        title: 'Too much text (' + metrics.totalWords + ' words)',
        detail: 'Drivers only have 2–3 seconds to read the sign. Aim for 10 words or fewer.'
      });
    }

    // 6. Contrast & outdoor LED glare check
    if (!hasBackgroundImage) {
      var bgLum = relativeLuminance(state.bgColor);
      if (bgLum > 0.72) {
        checks.push({
          level: 'warn',
          title: 'Bright background causes outdoor glare',
          detail: 'White or pale backgrounds wash out text on LED signs. Dark backgrounds (black, navy, dark green) read much better.'
        });
      }

      if (activeLines.length > 0) {
        var lowContrastLines = [];
        for (var j = 0; j < activeLines.length; j++) {
          var l = activeLines[j];
          var ratio1 = contrastRatio(state.bgColor, l.color);
          var ratio2 = state.bgStyle === 'gradient' ? contrastRatio(state.bgColor2, l.color) : ratio1;
          var minRatio = Math.min(ratio1, ratio2);
          if (minRatio < 4.5) {
            lowContrastLines.push('Line ' + (l.index + 1) + ' (' + minRatio.toFixed(1) + ':1)');
          }
        }
        if (lowContrastLines.length > 0) {
          checks.push({
            level: 'warn',
            title: 'Low color contrast',
            detail: lowContrastLines.join(', ') + ' has under 4.5:1 contrast against the background. Try white or bright yellow text.'
          });
        }
      }
    } else {
      // Background photo uploaded
      if (activeLines.length > 0 && state.bgScrim < 0.25) {
        checks.push({
          level: 'warn',
          title: 'Photo background may hide text',
          detail: 'Increase "Darken Photo Behind Text" to 25%+ or keep "Text Dark Outline" enabled so letters pop.'
        });
      }
      if (activeLines.length === 0) {
        checks.push({
          level: 'warn',
          title: 'Inspect the LED Matrix preview carefully',
          detail: 'Small flyers, fine print, and QR codes lose detail at 256 × 96 px. If you cannot read it easily in LED View, simplify the graphic.'
        });
      }
    }

    return checks;
  }

  global.MarqueeAnalyzer = {
    analyze: analyze,
    contrastRatio: contrastRatio,
    relativeLuminance: relativeLuminance
  };
})(window);
