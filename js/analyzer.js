/**
 * Springer Elementary Marquee Maker - Readability & Hardware Constraint Analyzer
 * Checks font sizes, word count, overflow, WCAG contrast, and Test-mode image fit.
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

  function analyzeTestMode(state) {
    var checks = [
      {
        level: 'ok',
        title: 'Exact 256 × 96 JPG Export',
        detail: 'Downloads at the exact Springer marquee dimensions.'
      }
    ];

    if (!state.testImage || !state.testImage.img) {
      checks.push({
        level: 'warn',
        title: 'No image uploaded yet',
        detail: 'Upload or drop a finished slide to preview it on the 256 × 96 LED grid.'
      });
      return checks;
    }

    var img = state.testImage.img;
    var iw = img.naturalWidth || img.width || 0;
    var ih = img.naturalHeight || img.height || 0;

    if (iw === 256 && ih === 96) {
      checks.push({
        level: 'ok',
        title: 'Exact 256 × 96 px Match',
        detail: 'Your image already matches the sign pixel-for-pixel.'
      });
    } else if (iw > 0 && ih > 0) {
      var ratio = iw / ih;
      var signRatio = 256 / 96; // 2.667
      if (Math.abs(ratio - signRatio) > 0.35) {
        checks.push({
          level: 'warn',
          title: 'Different Shape (' + iw + '×' + ih + ' vs 8:3 sign)',
          detail: '"Fit Whole Image" adds black sidebars; "Fill & Crop" trims top/bottom edges.'
        });
      } else {
        checks.push({
          level: 'ok',
          title: 'Good 8:3 Proportions (' + iw + '×' + ih + ')',
          detail: 'Scales cleanly to 256 × 96 px without heavy cropping.'
        });
      }
    }

    checks.push({
      level: 'warn',
      title: 'Check LED View Readability',
      detail: 'Make sure text looks crisp in LED Matrix View — fine print & QR codes blur outdoors.'
    });

    return checks;
  }

  function analyze(state, layoutMetrics) {
    if (state.appMode === 'test') {
      return analyzeTestMode(state);
    }

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
      title: '256 × 96 JPG Ready',
      detail: 'Exports as an exact 256 × 96 px opaque JPG file.'
    });

    // 2. Empty canvas guidance
    if (activeLines.length === 0 && !hasBackgroundImage && (!state.overlays || state.overlays.length === 0)) {
      checks.push({
        level: 'warn',
        title: 'Canvas is empty',
        detail: 'Pick a preset, type text, or add a sticker.'
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
          title: 'Text is too small',
          detail: tooSmall.join(', ') + ' is under 12px. Shorten wording or raise size to 14px+.'
        });
      } else if (borderline.length > 0) {
        checks.push({
          level: 'warn',
          title: 'Text is slightly small',
          detail: borderline.join(', ') + ' — aim for 14px+ to read cleanly from cars.'
        });
      } else {
        checks.push({
          level: 'ok',
          title: 'Readable Text Size (' + Math.round(metrics.minRenderedSize) + 'px+)',
          detail: 'All lines are large enough to read from the street.'
        });
      }
    }

    // 4. Text overflow check when auto-fit is disabled
    if (metrics.hasOverflow) {
      checks.push({
        level: 'error',
        title: 'Text extends off-screen',
        detail: 'Turn on "Auto-fit long lines", shorten text, or reduce font size.'
      });
    }

    // 5. Word count check for passing traffic
    if (metrics.totalWords > 10) {
      checks.push({
        level: 'warn',
        title: 'Too many words (' + metrics.totalWords + ')',
        detail: 'Families drive past in 2–3 seconds. Aim for 10 words or fewer.'
      });
    }

    // 6. Contrast check (supports both bright and dark backgrounds!)
    if (!hasBackgroundImage && activeLines.length > 0) {
      var bgLum1 = relativeLuminance(state.bgColor);
      var bgLum2 = state.bgStyle === 'gradient' ? relativeLuminance(state.bgColor2) : bgLum1;
      var avgBgLum = (bgLum1 + bgLum2) / 2;

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
        var tip =
          avgBgLum > 0.45
            ? 'Try dark navy, charcoal, or dark green text on bright backgrounds.'
            : 'Try white or bright yellow text on dark backgrounds.';
        checks.push({
          level: 'warn',
          title: 'Low Color Contrast',
          detail: lowContrastLines.join(', ') + ' is under 4.5:1. ' + tip
        });
      } else {
        checks.push({
          level: 'ok',
          title: 'Strong Color Contrast',
          detail: 'Text stands out clearly against your background.'
        });
      }
    } else if (hasBackgroundImage) {
      if (activeLines.length > 0 && state.bgScrim < 0.25 && !state.textOutline) {
        checks.push({
          level: 'warn',
          title: 'Photo may hide text',
          detail: 'Increase "Darken Photo Behind Text" or enable letter outlines.'
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
