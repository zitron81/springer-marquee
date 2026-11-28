/**
 * Springer Elementary Marquee Maker - Local Editable Project Save & Load (.marquee.json)
 * Serializes and validates complete slide designs locally with zero external network URLs.
 */
(function (global) {
  'use strict';

  var FORMAT = 'springer-marquee-project';
  var VERSION = 1;
  var FILE_EXTENSION = '.marquee.json';
  var MAX_LINES = 6;

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function normalizeAngle(deg) {
    var d = Math.round(deg) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  function isSafeImageDataUrl(str) {
    return typeof str === 'string' && /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(str.trim());
  }

  function isValidHex(str) {
    return typeof str === 'string' && /^#[0-9a-f]{6}$/i.test(str);
  }

  function pickEnum(val, allowed, fallback) {
    return allowed.indexOf(val) !== -1 ? val : fallback;
  }

  function numOr(val, fallback) {
    var n = Number(val);
    return isFinite(n) ? n : fallback;
  }

  function serializeProject(state) {
    var srcState = state || {};
    var lines = Array.isArray(srcState.lines) ? srcState.lines : [];
    var overlays = Array.isArray(srcState.overlays) ? srcState.overlays : [];
    var qrDraft = srcState.qrDraft || {};

    return {
      format: FORMAT,
      version: VERSION,
      savedAt: new Date().toISOString(),
      slide: {
        presetId: srcState.presetId || null,
        previewMode: srcState.previewMode === 'pixel' ? 'pixel' : 'led',
        bgStyle: srcState.bgStyle === 'gradient' ? 'gradient' : 'solid',
        bgColor: srcState.bgColor || '#0b4f26',
        bgColor2: srcState.bgColor2 || '#052e16',
        bgGradDir: srcState.bgGradDir || 'horizontal',
        motif: srcState.motif || 'none',
        motifColor: srcState.motifColor || '#ffd60a',
        fontId: srcState.fontId || 'montserrat',
        align: srcState.align || 'center',
        textOutline: Boolean(srcState.textOutline),
        autoFit: srcState.autoFit !== false,
        lines: lines.slice(0, MAX_LINES).map(function (line) {
          return {
            text: String((line && line.text) || ''),
            fontId: (line && line.fontId) || srcState.fontId || 'montserrat',
            size: numOr(line && line.size, 16),
            color: (line && line.color) || '#ffffff',
            offsetX: numOr(line && line.offsetX, 0),
            offsetY: numOr(line && line.offsetY, 0),
            rotation: numOr(line && line.rotation, 0)
          };
        }),
        bgImage:
          srcState.bgImage && srcState.bgImage.dataUrl
            ? {
                name: String(srcState.bgImage.name || 'background.png'),
                dataUrl: String(srcState.bgImage.dataUrl)
              }
            : null,
        bgFit: srcState.bgFit || 'cover',
        bgZoom: numOr(srcState.bgZoom, 1),
        bgUnlockAspect: Boolean(srcState.bgUnlockAspect),
        bgScaleX: numOr(srcState.bgScaleX, 1),
        bgScaleY: numOr(srcState.bgScaleY, 1),
        bgOffsetX: numOr(srcState.bgOffsetX, 0),
        bgOffsetY: numOr(srcState.bgOffsetY, 0),
        bgScrim: typeof srcState.bgScrim === 'number' && isFinite(srcState.bgScrim) ? srcState.bgScrim : 0.35,
        overlays: overlays.map(function (ov) {
          if (ov && ov.kind === 'qr') {
            return {
              kind: 'qr',
              name: String(ov.name || 'QR Code'),
              x: numOr(ov.x, 128),
              y: numOr(ov.y, 48),
              layer: ov.layer === 'back' ? 'back' : 'front',
              qrUrl: String(ov.qrUrl || ''),
              qrEcc: ov.qrEcc || 'L',
              qrScale: numOr(ov.qrScale, 1),
              qrQuietZone: typeof ov.qrQuietZone === 'number' && isFinite(ov.qrQuietZone) ? ov.qrQuietZone : 4
            };
          }
          return {
            kind: 'image',
            name: String((ov && ov.name) || 'Sticker'),
            src: ov ? ov.src : '',
            x: numOr(ov && ov.x, 128),
            y: numOr(ov && ov.y, 48),
            size: numOr(ov && ov.size, 42),
            rotation: numOr(ov && ov.rotation, 0),
            layer: ov && ov.layer === 'back' ? 'back' : 'front'
          };
        }),
        qrDraft: {
          url: String(qrDraft.url || ''),
          uppercase: qrDraft.uppercase !== false,
          scaleMode: String(qrDraft.scaleMode || 'auto'),
          quietZoneMode: String(qrDraft.quietZoneMode || 'auto'),
          ecc: qrDraft.ecc || 'L'
        },
        jpgQuality:
          typeof srcState.jpgQuality === 'number' && isFinite(srcState.jpgQuality) ? srcState.jpgQuality : 0.95
      }
    };
  }

  function parseProjectJson(rawText) {
    var data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      throw new Error('This file is not a valid Marquee Maker project file.');
    }

    if (!data || typeof data !== 'object' || data.format !== FORMAT || !data.slide || typeof data.slide !== 'object') {
      throw new Error('This file is not a valid Marquee Maker project file.');
    }

    if (typeof data.version !== 'number' || !isFinite(data.version) || data.version < 1) {
      throw new Error('This file is not a valid Marquee Maker project file.');
    }

    if (data.version > VERSION) {
      throw new Error('This project file was created with a newer version of Marquee Maker.');
    }

    var P = global.MarqueePresets;
    var width = P && P.WIDTH ? P.WIDTH : 256;
    var height = P && P.HEIGHT ? P.HEIGHT : 96;
    var resolveFontId = function (fid) {
      if (P && typeof P.getFontById === 'function') {
        return P.getFontById(fid).id;
      }
      return typeof fid === 'string' && fid ? fid : 'montserrat';
    };

    var s = data.slide;
    var slideFontId = resolveFontId(s.fontId);

    var rawLines = Array.isArray(s.lines) ? s.lines.slice(0, MAX_LINES) : [];
    var lines = [];
    for (var i = 0; i < rawLines.length; i++) {
      var ln = rawLines[i];
      if (!ln || typeof ln !== 'object') continue;
      lines.push({
        text: String(ln.text || '').slice(0, 48),
        fontId: resolveFontId(ln.fontId || slideFontId),
        size: clamp(Math.round(numOr(ln.size, 16)), 10, 48),
        color: isValidHex(ln.color) ? ln.color : '#ffffff',
        offsetX: clamp(Math.round(numOr(ln.offsetX, 0)), -120, 120),
        offsetY: clamp(Math.round(numOr(ln.offsetY, 0)), -48, 48),
        rotation: normalizeAngle(numOr(ln.rotation, 0))
      });
    }

    var bgImage = null;
    if (s.bgImage !== null && s.bgImage !== undefined) {
      if (typeof s.bgImage !== 'object' || !isSafeImageDataUrl(s.bgImage.dataUrl)) {
        throw new Error('Project file contains an unsupported background image source.');
      }
      bgImage = {
        name: String(s.bgImage.name || 'background.png'),
        dataUrl: s.bgImage.dataUrl.trim()
      };
    }

    var rawOverlays = Array.isArray(s.overlays) ? s.overlays : [];
    var overlays = [];
    for (var j = 0; j < rawOverlays.length; j++) {
      var ov = rawOverlays[j];
      if (!ov || typeof ov !== 'object') continue;
      if (ov.kind === 'qr') {
        overlays.push({
          kind: 'qr',
          name: String(ov.name || 'QR Code'),
          x: clamp(numOr(ov.x, width / 2), 0, width),
          y: clamp(numOr(ov.y, height / 2), 0, height),
          layer: pickEnum(ov.layer, ['front', 'back'], 'front'),
          qrUrl: String(ov.qrUrl || '').slice(0, 200),
          qrEcc: pickEnum(ov.qrEcc, ['L', 'M', 'Q', 'H'], 'L'),
          qrScale: clamp(Math.round(numOr(ov.qrScale, 1)), 1, 3),
          qrQuietZone: clamp(Math.round(numOr(ov.qrQuietZone, 4)), 2, 4)
        });
      } else {
        if (!isSafeImageDataUrl(ov.src)) {
          throw new Error('Project file contains an unsupported sticker image source.');
        }
        overlays.push({
          kind: 'image',
          name: String(ov.name || 'Sticker'),
          src: ov.src.trim(),
          x: clamp(Math.round(numOr(ov.x, width / 2)), 0, width),
          y: clamp(Math.round(numOr(ov.y, height / 2)), 0, height),
          size: clamp(Math.round(numOr(ov.size, 42)), 12, 260),
          rotation: normalizeAngle(numOr(ov.rotation, 0)),
          layer: pickEnum(ov.layer, ['front', 'back'], 'front')
        });
      }
    }

    var rawQrDraft = s.qrDraft && typeof s.qrDraft === 'object' ? s.qrDraft : {};
    var qrDraft = {
      url: String(rawQrDraft.url || '').slice(0, 200),
      uppercase: rawQrDraft.uppercase !== false,
      scaleMode: pickEnum(String(rawQrDraft.scaleMode || 'auto'), ['auto', '3', '2', '1'], 'auto'),
      quietZoneMode: pickEnum(String(rawQrDraft.quietZoneMode || 'auto'), ['auto', '4', '3', '2'], 'auto'),
      ecc: pickEnum(rawQrDraft.ecc, ['L', 'M'], 'L')
    };

    return {
      presetId: typeof s.presetId === 'string' ? s.presetId : null,
      previewMode: pickEnum(s.previewMode, ['led', 'pixel'], 'led'),
      bgStyle: pickEnum(s.bgStyle, ['solid', 'gradient'], 'solid'),
      bgColor: isValidHex(s.bgColor) ? s.bgColor : '#0b4f26',
      bgColor2: isValidHex(s.bgColor2) ? s.bgColor2 : '#052e16',
      bgGradDir: pickEnum(s.bgGradDir, ['horizontal', 'vertical', 'diagonal'], 'horizontal'),
      motif: pickEnum(s.motif, ['none', 'border', 'top-bar', 'confetti'], 'none'),
      motifColor: isValidHex(s.motifColor) ? s.motifColor : '#ffd60a',
      fontId: slideFontId,
      align: pickEnum(s.align, ['left', 'center', 'right'], 'center'),
      textOutline: Boolean(s.textOutline),
      autoFit: s.autoFit !== false,
      lines: lines,
      bgImage: bgImage,
      bgFit: pickEnum(s.bgFit, ['cover', 'contain', 'stretch'], 'cover'),
      bgZoom: clamp(numOr(s.bgZoom, 1), 0.2, 4),
      bgUnlockAspect: Boolean(s.bgUnlockAspect),
      bgScaleX: clamp(numOr(s.bgScaleX, 1), 0.2, 4),
      bgScaleY: clamp(numOr(s.bgScaleY, 1), 0.2, 4),
      bgOffsetX: clamp(Math.round(numOr(s.bgOffsetX, 0)), -220, 220),
      bgOffsetY: clamp(Math.round(numOr(s.bgOffsetY, 0)), -120, 120),
      bgScrim: clamp(numOr(s.bgScrim, 0.35), 0, 0.85),
      overlays: overlays,
      qrDraft: qrDraft,
      jpgQuality: clamp(numOr(s.jpgQuality, 0.95), 0.85, 1)
    };
  }

  global.MarqueeProject = {
    FORMAT: FORMAT,
    VERSION: VERSION,
    FILE_EXTENSION: FILE_EXTENSION,
    serializeProject: serializeProject,
    parseProjectJson: parseProjectJson,
    isSafeImageDataUrl: isSafeImageDataUrl
  };
})(window);
