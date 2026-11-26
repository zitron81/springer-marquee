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
    presetId: 'birthday-party',
    previewMode: 'led',
    bgStyle: 'gradient',
    bgColor: '#120d31',
    bgColor2: '#25144e',
    motif: 'none',
    motifColor: '#ffd60a',
    fontId: 'fredoka',
    align: 'center',
    textOutline: true,
    autoFit: true,
    textOffsetY: 0,
    lines: [
      { text: 'HAPPY BIRTHDAY', size: 17, color: '#ffd60a' },
      { text: 'MAYA!', size: 30, color: '#ffffff' },
      { text: 'HAVE A GREAT DAY!', size: 14, color: '#ff4d8d' }
    ],
    bgImage: null, // { name, img, dataUrl }
    bgFit: 'cover',
    bgZoom: 1,
    bgOffsetX: 0,
    bgOffsetY: 0,
    bgScrim: 0.35,
    overlays: [], // [{ id, name, src, img, x, y, size }]
    jpgQuality: 0.95
  };

  var uiState = {
    selectedOverlayId: null,
    overlayCounter: 1,
    sizeTimer: null,
    drag: null
  };

  var els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
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

  function buildFilename() {
    var parts = [];
    for (var i = 0; i < state.lines.length; i++) {
      var t = (state.lines[i].text || '').trim();
      if (t) parts.push(t);
    }
    var raw = parts.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!raw && state.bgImage && state.bgImage.name) {
      raw = state.bgImage.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    if (!raw) raw = 'springer-marquee';
    if (raw.length > 40) raw = raw.slice(0, 40).replace(/-+$/g, '');
    return raw + '-256x96.jpg';
  }

  function scheduleSizeEstimate() {
    if (uiState.sizeTimer) clearTimeout(uiState.sizeTimer);
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
        '<li class="check-item ' + cls + '">' +
        '<strong>[' + icon + '] ' + escapeHtml(c.title) + '</strong>' +
        '<span>' + escapeHtml(c.detail) + '</span>' +
        '</li>';
    }
    els.checksList.innerHTML = html;
  }

  function renderAll() {
    var metrics = R.renderSource(sourceCtx, state);
    R.renderDisplay(els.displayCanvas, sourceCanvas, state, uiState);

    // Update 1:1 actual size canvas
    var actCtx = els.actualCanvas.getContext('2d');
    actCtx.imageSmoothingEnabled = false;
    actCtx.clearRect(0, 0, P.WIDTH, P.HEIGHT);
    actCtx.drawImage(sourceCanvas, 0, 0);

    // Update Readability checks
    var checks = A.analyze(state, metrics);
    renderChecks(checks);

    // Update filename preview and JPG file size estimate
    els.filenamePreview.textContent = buildFilename();
    scheduleSizeEstimate();
  }

  function syncControlsFromState() {
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
    els.textOffsetY.value = String(state.textOffsetY);
    els.textOffsetYVal.textContent = state.textOffsetY + ' px';

    for (var l = 0; l < 3; l++) {
      var line = state.lines[l];
      els.lineText[l].value = line.text;
      els.lineSize[l].value = String(line.size);
      els.lineSizeVal[l].textContent = line.size + 'px';
      els.lineColor[l].value = line.color;
    }

    // Background tab controls
    els.bgStyle.value = state.bgStyle;
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

    // Quality
    els.jpgQuality.value = String(Math.round(state.jpgQuality * 100));
    els.jpgQualityVal.textContent = Math.round(state.jpgQuality * 100) + '%';

    syncOverlayListUI();
  }

  function syncOverlayListUI() {
    if (state.overlays.length === 0) {
      els.activeOverlaysList.innerHTML = '<p class="empty-note">No stickers added yet.</p>';
      els.selectedOverlayControls.hidden = true;
      return;
    }

    if (!getOverlayById(uiState.selectedOverlayId)) {
      uiState.selectedOverlayId = state.overlays[state.overlays.length - 1].id;
    }

    var html = '';
    for (var i = state.overlays.length - 1; i >= 0; i--) {
      var ov = state.overlays[i];
      var selectedClass = ov.id === uiState.selectedOverlayId ? ' is-selected' : '';
      html +=
        '<div class="overlay-item' + selectedClass + '">' +
        '<button type="button" class="overlay-select-btn" data-select-overlay="' + escapeHtml(ov.id) + '">' +
        '<img class="overlay-thumb" src="' + escapeHtml(ov.src) + '" alt="">' +
        '<span>' + escapeHtml(ov.name) + '</span>' +
        '</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-remove-overlay="' + escapeHtml(ov.id) + '" aria-label="Remove ' + escapeHtml(ov.name) + '">Remove</button>' +
        '</div>';
    }
    els.activeOverlaysList.innerHTML = html;

    var sel = getOverlayById(uiState.selectedOverlayId);
    if (sel) {
      els.selectedOverlayControls.hidden = false;
      els.ovSize.value = String(Math.round(sel.size));
      els.ovSizeVal.textContent = Math.round(sel.size) + ' px';
      els.ovX.value = String(Math.round(sel.x));
      els.ovXVal.textContent = String(Math.round(sel.x));
      els.ovY.value = String(Math.round(sel.y));
      els.ovYVal.textContent = String(Math.round(sel.y));
    } else {
      els.selectedOverlayControls.hidden = true;
    }
  }

  function addOverlay(name, src, x, y, size) {
    return loadImageFromSrc(src).then(function (img) {
      var id = 'ov-' + uiState.overlayCounter++;
      var item = {
        id: id,
        name: name || 'Sticker',
        src: src,
        img: img,
        x: typeof x === 'number' ? x : 128,
        y: typeof y === 'number' ? y : 48,
        size: typeof size === 'number' ? size : 42
      };
      state.overlays.push(item);
      uiState.selectedOverlayId = id;
      syncOverlayListUI();
      renderAll();
      return item;
    });
  }

  function applyPreset(presetId, clearUploads) {
    var preset = P.getPresetById(presetId);
    var c = preset.config;

    state.presetId = preset.id;
    state.bgStyle = c.bgStyle;
    state.bgColor = c.bgColor;
    state.bgColor2 = c.bgColor2;
    state.motif = c.motif;
    state.motifColor = c.motifColor;
    state.fontId = c.fontId;
    state.align = c.align;
    state.textOutline = c.textOutline;
    state.autoFit = c.autoFit;
    state.textOffsetY = c.textOffsetY;

    for (var i = 0; i < 3; i++) {
      state.lines[i] = {
        text: c.lines[i].text,
        size: c.lines[i].size,
        color: c.lines[i].color
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
    uiState.selectedOverlayId = null;

    syncControlsFromState();
    renderAll();

    if (c.starterSticker) {
      var st = P.getStickerById(c.starterSticker.stickerId);
      if (st) {
        addOverlay(st.name, st.src, c.starterSticker.x, c.starterSticker.y, c.starterSticker.size);
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
      var dots = '';
      for (var d = 0; d < pr.previewColors.length; d++) {
        dots += '<span class="preset-dot" style="background:' + escapeHtml(pr.previewColors[d]) + '"></span>';
      }
      pHtml +=
        '<button type="button" class="preset-card" data-preset-id="' + escapeHtml(pr.id) + '">' +
        '<div class="preset-dots" aria-hidden="true">' + dots + '</div>' +
        '<strong>' + escapeHtml(pr.name) + '</strong>' +
        '<span>' + escapeHtml(pr.tagline) + '</span>' +
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

    // Built-in stickers
    var stHtml = '';
    for (var k = 0; k < P.BUILTIN_STICKERS.length; k++) {
      var st = P.BUILTIN_STICKERS[k];
      stHtml +=
        '<button type="button" class="sticker-btn" data-add-sticker="' + escapeHtml(st.id) + '">' +
        '<img src="' + escapeHtml(st.src) + '" alt="">' +
        '<span>' + escapeHtml(st.name) + '</span>' +
        '</button>';
    }
    els.builtinStickersGrid.innerHTML = stHtml;
  }

  function buildSwatchButtonsHtml(targetType, targetIndex) {
    var html = '';
    for (var i = 0; i < P.SWATCHES.length; i++) {
      var sw = P.SWATCHES[i];
      html +=
        '<button type="button" class="swatch-btn" ' +
        'style="background:' + escapeHtml(sw.hex) + '" ' +
        'data-swatch-target="' + targetType + '" ' +
        'data-swatch-index="' + targetIndex + '" ' +
        'data-swatch-color="' + escapeHtml(sw.hex) + '" ' +
        'title="' + escapeHtml(sw.name) + '" ' +
        'aria-label="' + escapeHtml(sw.name) + '"></button>';
    }
    return html;
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

  function handleOverlayFile(file) {
    if (!file) return;
    readFileAsDataUrl(file)
      .then(function (dataUrl) {
        var cleanName = file.name.replace(/\.[^.]+$/, '') || 'Uploaded PNG';
        return addOverlay(cleanName, dataUrl, 128, 48, 46);
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

  function hitTestOverlay(pt) {
    for (var i = state.overlays.length - 1; i >= 0; i--) {
      var ov = state.overlays[i];
      var halfW = (ov._drawW || ov.size) / 2 + 4;
      var halfH = (ov._drawH || ov.size) / 2 + 4;
      if (
        pt.x >= ov.x - halfW &&
        pt.x <= ov.x + halfW &&
        pt.y >= ov.y - halfH &&
        pt.y <= ov.y + halfH
      ) {
        return ov;
      }
    }
    return null;
  }

  function bindCanvasInteractions() {
    var canvas = els.displayCanvas;

    canvas.addEventListener('pointerdown', function (ev) {
      var pt = canvasPointToLogical(ev);
      var hit = hitTestOverlay(pt);

      if (hit) {
        uiState.selectedOverlayId = hit.id;
        uiState.drag = {
          type: 'overlay',
          overlayId: hit.id,
          offsetX: pt.x - hit.x,
          offsetY: pt.y - hit.y
        };
        canvas.setPointerCapture(ev.pointerId);
        syncOverlayListUI();
        renderAll();
      } else {
        if (uiState.selectedOverlayId) {
          uiState.selectedOverlayId = null;
          syncOverlayListUI();
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
      }
    });

    canvas.addEventListener('pointermove', function (ev) {
      if (!uiState.drag) return;
      var pt = canvasPointToLogical(ev);

      if (uiState.drag.type === 'overlay') {
        var ov = getOverlayById(uiState.drag.overlayId);
        if (!ov) return;
        var nextX = clamp(pt.x - uiState.drag.offsetX, 0, P.WIDTH);
        var nextY = clamp(pt.y - uiState.drag.offsetY, 0, P.HEIGHT);
        // Gentle magnetic snap to horizontal & vertical center
        if (Math.abs(nextX - 128) <= 3) nextX = 128;
        if (Math.abs(nextY - 48) <= 3) nextY = 48;
        ov.x = Math.round(nextX);
        ov.y = Math.round(nextY);
        syncOverlayListUI();
        renderAll();
      } else if (uiState.drag.type === 'bg') {
        state.bgOffsetX = clamp(
          Math.round(uiState.drag.origOffsetX + (pt.x - uiState.drag.startX)),
          -160,
          160
        );
        state.bgOffsetY = clamp(
          Math.round(uiState.drag.origOffsetY + (pt.y - uiState.drag.startY)),
          -100,
          100
        );
        els.bgOffsetX.value = String(state.bgOffsetX);
        els.bgOffsetXVal.textContent = state.bgOffsetX + ' px';
        els.bgOffsetY.value = String(state.bgOffsetY);
        els.bgOffsetYVal.textContent = state.bgOffsetY + ' px';
        renderAll();
      }
    });

    function endDrag(ev) {
      if (!uiState.drag) return;
      uiState.drag = null;
      if (canvas.hasPointerCapture && canvas.hasPointerCapture(ev.pointerId)) {
        canvas.releasePointerCapture(ev.pointerId);
      }
    }

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    // Keyboard accessibility for selected sticker nudging
    canvas.addEventListener('keydown', function (ev) {
      var sel = getOverlayById(uiState.selectedOverlayId);
      if (!sel) return;
      var step = ev.shiftKey ? 5 : 1;
      var handled = true;
      if (ev.key === 'ArrowLeft') sel.x = clamp(sel.x - step, 0, P.WIDTH);
      else if (ev.key === 'ArrowRight') sel.x = clamp(sel.x + step, 0, P.WIDTH);
      else if (ev.key === 'ArrowUp') sel.y = clamp(sel.y - step, 0, P.HEIGHT);
      else if (ev.key === 'ArrowDown') sel.y = clamp(sel.y + step, 0, P.HEIGHT);
      else if (ev.key === 'Delete' || ev.key === 'Backspace') {
        removeOverlay(sel.id);
        ev.preventDefault();
        return;
      } else {
        handled = false;
      }
      if (handled) {
        ev.preventDefault();
        syncOverlayListUI();
        renderAll();
      }
    });
  }

  function removeOverlay(id) {
    state.overlays = state.overlays.filter(function (o) {
      return o.id !== id;
    });
    if (uiState.selectedOverlayId === id) {
      uiState.selectedOverlayId = state.overlays.length ? state.overlays[state.overlays.length - 1].id : null;
    }
    syncOverlayListUI();
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

    // Preview mode segmented buttons
    document.addEventListener('click', function (ev) {
      var modeBtn = ev.target.closest('[data-preview-mode]');
      if (modeBtn) {
        state.previewMode = modeBtn.getAttribute('data-preview-mode');
        syncControlsFromState();
        renderAll();
        return;
      }

      var presetBtn = ev.target.closest('[data-preset-id]');
      if (presetBtn) {
        var pid = presetBtn.getAttribute('data-preset-id');
        applyPreset(pid, false);
        if (pid === 'image-check') {
          switchTab('tab-background');
        }
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
        }
        renderAll();
        return;
      }

      var addStickerBtn = ev.target.closest('[data-add-sticker]');
      if (addStickerBtn) {
        var sid = addStickerBtn.getAttribute('data-add-sticker');
        var st = P.getStickerById(sid);
        if (st) {
          addOverlay(st.name, st.src, 128, 48, st.defaultSize || 42);
        }
        return;
      }

      var selectOvBtn = ev.target.closest('[data-select-overlay]');
      if (selectOvBtn) {
        uiState.selectedOverlayId = selectOvBtn.getAttribute('data-select-overlay');
        syncOverlayListUI();
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
        var sel = getOverlayById(uiState.selectedOverlayId);
        if (!sel) return;
        var dir = nudgeBtn.getAttribute('data-nudge');
        if (dir === 'left') sel.x = clamp(sel.x - 2, 0, P.WIDTH);
        else if (dir === 'right') sel.x = clamp(sel.x + 2, 0, P.WIDTH);
        else if (dir === 'up') sel.y = clamp(sel.y - 2, 0, P.HEIGHT);
        else if (dir === 'down') sel.y = clamp(sel.y + 2, 0, P.HEIGHT);
        syncOverlayListUI();
        renderAll();
      }
    });

    els.shortcutCheckImage.addEventListener('click', function () {
      applyPreset('image-check', false);
      switchTab('tab-background');
    });

    els.resetBtn.addEventListener('click', function () {
      applyPreset('birthday-party', true);
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

    els.textOffsetY.addEventListener('input', function () {
      state.textOffsetY = Number(els.textOffsetY.value);
      els.textOffsetYVal.textContent = state.textOffsetY + ' px';
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
        els.lineColor[idx].addEventListener('input', function () {
          state.lines[idx].color = els.lineColor[idx].value;
          renderAll();
        });
      })(i);
    }

    // Background controls
    els.bgStyle.addEventListener('change', function () {
      state.bgStyle = els.bgStyle.value;
      els.bgColor2Wrap.hidden = state.bgStyle !== 'gradient';
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

    // Selected overlay sliders & actions
    els.ovSize.addEventListener('input', function () {
      var sel = getOverlayById(uiState.selectedOverlayId);
      if (!sel) return;
      sel.size = Number(els.ovSize.value);
      els.ovSizeVal.textContent = sel.size + ' px';
      renderAll();
    });
    els.ovX.addEventListener('input', function () {
      var sel = getOverlayById(uiState.selectedOverlayId);
      if (!sel) return;
      sel.x = Number(els.ovX.value);
      els.ovXVal.textContent = String(sel.x);
      renderAll();
    });
    els.ovY.addEventListener('input', function () {
      var sel = getOverlayById(uiState.selectedOverlayId);
      if (!sel) return;
      sel.y = Number(els.ovY.value);
      els.ovYVal.textContent = String(sel.y);
      renderAll();
    });
    els.ovCenterBtn.addEventListener('click', function () {
      var sel = getOverlayById(uiState.selectedOverlayId);
      if (!sel) return;
      sel.x = 128;
      sel.y = 48;
      syncOverlayListUI();
      renderAll();
    });
    els.ovFrontBtn.addEventListener('click', function () {
      var sel = getOverlayById(uiState.selectedOverlayId);
      if (!sel) return;
      state.overlays = state.overlays.filter(function (o) {
        return o.id !== sel.id;
      });
      state.overlays.push(sel);
      syncOverlayListUI();
      renderAll();
    });
    els.ovDeleteBtn.addEventListener('click', function () {
      if (uiState.selectedOverlayId) removeOverlay(uiState.selectedOverlayId);
    });

    // Quality & Export
    els.jpgQuality.addEventListener('input', function () {
      var q = Number(els.jpgQuality.value);
      state.jpgQuality = q / 100;
      els.jpgQualityVal.textContent = q + '%';
      scheduleSizeEstimate();
    });

    els.downloadBtn.addEventListener('click', function () {
      // Ensure clean render before exporting
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
    els.displayCanvas = $('display-canvas');
    els.actualCanvas = $('actual-canvas');
    els.checksList = $('checks-list');
    els.downloadBtn = $('download-btn');
    els.fileSizeBadge = $('file-size-badge');
    els.filenamePreview = $('filename-preview');
    els.jpgQuality = $('jpg-quality');
    els.jpgQualityVal = $('jpg-quality-val');
    els.resetBtn = $('reset-btn');
    els.openGuideBtn = $('open-guide-btn');
    els.closeGuideBtn = $('close-guide-btn');
    els.guideDialog = $('guide-dialog');
    els.shortcutCheckImage = $('shortcut-check-image');
    els.presetsGrid = $('presets-grid');

    els.fontSelect = $('font-select');
    els.autoFit = $('auto-fit');
    els.textOutline = $('text-outline');
    els.textOffsetY = $('text-offset-y');
    els.textOffsetYVal = $('text-offset-y-val');
    els.lineText = [$('line-text-0'), $('line-text-1'), $('line-text-2')];
    els.lineSize = [$('line-size-0'), $('line-size-1'), $('line-size-2')];
    els.lineSizeVal = [$('line-size-val-0'), $('line-size-val-1'), $('line-size-val-2')];
    els.lineColor = [$('line-color-0'), $('line-color-1'), $('line-color-2')];

    els.bgStyle = $('bg-style');
    els.bgColor = $('bg-color');
    els.bgColor2 = $('bg-color2');
    els.bgColor2Wrap = $('bg-color2-wrap');
    els.bgSwatches = $('bg-swatches');
    els.motifSelect = $('motif-select');
    els.motifColor = $('motif-color');
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

    els.overlayDropzone = $('overlay-dropzone');
    els.overlayFileInput = $('overlay-file-input');
    els.builtinStickersGrid = $('builtin-stickers-grid');
    els.activeOverlaysList = $('active-overlays-list');
    els.selectedOverlayControls = $('selected-overlay-controls');
    els.ovSize = $('ov-size');
    els.ovSizeVal = $('ov-size-val');
    els.ovX = $('ov-x');
    els.ovXVal = $('ov-x-val');
    els.ovY = $('ov-y');
    els.ovYVal = $('ov-y-val');
    els.ovCenterBtn = $('ov-center-btn');
    els.ovFrontBtn = $('ov-front-btn');
    els.ovDeleteBtn = $('ov-delete-btn');
  }

  function init() {
    cacheElements();
    populateStaticLists();
    bindEvents();
    applyPreset('birthday-party', true);

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
