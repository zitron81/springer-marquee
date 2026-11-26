/**
 * Springer Elementary Marquee Maker - Canvas 2D Renderer & LED Matrix Simulator
 * Renders clean 256x96 artwork onto sourceCanvas for exact JPG export,
 * and renders a 4x (1024x384) interactive preview with LED dot simulation onto displayCanvas.
 */
(function (global) {
  'use strict';

  var SCALE = 4; // 256x96 -> 1024x384 preview
  var HANDLE_OFFSET = 10; // logical px distance from box edge to rotation handle

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

  function getRotationHandlePos(cx, cy, w, h, rotationDeg, preferredSign) {
    var rad = ((rotationDeg || 0) * Math.PI) / 180;
    var cos = Math.cos(rad);
    var sin = Math.sin(rad);

    function computeFor(sign) {
      var dist = h / 2 + HANDLE_OFFSET;
      var lx = 0;
      var ly = sign * dist;
      return {
        x: cx + lx * cos - ly * sin,
        y: cy + lx * sin + ly * cos,
        sign: sign
      };
    }

    if (preferredSign === 1 || preferredSign === -1) {
      return computeFor(preferredSign);
    }

    var top = computeFor(-1);
    if (top.y < 5) {
      return computeFor(1);
    }
    return top;
  }

  function getResizeHandlePos(cx, cy, w, h, rotationDeg) {
    var rad = ((rotationDeg || 0) * Math.PI) / 180;
    var cos = Math.cos(rad);
    var sin = Math.sin(rad);
    var lx = w / 2 + 1.5;
    var ly = h / 2 + 1.5;
    return {
      x: cx + lx * cos - ly * sin,
      y: cy + lx * sin + ly * cos
    };
  }

  function drawBadgePill(ctx, x, y, text) {
    ctx.save();
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 1.5;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y - 12, 54, 24, 6);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(x, y - 12, 54, 24);
      ctx.strokeRect(x, y - 12, 54, 24);
    }
    ctx.fillStyle = '#ffd60a';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 27, y);
    ctx.restore();
  }

  function pointInRotatedBox(pt, cx, cy, w, h, rotationDeg, pad) {
    var rad = -((rotationDeg || 0) * Math.PI) / 180;
    var dx = pt.x - cx;
    var dy = pt.y - cy;
    var cos = Math.cos(rad);
    var sin = Math.sin(rad);
    var lx = dx * cos - dy * sin;
    var ly = dx * sin + dy * cos;
    var p = pad || 0;
    return Math.abs(lx) <= w / 2 + p && Math.abs(ly) <= h / 2 + p;
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
        { x: 242, y: 84, r: 2, c: '#15803d' }
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

  function drawImageFitted(ctx, img, fit, zoom, offsetX, offsetY, w, h) {
    if (!img) return;
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;

    ctx.save();
    if (fit === 'stretch') {
      ctx.drawImage(img, 0, 0, w, h);
    } else {
      var baseScale =
        fit === 'contain'
          ? Math.min(w / iw, h / ih)
          : Math.max(w / iw, h / ih);
      var z = clamp(zoom || 1, 0.25, 4);
      var drawW = iw * baseScale * z;
      var drawH = ih * baseScale * z;
      var drawX = (w - drawW) / 2 + (offsetX || 0);
      var drawY = (h - drawH) / 2 + (offsetY || 0);
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }
    ctx.restore();
  }

  function drawOverlays(ctx, overlays, layerFilter) {
    if (!overlays || overlays.length === 0) return;
    for (var i = 0; i < overlays.length; i++) {
      var ov = overlays[i];
      if (!ov.img) continue;
      var isBack = ov.layer === 'back';
      if (layerFilter === 'back' && !isBack) continue;
      if (layerFilter === 'front' && isBack) continue;

      var iw = ov.img.naturalWidth || ov.img.width || 1;
      var ih = ov.img.naturalHeight || ov.img.height || 1;
      var aspect = iw / ih;
      var drawW;
      var drawH;
      if (aspect < 1) {
        drawH = ov.size;
        drawW = ov.size * aspect;
      } else {
        drawW = ov.size;
        drawH = ov.size / aspect;
      }
      ov._drawW = drawW;
      ov._drawH = drawH;

      ctx.save();
      ctx.translate(ov.x, ov.y);
      if (ov.rotation) {
        ctx.rotate((ov.rotation * Math.PI) / 180);
      }
      ctx.drawImage(ov.img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }
  }

  function buildFontString(fontObj, sizePx) {
    var weight = fontObj.weight || '700';
    return weight + ' ' + sizePx + 'px ' + fontObj.css;
  }

  function renderSource(ctx, state) {
    var P = global.MarqueePresets;
    var A = global.MarqueeAnalyzer;
    var w = P.WIDTH;
    var h = P.HEIGHT;

    if (state.appMode === 'test') {
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      if (state.testImage && state.testImage.img) {
        drawImageFitted(
          ctx,
          state.testImage.img,
          state.testFit,
          state.testZoom,
          state.testOffsetX,
          state.testOffsetY,
          w,
          h
        );
      }
      return {
        lines: [],
        hasOverflow: false,
        minRenderedSize: null,
        totalWords: 0
      };
    }

    // Create Mode:
    // 1. Always fill opaque background (required for clean JPG export)
    ctx.save();
    if (state.bgStyle === 'gradient') {
      var dir = state.bgGradDir || 'horizontal';
      var grad =
        dir === 'horizontal'
          ? ctx.createLinearGradient(0, 0, w, 0)
          : dir === 'vertical'
          ? ctx.createLinearGradient(0, 0, 0, h)
          : ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, state.bgColor || '#000000');
      grad.addColorStop(1, state.bgColor2 || '#120d31');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = state.bgColor || '#000000';
    }
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // 2. Optional background image
    if (state.bgImage && state.bgImage.img) {
      drawImageFitted(
        ctx,
        state.bgImage.img,
        state.bgFit,
        state.bgZoom,
        state.bgOffsetX,
        state.bgOffsetY,
        w,
        h
      );
    }

    // 3. Optional dark scrim over background photo
    if (state.bgImage && state.bgImage.img && state.bgScrim > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, ' + clamp(state.bgScrim, 0, 0.9) + ')';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 4. Optional decorative motif (behind text & overlays)
    drawMotif(ctx, state, w, h);

    // 5. Back-layer overlays (behind text)
    drawOverlays(ctx, state.overlays, 'back');

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
        offsetX: Number(raw.offsetX) || 0,
        offsetY: Number(raw.offsetY) || 0,
        rotation: Number(raw.rotation) || 0,
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

    var startY = (h - totalHeight) / 2;
    var minRenderedSize = null;
    var hasOverflow = false;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    var cursorY = startY;
    for (var m = 0; m < activeLines.length; m++) {
      var line = activeLines[m];
      var baseY = cursorY + line.renderedSize / 2;
      var baseX = w / 2;
      if (state.align === 'left') baseX = safeMarginX + line.width / 2;
      else if (state.align === 'right') baseX = w - safeMarginX - line.width / 2;

      var cx = baseX + line.offsetX;
      var cy = baseY + line.offsetY;
      line.cx = cx;
      line.cy = cy;
      line.boxW = Math.max(18, line.width);
      line.boxH = Math.max(12, line.renderedSize);

      ctx.save();
      ctx.translate(cx, cy);
      if (line.rotation) {
        ctx.rotate((line.rotation * Math.PI) / 180);
      }
      ctx.font = buildFontString(fontObj, line.renderedSize);

      if (state.textOutline) {
        var isDarkText = A && A.relativeLuminance(line.color) < 0.35;
        ctx.strokeStyle = isDarkText ? 'rgba(255, 255, 255, 0.92)' : 'rgba(0, 0, 0, 0.88)';
        ctx.lineWidth = Math.max(2, Math.round(line.renderedSize * 0.16));
        ctx.strokeText(line.text, 0, 0);
      }

      ctx.fillStyle = line.color;
      ctx.fillText(line.text, 0, 0);
      ctx.restore();

      cursorY += line.renderedSize + lineGap;
      if (minRenderedSize === null || line.renderedSize < minRenderedSize) {
        minRenderedSize = line.renderedSize;
      }
      if (line.overflows) {
        hasOverflow = true;
      }
    }
    ctx.restore();

    // 7. Front-layer overlays (in front of text)
    drawOverlays(ctx, state.overlays, 'front');

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

  function findSelectionGeom(state, uiState, layoutMetrics) {
    var sel = uiState && uiState.selection;
    if (!sel || state.appMode !== 'create') return null;

    if (sel.type === 'overlay' && state.overlays) {
      for (var i = 0; i < state.overlays.length; i++) {
        var ov = state.overlays[i];
        if (ov.id === sel.id && ov._drawW && ov._drawH) {
          return {
            cx: ov.x,
            cy: ov.y,
            w: ov._drawW,
            h: ov._drawH,
            rotation: ov.rotation || 0
          };
        }
      }
    } else if (sel.type === 'text' && layoutMetrics && layoutMetrics.lines) {
      for (var j = 0; j < layoutMetrics.lines.length; j++) {
        var line = layoutMetrics.lines[j];
        if (line.index === sel.index) {
          return {
            cx: line.cx,
            cy: line.cy,
            w: line.boxW,
            h: line.boxH,
            rotation: line.rotation || 0
          };
        }
      }
    }
    return null;
  }

  function renderDisplay(displayCanvas, sourceCanvas, state, uiState, layoutMetrics) {
    var dw = displayCanvas.width;
    var dh = displayCanvas.height;
    var ctx = displayCanvas.getContext('2d');

    ctx.save();
    ctx.clearRect(0, 0, dw, dh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sourceCanvas, 0, 0, dw, dh);

    if (state.previewMode === 'led') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.12;
      ctx.drawImage(sourceCanvas, 0, 0, dw, dh);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      var mask = getLedMaskCanvas(dw, dh);
      ctx.drawImage(mask, 0, 0);
    }

    // Test mode empty placeholder (never exported onto sourceCanvas)
    if (state.appMode === 'test' && !(state.testImage && state.testImage.img)) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fillRect(0, 0, dw, dh);
      ctx.strokeStyle = 'rgba(255, 214, 10, 0.45)';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.strokeRect(24, 24, dw - 48, dh - 48);
      ctx.setLineDash([]);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 28px system-ui, -apple-system, sans-serif';
      ctx.fillText('Drop your finished image here or upload below', dw / 2, dh / 2 - 16);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 18px system-ui, -apple-system, sans-serif';
      ctx.fillText('Preview it at real 256 × 96 LED sign resolution', dw / 2, dh / 2 + 22);
      ctx.restore();
    }

    // Interactive selection box, center snap guides & rotation handle (Create mode)
    var geom = findSelectionGeom(state, uiState, layoutMetrics);
    if (geom) {
      if (Math.abs(geom.cx - 128) < 1) {
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(128 * SCALE, 0);
        ctx.lineTo(128 * SCALE, dh);
        ctx.stroke();
      }
      if (Math.abs(geom.cy - 48) < 1) {
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(0, 48 * SCALE);
        ctx.lineTo(dw, 48 * SCALE);
        ctx.stroke();
      }

      var preferredSign =
        uiState && uiState.drag && uiState.drag.type === 'rotate'
          ? uiState.drag.handleSign
          : undefined;
      var handle = getRotationHandlePos(geom.cx, geom.cy, geom.w, geom.h, geom.rotation, preferredSign);
      var rad = (geom.rotation * Math.PI) / 180;
      var boxW = geom.w * SCALE + 12;
      var boxH = geom.h * SCALE + 12;

      // Rotated bounding box + stem
      ctx.save();
      ctx.translate(geom.cx * SCALE, geom.cy * SCALE);
      ctx.rotate(rad);

      // Dark backing stroke so selection is visible on white/yellow backgrounds
      ctx.setLineDash([8, 5]);
      ctx.strokeStyle = 'rgba(17, 24, 39, 0.75)';
      ctx.lineWidth = 4.5;
      ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

      ctx.strokeStyle = '#ffd60a';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);
      ctx.setLineDash([]);

      // Stem connecting box edge to handle
      var edgeY = handle.sign * (boxH / 2);
      var stemEndY = handle.sign * ((geom.h / 2 + HANDLE_OFFSET) * SCALE);
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, edgeY);
      ctx.lineTo(0, stemEndY);
      ctx.stroke();
      ctx.strokeStyle = '#ffd60a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, edgeY);
      ctx.lineTo(0, stemEndY);
      ctx.stroke();
      ctx.restore();

      // Rotation handle circle in world space
      var hx = handle.x * SCALE;
      var hy = handle.y * SCALE;
      ctx.save();
      ctx.beginPath();
      ctx.arc(hx, hy, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd60a';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#111827';
      ctx.stroke();

      // Tiny inner rotation arc icon
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5, 0.3, Math.PI * 1.65);
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();

      // Live angle badge while rotating
      if (uiState && uiState.drag && uiState.drag.type === 'rotate') {
        var label = Math.round(geom.rotation) + '°';
        var pillX = clamp(hx + 16, 40, dw - 60);
        var pillY = clamp(hy - 14, 18, dh - 24);
        drawBadgePill(ctx, pillX, pillY, label);
      }

      // Corner resize handle for selected stickers/PNGs
      if (uiState && uiState.selection && uiState.selection.type === 'overlay') {
        var rHandle = getResizeHandlePos(geom.cx, geom.cy, geom.w, geom.h, geom.rotation);
        var rx = rHandle.x * SCALE;
        var ry = rHandle.y * SCALE;
        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(rad);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 3;
        ctx.fillRect(-8, -8, 16, 16);
        ctx.strokeRect(-8, -8, 16, 16);
        ctx.fillStyle = '#156136';
        ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();

        if (uiState.drag && uiState.drag.type === 'resize') {
          var sizePillX = clamp(rx + 14, 12, dw - 60);
          var sizePillY = clamp(ry, 18, dh - 24);
          drawBadgePill(ctx, sizePillX, sizePillY, Math.round(Math.max(geom.w, geom.h)) + 'px');
        }
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
    HANDLE_OFFSET: HANDLE_OFFSET,
    getRotationHandlePos: getRotationHandlePos,
    getResizeHandlePos: getResizeHandlePos,
    pointInRotatedBox: pointInRotatedBox,
    renderSource: renderSource,
    renderDisplay: renderDisplay,
    exportJpgBlob: exportJpgBlob
  };
})(window);
