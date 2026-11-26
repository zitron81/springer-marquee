/**
 * Springer Elementary Marquee Maker - Main Interactive Application Controller
 */
(function (global) {
  'use strict';

  var P = global.MarqueePresets;
  var R = global.MarqueeRenderer;
  var A = global.MarqueeAnalyzer;
  var QR = global.MarqueeQR;
  var MAX_LINES = 6;

  var sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = P.WIDTH;
  sourceCanvas.height = P.HEIGHT;
  var sourceCtx = sourceCanvas.getContext('2d');

  var state = {
    appMode: 'create', // 'create' | 'test'
    presetId: 'springer-stingers',
    previewMode: 'led',
    bgStyle: 'solid',
    bgColor: '#0b4f26',
    bgColor2: '#052e16',
    bgGradDir: 'horizontal',
    motif: 'border',
    motifColor: '#ffd60a',
    fontId: 'montserrat',
    align: 'center',
    textOutline: false,
    autoFit: true,
    lines: [
      { text: 'SPRINGER PTA', size: 15, color: '#ffd60a', offsetX: 18, offsetY: 0, rotation: 0 },
      { text: 'GO STINGERS!', size: 23, color: '#ffffff', offsetX: 18, offsetY: 0, rotation: 0 },
      { text: 'BEE KIND & SAFE', size: 14, color: '#ffd60a', offsetX: 18, offsetY: 0, rotation: 0 }
    ],
    bgImage: null, // { name, img, dataUrl }
    bgFit: 'cover',
    bgZoom: 1,
    bgUnlockAspect: false,
    bgScaleX: 1,
    bgScaleY: 1,
    bgOffsetX: 0,
    bgOffsetY: 0,
    bgScrim: 0.35,
    overlays: [], // [{ id, name, src, img, x, y, size, rotation, layer }]
    testImage: null, // { name, img, dataUrl }
    testFit: 'contain',
    testZoom: 1,
    testUnlockAspect: false,
    testScaleX: 1,
    testScaleY: 1,
    testOffsetX: 0,
    testOffsetY: 0,
    testBgColor: '#000000',
    jpgQuality: 0.95,
    qrDraft: {
      url: 'https://springerpta.org',
      uppercase: true,
      scaleMode: 'auto',
      quietZoneMode: 'auto',
      ecc: 'L'
    }
  };

  var uiState = {
    selection: null, // { type: 'overlay', id } | { type: 'text', index } | null
    overlayCounter: 1,
    sizeTimer: null,
    drag: null,
    lastMetrics: null
  };

  var els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function normalizeAngle(deg) {
    var d = Math.round(deg) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  function snapAngle(deg) {
    var snaps = [-180, -135, -90, -45, 0, 45, 90, 135, 180];
    for (var i = 0; i < snaps.length; i++) {
      if (Math.abs(deg - snaps[i]) <= 3) return snaps[i];
    }
    return deg;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function loadImageFromSrc(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error('Could not decode image file.'));
      };
      img.src = src;
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf('image/') !== 0) {
        reject(new Error('Please choose an image file (PNG, JPG, WebP, or GIF).'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function (ev) {
        resolve(ev.target.result);
      };
      reader.onerror = function () {
        reject(new Error('Could not read the selected file.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function getOverlayById(id) {
    for (var i = 0; i < state.overlays.length; i++) {
      if (state.overlays[i].id === id) return state.overlays[i];
    }
    return null;
  }

  function getQrOverlay() {
    for (var i = 0; i < state.overlays.length; i++) {
      if (state.overlays[i].kind === 'qr') return state.overlays[i];
    }
    return null;
  }

  function clampQrCenter(x, y, totalPx) {
    var left = clamp(Math.round(x - totalPx / 2), 0, Math.max(0, P.WIDTH - totalPx));
    var top = clamp(Math.round(y - totalPx / 2), 0, Math.max(0, P.HEIGHT - totalPx));
    return {
      left: left,
      top: top,
      x: left + totalPx / 2,
      y: top + totalPx / 2
    };
  }

  function buildQrOverlayData(draft) {
    if (!QR) return { error: 'QR encoder unavailable.' };
    var raw = (draft.url || '').trim();
    if (!raw) {
      return { error: 'Enter a link or short text to generate a QR code.' };
    }
    var payload = draft.uppercase ? raw.toUpperCase() : raw;
    var enc = QR.encode(payload, draft.ecc);
    if (enc.error) {
      return { error: enc.error, payload: payload };
    }
    var layout = QR.computeLayout(enc.size, draft.scaleMode, draft.quietZoneMode, P.HEIGHT);
    var thumbSrc = QR.toThumbDataUrl(enc.matrix, layout.quietZone);
    return {
      payload: payload,
      encoded: enc,
      layout: layout,
      thumbSrc: thumbSrc
    };
  }

  function placeQrWithTextShift(ov, side, shiftText) {
    if (!ov || ov.kind !== 'qr') return;
    var totalPx = (ov.qrModules + ov.qrQuietZone * 2) * ov.qrScale;
    var padY = Math.max(0, Math.floor((P.HEIGHT - totalPx) / 2));
    var padX = Math.min(4, padY);
    var left;
    var freeStart;
    var freeEnd;

    if (side === 'left') {
      left = padX;
      freeStart = left + totalPx + 6;
      freeEnd = P.WIDTH - 6;
    } else if (side === 'right') {
      left = Math.max(0, P.WIDTH - totalPx - padX);
      freeStart = 6;
      freeEnd = left - 6;
    } else {
      left = Math.max(0, Math.floor((P.WIDTH - totalPx) / 2));
    }

    var clamped = clampQrCenter(left + totalPx / 2, padY + totalPx / 2, totalPx);
    ov.x = clamped.x;
    ov.y = clamped.y;

    if (shiftText !== false && (side === 'left' || side === 'right')) {
      var freeWidth = Math.max(40, freeEnd - freeStart);
      var targetCenterX = (freeStart + freeEnd) / 2;
      var offsetDelta = Math.round(targetCenterX - P.WIDTH / 2);
      state.align = 'center';

      for (var i = 0; i < state.lines.length; i++) {
        var line = state.lines[i];
        line.offsetX = clamp(offsetDelta, -120, 120);
        var text = (line.text || '').trim();
        if (text) {
          var fontObj = P.getFontById(line.fontId || state.fontId);
          sourceCtx.save();
          sourceCtx.font = (fontObj.weight || '700') + ' ' + line.size + 'px ' + fontObj.css;
          var w = sourceCtx.measureText(text).width;
          sourceCtx.restore();
          if (w > freeWidth) {
            line.size = clamp(Math.floor(line.size * (freeWidth / w)), 10, 48);
          }
        }
      }
      syncControlsFromState();
    }
  }

  function upsertQrOverlay(selectOnAdd, snapSide, shiftText) {
    var data = buildQrOverlayData(state.qrDraft);
    if (!data || data.error) return null;

    var existing = getQrOverlay();
    var enc = data.encoded;
    var layout = data.layout;
    var nameLabel = 'QR (' + layout.scale + '×' + layout.scale + ' px/sq)';

    if (existing) {
      existing.name = nameLabel;
      existing.src = data.thumbSrc;
      existing.qrMatrix = enc.matrix;
      existing.qrVersion = enc.version;
      existing.qrModules = enc.size;
      existing.qrScale = layout.scale;
      existing.qrQuietZone = layout.quietZone;
      existing.qrMode = enc.mode;
      existing.qrEcc = enc.ecc;
      existing.qrUrl = data.payload;
      existing.size = layout.totalPx;
      existing.rotation = 0;

      if (snapSide) {
        placeQrWithTextShift(existing, snapSide, shiftText);
      } else {
        var c = clampQrCenter(existing.x, existing.y, layout.totalPx);
        existing.x = c.x;
        existing.y = c.y;
      }

      if (selectOnAdd) {
        uiState.selection = { type: 'overlay', id: existing.id };
      }
      syncSelectionUI();
      syncQrPanelUI();
      renderAll();
      return existing;
    }

    var id = 'ov-' + uiState.overlayCounter++;
    var item = {
      id: id,
      kind: 'qr',
      name: nameLabel,
      src: data.thumbSrc,
      img: null,
      x: P.WIDTH - Math.round(layout.totalPx / 2) - 4,
      y: Math.round(P.HEIGHT / 2),
      size: layout.totalPx,
      rotation: 0,
      layer: 'front',
      qrMatrix: enc.matrix,
      qrVersion: enc.version,
      qrModules: enc.size,
      qrScale: layout.scale,
      qrQuietZone: layout.quietZone,
      qrMode: enc.mode,
      qrEcc: enc.ecc,
      qrUrl: data.payload
    };

    state.overlays.push(item);
    state.jpgQuality = 1.0;
    els.jpgQuality.value = '100';
    els.jpgQualityVal.textContent = '100%';

    placeQrWithTextShift(item, snapSide || 'right', shiftText);

    if (selectOnAdd !== false) {
      uiState.selection = { type: 'overlay', id: id };
    }
    syncSelectionUI();
    syncQrPanelUI();
    renderAll();
    return item;
  }

  function getSelectedOverlay() {
    if (uiState.selection && uiState.selection.type === 'overlay') {
      return getOverlayById(uiState.selection.id);
    }
    return null;
  }

  function getSelectedTextIndex() {
    if (uiState.selection && uiState.selection.type === 'text') {
      return uiState.selection.index;
    }
    return null;
  }

  function getLineMetric(index) {
    var metrics = uiState.lastMetrics;
    if (!metrics || !metrics.lines) return null;
    for (var i = 0; i < metrics.lines.length; i++) {
      if (metrics.lines[i].index === index) return metrics.lines[i];
    }
    return null;
  }

  function buildFilename() {
    if (state.appMode === 'test') {
      if (state.testImage && state.testImage.name) {
        var base = state.testImage.name
          .replace(/\.[^.]+$/, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        return (base || 'tested-slide') + '-256x96.jpg';
      }
      return 'tested-slide-256x96.jpg';
    }

    var parts = [];
    for (var i = 0; i < state.lines.length; i++) {
      var t = (state.lines[i].text || '').trim();
      if (t) parts.push(t);
    }
    var raw = parts
      .join(' ')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!raw && state.bgImage && state.bgImage.name) {
      raw = state.bgImage.name
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
    if (!raw) raw = 'springer-marquee';
    if (raw.length > 40) raw = raw.slice(0, 40).replace(/-+$/g, '');
    return raw + '-256x96.jpg';
  }

  function scheduleSizeEstimate() {
    if (uiState.sizeTimer) clearTimeout(uiState.sizeTimer);
    if (state.appMode === 'test' && !(state.testImage && state.testImage.img)) {
      els.fileSizeBadge.textContent = '256×96 JPG';
      return;
    }
    uiState.sizeTimer = setTimeout(function () {
      R.exportJpgBlob(sourceCanvas, state.jpgQuality)
        .then(function (blob) {
          var kb = Math.max(1, Math.round(blob.size / 1024));
          els.fileSizeBadge.textContent = '~' + kb + ' KB';
        })
        .catch(function () {
          els.fileSizeBadge.textContent = '256×96 JPG';
        });
    }, 150);
  }

  function renderChecks(checks) {
    var html = '';
    for (var i = 0; i < checks.length; i++) {
      var c = checks[i];
      var cls = c.level === 'error' ? 'is-error' : c.level === 'warn' ? 'is-warn' : 'is-ok';
      var icon = c.level === 'error' ? '!' : c.level === 'warn' ? '!' : '✓';
      html +=
        '<li class="check-item ' +
        cls +
        '">' +
        '<strong>[' +
        icon +
        '] ' +
        escapeHtml(c.title) +
        '</strong>' +
        '<span>' +
        escapeHtml(c.detail) +
        '</span>' +
        '</li>';
    }
    els.checksList.innerHTML = html;
  }

  function updateImageMetaLabel(metaEl, imgEntry, drawMetrics) {
    if (!metaEl || !imgEntry || !imgEntry.img) return;
    var iw = imgEntry.img.naturalWidth || imgEntry.img.width;
    var ih = imgEntry.img.naturalHeight || imgEntry.img.height;
    var label = imgEntry.name + ' • ' + iw + '×' + ih;
    if (drawMetrics && drawMetrics.drawW && drawMetrics.drawH) {
      label += ' → ' + drawMetrics.drawW + '×' + drawMetrics.drawH + ' px';
    } else {
      label += ' px';
    }
    metaEl.textContent = label;
  }

  function applyQuickImageResize(prefix, action) {
    var imgEntry = state[prefix + 'Image'];
    if (!imgEntry || !imgEntry.img) return;
    var iw = imgEntry.img.naturalWidth || imgEntry.img.width || 1;
    var ih = imgEntry.img.naturalHeight || imgEntry.img.height || 1;

    if (action === 'stretch') {
      state[prefix + 'Fit'] = 'stretch';
      state[prefix + 'Zoom'] = 1;
    } else {
      state[prefix + 'Fit'] = 'contain';
      var containScale = Math.min(P.WIDTH / iw, P.HEIGHT / ih);
      var targetZoom = action === 'fit-w' ? P.WIDTH / (iw * containScale) : P.HEIGHT / (ih * containScale);
      state[prefix + 'Zoom'] = clamp(Math.round(targetZoom * 50) / 50, 0.2, 4);
    }
    state[prefix + 'UnlockAspect'] = false;
    state[prefix + 'ScaleX'] = state[prefix + 'Zoom'];
    state[prefix + 'ScaleY'] = state[prefix + 'Zoom'];
    state[prefix + 'OffsetX'] = 0;
    state[prefix + 'OffsetY'] = 0;
    syncControlsFromState();
    renderAll();
  }

  function renderAll() {
    var metrics = R.renderSource(sourceCtx, state);
    uiState.lastMetrics = metrics;
    R.renderDisplay(els.displayCanvas, sourceCanvas, state, uiState, metrics);

    if (state.bgImage && state.bgImage.img) {
      updateImageMetaLabel(els.bgImageMeta, state.bgImage, metrics.bgImageMetrics);
    }
    if (state.testImage && state.testImage.img) {
      updateImageMetaLabel(els.testImageMeta, state.testImage, metrics.testImageMetrics);
    }

    // Update 1:1 actual size canvas
    var actCtx = els.actualCanvas.getContext('2d');
    actCtx.imageSmoothingEnabled = false;
    actCtx.clearRect(0, 0, P.WIDTH, P.HEIGHT);
    actCtx.drawImage(sourceCanvas, 0, 0);

    // Update Readability checks
    var checks = A.analyze(state, metrics);
    renderChecks(checks);

    // Export button readiness in Test mode
    var canExport = state.appMode === 'create' || Boolean(state.testImage && state.testImage.img);
    els.downloadBtn.disabled = !canExport;
    els.downloadBtnLabel.textContent = canExport ? 'Download 256×96 JPG' : 'Upload an Image to Export';

    // Update filename preview and JPG file size estimate
    els.filenamePreview.textContent = buildFilename();
    scheduleSizeEstimate();
  }

  function buildFontOptionsHtml(selectedId, includeMixed) {
    var groups = {};
    var groupOrder = [];
    for (var i = 0; i < P.FONTS.length; i++) {
      var f = P.FONTS[i];
      var gName = f.group || 'Fonts';
      if (!groups[gName]) {
        groups[gName] = [];
        groupOrder.push(gName);
      }
      groups[gName].push(f);
    }

    var html = '';
    if (includeMixed) {
      var mixedSel = selectedId === 'mixed' ? ' selected' : '';
      html += '<option value="mixed" disabled' + mixedSel + '>— Mixed Fonts —</option>';
    }
    for (var g = 0; g < groupOrder.length; g++) {
      var label = groupOrder[g];
      var list = groups[label];
      html += '<optgroup label="' + escapeHtml(label) + '">';
      for (var j = 0; j < list.length; j++) {
        var font = list[j];
        var sel = font.id === selectedId ? ' selected' : '';
        html += '<option value="' + escapeHtml(font.id) + '"' + sel + '>' + escapeHtml(font.label) + '</option>';
      }
      html += '</optgroup>';
    }
    return html;
  }

  function ensureFontLoaded(fontId) {
    if (!document.fonts || !document.fonts.load) return;
    var fontObj = P.getFontById(fontId);
    if (!fontObj) return;
    var spec = (fontObj.weight || '400') + ' 24px ' + fontObj.css;
    document.fonts
      .load(spec)
      .then(function () {
        renderAll();
      })
      .catch(function () {});
  }

  function syncGlobalFontSelect() {
    if (!els.fontSelect) return;
    if (state.lines.length === 0) {
      els.fontSelect.value = state.fontId;
      return;
    }
    var firstFont = state.lines[0].fontId || state.fontId;
    var allSame = true;
    for (var i = 1; i < state.lines.length; i++) {
      if ((state.lines[i].fontId || state.fontId) !== firstFont) {
        allSame = false;
        break;
      }
    }
    els.fontSelect.value = allSame ? firstFont : 'mixed';
  }

  function renderLinesEditor() {
    if (!els.linesStack) return;
    var len = state.lines.length;
    var selLineIdx = getSelectedTextIndex();

    if (els.addLineBtn) {
      els.addLineBtn.disabled = len >= MAX_LINES;
    }
    if (els.lineCountHint) {
      els.lineCountHint.textContent =
        len + ' of ' + MAX_LINES + ' lines • Press Enter inside a line to split or add below';
    }

    if (len === 0) {
      els.linesStack.innerHTML =
        '<div class="lines-empty-state">No text lines yet. Click <strong>+ Add Text Line</strong> above to add one.</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < len; i++) {
      var line = state.lines[i];
      var isSel = state.appMode === 'create' && selLineIdx === i;
      var upDisabled = i === 0 ? ' disabled' : '';
      var downDisabled = i === len - 1 ? ' disabled' : '';
      var dupDisabled = len >= MAX_LINES ? ' disabled' : '';
      var rot = Math.round(line.rotation || 0);
      var size = Math.round(line.size || 16);

      html +=
        '<div class="line-card' +
        (isSel ? ' is-selected' : '') +
        '" data-line-card="' +
        i +
        '">' +
        '<div class="line-card-header">' +
        '<span class="line-num-badge">Line ' +
        (i + 1) +
        '</span>' +
        '<div class="line-card-actions">' +
        '<button type="button" class="btn btn-outline btn-sm" data-line-move-up="' +
        i +
        '" aria-label="Move line ' +
        (i + 1) +
        ' up"' +
        upDisabled +
        '>&uarr;</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-line-move-down="' +
        i +
        '" aria-label="Move line ' +
        (i + 1) +
        ' down"' +
        downDisabled +
        '>&darr;</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-line-duplicate="' +
        i +
        '"' +
        dupDisabled +
        '>Duplicate</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-line-reset-transform="' +
        i +
        '">Reset Pos/Tilt</button>' +
        '<button type="button" class="btn btn-danger btn-sm" data-line-delete="' +
        i +
        '" aria-label="Delete line ' +
        (i + 1) +
        '">Delete</button>' +
        '</div>' +
        '</div>' +
        '<div class="line-card-body">' +
        '<div class="line-input-row">' +
        '<input type="text" data-line-text="' +
        i +
        '" maxlength="48" value="' +
        escapeHtml(line.text || '') +
        '" placeholder="Type marquee line..." aria-label="Line ' +
        (i + 1) +
        ' text">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-line-clear="' +
        i +
        '" aria-label="Clear line ' +
        (i + 1) +
        '">Clear</button>' +
        '</div>' +
        '<div class="line-controls-row">' +
        '<div class="line-font-group">' +
        '<label>Font</label>' +
        '<select data-line-font="' +
        i +
        '" class="line-font-select" aria-label="Line ' +
        (i + 1) +
        ' font">' +
        buildFontOptionsHtml(line.fontId || state.fontId, false) +
        '</select>' +
        '</div>' +
        '<div class="slider-group">' +
        '<label>Size: <strong data-line-size-val="' +
        i +
        '">' +
        size +
        'px</strong> <span class="safe-hint">(14px+)</span></label>' +
        '<input type="range" data-line-size="' +
        i +
        '" min="10" max="48" step="1" value="' +
        size +
        '" aria-label="Line ' +
        (i + 1) +
        ' size">' +
        '</div>' +
        '<div class="slider-group rotate-group">' +
        '<label>Rotate: <strong data-line-rotate-val="' +
        i +
        '">' +
        rot +
        '°</strong></label>' +
        '<input type="range" data-line-rotate="' +
        i +
        '" min="-180" max="180" step="1" value="' +
        rot +
        '" aria-label="Line ' +
        (i + 1) +
        ' rotation">' +
        '</div>' +
        '<div class="color-group">' +
        '<input type="color" data-line-color="' +
        i +
        '" value="' +
        escapeHtml(line.color || '#ffffff') +
        '" title="Custom color" aria-label="Line ' +
        (i + 1) +
        ' color">' +
        '<div class="swatch-strip">' +
        buildSwatchButtonsHtml('line', i) +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>';
    }
    els.linesStack.innerHTML = html;
  }

  function syncLineCardValues(idx) {
    if (!els.linesStack || !state.lines[idx]) return;
    var card = els.linesStack.querySelector('[data-line-card="' + idx + '"]');
    if (!card) return;
    var line = state.lines[idx];
    var textInput = card.querySelector('[data-line-text="' + idx + '"]');
    var fontSelect = card.querySelector('[data-line-font="' + idx + '"]');
    var sizeInput = card.querySelector('[data-line-size="' + idx + '"]');
    var sizeVal = card.querySelector('[data-line-size-val="' + idx + '"]');
    var rotInput = card.querySelector('[data-line-rotate="' + idx + '"]');
    var rotVal = card.querySelector('[data-line-rotate-val="' + idx + '"]');
    var colorInput = card.querySelector('[data-line-color="' + idx + '"]');

    if (textInput && document.activeElement !== textInput) textInput.value = line.text || '';
    if (fontSelect) fontSelect.value = line.fontId || state.fontId;
    if (sizeInput) sizeInput.value = String(Math.round(line.size || 16));
    if (sizeVal) sizeVal.textContent = Math.round(line.size || 16) + 'px';
    if (rotInput) rotInput.value = String(Math.round(line.rotation || 0));
    if (rotVal) rotVal.textContent = Math.round(line.rotation || 0) + '°';
    if (colorInput) colorInput.value = line.color || '#ffffff';
  }

  function addLine(insertAfterIdx, initialText) {
    if (state.lines.length >= MAX_LINES) return;
    var refIdx =
      typeof insertAfterIdx === 'number' && state.lines[insertAfterIdx]
        ? insertAfterIdx
        : state.lines.length - 1;
    var refLine = refIdx >= 0 ? state.lines[refIdx] : null;
    var bgLum = A ? A.relativeLuminance(state.bgColor) : 0;
    var fallbackColor = bgLum > 0.45 ? '#111827' : '#ffffff';
    var nextColor = refLine ? refLine.color : fallbackColor;
    var nextSize = refLine ? clamp(Math.round(refLine.size), 14, 22) : 16;
    var nextOffsetX = refLine ? refLine.offsetX || 0 : 0;
    var nextFontId = refLine ? refLine.fontId || state.fontId : state.fontId;

    var newLine = {
      text: typeof initialText === 'string' ? initialText : '',
      fontId: nextFontId,
      size: nextSize,
      color: nextColor,
      offsetX: nextOffsetX,
      offsetY: 0,
      rotation: 0
    };

    var targetIdx = typeof insertAfterIdx === 'number' ? insertAfterIdx + 1 : state.lines.length;
    state.lines.splice(targetIdx, 0, newLine);
    uiState.selection = { type: 'text', index: targetIdx };
    renderLinesEditor();
    syncGlobalFontSelect();
    syncSelectionUI();
    renderAll();

    if (els.linesStack) {
      var input = els.linesStack.querySelector('[data-line-text="' + targetIdx + '"]');
      if (input) {
        input.focus();
        if (initialText) input.setSelectionRange(0, 0);
      }
    }
  }

  function duplicateLine(idx) {
    if (state.lines.length >= MAX_LINES || !state.lines[idx]) return;
    var src = state.lines[idx];
    var copy = {
      text: src.text || '',
      fontId: src.fontId || state.fontId,
      size: src.size,
      color: src.color,
      offsetX: src.offsetX || 0,
      offsetY: 0,
      rotation: src.rotation || 0
    };
    state.lines.splice(idx + 1, 0, copy);
    uiState.selection = { type: 'text', index: idx + 1 };
    renderLinesEditor();
    syncGlobalFontSelect();
    syncSelectionUI();
    renderAll();

    if (els.linesStack) {
      var input = els.linesStack.querySelector('[data-line-text="' + (idx + 1) + '"]');
      if (input) input.focus();
    }
  }

  function moveLine(idx, delta) {
    var target = idx + delta;
    if (idx < 0 || idx >= state.lines.length || target < 0 || target >= state.lines.length) return;
    var tmp = state.lines[idx];
    state.lines[idx] = state.lines[target];
    state.lines[target] = tmp;

    if (uiState.selection && uiState.selection.type === 'text') {
      if (uiState.selection.index === idx) uiState.selection.index = target;
      else if (uiState.selection.index === target) uiState.selection.index = idx;
    }

    renderLinesEditor();
    syncGlobalFontSelect();
    syncSelectionUI();
    renderAll();
  }

  function removeLine(idx) {
    if (idx < 0 || idx >= state.lines.length) return;
    state.lines.splice(idx, 1);
    if (uiState.selection && uiState.selection.type === 'text') {
      if (uiState.selection.index === idx) {
        uiState.selection = null;
      } else if (uiState.selection.index > idx) {
        uiState.selection.index -= 1;
      }
    }
    renderLinesEditor();
    syncGlobalFontSelect();
    syncSelectionUI();
    renderAll();
  }

  function syncSelectionUI() {
    var selOv = getSelectedOverlay();
    var selLineIdx = getSelectedTextIndex();

    // Highlight matching line cards in Text tab
    if (els.linesStack) {
      var cards = els.linesStack.querySelectorAll('[data-line-card]');
      for (var l = 0; l < cards.length; l++) {
        var cIdx = Number(cards[l].getAttribute('data-line-card'));
        cards[l].classList.toggle('is-selected', state.appMode === 'create' && selLineIdx === cIdx);
      }
    }

    // Quick selection bar right below bezel
    if (state.appMode !== 'create' || (!selOv && selLineIdx === null)) {
      els.quickSelectionBar.hidden = true;
    } else if (selOv && selOv.kind === 'qr') {
      els.quickSelectionBar.hidden = false;
      els.quickSelLabel.textContent =
        'Pixel-Locked QR (' +
        selOv.qrScale +
        '×' +
        selOv.qrScale +
        ' px/sq • ' +
        selOv.size +
        '×' +
        selOv.size +
        ')';
      els.quickSizeWrap.hidden = true;
      els.quickRotateWrap.hidden = true;
      els.quickEditQrBtn.hidden = false;
      els.quickLayerWrap.hidden = false;
      els.quickDeleteBtn.hidden = false;
      els.quickCenterBtn.textContent = 'Center';
    } else if (selOv) {
      els.quickSelectionBar.hidden = false;
      els.quickSelLabel.textContent = 'Sticker: ' + selOv.name;
      els.quickSizeWrap.hidden = false;
      els.quickSize.min = '12';
      els.quickSize.max = '260';
      els.quickRotateWrap.hidden = false;
      els.quickEditQrBtn.hidden = true;
      els.quickLayerWrap.hidden = false;
      els.quickDeleteBtn.hidden = false;
      els.quickSize.value = String(Math.round(selOv.size));
      els.quickSizeVal.textContent = Math.round(selOv.size) + 'px';
      els.quickRotate.value = String(Math.round(selOv.rotation || 0));
      els.quickRotateVal.textContent = Math.round(selOv.rotation || 0) + '°';
      els.quickCenterBtn.textContent = 'Center';
    } else if (selLineIdx !== null && state.lines[selLineIdx]) {
      var line = state.lines[selLineIdx];
      els.quickSelectionBar.hidden = false;
      els.quickSelLabel.textContent = 'Text: Line ' + (selLineIdx + 1);
      els.quickSizeWrap.hidden = false;
      els.quickSize.min = '10';
      els.quickSize.max = '48';
      els.quickSize.value = String(Math.round(line.size || 16));
      els.quickSizeVal.textContent = Math.round(line.size || 16) + 'px';
      els.quickRotateWrap.hidden = false;
      els.quickEditQrBtn.hidden = true;
      els.quickLayerWrap.hidden = true;
      els.quickDeleteBtn.hidden = false;
      els.quickRotate.value = String(Math.round(line.rotation || 0));
      els.quickRotateVal.textContent = Math.round(line.rotation || 0) + '°';
      els.quickCenterBtn.textContent = 'Reset Pos';
    } else {
      els.quickSelectionBar.hidden = true;
    }

    syncOverlayListUI();
  }

  function syncOverlayListUI() {
    if (state.overlays.length === 0) {
      els.activeOverlaysList.innerHTML = '<p class="empty-note">No stickers added yet.</p>';
      els.selectedOverlayControls.hidden = true;
      return;
    }

    var selOv = getSelectedOverlay();
    var selectedId = selOv ? selOv.id : null;

    // Show top-most front items first, back items below
    var ordered = [];
    for (var f = state.overlays.length - 1; f >= 0; f--) {
      if (state.overlays[f].layer !== 'back') ordered.push(state.overlays[f]);
    }
    for (var b = state.overlays.length - 1; b >= 0; b--) {
      if (state.overlays[b].layer === 'back') ordered.push(state.overlays[b]);
    }

    var html = '';
    for (var i = 0; i < ordered.length; i++) {
      var ov = ordered[i];
      var selectedClass = ov.id === selectedId ? ' is-selected' : '';
      var isFront = ov.layer !== 'back';
      var layerBadge = isFront
        ? '<span class="layer-pill is-front">Front</span>'
        : '<span class="layer-pill">Behind Text</span>';
      html +=
        '<div class="overlay-item' +
        selectedClass +
        '">' +
        '<button type="button" class="overlay-select-btn" data-select-overlay="' +
        escapeHtml(ov.id) +
        '">' +
        '<img class="overlay-thumb" src="' +
        escapeHtml(ov.src) +
        '" alt="">' +
        '<span>' +
        escapeHtml(ov.name) +
        '</span>' +
        layerBadge +
        '</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-remove-overlay="' +
        escapeHtml(ov.id) +
        '" aria-label="Remove ' +
        escapeHtml(ov.name) +
        '">Remove</button>' +
        '</div>';
    }
    els.activeOverlaysList.innerHTML = html;

    if (selOv) {
      var isQrSel = selOv.kind === 'qr';
      els.selectedOverlayControls.hidden = false;
      els.ovQrLockNote.hidden = !isQrSel;
      els.ovTransformRow.hidden = isQrSel;
      els.ovSize.value = String(Math.round(selOv.size));
      els.ovSizeVal.textContent = Math.round(selOv.size) + ' px';
      els.ovRotate.value = String(Math.round(selOv.rotation || 0));
      els.ovRotateVal.textContent = Math.round(selOv.rotation || 0) + '°';
      els.ovX.value = String(Math.round(selOv.x));
      els.ovXVal.textContent = String(Math.round(selOv.x));
      els.ovY.value = String(Math.round(selOv.y));
      els.ovYVal.textContent = String(Math.round(selOv.y));
    } else {
      els.selectedOverlayControls.hidden = true;
    }
  }

  function syncControlsFromState() {
    var isCreate = state.appMode === 'create';

    // Mode switcher & panels
    els.modeCreateBtn.classList.toggle('is-active', isCreate);
    els.modeCreateBtn.setAttribute('aria-pressed', isCreate ? 'true' : 'false');
    els.modeTestBtn.classList.toggle('is-active', !isCreate);
    els.modeTestBtn.setAttribute('aria-pressed', !isCreate ? 'true' : 'false');
    els.createModePanel.hidden = !isCreate;
    els.testModePanel.hidden = isCreate;
    els.resetBtn.hidden = !isCreate;
    els.canvasInteractionHint.textContent = isCreate
      ? 'Click any text or sticker to drag or rotate'
      : 'Drop an image onto the sign or drag to pan';

    // Preview mode buttons
    var modeBtns = document.querySelectorAll('[data-preview-mode]');
    for (var i = 0; i < modeBtns.length; i++) {
      var isActive = modeBtns[i].getAttribute('data-preview-mode') === state.previewMode;
      modeBtns[i].classList.toggle('is-active', isActive);
      modeBtns[i].setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }

    // Preset cards active state
    var presetBtns = document.querySelectorAll('[data-preset-id]');
    for (var p = 0; p < presetBtns.length; p++) {
      presetBtns[p].classList.toggle('is-active', presetBtns[p].getAttribute('data-preset-id') === state.presetId);
    }

    // Text tab controls
    syncGlobalFontSelect();
    var alignBtns = document.querySelectorAll('[data-align]');
    for (var a = 0; a < alignBtns.length; a++) {
      var aMatch = alignBtns[a].getAttribute('data-align') === state.align;
      alignBtns[a].classList.toggle('is-active', aMatch);
      alignBtns[a].setAttribute('aria-pressed', aMatch ? 'true' : 'false');
    }
    els.autoFit.checked = state.autoFit;
    els.textOutline.checked = state.textOutline;

    renderLinesEditor();

    // Background tab controls
    els.bgStyle.value = state.bgStyle;
    els.bgGradDir.value = state.bgGradDir;
    els.bgGradDirWrap.hidden = state.bgStyle !== 'gradient';
    els.bgColor.value = state.bgColor;
    els.bgColor2.value = state.bgColor2;
    els.bgColor2Wrap.hidden = state.bgStyle !== 'gradient';
    els.motifSelect.value = state.motif;
    els.motifColor.value = state.motifColor;
    els.motifColorWrap.hidden = state.motif === 'none' || state.motif === 'confetti';

    var hasBgImg = Boolean(state.bgImage && state.bgImage.img);
    els.bgImageControls.hidden = !hasBgImg;
    if (hasBgImg) {
      updateImageMetaLabel(els.bgImageMeta, state.bgImage, uiState.lastMetrics && uiState.lastMetrics.bgImageMetrics);
    }
    els.bgFit.value = state.bgFit;
    els.bgUnlockAspect.checked = Boolean(state.bgUnlockAspect);
    els.bgZoomWrap.hidden = Boolean(state.bgUnlockAspect);
    els.bgScaleXyWrap.hidden = !state.bgUnlockAspect;
    els.bgZoom.value = String(state.bgZoom);
    els.bgZoomVal.textContent = Math.round(state.bgZoom * 100) + '%';
    els.bgScaleX.value = String(state.bgScaleX);
    els.bgScaleXVal.textContent = Math.round(state.bgScaleX * 100) + '%';
    els.bgScaleY.value = String(state.bgScaleY);
    els.bgScaleYVal.textContent = Math.round(state.bgScaleY * 100) + '%';
    els.bgOffsetX.value = String(state.bgOffsetX);
    els.bgOffsetXVal.textContent = Math.round(state.bgOffsetX) + ' px';
    els.bgOffsetY.value = String(state.bgOffsetY);
    els.bgOffsetYVal.textContent = Math.round(state.bgOffsetY) + ' px';
    els.bgScrim.value = String(Math.round(state.bgScrim * 100));
    els.bgScrimVal.textContent = Math.round(state.bgScrim * 100) + '%';

    // Test mode controls
    var hasTestImg = Boolean(state.testImage && state.testImage.img);
    els.testImageControls.hidden = !hasTestImg;
    if (hasTestImg) {
      updateImageMetaLabel(els.testImageMeta, state.testImage, uiState.lastMetrics && uiState.lastMetrics.testImageMetrics);
    }
    els.testFit.value = state.testFit;
    els.testBgColor.value = state.testBgColor || '#000000';
    els.testUnlockAspect.checked = Boolean(state.testUnlockAspect);
    els.testZoomWrap.hidden = Boolean(state.testUnlockAspect);
    els.testScaleXyWrap.hidden = !state.testUnlockAspect;
    els.testZoom.value = String(state.testZoom);
    els.testZoomVal.textContent = Math.round(state.testZoom * 100) + '%';
    els.testScaleX.value = String(state.testScaleX);
    els.testScaleXVal.textContent = Math.round(state.testScaleX * 100) + '%';
    els.testScaleY.value = String(state.testScaleY);
    els.testScaleYVal.textContent = Math.round(state.testScaleY * 100) + '%';
    els.testOffsetX.value = String(state.testOffsetX);
    els.testOffsetXVal.textContent = Math.round(state.testOffsetX) + ' px';
    els.testOffsetY.value = String(state.testOffsetY);
    els.testOffsetYVal.textContent = Math.round(state.testOffsetY) + ' px';

    // Quality
    els.jpgQuality.value = String(Math.round(state.jpgQuality * 100));
    els.jpgQualityVal.textContent = Math.round(state.jpgQuality * 100) + '%';

    syncQrPanelUI();
    syncSelectionUI();
  }

  function syncQrPanelUI() {
    if (!els.qrUrl) return;
    var draft = state.qrDraft;
    if (document.activeElement !== els.qrUrl) {
      els.qrUrl.value = draft.url;
    }
    els.qrUppercase.checked = Boolean(draft.uppercase);
    els.qrEcc.value = draft.ecc;

    var scaleBtns = document.querySelectorAll('[data-qr-scale]');
    for (var s = 0; s < scaleBtns.length; s++) {
      var sv = scaleBtns[s].getAttribute('data-qr-scale');
      var sActive = sv === String(draft.scaleMode);
      scaleBtns[s].classList.toggle('is-active', sActive);
      scaleBtns[s].setAttribute('aria-pressed', sActive ? 'true' : 'false');
    }

    var qzBtns = document.querySelectorAll('[data-qr-qz]');
    for (var q = 0; q < qzBtns.length; q++) {
      var qv = qzBtns[q].getAttribute('data-qr-qz');
      var qActive = qv === String(draft.quietZoneMode);
      qzBtns[q].classList.toggle('is-active', qActive);
      qzBtns[q].setAttribute('aria-pressed', qActive ? 'true' : 'false');
    }

    var activeQr = getQrOverlay();
    els.qrRemoveBtn.hidden = !activeQr;
    els.qrAddBtn.textContent = activeQr ? 'Update QR on Slide' : 'Add Pixel-Locked QR to Slide';

    var data = buildQrOverlayData(draft);
    if (!data || data.error) {
      els.qrStatusPill.className = 'qr-status-pill is-error';
      els.qrStatusPill.textContent = 'Cannot Fit';
      els.qrVersionMeta.textContent = '—';
      els.qrDimensionsText.textContent = (data && data.error) || 'Enter a valid link.';
      els.qrPayloadPreview.textContent = '';
      els.qrAddBtn.disabled = true;
      els.qrPlaceLeftBtn.disabled = true;
      els.qrPlaceRightBtn.disabled = true;
      els.qrPlaceCenterBtn.disabled = true;
      for (var ds = 0; ds < scaleBtns.length; ds++) {
        scaleBtns[ds].disabled = false;
      }
      return;
    }

    var enc = data.encoded;
    var layout = data.layout;
    els.qrAddBtn.disabled = false;
    els.qrPlaceLeftBtn.disabled = false;
    els.qrPlaceRightBtn.disabled = false;
    els.qrPlaceCenterBtn.disabled = false;

    for (var sb = 0; sb < scaleBtns.length; sb++) {
      var val = scaleBtns[sb].getAttribute('data-qr-scale');
      if (val === '3') scaleBtns[sb].disabled = !layout.fitsScale3;
      else if (val === '2') scaleBtns[sb].disabled = !layout.fitsScale2;
      else scaleBtns[sb].disabled = false;
    }

    if (layout.scale >= 3) {
      els.qrStatusPill.className = 'qr-status-pill is-ok';
      els.qrStatusPill.textContent = 'Optimal 3×3 LEDs/sq';
    } else if (layout.scale === 2) {
      els.qrStatusPill.className = 'qr-status-pill is-warn';
      els.qrStatusPill.textContent = 'Compact 2×2 LEDs/sq';
    } else {
      els.qrStatusPill.className = 'qr-status-pill is-error';
      els.qrStatusPill.textContent = 'Too Dense 1×1 LED';
    }

    els.qrVersionMeta.textContent = 'V' + enc.version + ' • ' + enc.size + '×' + enc.size + ' • ' + enc.mode;
    els.qrDimensionsText.textContent =
      layout.totalPx +
      ' × ' +
      layout.totalPx +
      ' px • ' +
      layout.scale +
      '×' +
      layout.scale +
      ' px/square • ' +
      layout.quietZone +
      '-sq white border • 0° locked';
    els.qrPayloadPreview.textContent = 'Encoded (' + data.payload.length + ' chars): ' + data.payload;
  }

  function setAppMode(mode) {
    if (mode !== 'create' && mode !== 'test') return;
    state.appMode = mode;
    uiState.selection = null;
    uiState.drag = null;
    syncControlsFromState();
    renderAll();
  }

  function addOverlay(name, src, x, y, size, rotation, layer, selectOnAdd) {
    return loadImageFromSrc(src).then(function (img) {
      var id = 'ov-' + uiState.overlayCounter++;
      var item = {
        id: id,
        name: name || 'Sticker',
        src: src,
        img: img,
        x: typeof x === 'number' ? x : 128,
        y: typeof y === 'number' ? y : 48,
        size: typeof size === 'number' ? size : 42,
        rotation: typeof rotation === 'number' ? rotation : 0,
        layer: layer === 'back' ? 'back' : 'front'
      };
      state.overlays.push(item);
      if (selectOnAdd !== false) {
        uiState.selection = { type: 'overlay', id: id };
      }
      syncSelectionUI();
      renderAll();
      return item;
    });
  }

  function bringOverlayToFront(id) {
    var ov = getOverlayById(id);
    if (!ov) return;
    ov.layer = 'front';
    state.overlays = state.overlays.filter(function (o) {
      return o.id !== id;
    });
    state.overlays.push(ov);
    syncSelectionUI();
    renderAll();
  }

  function sendOverlayToBack(id) {
    var ov = getOverlayById(id);
    if (!ov) return;
    ov.layer = 'back';
    state.overlays = state.overlays.filter(function (o) {
      return o.id !== id;
    });
    state.overlays.unshift(ov);
    syncSelectionUI();
    renderAll();
  }

  function applyPreset(presetId, clearUploads) {
    var preset = P.getPresetById(presetId);
    var c = preset.config;

    state.presetId = preset.id;
    state.bgStyle = c.bgStyle;
    state.bgColor = c.bgColor;
    state.bgColor2 = c.bgColor2;
    state.bgGradDir = c.bgGradDir || 'horizontal';
    state.motif = c.motif;
    state.motifColor = c.motifColor;
    state.fontId = c.fontId;
    state.align = c.align;
    state.textOutline = c.textOutline;
    state.autoFit = c.autoFit;

    state.lines = [];
    var loadedFonts = {};
    for (var i = 0; i < c.lines.length; i++) {
      var presetLine = c.lines[i];
      if (!presetLine || !(presetLine.text || '').trim()) continue;
      var lineFontId = presetLine.fontId || c.fontId;
      state.lines.push({
        text: presetLine.text,
        fontId: lineFontId,
        size: presetLine.size,
        color: presetLine.color,
        offsetX: presetLine.offsetX || 0,
        offsetY: presetLine.offsetY || 0,
        rotation: presetLine.rotation || 0
      });
      if (!loadedFonts[lineFontId]) {
        loadedFonts[lineFontId] = true;
        ensureFontLoaded(lineFontId);
      }
    }
    if (!loadedFonts[c.fontId]) {
      ensureFontLoaded(c.fontId);
    }

    if (clearUploads) {
      state.bgImage = null;
      state.bgFit = 'cover';
      state.bgZoom = 1;
      state.bgUnlockAspect = false;
      state.bgScaleX = 1;
      state.bgScaleY = 1;
      state.bgOffsetX = 0;
      state.bgOffsetY = 0;
      state.bgScrim = 0.35;
    }

    state.overlays = [];
    uiState.selection = null;
    if (clearUploads) {
      state.jpgQuality = 0.95;
    }

    syncControlsFromState();
    renderAll();

    if (c.starterSticker) {
      var st = P.getStickerById(c.starterSticker.stickerId);
      if (st) {
        addOverlay(
          st.name,
          st.src,
          c.starterSticker.x,
          c.starterSticker.y,
          c.starterSticker.size,
          c.starterSticker.rotation || 0,
          c.starterSticker.layer || 'front',
          false
        );
      }
    }

    if (c.starterQr) {
      state.qrDraft = {
        url: c.starterQr.url,
        uppercase: c.starterQr.uppercase !== false,
        scaleMode: c.starterQr.scaleMode || 'auto',
        quietZoneMode: c.starterQr.quietZoneMode || 'auto',
        ecc: c.starterQr.ecc || 'L'
      };
      upsertQrOverlay(false, c.starterQr.snap || 'right', false);
      syncControlsFromState();
    }
  }

  function switchTab(tabId) {
    var tabBtns = document.querySelectorAll('[role="tab"]');
    var panels = document.querySelectorAll('[role="tabpanel"]');
    for (var i = 0; i < tabBtns.length; i++) {
      var isTarget = tabBtns[i].id === tabId;
      tabBtns[i].classList.toggle('is-active', isTarget);
      tabBtns[i].setAttribute('aria-selected', isTarget ? 'true' : 'false');
    }
    for (var j = 0; j < panels.length; j++) {
      var controlsTarget = panels[j].getAttribute('aria-labelledby') === tabId;
      panels[j].classList.toggle('is-active', controlsTarget);
      panels[j].hidden = !controlsTarget;
    }
  }

  function buildSwatchButtonsHtml(targetType, targetIndex) {
    var html = '';
    for (var i = 0; i < P.SWATCHES.length; i++) {
      var sw = P.SWATCHES[i];
      html +=
        '<button type="button" class="swatch-btn" ' +
        'style="background:' +
        escapeHtml(sw.hex) +
        '" ' +
        'data-swatch-target="' +
        targetType +
        '" ' +
        'data-swatch-index="' +
        targetIndex +
        '" ' +
        'data-swatch-color="' +
        escapeHtml(sw.hex) +
        '" ' +
        'title="' +
        escapeHtml(sw.name) +
        '" ' +
        'aria-label="' +
        escapeHtml(sw.name) +
        '"></button>';
    }
    return html;
  }

  function populateStaticLists() {
    // Font select (with optgroups + mixed indicator)
    els.fontSelect.innerHTML = buildFontOptionsHtml(state.fontId, true);

    // Presets grid
    var pHtml = '';
    for (var p = 0; p < P.PRESETS.length; p++) {
      var pr = P.PRESETS[p];
      var c0 = pr.previewColors[0] || '#111827';
      var dots = '';
      for (var d = 1; d < pr.previewColors.length; d++) {
        dots += '<span class="preset-dot" style="background:' + escapeHtml(pr.previewColors[d]) + '"></span>';
      }
      pHtml +=
        '<button type="button" class="preset-card" data-preset-id="' +
        escapeHtml(pr.id) +
        '">' +
        '<div class="preset-swatch-bar" style="background:' +
        escapeHtml(c0) +
        '" aria-hidden="true">' +
        dots +
        '</div>' +
        '<strong>' +
        escapeHtml(pr.name) +
        '</strong>' +
        '<span>' +
        escapeHtml(pr.tagline) +
        '</span>' +
        '</button>';
    }
    els.presetsGrid.innerHTML = pHtml;

    // Swatch strips for background & motif
    els.bgSwatches.innerHTML = buildSwatchButtonsHtml('bg', '0');
    els.bgSwatches2.innerHTML = buildSwatchButtonsHtml('bg2', '0');
    els.motifSwatches.innerHTML = buildSwatchButtonsHtml('motif', '0');

    // Built-in stickers
    var stHtml = '';
    for (var k = 0; k < P.BUILTIN_STICKERS.length; k++) {
      var st = P.BUILTIN_STICKERS[k];
      stHtml +=
        '<button type="button" class="sticker-btn" data-add-sticker="' +
        escapeHtml(st.id) +
        '">' +
        '<img src="' +
        escapeHtml(st.src) +
        '" alt="">' +
        '<span>' +
        escapeHtml(st.name) +
        '</span>' +
        '</button>';
    }
    els.builtinStickersGrid.innerHTML = stHtml;
  }

  function handleBgFile(file) {
    if (!file) return;
    readFileAsDataUrl(file)
      .then(function (dataUrl) {
        return loadImageFromSrc(dataUrl).then(function (img) {
          state.bgImage = { name: file.name, img: img, dataUrl: dataUrl };
          state.bgFit = 'cover';
          state.bgZoom = 1;
          state.bgUnlockAspect = false;
          state.bgScaleX = 1;
          state.bgScaleY = 1;
          state.bgOffsetX = 0;
          state.bgOffsetY = 0;
          syncControlsFromState();
          renderAll();
        });
      })
      .catch(function (err) {
        alert(err.message || 'Could not load background image.');
      });
  }

  function handleTestFile(file) {
    if (!file) return;
    readFileAsDataUrl(file)
      .then(function (dataUrl) {
        return loadImageFromSrc(dataUrl).then(function (img) {
          state.testImage = { name: file.name, img: img, dataUrl: dataUrl };
          state.testFit = 'contain';
          state.testZoom = 1;
          state.testUnlockAspect = false;
          state.testScaleX = 1;
          state.testScaleY = 1;
          state.testOffsetX = 0;
          state.testOffsetY = 0;
          syncControlsFromState();
          renderAll();
        });
      })
      .catch(function (err) {
        alert(err.message || 'Could not load image file.');
      });
  }

  function handleOverlayFile(file) {
    if (!file) return;
    readFileAsDataUrl(file)
      .then(function (dataUrl) {
        return loadImageFromSrc(dataUrl).then(function (img) {
          var cleanName = file.name.replace(/\.[^.]+$/, '') || 'Uploaded PNG';
          var iw = img.naturalWidth || img.width || 1;
          var ih = img.naturalHeight || img.height || 1;
          var aspect = iw / ih;
          var defaultSize = aspect >= 1 ? clamp(Math.round(64 * aspect), 64, 220) : 72;
          return addOverlay(cleanName, dataUrl, 128, 48, defaultSize, 0, 'front', true);
        });
      })
      .catch(function (err) {
        alert(err.message || 'Could not load PNG overlay.');
      });
  }

  function bindDropzone(zoneEl, inputEl, onFile) {
    zoneEl.addEventListener('click', function () {
      inputEl.click();
    });
    zoneEl.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        inputEl.click();
      }
    });
    inputEl.addEventListener('change', function () {
      if (inputEl.files && inputEl.files[0]) {
        onFile(inputEl.files[0]);
      }
      inputEl.value = '';
    });
    zoneEl.addEventListener('dragover', function (ev) {
      ev.preventDefault();
      zoneEl.classList.add('is-dragover');
    });
    zoneEl.addEventListener('dragleave', function () {
      zoneEl.classList.remove('is-dragover');
    });
    zoneEl.addEventListener('drop', function (ev) {
      ev.preventDefault();
      zoneEl.classList.remove('is-dragover');
      if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]) {
        onFile(ev.dataTransfer.files[0]);
      }
    });
  }

  function canvasPointToLogical(ev) {
    var rect = els.displayCanvas.getBoundingClientRect();
    var x = ((ev.clientX - rect.left) / rect.width) * P.WIDTH;
    var y = ((ev.clientY - rect.top) / rect.height) * P.HEIGHT;
    return { x: x, y: y };
  }

  function getSelectionBox() {
    if (!uiState.selection || state.appMode !== 'create') return null;
    if (uiState.selection.type === 'overlay') {
      var ov = getOverlayById(uiState.selection.id);
      if (ov && ov._drawW && ov._drawH) {
        return {
          target: uiState.selection,
          cx: ov.x,
          cy: ov.y,
          w: ov._drawW,
          h: ov._drawH,
          rotation: ov.rotation || 0
        };
      }
    } else if (uiState.selection.type === 'text') {
      var m = getLineMetric(uiState.selection.index);
      if (m) {
        return {
          target: uiState.selection,
          cx: m.cx,
          cy: m.cy,
          w: m.boxW,
          h: m.boxH,
          rotation: m.rotation || 0
        };
      }
    }
    return null;
  }

  function hitTestRotationHandle(pt) {
    var box = getSelectionBox();
    if (!box) return null;
    if (box.target && box.target.type === 'overlay') {
      var selOv = getOverlayById(box.target.id);
      if (selOv && selOv.kind === 'qr') return null;
    }
    var handle = R.getRotationHandlePos(box.cx, box.cy, box.w, box.h, box.rotation);
    var dx = pt.x - handle.x;
    var dy = pt.y - handle.y;
    if (dx * dx + dy * dy <= 7.5 * 7.5) {
      return {
        target: box.target,
        cx: box.cx,
        cy: box.cy,
        handleSign: handle.sign
      };
    }
    return null;
  }

  function hitTestResizeHandle(pt) {
    var ov = getSelectedOverlay();
    if (!ov || ov.kind === 'qr' || !ov._drawW || !ov._drawH) return null;
    var handle = R.getResizeHandlePos(ov.x, ov.y, ov._drawW, ov._drawH, ov.rotation || 0);
    var dx = pt.x - handle.x;
    var dy = pt.y - handle.y;
    if (dx * dx + dy * dy <= 7.5 * 7.5) {
      return {
        overlayId: ov.id,
        cx: ov.x,
        cy: ov.y,
        startSize: ov.size
      };
    }
    return null;
  }

  function hitTestOverlaysByLayer(pt, isBackLayer) {
    for (var i = state.overlays.length - 1; i >= 0; i--) {
      var ov = state.overlays[i];
      var ovIsBack = ov.layer === 'back';
      if (ovIsBack !== isBackLayer) continue;
      var w = ov._drawW || ov.size;
      var h = ov._drawH || ov.size;
      if (R.pointInRotatedBox(pt, ov.x, ov.y, w, h, ov.rotation || 0, 4)) {
        return ov;
      }
    }
    return null;
  }

  function hitTestTextLine(pt) {
    var metrics = uiState.lastMetrics;
    if (!metrics || !metrics.lines) return null;
    for (var i = metrics.lines.length - 1; i >= 0; i--) {
      var line = metrics.lines[i];
      if (R.pointInRotatedBox(pt, line.cx, line.cy, line.boxW, line.boxH, line.rotation || 0, 5)) {
        return line;
      }
    }
    return null;
  }

  function bindCanvasInteractions() {
    var canvas = els.displayCanvas;

    // Allow dropping an image file directly onto the marquee bezel in Test mode
    els.marqueeBezel.addEventListener('dragover', function (ev) {
      if (state.appMode !== 'test') return;
      ev.preventDefault();
      els.marqueeBezel.classList.add('is-dragover');
    });
    els.marqueeBezel.addEventListener('dragleave', function () {
      els.marqueeBezel.classList.remove('is-dragover');
    });
    els.marqueeBezel.addEventListener('drop', function (ev) {
      if (state.appMode !== 'test') return;
      ev.preventDefault();
      els.marqueeBezel.classList.remove('is-dragover');
      if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]) {
        handleTestFile(ev.dataTransfer.files[0]);
      }
    });

    canvas.addEventListener('pointerdown', function (ev) {
      var pt = canvasPointToLogical(ev);

      if (state.appMode === 'test') {
        if (state.testImage && state.testImage.img) {
          uiState.drag = {
            type: 'test-bg',
            startX: pt.x,
            startY: pt.y,
            origOffsetX: state.testOffsetX,
            origOffsetY: state.testOffsetY
          };
          canvas.setPointerCapture(ev.pointerId);
        }
        return;
      }

      // 1. Rotation handle of active selection
      var handleHit = hitTestRotationHandle(pt);
      if (handleHit) {
        uiState.drag = {
          type: 'rotate',
          target: handleHit.target,
          cx: handleHit.cx,
          cy: handleHit.cy,
          handleSign: handleHit.handleSign
        };
        canvas.setPointerCapture(ev.pointerId);
        renderAll();
        return;
      }

      // 1b. Corner resize handle of selected overlay
      var resizeHit = hitTestResizeHandle(pt);
      if (resizeHit) {
        uiState.drag = {
          type: 'resize',
          overlayId: resizeHit.overlayId,
          cx: resizeHit.cx,
          cy: resizeHit.cy,
          startDist: Math.max(4, Math.hypot(pt.x - resizeHit.cx, pt.y - resizeHit.cy)),
          startSize: resizeHit.startSize
        };
        canvas.setPointerCapture(ev.pointerId);
        renderAll();
        return;
      }

      // 2. Front-layer stickers (visually above text)
      var hitFront = hitTestOverlaysByLayer(pt, false);
      if (hitFront) {
        uiState.selection = { type: 'overlay', id: hitFront.id };
        uiState.drag = {
          type: 'overlay',
          overlayId: hitFront.id,
          offsetX: pt.x - hitFront.x,
          offsetY: pt.y - hitFront.y
        };
        canvas.setPointerCapture(ev.pointerId);
        syncSelectionUI();
        renderAll();
        return;
      }

      // 3. Text lines
      var hitLine = hitTestTextLine(pt);
      if (hitLine) {
        var lineObj = state.lines[hitLine.index];
        uiState.selection = { type: 'text', index: hitLine.index };
        uiState.drag = {
          type: 'text',
          index: hitLine.index,
          startX: pt.x,
          startY: pt.y,
          origOffsetX: lineObj.offsetX || 0,
          origOffsetY: lineObj.offsetY || 0,
          baseX: hitLine.cx - (lineObj.offsetX || 0),
          baseY: hitLine.cy - (lineObj.offsetY || 0)
        };
        canvas.setPointerCapture(ev.pointerId);
        syncSelectionUI();
        renderAll();
        return;
      }

      // 4. Back-layer stickers (visually behind text)
      var hitBack = hitTestOverlaysByLayer(pt, true);
      if (hitBack) {
        uiState.selection = { type: 'overlay', id: hitBack.id };
        uiState.drag = {
          type: 'overlay',
          overlayId: hitBack.id,
          offsetX: pt.x - hitBack.x,
          offsetY: pt.y - hitBack.y
        };
        canvas.setPointerCapture(ev.pointerId);
        syncSelectionUI();
        renderAll();
        return;
      }

      // 5. Empty area -> deselect, or pan background photo
      if (uiState.selection) {
        uiState.selection = null;
        syncSelectionUI();
        renderAll();
      }
      if (state.bgImage && state.bgImage.img) {
        uiState.drag = {
          type: 'bg',
          startX: pt.x,
          startY: pt.y,
          origOffsetX: state.bgOffsetX,
          origOffsetY: state.bgOffsetY
        };
        canvas.setPointerCapture(ev.pointerId);
      }
    });

    canvas.addEventListener('pointermove', function (ev) {
      var pt = canvasPointToLogical(ev);

      if (!uiState.drag) {
        if (state.appMode === 'test') {
          canvas.style.cursor = state.testImage && state.testImage.img ? 'grab' : 'default';
          return;
        }
        if (hitTestRotationHandle(pt)) {
          canvas.style.cursor = 'grab';
        } else if (hitTestResizeHandle(pt)) {
          canvas.style.cursor = 'nwse-resize';
        } else if (hitTestOverlaysByLayer(pt, false) || hitTestTextLine(pt) || hitTestOverlaysByLayer(pt, true)) {
          canvas.style.cursor = 'move';
        } else if (state.bgImage && state.bgImage.img) {
          canvas.style.cursor = 'grab';
        } else {
          canvas.style.cursor = 'default';
        }
        return;
      }

      if (uiState.drag.type === 'resize') {
        canvas.style.cursor = 'nwse-resize';
        var ovRes = getOverlayById(uiState.drag.overlayId);
        if (!ovRes) return;
        var curDist = Math.hypot(pt.x - uiState.drag.cx, pt.y - uiState.drag.cy);
        ovRes.size = clamp(Math.round(uiState.drag.startSize * (curDist / uiState.drag.startDist)), 12, 260);
        syncSelectionUI();
        renderAll();
      } else if (uiState.drag.type === 'rotate') {
        canvas.style.cursor = 'grabbing';
        var rawRad = Math.atan2(pt.y - uiState.drag.cy, pt.x - uiState.drag.cx);
        var offsetDeg = uiState.drag.handleSign === -1 ? 90 : -90;
        var deg = snapAngle(normalizeAngle((rawRad * 180) / Math.PI + offsetDeg));

        if (uiState.drag.target.type === 'overlay') {
          var ovRot = getOverlayById(uiState.drag.target.id);
          if (ovRot) ovRot.rotation = deg;
        } else if (uiState.drag.target.type === 'text') {
          var lIdx = uiState.drag.target.index;
          if (state.lines[lIdx]) {
            state.lines[lIdx].rotation = deg;
            syncLineCardValues(lIdx);
          }
        }
        syncSelectionUI();
        renderAll();
      } else if (uiState.drag.type === 'overlay') {
        canvas.style.cursor = 'grabbing';
        var ov = getOverlayById(uiState.drag.overlayId);
        if (!ov) return;
        var nextX = clamp(pt.x - uiState.drag.offsetX, 0, P.WIDTH);
        var nextY = clamp(pt.y - uiState.drag.offsetY, 0, P.HEIGHT);
        if (Math.abs(nextX - 128) <= 3) nextX = 128;
        if (Math.abs(nextY - 48) <= 3) nextY = 48;
        if (ov.kind === 'qr') {
          var totalPx = ov._drawW || (ov.qrModules + ov.qrQuietZone * 2) * ov.qrScale;
          var snapped = clampQrCenter(nextX, nextY, totalPx);
          ov.x = snapped.x;
          ov.y = snapped.y;
        } else {
          ov.x = Math.round(nextX);
          ov.y = Math.round(nextY);
        }
        syncSelectionUI();
        renderAll();
      } else if (uiState.drag.type === 'text') {
        canvas.style.cursor = 'grabbing';
        var line = state.lines[uiState.drag.index];
        var nextOx = clamp(Math.round(uiState.drag.origOffsetX + (pt.x - uiState.drag.startX)), -120, 120);
        var nextOy = clamp(Math.round(uiState.drag.origOffsetY + (pt.y - uiState.drag.startY)), -48, 48);
        // Magnetic snap to sign center
        if (Math.abs(uiState.drag.baseX + nextOx - 128) <= 3) {
          nextOx = Math.round(128 - uiState.drag.baseX);
        }
        if (Math.abs(uiState.drag.baseY + nextOy - 48) <= 3) {
          nextOy = Math.round(48 - uiState.drag.baseY);
        }
        line.offsetX = nextOx;
        line.offsetY = nextOy;
        renderAll();
      } else if (uiState.drag.type === 'bg') {
        canvas.style.cursor = 'grabbing';
        state.bgOffsetX = clamp(Math.round(uiState.drag.origOffsetX + (pt.x - uiState.drag.startX)), -220, 220);
        state.bgOffsetY = clamp(Math.round(uiState.drag.origOffsetY + (pt.y - uiState.drag.startY)), -120, 120);
        els.bgOffsetX.value = String(state.bgOffsetX);
        els.bgOffsetXVal.textContent = state.bgOffsetX + ' px';
        els.bgOffsetY.value = String(state.bgOffsetY);
        els.bgOffsetYVal.textContent = state.bgOffsetY + ' px';
        renderAll();
      } else if (uiState.drag.type === 'test-bg') {
        canvas.style.cursor = 'grabbing';
        state.testOffsetX = clamp(Math.round(uiState.drag.origOffsetX + (pt.x - uiState.drag.startX)), -220, 220);
        state.testOffsetY = clamp(Math.round(uiState.drag.origOffsetY + (pt.y - uiState.drag.startY)), -120, 120);
        els.testOffsetX.value = String(state.testOffsetX);
        els.testOffsetXVal.textContent = state.testOffsetX + ' px';
        els.testOffsetY.value = String(state.testOffsetY);
        els.testOffsetYVal.textContent = state.testOffsetY + ' px';
        renderAll();
      }
    });

    function endDrag(ev) {
      if (!uiState.drag) return;
      uiState.drag = null;
      canvas.style.cursor = 'default';
      if (canvas.hasPointerCapture && canvas.hasPointerCapture(ev.pointerId)) {
        canvas.releasePointerCapture(ev.pointerId);
      }
      renderAll();
    }

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    // Keyboard accessibility for nudging & rotating selected text or sticker
    canvas.addEventListener('keydown', function (ev) {
      if (state.appMode !== 'create' || !uiState.selection) return;

      if (ev.key === 'Escape') {
        uiState.selection = null;
        syncSelectionUI();
        renderAll();
        ev.preventDefault();
        return;
      }

      var selOv = getSelectedOverlay();
      var selLineIdx = getSelectedTextIndex();
      var step = ev.shiftKey ? 5 : 1;
      var rotStep = ev.shiftKey ? 1 : 5;
      var handled = true;

      if (selOv) {
        if (selOv.kind === 'qr') {
          var qrTotal = selOv._drawW || (selOv.qrModules + selOv.qrQuietZone * 2) * selOv.qrScale;
          var qrCurLeft = typeof selOv._left === 'number' ? selOv._left : Math.round(selOv.x - qrTotal / 2);
          var qrCurTop = typeof selOv._top === 'number' ? selOv._top : Math.round(selOv.y - qrTotal / 2);
          if (ev.key === 'ArrowLeft') qrCurLeft -= step;
          else if (ev.key === 'ArrowRight') qrCurLeft += step;
          else if (ev.key === 'ArrowUp') qrCurTop -= step;
          else if (ev.key === 'ArrowDown') qrCurTop += step;
          else if (ev.key === 'Delete' || ev.key === 'Backspace') {
            removeOverlay(selOv.id);
            ev.preventDefault();
            return;
          } else {
            handled = false;
          }
          if (handled) {
            var qrClamped = clampQrCenter(qrCurLeft + qrTotal / 2, qrCurTop + qrTotal / 2, qrTotal);
            selOv.x = qrClamped.x;
            selOv.y = qrClamped.y;
          }
        } else {
          if (ev.key === 'ArrowLeft') selOv.x = clamp(selOv.x - step, 0, P.WIDTH);
          else if (ev.key === 'ArrowRight') selOv.x = clamp(selOv.x + step, 0, P.WIDTH);
          else if (ev.key === 'ArrowUp') selOv.y = clamp(selOv.y - step, 0, P.HEIGHT);
          else if (ev.key === 'ArrowDown') selOv.y = clamp(selOv.y + step, 0, P.HEIGHT);
          else if (ev.key === '[') selOv.rotation = normalizeAngle((selOv.rotation || 0) - rotStep);
          else if (ev.key === ']') selOv.rotation = normalizeAngle((selOv.rotation || 0) + rotStep);
          else if (ev.key === '0') selOv.rotation = 0;
          else if (ev.key === 'Delete' || ev.key === 'Backspace') {
            removeOverlay(selOv.id);
            ev.preventDefault();
            return;
          } else {
            handled = false;
          }
        }
      } else if (selLineIdx !== null && state.lines[selLineIdx]) {
        var line = state.lines[selLineIdx];
        if (ev.key === 'ArrowLeft') line.offsetX = clamp((line.offsetX || 0) - step, -120, 120);
        else if (ev.key === 'ArrowRight') line.offsetX = clamp((line.offsetX || 0) + step, -120, 120);
        else if (ev.key === 'ArrowUp') line.offsetY = clamp((line.offsetY || 0) - step, -48, 48);
        else if (ev.key === 'ArrowDown') line.offsetY = clamp((line.offsetY || 0) + step, -48, 48);
        else if (ev.key === '[') line.rotation = normalizeAngle((line.rotation || 0) - rotStep);
        else if (ev.key === ']') line.rotation = normalizeAngle((line.rotation || 0) + rotStep);
        else if (ev.key === '0') line.rotation = 0;
        else if (ev.key === 'Delete' || ev.key === 'Backspace') {
          removeLine(selLineIdx);
          ev.preventDefault();
          return;
        } else handled = false;

        if (handled) {
          syncLineCardValues(selLineIdx);
        }
      } else {
        handled = false;
      }

      if (handled) {
        ev.preventDefault();
        syncSelectionUI();
        renderAll();
      }
    });
  }

  function removeOverlay(id) {
    state.overlays = state.overlays.filter(function (o) {
      return o.id !== id;
    });
    if (uiState.selection && uiState.selection.type === 'overlay' && uiState.selection.id === id) {
      uiState.selection = state.overlays.length
        ? { type: 'overlay', id: state.overlays[state.overlays.length - 1].id }
        : null;
    }
    syncSelectionUI();
    syncQrPanelUI();
    renderAll();
  }

  function bindEvents() {
    // Modal guide
    els.openGuideBtn.addEventListener('click', function () {
      if (els.guideDialog.showModal) els.guideDialog.showModal();
      else els.guideDialog.setAttribute('open', '');
    });
    els.closeGuideBtn.addEventListener('click', function () {
      if (els.guideDialog.close) els.guideDialog.close();
      else els.guideDialog.removeAttribute('open');
    });
    els.guideDialog.addEventListener('click', function (ev) {
      if (ev.target === els.guideDialog && els.guideDialog.close) {
        els.guideDialog.close();
      }
    });

    // Global delegated clicks
    document.addEventListener('click', function (ev) {
      var appModeBtn = ev.target.closest('[data-app-mode]');
      if (appModeBtn) {
        setAppMode(appModeBtn.getAttribute('data-app-mode'));
        return;
      }

      var modeBtn = ev.target.closest('[data-preview-mode]');
      if (modeBtn) {
        state.previewMode = modeBtn.getAttribute('data-preview-mode');
        syncControlsFromState();
        renderAll();
        return;
      }

      var presetBtn = ev.target.closest('[data-preset-id]');
      if (presetBtn) {
        applyPreset(presetBtn.getAttribute('data-preset-id'), false);
        return;
      }

      var tabBtn = ev.target.closest('[role="tab"]');
      if (tabBtn) {
        switchTab(tabBtn.id);
        return;
      }

      var alignBtn = ev.target.closest('[data-align]');
      if (alignBtn) {
        state.align = alignBtn.getAttribute('data-align');
        syncControlsFromState();
        renderAll();
        return;
      }

      var moveUpBtn = ev.target.closest('[data-line-move-up]');
      if (moveUpBtn && !moveUpBtn.disabled) {
        moveLine(Number(moveUpBtn.getAttribute('data-line-move-up')), -1);
        return;
      }

      var moveDownBtn = ev.target.closest('[data-line-move-down]');
      if (moveDownBtn && !moveDownBtn.disabled) {
        moveLine(Number(moveDownBtn.getAttribute('data-line-move-down')), 1);
        return;
      }

      var dupLineBtn = ev.target.closest('[data-line-duplicate]');
      if (dupLineBtn && !dupLineBtn.disabled) {
        duplicateLine(Number(dupLineBtn.getAttribute('data-line-duplicate')));
        return;
      }

      var delLineBtn = ev.target.closest('[data-line-delete]');
      if (delLineBtn) {
        removeLine(Number(delLineBtn.getAttribute('data-line-delete')));
        return;
      }

      var clearBtn = ev.target.closest('[data-line-clear]');
      if (clearBtn) {
        var idx = Number(clearBtn.getAttribute('data-line-clear'));
        if (state.lines[idx]) {
          state.lines[idx].text = '';
          syncLineCardValues(idx);
          var clearedInput = els.linesStack ? els.linesStack.querySelector('[data-line-text="' + idx + '"]') : null;
          if (clearedInput) clearedInput.value = '';
        }
        if (uiState.selection && uiState.selection.type === 'text' && uiState.selection.index === idx) {
          uiState.selection = null;
        }
        syncSelectionUI();
        renderAll();
        return;
      }

      var resetLineBtn = ev.target.closest('[data-line-reset-transform]');
      if (resetLineBtn) {
        var rIdx = Number(resetLineBtn.getAttribute('data-line-reset-transform'));
        if (state.lines[rIdx]) {
          state.lines[rIdx].offsetX = 0;
          state.lines[rIdx].offsetY = 0;
          state.lines[rIdx].rotation = 0;
          syncLineCardValues(rIdx);
        }
        syncSelectionUI();
        renderAll();
        return;
      }

      var swBtn = ev.target.closest('[data-swatch-target]');
      if (swBtn) {
        var targetType = swBtn.getAttribute('data-swatch-target');
        var colorHex = swBtn.getAttribute('data-swatch-color');
        if (targetType === 'line') {
          var lIdx = Number(swBtn.getAttribute('data-swatch-index'));
          if (state.lines[lIdx]) {
            state.lines[lIdx].color = colorHex;
            syncLineCardValues(lIdx);
          }
        } else if (targetType === 'bg') {
          state.bgColor = colorHex;
          els.bgColor.value = colorHex;
        } else if (targetType === 'bg2') {
          state.bgColor2 = colorHex;
          els.bgColor2.value = colorHex;
        } else if (targetType === 'motif') {
          state.motifColor = colorHex;
          els.motifColor.value = colorHex;
        }
        renderAll();
        return;
      }

      var addStickerBtn = ev.target.closest('[data-add-sticker]');
      if (addStickerBtn) {
        var sid = addStickerBtn.getAttribute('data-add-sticker');
        var st = P.getStickerById(sid);
        if (st) {
          addOverlay(st.name, st.src, 128, 48, st.defaultSize || 42, 0, 'front', true);
        }
        return;
      }

      var selectOvBtn = ev.target.closest('[data-select-overlay]');
      if (selectOvBtn) {
        uiState.selection = { type: 'overlay', id: selectOvBtn.getAttribute('data-select-overlay') };
        syncSelectionUI();
        renderAll();
        return;
      }

      var removeOvBtn = ev.target.closest('[data-remove-overlay]');
      if (removeOvBtn) {
        removeOverlay(removeOvBtn.getAttribute('data-remove-overlay'));
        return;
      }

      var nudgeBtn = ev.target.closest('[data-nudge]');
      if (nudgeBtn) {
        var sel = getSelectedOverlay();
        if (!sel) return;
        var dir = nudgeBtn.getAttribute('data-nudge');
        var step = sel.kind === 'qr' ? 1 : 2;
        var nx = sel.x;
        var ny = sel.y;
        if (dir === 'left') nx -= step;
        else if (dir === 'right') nx += step;
        else if (dir === 'up') ny -= step;
        else if (dir === 'down') ny += step;

        if (sel.kind === 'qr') {
          var qTotal = sel._drawW || (sel.qrModules + sel.qrQuietZone * 2) * sel.qrScale;
          var qPos = clampQrCenter(nx, ny, qTotal);
          sel.x = qPos.x;
          sel.y = qPos.y;
        } else {
          sel.x = clamp(nx, 0, P.WIDTH);
          sel.y = clamp(ny, 0, P.HEIGHT);
        }
        syncSelectionUI();
        renderAll();
        return;
      }

      var qrScaleBtn = ev.target.closest('[data-qr-scale]');
      if (qrScaleBtn && !qrScaleBtn.disabled) {
        state.qrDraft.scaleMode = qrScaleBtn.getAttribute('data-qr-scale');
        if (getQrOverlay()) upsertQrOverlay(false, null, false);
        else syncQrPanelUI();
        return;
      }

      var qrQzBtn = ev.target.closest('[data-qr-qz]');
      if (qrQzBtn) {
        state.qrDraft.quietZoneMode = qrQzBtn.getAttribute('data-qr-qz');
        if (getQrOverlay()) upsertQrOverlay(false, null, false);
        else syncQrPanelUI();
        return;
      }

      var bgQuickBtn = ev.target.closest('[data-bg-quick]');
      if (bgQuickBtn) {
        applyQuickImageResize('bg', bgQuickBtn.getAttribute('data-bg-quick'));
        return;
      }

      var testQuickBtn = ev.target.closest('[data-test-quick]');
      if (testQuickBtn) {
        applyQuickImageResize('test', testQuickBtn.getAttribute('data-test-quick'));
        return;
      }

      var testBgFillBtn = ev.target.closest('[data-test-bg-color]');
      if (testBgFillBtn) {
        state.testBgColor = testBgFillBtn.getAttribute('data-test-bg-color');
        els.testBgColor.value = state.testBgColor;
        renderAll();
      }
    });

    els.resetBtn.addEventListener('click', function () {
      applyPreset('springer-stingers', true);
    });

    // Quick selection bar controls
    els.quickSize.addEventListener('input', function () {
      var sel = getSelectedOverlay();
      var selLineIdx = getSelectedTextIndex();
      if (sel) {
        sel.size = Number(els.quickSize.value);
      } else if (selLineIdx !== null && state.lines[selLineIdx]) {
        state.lines[selLineIdx].size = Number(els.quickSize.value);
        syncLineCardValues(selLineIdx);
      } else {
        return;
      }
      syncSelectionUI();
      renderAll();
    });

    els.quickRotate.addEventListener('input', function () {
      var deg = Number(els.quickRotate.value);
      var selOv = getSelectedOverlay();
      var selLineIdx = getSelectedTextIndex();
      if (selOv) {
        selOv.rotation = deg;
      } else if (selLineIdx !== null && state.lines[selLineIdx]) {
        state.lines[selLineIdx].rotation = deg;
        syncLineCardValues(selLineIdx);
      }
      syncSelectionUI();
      renderAll();
    });

    els.quickRotateReset.addEventListener('click', function () {
      var selOv = getSelectedOverlay();
      var selLineIdx = getSelectedTextIndex();
      if (selOv) {
        selOv.rotation = 0;
      } else if (selLineIdx !== null && state.lines[selLineIdx]) {
        state.lines[selLineIdx].rotation = 0;
        syncLineCardValues(selLineIdx);
      }
      syncSelectionUI();
      renderAll();
    });

    els.quickCenterBtn.addEventListener('click', function () {
      var selOv = getSelectedOverlay();
      var selLineIdx = getSelectedTextIndex();
      if (selOv) {
        if (selOv.kind === 'qr') {
          placeQrWithTextShift(selOv, 'center', false);
        } else {
          selOv.x = 128;
          selOv.y = 48;
        }
      } else if (selLineIdx !== null) {
        state.lines[selLineIdx].offsetX = 0;
        state.lines[selLineIdx].offsetY = 0;
      }
      syncSelectionUI();
      renderAll();
    });

    els.quickEditQrBtn.addEventListener('click', function () {
      switchTab('tab-qr');
      if (els.qrUrl) els.qrUrl.focus();
    });

    els.quickFrontBtn.addEventListener('click', function () {
      var sel = getSelectedOverlay();
      if (sel) bringOverlayToFront(sel.id);
    });

    els.quickBackBtn.addEventListener('click', function () {
      var sel = getSelectedOverlay();
      if (sel) sendOverlayToBack(sel.id);
    });

    els.quickDeleteBtn.addEventListener('click', function () {
      var sel = getSelectedOverlay();
      var selLineIdx = getSelectedTextIndex();
      if (sel) {
        removeOverlay(sel.id);
      } else if (selLineIdx !== null) {
        removeLine(selLineIdx);
      }
    });

    els.quickDeselectBtn.addEventListener('click', function () {
      uiState.selection = null;
      syncSelectionUI();
      renderAll();
    });

    // Text inputs
    els.fontSelect.addEventListener('change', function () {
      var val = els.fontSelect.value;
      if (val === 'mixed') return;
      state.fontId = val;
      for (var i = 0; i < state.lines.length; i++) {
        state.lines[i].fontId = val;
        syncLineCardValues(i);
      }
      ensureFontLoaded(val);
      renderAll();
    });

    els.autoFit.addEventListener('change', function () {
      state.autoFit = els.autoFit.checked;
      renderAll();
    });

    els.textOutline.addEventListener('change', function () {
      state.textOutline = els.textOutline.checked;
      renderAll();
    });

    els.resetTextTransformsBtn.addEventListener('click', function () {
      for (var t = 0; t < state.lines.length; t++) {
        state.lines[t].offsetX = 0;
        state.lines[t].offsetY = 0;
        state.lines[t].rotation = 0;
      }
      syncControlsFromState();
      renderAll();
    });

    els.addLineBtn.addEventListener('click', function () {
      addLine();
    });

    els.linesStack.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t.hasAttribute('data-line-text')) {
        var idx = Number(t.getAttribute('data-line-text'));
        if (state.lines[idx]) {
          state.lines[idx].text = t.value;
          renderAll();
        }
      } else if (t.hasAttribute('data-line-size')) {
        var sIdx = Number(t.getAttribute('data-line-size'));
        if (state.lines[sIdx]) {
          var val = Number(t.value);
          state.lines[sIdx].size = val;
          var sizeVal = els.linesStack.querySelector('[data-line-size-val="' + sIdx + '"]');
          if (sizeVal) sizeVal.textContent = val + 'px';
          syncSelectionUI();
          renderAll();
        }
      } else if (t.hasAttribute('data-line-rotate')) {
        var rIdx = Number(t.getAttribute('data-line-rotate'));
        if (state.lines[rIdx]) {
          var deg = Number(t.value);
          state.lines[rIdx].rotation = deg;
          var rotVal = els.linesStack.querySelector('[data-line-rotate-val="' + rIdx + '"]');
          if (rotVal) rotVal.textContent = deg + '°';
          syncSelectionUI();
          renderAll();
        }
      } else if (t.hasAttribute('data-line-color')) {
        var cIdx = Number(t.getAttribute('data-line-color'));
        if (state.lines[cIdx]) {
          state.lines[cIdx].color = t.value;
          renderAll();
        }
      }
    });

    els.linesStack.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.hasAttribute('data-line-font')) {
        var fIdx = Number(t.getAttribute('data-line-font'));
        if (state.lines[fIdx]) {
          state.lines[fIdx].fontId = t.value;
          syncGlobalFontSelect();
          ensureFontLoaded(t.value);
          renderAll();
        }
      }
    });

    els.linesStack.addEventListener('keydown', function (ev) {
      var t = ev.target;
      if (ev.key === 'Enter' && t.hasAttribute('data-line-text')) {
        ev.preventDefault();
        if (state.lines.length >= MAX_LINES) return;
        var idx = Number(t.getAttribute('data-line-text'));
        if (!state.lines[idx]) return;
        var start = typeof t.selectionStart === 'number' ? t.selectionStart : t.value.length;
        var end = typeof t.selectionEnd === 'number' ? t.selectionEnd : start;
        var leftText = t.value.slice(0, start).replace(/\s+$/, '');
        var rightText = t.value.slice(end).replace(/^\s+/, '');
        state.lines[idx].text = leftText;
        addLine(idx, rightText);
      }
    });

    els.linesStack.addEventListener('focusin', function (ev) {
      var card = ev.target.closest('[data-line-card]');
      if (!card) return;
      var idx = Number(card.getAttribute('data-line-card'));
      if (!state.lines[idx]) return;
      if (!uiState.selection || uiState.selection.type !== 'text' || uiState.selection.index !== idx) {
        uiState.selection = { type: 'text', index: idx };
        syncSelectionUI();
        renderAll();
      }
    });

    // Background controls
    els.bgStyle.addEventListener('change', function () {
      state.bgStyle = els.bgStyle.value;
      if (state.bgStyle === 'gradient' && state.bgColor.toLowerCase() === state.bgColor2.toLowerCase()) {
        var lum = A.relativeLuminance(state.bgColor);
        if (lum > 0.5) {
          state.bgColor2 = state.bgColor.toLowerCase() === '#38bdf8' ? '#ffd60a' : '#38bdf8';
        } else {
          state.bgColor2 = '#2563eb';
        }
        els.bgColor2.value = state.bgColor2;
      }
      els.bgColor2Wrap.hidden = state.bgStyle !== 'gradient';
      els.bgGradDirWrap.hidden = state.bgStyle !== 'gradient';
      renderAll();
    });
    els.bgGradDir.addEventListener('change', function () {
      state.bgGradDir = els.bgGradDir.value;
      renderAll();
    });
    els.bgColor.addEventListener('input', function () {
      state.bgColor = els.bgColor.value;
      renderAll();
    });
    els.bgColor2.addEventListener('input', function () {
      state.bgColor2 = els.bgColor2.value;
      renderAll();
    });
    els.motifSelect.addEventListener('change', function () {
      state.motif = els.motifSelect.value;
      els.motifColorWrap.hidden = state.motif === 'none' || state.motif === 'confetti';
      renderAll();
    });
    els.motifColor.addEventListener('input', function () {
      state.motifColor = els.motifColor.value;
      renderAll();
    });

    bindDropzone(els.bgDropzone, els.bgFileInput, handleBgFile);
    bindDropzone(els.overlayDropzone, els.overlayFileInput, handleOverlayFile);
    bindDropzone(els.testDropzone, els.testFileInput, handleTestFile);

    function bindImageResizeControls(prefix) {
      els[prefix + 'Fit'].addEventListener('change', function () {
        state[prefix + 'Fit'] = els[prefix + 'Fit'].value;
        renderAll();
      });
      els[prefix + 'Zoom'].addEventListener('input', function () {
        var z = Number(els[prefix + 'Zoom'].value);
        state[prefix + 'Zoom'] = z;
        state[prefix + 'ScaleX'] = z;
        state[prefix + 'ScaleY'] = z;
        els[prefix + 'ZoomVal'].textContent = Math.round(z * 100) + '%';
        renderAll();
      });
      els[prefix + 'UnlockAspect'].addEventListener('change', function () {
        var unlocked = els[prefix + 'UnlockAspect'].checked;
        state[prefix + 'UnlockAspect'] = unlocked;
        if (unlocked) {
          state[prefix + 'ScaleX'] = state[prefix + 'Zoom'];
          state[prefix + 'ScaleY'] = state[prefix + 'Zoom'];
        } else {
          state[prefix + 'Zoom'] = state[prefix + 'ScaleX'];
        }
        syncControlsFromState();
        renderAll();
      });
      els[prefix + 'ScaleX'].addEventListener('input', function () {
        var sx = Number(els[prefix + 'ScaleX'].value);
        state[prefix + 'ScaleX'] = sx;
        els[prefix + 'ScaleXVal'].textContent = Math.round(sx * 100) + '%';
        renderAll();
      });
      els[prefix + 'ScaleY'].addEventListener('input', function () {
        var sy = Number(els[prefix + 'ScaleY'].value);
        state[prefix + 'ScaleY'] = sy;
        els[prefix + 'ScaleYVal'].textContent = Math.round(sy * 100) + '%';
        renderAll();
      });
      els[prefix + 'OffsetX'].addEventListener('input', function () {
        state[prefix + 'OffsetX'] = Number(els[prefix + 'OffsetX'].value);
        els[prefix + 'OffsetXVal'].textContent = state[prefix + 'OffsetX'] + ' px';
        renderAll();
      });
      els[prefix + 'OffsetY'].addEventListener('input', function () {
        state[prefix + 'OffsetY'] = Number(els[prefix + 'OffsetY'].value);
        els[prefix + 'OffsetYVal'].textContent = state[prefix + 'OffsetY'] + ' px';
        renderAll();
      });
      els[prefix + 'CenterBtn'].addEventListener('click', function () {
        state[prefix + 'Zoom'] = 1;
        state[prefix + 'UnlockAspect'] = false;
        state[prefix + 'ScaleX'] = 1;
        state[prefix + 'ScaleY'] = 1;
        state[prefix + 'OffsetX'] = 0;
        state[prefix + 'OffsetY'] = 0;
        syncControlsFromState();
        renderAll();
      });
      els[prefix + 'RemoveBtn'].addEventListener('click', function () {
        state[prefix + 'Image'] = null;
        syncControlsFromState();
        renderAll();
      });
    }

    bindImageResizeControls('bg');
    bindImageResizeControls('test');

    els.bgScrim.addEventListener('input', function () {
      var pct = Number(els.bgScrim.value);
      state.bgScrim = pct / 100;
      els.bgScrimVal.textContent = pct + '%';
      renderAll();
    });
    els.testBgColor.addEventListener('input', function () {
      state.testBgColor = els.testBgColor.value;
      renderAll();
    });

    // Selected overlay sliders & actions
    els.ovSize.addEventListener('input', function () {
      var sel = getSelectedOverlay();
      if (!sel) return;
      sel.size = Number(els.ovSize.value);
      syncSelectionUI();
      renderAll();
    });
    els.ovRotate.addEventListener('input', function () {
      var sel = getSelectedOverlay();
      if (!sel) return;
      sel.rotation = Number(els.ovRotate.value);
      syncSelectionUI();
      renderAll();
    });
    els.ovX.addEventListener('input', function () {
      var sel = getSelectedOverlay();
      if (!sel) return;
      var val = Number(els.ovX.value);
      if (sel.kind === 'qr') {
        var totalPx = sel._drawW || (sel.qrModules + sel.qrQuietZone * 2) * sel.qrScale;
        sel.x = clampQrCenter(val, sel.y, totalPx).x;
      } else {
        sel.x = val;
      }
      els.ovXVal.textContent = String(Math.round(sel.x));
      renderAll();
    });
    els.ovY.addEventListener('input', function () {
      var sel = getSelectedOverlay();
      if (!sel) return;
      var val = Number(els.ovY.value);
      if (sel.kind === 'qr') {
        var totalPx = sel._drawW || (sel.qrModules + sel.qrQuietZone * 2) * sel.qrScale;
        sel.y = clampQrCenter(sel.x, val, totalPx).y;
      } else {
        sel.y = val;
      }
      els.ovYVal.textContent = String(Math.round(sel.y));
      renderAll();
    });
    els.ovCenterBtn.addEventListener('click', function () {
      var sel = getSelectedOverlay();
      if (!sel) return;
      if (sel.kind === 'qr') {
        placeQrWithTextShift(sel, 'center', false);
      } else {
        sel.x = 128;
        sel.y = 48;
      }
      syncSelectionUI();
      renderAll();
    });
    els.ovFrontBtn.addEventListener('click', function () {
      var sel = getSelectedOverlay();
      if (sel) bringOverlayToFront(sel.id);
    });
    els.ovBackBtn.addEventListener('click', function () {
      var sel = getSelectedOverlay();
      if (sel) sendOverlayToBack(sel.id);
    });
    els.ovDeleteBtn.addEventListener('click', function () {
      var sel = getSelectedOverlay();
      if (sel) removeOverlay(sel.id);
    });

    // Tab 5: Pixel-Locked QR Code controls
    els.qrUrl.addEventListener('input', function () {
      state.qrDraft.url = els.qrUrl.value;
      if (getQrOverlay()) upsertQrOverlay(false, null, false);
      else syncQrPanelUI();
    });
    els.qrClearBtn.addEventListener('click', function () {
      state.qrDraft.url = '';
      els.qrUrl.value = '';
      syncQrPanelUI();
      els.qrUrl.focus();
    });
    els.qrUppercase.addEventListener('change', function () {
      state.qrDraft.uppercase = els.qrUppercase.checked;
      if (getQrOverlay()) upsertQrOverlay(false, null, false);
      else syncQrPanelUI();
    });
    els.qrEcc.addEventListener('change', function () {
      state.qrDraft.ecc = els.qrEcc.value;
      if (getQrOverlay()) upsertQrOverlay(false, null, false);
      else syncQrPanelUI();
    });
    els.qrAddBtn.addEventListener('click', function () {
      var existing = getQrOverlay();
      upsertQrOverlay(true, existing ? null : 'right', !existing);
    });
    els.qrRemoveBtn.addEventListener('click', function () {
      var existing = getQrOverlay();
      if (existing) removeOverlay(existing.id);
    });
    els.qrPlaceLeftBtn.addEventListener('click', function () {
      var existing = getQrOverlay();
      if (existing) {
        placeQrWithTextShift(existing, 'left', true);
        uiState.selection = { type: 'overlay', id: existing.id };
        syncSelectionUI();
        renderAll();
      } else {
        upsertQrOverlay(true, 'left', true);
      }
    });
    els.qrPlaceRightBtn.addEventListener('click', function () {
      var existing = getQrOverlay();
      if (existing) {
        placeQrWithTextShift(existing, 'right', true);
        uiState.selection = { type: 'overlay', id: existing.id };
        syncSelectionUI();
        renderAll();
      } else {
        upsertQrOverlay(true, 'right', true);
      }
    });
    els.qrPlaceCenterBtn.addEventListener('click', function () {
      var existing = getQrOverlay();
      if (existing) {
        placeQrWithTextShift(existing, 'center', false);
        uiState.selection = { type: 'overlay', id: existing.id };
        syncSelectionUI();
        renderAll();
      } else {
        upsertQrOverlay(true, 'center', false);
      }
    });

    // Quality & Export
    els.jpgQuality.addEventListener('input', function () {
      var q = Number(els.jpgQuality.value);
      state.jpgQuality = q / 100;
      els.jpgQualityVal.textContent = q + '%';
      scheduleSizeEstimate();
    });

    els.downloadBtn.addEventListener('click', function () {
      R.renderSource(sourceCtx, state);
      R.exportJpgBlob(sourceCanvas, state.jpgQuality)
        .then(function (blob) {
          var url = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = url;
          link.download = buildFilename();
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(function () {
            URL.revokeObjectURL(url);
          }, 1500);
        })
        .catch(function (err) {
          alert(err.message || 'Could not export JPG file.');
        });
    });

    bindCanvasInteractions();
  }

  function cacheElements() {
    els.brandLogoImg = $('brand-logo-img');
    els.modeCreateBtn = $('mode-create-btn');
    els.modeTestBtn = $('mode-test-btn');
    els.createModePanel = $('create-mode-panel');
    els.testModePanel = $('test-mode-panel');

    els.marqueeBezel = $('marquee-bezel');
    els.displayCanvas = $('display-canvas');
    els.actualCanvas = $('actual-canvas');
    els.canvasInteractionHint = $('canvas-interaction-hint');
    els.checksList = $('checks-list');
    els.downloadBtn = $('download-btn');
    els.downloadBtnLabel = $('download-btn-label');
    els.fileSizeBadge = $('file-size-badge');
    els.filenamePreview = $('filename-preview');
    els.jpgQuality = $('jpg-quality');
    els.jpgQualityVal = $('jpg-quality-val');
    els.resetBtn = $('reset-btn');
    els.openGuideBtn = $('open-guide-btn');
    els.closeGuideBtn = $('close-guide-btn');
    els.guideDialog = $('guide-dialog');
    els.presetsGrid = $('presets-grid');

    els.quickSelectionBar = $('quick-selection-bar');
    els.quickSelLabel = $('quick-sel-label');
    els.quickSizeWrap = $('quick-size-wrap');
    els.quickSize = $('quick-size');
    els.quickSizeVal = $('quick-size-val');
    els.quickRotateWrap = $('quick-rotate-wrap');
    els.quickRotate = $('quick-rotate');
    els.quickRotateVal = $('quick-rotate-val');
    els.quickRotateReset = $('quick-rotate-reset');
    els.quickEditQrBtn = $('quick-edit-qr-btn');
    els.quickCenterBtn = $('quick-center-btn');
    els.quickLayerWrap = $('quick-layer-wrap');
    els.quickFrontBtn = $('quick-front-btn');
    els.quickBackBtn = $('quick-back-btn');
    els.quickDeleteBtn = $('quick-delete-btn');
    els.quickDeselectBtn = $('quick-deselect-btn');

    els.fontSelect = $('font-select');
    els.autoFit = $('auto-fit');
    els.textOutline = $('text-outline');
    els.resetTextTransformsBtn = $('reset-text-transforms-btn');
    els.addLineBtn = $('add-line-btn');
    els.lineCountHint = $('line-count-hint');
    els.linesStack = $('lines-stack');

    els.bgStyle = $('bg-style');
    els.bgGradDir = $('bg-grad-dir');
    els.bgGradDirWrap = $('bg-grad-dir-wrap');
    els.bgColor = $('bg-color');
    els.bgColor2 = $('bg-color2');
    els.bgColor2Wrap = $('bg-color2-wrap');
    els.bgSwatches = $('bg-swatches');
    els.bgSwatches2 = $('bg-swatches-2');
    els.motifSelect = $('motif-select');
    els.motifColor = $('motif-color');
    els.motifSwatches = $('motif-swatches');
    els.motifColorWrap = $('motif-color-wrap');

    els.bgDropzone = $('bg-dropzone');
    els.bgFileInput = $('bg-file-input');
    els.bgImageControls = $('bg-image-controls');
    els.bgImageMeta = $('bg-image-meta');
    els.bgFit = $('bg-fit');
    els.bgZoomWrap = $('bg-zoom-wrap');
    els.bgZoom = $('bg-zoom');
    els.bgZoomVal = $('bg-zoom-val');
    els.bgUnlockAspect = $('bg-unlock-aspect');
    els.bgScaleXyWrap = $('bg-scale-xy-wrap');
    els.bgScaleX = $('bg-scale-x');
    els.bgScaleXVal = $('bg-scale-x-val');
    els.bgScaleY = $('bg-scale-y');
    els.bgScaleYVal = $('bg-scale-y-val');
    els.bgOffsetX = $('bg-offset-x');
    els.bgOffsetXVal = $('bg-offset-x-val');
    els.bgOffsetY = $('bg-offset-y');
    els.bgOffsetYVal = $('bg-offset-y-val');
    els.bgScrim = $('bg-scrim');
    els.bgScrimVal = $('bg-scrim-val');
    els.bgCenterBtn = $('bg-center-btn');
    els.bgRemoveBtn = $('bg-remove-btn');

    els.testDropzone = $('test-dropzone');
    els.testFileInput = $('test-file-input');
    els.testImageControls = $('test-image-controls');
    els.testImageMeta = $('test-image-meta');
    els.testFit = $('test-fit');
    els.testBgColor = $('test-bg-color');
    els.testZoomWrap = $('test-zoom-wrap');
    els.testZoom = $('test-zoom');
    els.testZoomVal = $('test-zoom-val');
    els.testUnlockAspect = $('test-unlock-aspect');
    els.testScaleXyWrap = $('test-scale-xy-wrap');
    els.testScaleX = $('test-scale-x');
    els.testScaleXVal = $('test-scale-x-val');
    els.testScaleY = $('test-scale-y');
    els.testScaleYVal = $('test-scale-y-val');
    els.testOffsetX = $('test-offset-x');
    els.testOffsetXVal = $('test-offset-x-val');
    els.testOffsetY = $('test-offset-y');
    els.testOffsetYVal = $('test-offset-y-val');
    els.testCenterBtn = $('test-center-btn');
    els.testRemoveBtn = $('test-remove-btn');

    els.overlayDropzone = $('overlay-dropzone');
    els.overlayFileInput = $('overlay-file-input');
    els.builtinStickersGrid = $('builtin-stickers-grid');
    els.activeOverlaysList = $('active-overlays-list');
    els.selectedOverlayControls = $('selected-overlay-controls');
    els.ovQrLockNote = $('ov-qr-lock-note');
    els.ovTransformRow = $('ov-transform-row');
    els.ovSize = $('ov-size');
    els.ovSizeVal = $('ov-size-val');
    els.ovRotate = $('ov-rotate');
    els.ovRotateVal = $('ov-rotate-val');
    els.ovX = $('ov-x');
    els.ovXVal = $('ov-x-val');
    els.ovY = $('ov-y');
    els.ovYVal = $('ov-y-val');
    els.ovCenterBtn = $('ov-center-btn');
    els.ovFrontBtn = $('ov-front-btn');
    els.ovBackBtn = $('ov-back-btn');
    els.ovDeleteBtn = $('ov-delete-btn');

    els.qrUrl = $('qr-url');
    els.qrClearBtn = $('qr-clear-btn');
    els.qrUppercase = $('qr-uppercase');
    els.qrEcc = $('qr-ecc');
    els.qrAddBtn = $('qr-add-btn');
    els.qrRemoveBtn = $('qr-remove-btn');
    els.qrStatusPill = $('qr-status-pill');
    els.qrVersionMeta = $('qr-version-meta');
    els.qrDimensionsText = $('qr-dimensions-text');
    els.qrPayloadPreview = $('qr-payload-preview');
    els.qrPlaceLeftBtn = $('qr-place-left-btn');
    els.qrPlaceRightBtn = $('qr-place-right-btn');
    els.qrPlaceCenterBtn = $('qr-place-center-btn');
  }

  function init() {
    cacheElements();
    populateStaticLists();
    var logoSticker = P.getStickerById('stinger-bee');
    if (els.brandLogoImg && logoSticker) {
      els.brandLogoImg.src = logoSticker.src;
    }
    bindEvents();
    applyPreset('springer-stingers', true);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        renderAll();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
