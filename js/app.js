/**
 * Springer Elementary Marquee Maker - Main Interactive Application Controller
 */
(function (global) {
  'use strict';

  var P = global.MarqueePresets;
  var R = global.MarqueeRenderer;
  var A = global.MarqueeAnalyzer;

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
    bgOffsetX: 0,
    bgOffsetY: 0,
    bgScrim: 0.35,
    overlays: [], // [{ id, name, src, img, x, y, size, rotation, layer }]
    testImage: null, // { name, img, dataUrl }
    testFit: 'contain',
    testZoom: 1,
    testOffsetX: 0,
    testOffsetY: 0,
    jpgQuality: 0.95
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

  function renderAll() {
    var metrics = R.renderSource(sourceCtx, state);
    uiState.lastMetrics = metrics;
    R.renderDisplay(els.displayCanvas, sourceCanvas, state, uiState, metrics);

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

  function syncSelectionUI() {
    var selOv = getSelectedOverlay();
    var selLineIdx = getSelectedTextIndex();

    // Highlight matching line cards in Text tab
    for (var l = 0; l < 3; l++) {
      els.lineCard[l].classList.toggle('is-selected', state.appMode === 'create' && selLineIdx === l);
    }

    // Quick selection bar right below bezel
    if (state.appMode !== 'create' || (!selOv && selLineIdx === null)) {
      els.quickSelectionBar.hidden = true;
    } else if (selOv) {
      els.quickSelectionBar.hidden = false;
      els.quickSelLabel.textContent = 'Sticker: ' + selOv.name;
      els.quickSizeWrap.hidden = false;
      els.quickLayerWrap.hidden = false;
      els.quickSize.value = String(Math.round(selOv.size));
      els.quickSizeVal.textContent = Math.round(selOv.size) + 'px';
      els.quickRotate.value = String(Math.round(selOv.rotation || 0));
      els.quickRotateVal.textContent = Math.round(selOv.rotation || 0) + '°';
      els.quickCenterBtn.textContent = 'Center';
    } else if (selLineIdx !== null) {
      var line = state.lines[selLineIdx];
      els.quickSelectionBar.hidden = false;
      els.quickSelLabel.textContent = 'Text: Line ' + (selLineIdx + 1);
      els.quickSizeWrap.hidden = true;
      els.quickLayerWrap.hidden = true;
      els.quickRotate.value = String(Math.round(line.rotation || 0));
      els.quickRotateVal.textContent = Math.round(line.rotation || 0) + '°';
      els.quickCenterBtn.textContent = 'Reset Pos';
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
      els.selectedOverlayControls.hidden = false;
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
    els.fontSelect.value = state.fontId;
    var alignBtns = document.querySelectorAll('[data-align]');
    for (var a = 0; a < alignBtns.length; a++) {
      var aMatch = alignBtns[a].getAttribute('data-align') === state.align;
      alignBtns[a].classList.toggle('is-active', aMatch);
      alignBtns[a].setAttribute('aria-pressed', aMatch ? 'true' : 'false');
    }
    els.autoFit.checked = state.autoFit;
    els.textOutline.checked = state.textOutline;

    for (var l = 0; l < 3; l++) {
      var line = state.lines[l];
      els.lineText[l].value = line.text;
      els.lineSize[l].value = String(line.size);
      els.lineSizeVal[l].textContent = line.size + 'px';
      els.lineRotate[l].value = String(Math.round(line.rotation || 0));
      els.lineRotateVal[l].textContent = Math.round(line.rotation || 0) + '°';
      els.lineColor[l].value = line.color;
    }

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
    els.bgFit.value = state.bgFit;
    els.bgZoom.value = String(state.bgZoom);
    els.bgZoomVal.textContent = Math.round(state.bgZoom * 100) + '%';
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
      var ti = state.testImage.img;
      els.testImageMeta.textContent =
        state.testImage.name + ' • ' + (ti.naturalWidth || ti.width) + ' × ' + (ti.naturalHeight || ti.height) + ' px';
    }
    els.testFit.value = state.testFit;
    els.testZoom.value = String(state.testZoom);
    els.testZoomVal.textContent = Math.round(state.testZoom * 100) + '%';
    els.testOffsetX.value = String(state.testOffsetX);
    els.testOffsetXVal.textContent = Math.round(state.testOffsetX) + ' px';
    els.testOffsetY.value = String(state.testOffsetY);
    els.testOffsetYVal.textContent = Math.round(state.testOffsetY) + ' px';

    // Quality
    els.jpgQuality.value = String(Math.round(state.jpgQuality * 100));
    els.jpgQualityVal.textContent = Math.round(state.jpgQuality * 100) + '%';

    syncSelectionUI();
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

    for (var i = 0; i < 3; i++) {
      state.lines[i] = {
        text: c.lines[i].text,
        size: c.lines[i].size,
        color: c.lines[i].color,
        offsetX: c.lines[i].offsetX || 0,
        offsetY: c.lines[i].offsetY || 0,
        rotation: c.lines[i].rotation || 0
      };
    }

    if (clearUploads) {
      state.bgImage = null;
      state.bgFit = 'cover';
      state.bgZoom = 1;
      state.bgOffsetX = 0;
      state.bgOffsetY = 0;
      state.bgScrim = 0.35;
    }

    state.overlays = [];
    uiState.selection = null;

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
    // Font select
    var fontHtml = '';
    for (var f = 0; f < P.FONTS.length; f++) {
      fontHtml += '<option value="' + escapeHtml(P.FONTS[f].id) + '">' + escapeHtml(P.FONTS[f].label) + '</option>';
    }
    els.fontSelect.innerHTML = fontHtml;

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

    // Swatch strips for 3 text lines & background
    var swatchStrips = document.querySelectorAll('[data-line-swatches]');
    for (var s = 0; s < swatchStrips.length; s++) {
      var lineIdx = swatchStrips[s].getAttribute('data-line-swatches');
      swatchStrips[s].innerHTML = buildSwatchButtonsHtml('line', lineIdx);
    }
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
    if (!ov || !ov._drawW || !ov._drawH) return null;
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
        if (state.testImage && state.testImage.img && state.testFit !== 'stretch') {
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
      if (state.bgImage && state.bgImage.img && state.bgFit !== 'stretch') {
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
          canvas.style.cursor =
            state.testImage && state.testImage.img && state.testFit !== 'stretch' ? 'grab' : 'default';
          return;
        }
        if (hitTestRotationHandle(pt)) {
          canvas.style.cursor = 'grab';
        } else if (hitTestResizeHandle(pt)) {
          canvas.style.cursor = 'nwse-resize';
        } else if (hitTestOverlaysByLayer(pt, false) || hitTestTextLine(pt) || hitTestOverlaysByLayer(pt, true)) {
          canvas.style.cursor = 'move';
        } else if (state.bgImage && state.bgImage.img && state.bgFit !== 'stretch') {
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
          state.lines[lIdx].rotation = deg;
          els.lineRotate[lIdx].value = String(deg);
          els.lineRotateVal[lIdx].textContent = deg + '°';
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
        ov.x = Math.round(nextX);
        ov.y = Math.round(nextY);
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
        state.bgOffsetX = clamp(Math.round(uiState.drag.origOffsetX + (pt.x - uiState.drag.startX)), -160, 160);
        state.bgOffsetY = clamp(Math.round(uiState.drag.origOffsetY + (pt.y - uiState.drag.startY)), -100, 100);
        els.bgOffsetX.value = String(state.bgOffsetX);
        els.bgOffsetXVal.textContent = state.bgOffsetX + ' px';
        els.bgOffsetY.value = String(state.bgOffsetY);
        els.bgOffsetYVal.textContent = state.bgOffsetY + ' px';
        renderAll();
      } else if (uiState.drag.type === 'test-bg') {
        canvas.style.cursor = 'grabbing';
        state.testOffsetX = clamp(Math.round(uiState.drag.origOffsetX + (pt.x - uiState.drag.startX)), -160, 160);
        state.testOffsetY = clamp(Math.round(uiState.drag.origOffsetY + (pt.y - uiState.drag.startY)), -100, 100);
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
      } else if (selLineIdx !== null) {
        var line = state.lines[selLineIdx];
        if (ev.key === 'ArrowLeft') line.offsetX = clamp((line.offsetX || 0) - step, -120, 120);
        else if (ev.key === 'ArrowRight') line.offsetX = clamp((line.offsetX || 0) + step, -120, 120);
        else if (ev.key === 'ArrowUp') line.offsetY = clamp((line.offsetY || 0) - step, -48, 48);
        else if (ev.key === 'ArrowDown') line.offsetY = clamp((line.offsetY || 0) + step, -48, 48);
        else if (ev.key === '[') line.rotation = normalizeAngle((line.rotation || 0) - rotStep);
        else if (ev.key === ']') line.rotation = normalizeAngle((line.rotation || 0) + rotStep);
        else if (ev.key === '0') line.rotation = 0;
        else handled = false;

        if (handled) {
          els.lineRotate[selLineIdx].value = String(line.rotation || 0);
          els.lineRotateVal[selLineIdx].textContent = (line.rotation || 0) + '°';
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

      var clearBtn = ev.target.closest('[data-line-clear]');
      if (clearBtn) {
        var idx = Number(clearBtn.getAttribute('data-line-clear'));
        state.lines[idx].text = '';
        els.lineText[idx].value = '';
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
        state.lines[rIdx].offsetX = 0;
        state.lines[rIdx].offsetY = 0;
        state.lines[rIdx].rotation = 0;
        els.lineRotate[rIdx].value = '0';
        els.lineRotateVal[rIdx].textContent = '0°';
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
          state.lines[lIdx].color = colorHex;
          els.lineColor[lIdx].value = colorHex;
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
        if (dir === 'left') sel.x = clamp(sel.x - 2, 0, P.WIDTH);
        else if (dir === 'right') sel.x = clamp(sel.x + 2, 0, P.WIDTH);
        else if (dir === 'up') sel.y = clamp(sel.y - 2, 0, P.HEIGHT);
        else if (dir === 'down') sel.y = clamp(sel.y + 2, 0, P.HEIGHT);
        syncSelectionUI();
        renderAll();
      }
    });

    els.resetBtn.addEventListener('click', function () {
      applyPreset('springer-stingers', true);
    });

    // Quick selection bar controls
    els.quickSize.addEventListener('input', function () {
      var sel = getSelectedOverlay();
      if (!sel) return;
      sel.size = Number(els.quickSize.value);
      syncSelectionUI();
      renderAll();
    });

    els.quickRotate.addEventListener('input', function () {
      var deg = Number(els.quickRotate.value);
      var selOv = getSelectedOverlay();
      var selLineIdx = getSelectedTextIndex();
      if (selOv) {
        selOv.rotation = deg;
      } else if (selLineIdx !== null) {
        state.lines[selLineIdx].rotation = deg;
        els.lineRotate[selLineIdx].value = String(deg);
        els.lineRotateVal[selLineIdx].textContent = deg + '°';
      }
      syncSelectionUI();
      renderAll();
    });

    els.quickRotateReset.addEventListener('click', function () {
      var selOv = getSelectedOverlay();
      var selLineIdx = getSelectedTextIndex();
      if (selOv) {
        selOv.rotation = 0;
      } else if (selLineIdx !== null) {
        state.lines[selLineIdx].rotation = 0;
        els.lineRotate[selLineIdx].value = '0';
        els.lineRotateVal[selLineIdx].textContent = '0°';
      }
      syncSelectionUI();
      renderAll();
    });

    els.quickCenterBtn.addEventListener('click', function () {
      var selOv = getSelectedOverlay();
      var selLineIdx = getSelectedTextIndex();
      if (selOv) {
        selOv.x = 128;
        selOv.y = 48;
      } else if (selLineIdx !== null) {
        state.lines[selLineIdx].offsetX = 0;
        state.lines[selLineIdx].offsetY = 0;
      }
      syncSelectionUI();
      renderAll();
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
      if (sel) removeOverlay(sel.id);
    });

    els.quickDeselectBtn.addEventListener('click', function () {
      uiState.selection = null;
      syncSelectionUI();
      renderAll();
    });

    // Text inputs
    els.fontSelect.addEventListener('change', function () {
      state.fontId = els.fontSelect.value;
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
      for (var t = 0; t < 3; t++) {
        state.lines[t].offsetX = 0;
        state.lines[t].offsetY = 0;
        state.lines[t].rotation = 0;
      }
      syncControlsFromState();
      renderAll();
    });

    for (var i = 0; i < 3; i++) {
      (function (idx) {
        els.lineText[idx].addEventListener('input', function () {
          state.lines[idx].text = els.lineText[idx].value;
          renderAll();
        });
        els.lineSize[idx].addEventListener('input', function () {
          var val = Number(els.lineSize[idx].value);
          state.lines[idx].size = val;
          els.lineSizeVal[idx].textContent = val + 'px';
          renderAll();
        });
        els.lineRotate[idx].addEventListener('input', function () {
          var deg = Number(els.lineRotate[idx].value);
          state.lines[idx].rotation = deg;
          els.lineRotateVal[idx].textContent = deg + '°';
          syncSelectionUI();
          renderAll();
        });
        els.lineColor[idx].addEventListener('input', function () {
          state.lines[idx].color = els.lineColor[idx].value;
          renderAll();
        });
      })(i);
    }

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

    els.bgFit.addEventListener('change', function () {
      state.bgFit = els.bgFit.value;
      renderAll();
    });
    els.bgZoom.addEventListener('input', function () {
      state.bgZoom = Number(els.bgZoom.value);
      els.bgZoomVal.textContent = Math.round(state.bgZoom * 100) + '%';
      renderAll();
    });
    els.bgOffsetX.addEventListener('input', function () {
      state.bgOffsetX = Number(els.bgOffsetX.value);
      els.bgOffsetXVal.textContent = state.bgOffsetX + ' px';
      renderAll();
    });
    els.bgOffsetY.addEventListener('input', function () {
      state.bgOffsetY = Number(els.bgOffsetY.value);
      els.bgOffsetYVal.textContent = state.bgOffsetY + ' px';
      renderAll();
    });
    els.bgScrim.addEventListener('input', function () {
      var pct = Number(els.bgScrim.value);
      state.bgScrim = pct / 100;
      els.bgScrimVal.textContent = pct + '%';
      renderAll();
    });
    els.bgCenterBtn.addEventListener('click', function () {
      state.bgZoom = 1;
      state.bgOffsetX = 0;
      state.bgOffsetY = 0;
      syncControlsFromState();
      renderAll();
    });
    els.bgRemoveBtn.addEventListener('click', function () {
      state.bgImage = null;
      syncControlsFromState();
      renderAll();
    });

    // Test mode controls
    els.testFit.addEventListener('change', function () {
      state.testFit = els.testFit.value;
      renderAll();
    });
    els.testZoom.addEventListener('input', function () {
      state.testZoom = Number(els.testZoom.value);
      els.testZoomVal.textContent = Math.round(state.testZoom * 100) + '%';
      renderAll();
    });
    els.testOffsetX.addEventListener('input', function () {
      state.testOffsetX = Number(els.testOffsetX.value);
      els.testOffsetXVal.textContent = state.testOffsetX + ' px';
      renderAll();
    });
    els.testOffsetY.addEventListener('input', function () {
      state.testOffsetY = Number(els.testOffsetY.value);
      els.testOffsetYVal.textContent = state.testOffsetY + ' px';
      renderAll();
    });
    els.testCenterBtn.addEventListener('click', function () {
      state.testZoom = 1;
      state.testOffsetX = 0;
      state.testOffsetY = 0;
      syncControlsFromState();
      renderAll();
    });
    els.testRemoveBtn.addEventListener('click', function () {
      state.testImage = null;
      syncControlsFromState();
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
      sel.x = Number(els.ovX.value);
      els.ovXVal.textContent = String(sel.x);
      renderAll();
    });
    els.ovY.addEventListener('input', function () {
      var sel = getSelectedOverlay();
      if (!sel) return;
      sel.y = Number(els.ovY.value);
      els.ovYVal.textContent = String(sel.y);
      renderAll();
    });
    els.ovCenterBtn.addEventListener('click', function () {
      var sel = getSelectedOverlay();
      if (!sel) return;
      sel.x = 128;
      sel.y = 48;
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
    els.quickRotate = $('quick-rotate');
    els.quickRotateVal = $('quick-rotate-val');
    els.quickRotateReset = $('quick-rotate-reset');
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
    els.lineCard = [$('line-card-0'), $('line-card-1'), $('line-card-2')];
    els.lineText = [$('line-text-0'), $('line-text-1'), $('line-text-2')];
    els.lineSize = [$('line-size-0'), $('line-size-1'), $('line-size-2')];
    els.lineSizeVal = [$('line-size-val-0'), $('line-size-val-1'), $('line-size-val-2')];
    els.lineRotate = [$('line-rotate-0'), $('line-rotate-1'), $('line-rotate-2')];
    els.lineRotateVal = [$('line-rotate-val-0'), $('line-rotate-val-1'), $('line-rotate-val-2')];
    els.lineColor = [$('line-color-0'), $('line-color-1'), $('line-color-2')];

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
    els.bgFit = $('bg-fit');
    els.bgZoom = $('bg-zoom');
    els.bgZoomVal = $('bg-zoom-val');
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
    els.testZoom = $('test-zoom');
    els.testZoomVal = $('test-zoom-val');
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
