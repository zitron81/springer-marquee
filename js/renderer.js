/**
 * Springer Elementary Marquee Maker - Canvas 2D Renderer & LED Matrix Simulator
 * Renders clean 256x96 artwork onto sourceCanvas for exact JPG export,
 * and renders a 4x (1024x384) interactive preview with LED dot simulation onto displayCanvas.
 */
(function (global) {
  'use strict';

  var SCALE = 4; // 256x96 -> 1024x384 preview

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function countWords(lines) {
    var count = 0;
    for (var i = 0; i < lines.length; i++) {
      var trimmed = (lines[i].text || '').trim();
      if (!trimmed) continue;
      count += trimmed.split(/\s+/).length;
    }
    return count;
  }

  function drawMotif(ctx, state, w, h) {
    var motif = state.motif;
    if (!motif || motif === 'none') return;

    ctx.save();
    if (motif === 'border') {
      ctx.strokeStyle = state.motifColor || '#ffd60a';
      ctx.lineWidth = 3;
      ctx.strokeRect(2.5, 2.5, w - 5, h - 5);
    } else if (motif === 'top-bar') {
      ctx.fillStyle = state.motifColor || '#ffd60a';
      ctx.fillRect(0, 0, w, 6);
      ctx.fillRect(0, h - 4, w, 4);
    } else if (motif === 'confetti') {
      var dots = [
        { x: 14, y: 12, r: 3, c: '#ffd60a' },
        { x: 34, y: 78, r: 3, c: '#ff4d8d' },
        { x: 22, y: 44, r: 2.5, c: '#22d3ee' },
        { x: 238, y: 14, r: 3, c: '#ff4d8d' },
        { x: 224, y: 76, r: 3, c: '#84cc16' },
        { x: 244, y: 48, r: 2.5, c: '#ffd60a' },
        { x: 56, y: 10, r: 2, c: '#84cc16' },
        { x: 200, y: 84, r: 2, c: '#22d3ee' },
        { x: 12, y: 84, r: 2, c: '#ff8c00' },
        { x: 242, y: 84, r: 2, c: '#ffffff' }
      ];
      for (var i = 0; i < dots.length; i++) {
        ctx.fillStyle = dots[i].c;
        ctx.beginPath();
        ctx.arc(dots[i].x, dots[i].y, dots[i].r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBackgroundImage(ctx, state, w, h) {
    if (!state.bgImage || !state.bgImage.img) return;
    var img = state.bgImage.img;
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;

    ctx.save();
    if (state.bgFit === 'stretch') {
      ctx.drawImage(img, 0, 0, w, h);
    } else {
      var baseScale =
        state.bgFit === 'contain'
          ? Math.min(w / iw, h / ih)
          : Math.max(w / iw, h / ih);
      var zoom = clamp(state.bgZoom || 1, 0.25, 4);
      var drawW = iw * baseScale * zoom;
      var drawH = ih * baseScale * zoom;
      var drawX = (w - drawW) / 2 + (state.bgOffsetX || 0);
      var drawY = (h - drawH) / 2 + (state.bgOffsetY || 0);
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }
    ctx.restore();
  }

  function drawOverlays(ctx, overlays) {
    if (!overlays || overlays.length === 0) return;
    for (var i = 0; i < overlays.length; i++) {
      var ov = overlays[i];
      if (!ov.img) continue;
      var iw = ov.img.naturalWidth || ov.img.width || 1;
      var ih = ov.img.naturalHeight || ov.img.height || 1;
      var aspect = iw / ih;
      var drawH = ov.size;
      var drawW = ov.size * aspect;
      if (aspect < 1) {
        drawH = ov.size / aspect;
        drawW = ov.size;
        // Keep max dimension bounded to ov.size so wide/tall logos behave predictably
        var maxDim = Math.max(drawW, drawH);
        var factor = ov.size / maxDim;
        drawW *= factor;
        drawH *= factor;
      } else {
        drawW = ov.size;
        drawH = ov.size / aspect;
      }
      ov._drawW = drawW;
      ov._drawH = drawH;

      ctx.save();
      ctx.drawImage(ov.img, ov.x - drawW / 2, ov.y - drawH / 2, drawW, drawH);
      ctx.restore();
    }
  }

  function buildFontString(fontObj, sizePx) {
    var weight = fontObj.weight || '700';
    return weight + ' ' + sizePx + 'px ' + fontObj.css;
  }

  function renderSource(ctx, state) {
    var P = global.MarqueePresets;
    var w = P.WIDTH;
    var h = P.HEIGHT;

    // 1. Always fill opaque background (required for clean JPG export)
    ctx.save();
    if (state.bgStyle === 'gradient') {
      var grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, state.bgColor || '#000000');
      grad.addColorStop(1, state.bgColor2 || '#120d31');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = state.bgColor || '#000000';
    }
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // 2. Optional background image
    drawBackgroundImage(ctx, state, w, h);

    // 3. Optional dark scrim over background photo/color
    if (state.bgImage && state.bgImage.img && state.bgScrim > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, ' + clamp(state.bgScrim, 0, 0.9) + ')';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 4. Optional decorative motif (behind text & overlays)
    drawMotif(ctx, state, w, h);

    // 5. PNG / SVG Overlays
    drawOverlays(ctx, state.overlays);

    // 6. Text lines
    var fontObj = P.getFontById(state.fontId);
    var safeMarginX = 8;
    var maxSafeWidth = w - safeMarginX * 2; // 240px

    var activeLines = [];
    for (var i = 0; i < state.lines.length; i++) {
      var raw = state.lines[i];
      var text = (raw.text || '').trim();
      if (!text) continue;

      var targetSize = clamp(Number(raw.size) || 18, 8, 56);
      var renderedSize = targetSize;

      ctx.font = buildFontString(fontObj, renderedSize);
      var measuredWidth = ctx.measureText(text).width;

      if (state.autoFit && measuredWidth > maxSafeWidth) {
        var scaleFactor = maxSafeWidth / measuredWidth;
        renderedSize = Math.max(8, targetSize * scaleFactor);
        ctx.font = buildFontString(fontObj, renderedSize);
        measuredWidth = ctx.measureText(text).width;
      }

      activeLines.push({
        index: i,
        text: text,
        color: raw.color || '#ffffff',
        targetSize: targetSize,
        renderedSize: renderedSize,
        width: measuredWidth,
        overflows: measuredWidth > w - 2
      });
    }

    var lineGap = activeLines.length >= 3 ? 3 : 5;
    var totalHeight = 0;
    for (var k = 0; k < activeLines.length; k++) {
      totalHeight += activeLines[k].renderedSize;
      if (k > 0) totalHeight += lineGap;
    }

    var startY = (h - totalHeight) / 2 + (state.textOffsetY || 0);
    var anchorX = w / 2;
    if (state.align === 'left') anchorX = safeMarginX;
    else if (state.align === 'right') anchorX = w - safeMarginX;

    var minRenderedSize = null;
    var hasOverflow = false;

    ctx.save();
    ctx.textAlign = state.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    var cursorY = startY;
    for (var m = 0; m < activeLines.length; m++) {
      var line = activeLines[m];
      var centerY = cursorY + line.renderedSize / 2;
      ctx.font = buildFontString(fontObj, line.renderedSize);

      if (state.textOutline) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
        ctx.lineWidth = Math.max(2, Math.round(line.renderedSize * 0.16));
        ctx.strokeText(line.text, anchorX, centerY);
      }

      ctx.fillStyle = line.color;
      ctx.fillText(line.text, anchorX, centerY);

      cursorY += line.renderedSize + lineGap;
      if (minRenderedSize === null || line.renderedSize < minRenderedSize) {
        minRenderedSize = line.renderedSize;
      }
      if (line.overflows) {
        hasOverflow = true;
      }
    }
    ctx.restore();

    return {
      lines: activeLines,
      hasOverflow: hasOverflow,
      minRenderedSize: minRenderedSize,
      totalWords: countWords(state.lines)
    };
  }

  // Pre-build offscreen LED pitch mask for fast 4x rendering (1024x384)
  var cachedLedMask = null;
  function getLedMaskCanvas(w, h) {
    if (cachedLedMask && cachedLedMask.width === w && cachedLedMask.height === h) {
      return cachedLedMask;
    }
    var mask = document.createElement('canvas');
    mask.width = w;
    mask.height = h;
    var mctx = mask.getContext('2d');

    // Fill solid dark bezel grid, then punch circular LED diode apertures per 4x4 cell
    mctx.fillStyle = '#07080b';
    mctx.fillRect(0, 0, w, h);

    mctx.globalCompositeOperation = 'destination-out';
    for (var py = 0; py < h; py += SCALE) {
      for (var px = 0; px < w; px += SCALE) {
        mctx.beginPath();
        mctx.arc(px + 1.8, py + 1.8, 1.55, 0, Math.PI * 2);
        mctx.fill();
      }
    }
    cachedLedMask = mask;
    return mask;
  }

  function renderDisplay(displayCanvas, sourceCanvas, state, uiState) {
    var dw = displayCanvas.width;
    var dh = displayCanvas.height;
    var ctx = displayCanvas.getContext('2d');

    ctx.save();
    ctx.clearRect(0, 0, dw, dh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sourceCanvas, 0, 0, dw, dh);

    if (state.previewMode === 'led') {
      // Subtle brightness boost to mimic glowing outdoor LED diodes against dark bezel
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.12;
      ctx.drawImage(sourceCanvas, 0, 0, dw, dh);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      var mask = getLedMaskCanvas(dw, dh);
      ctx.drawImage(mask, 0, 0);
    }

    // Draw interactive selection box & snap guides on display canvas only (never on sourceCanvas)
    if (uiState && uiState.selectedOverlayId && state.overlays) {
      var selected = null;
      for (var i = 0; i < state.overlays.length; i++) {
        if (state.overlays[i].id === uiState.selectedOverlayId) {
          selected = state.overlays[i];
          break;
        }
      }
      if (selected && selected._drawW && selected._drawH) {
        var sx = (selected.x - selected._drawW / 2) * SCALE;
        var sy = (selected.y - selected._drawH / 2) * SCALE;
        var sw = selected._drawW * SCALE;
        var sh = selected._drawH * SCALE;

        // Center snap guide lines when snapping
        if (Math.abs(selected.x - 128) < 1) {
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.75)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(128 * SCALE, 0);
          ctx.lineTo(128 * SCALE, dh);
          ctx.stroke();
        }
        if (Math.abs(selected.y - 48) < 1) {
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.75)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(0, 48 * SCALE);
          ctx.lineTo(dw, 48 * SCALE);
          ctx.stroke();
        }

        ctx.setLineDash([8, 5]);
        ctx.strokeStyle = '#ffd60a';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(sx - 2, sy - 2, sw + 4, sh + 4);
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }

  function exportJpgBlob(sourceCanvas, quality) {
    var P = global.MarqueePresets;
    if (sourceCanvas.width !== P.WIDTH || sourceCanvas.height !== P.HEIGHT) {
      return Promise.reject(
        new Error('Expected ' + P.WIDTH + 'x' + P.HEIGHT + ' canvas, got ' + sourceCanvas.width + 'x' + sourceCanvas.height)
      );
    }
    var q = clamp(typeof quality === 'number' ? quality : 0.95, 0.5, 1);
    return new Promise(function (resolve, reject) {
      if (sourceCanvas.toBlob) {
        sourceCanvas.toBlob(
          function (blob) {
            if (blob) resolve(blob);
            else reject(new Error('Failed to encode JPG image.'));
          },
          'image/jpeg',
          q
        );
      } else {
        try {
          var dataUrl = sourceCanvas.toDataURL('image/jpeg', q);
          var parts = dataUrl.split(',');
          var binary = atob(parts[1]);
          var arr = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
          resolve(new Blob([arr], { type: 'image/jpeg' }));
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  global.MarqueeRenderer = {
    SCALE: SCALE,
    renderSource: renderSource,
    renderDisplay: renderDisplay,
    exportJpgBlob: exportJpgBlob
  };
})(window);
