/**
 * Springer Elementary Marquee Maker - Zero-Dependency ISO/IEC 18004 QR Code Encoder
 * Supports Versions 1-10, Alphanumeric & UTF-8 Byte modes, ECC L/M/Q/H,
 * plus integer pixel-locked layout calculation for the 256x96 LED marquee.
 */
(function (global) {
  'use strict';

  var ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

  // GF(256) with primitive polynomial 0x11D
  var GF_EXP = new Uint8Array(512);
  var GF_LOG = new Uint8Array(256);
  (function initGaloisTables() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) {
      GF_EXP[j] = GF_EXP[j - 255];
    }
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  function rsGeneratorPoly(degree) {
    var poly = [1];
    for (var i = 0; i < degree; i++) {
      var next = new Array(poly.length + 1);
      for (var k = 0; k < next.length; k++) next[k] = 0;
      var root = GF_EXP[i];
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], root);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(dataBytes, ecCount) {
    var gen = rsGeneratorPoly(ecCount);
    var buf = new Uint8Array(dataBytes.length + ecCount);
    buf.set(dataBytes, 0);
    for (var i = 0; i < dataBytes.length; i++) {
      var factor = buf[i];
      if (factor === 0) continue;
      for (var j = 0; j < gen.length; j++) {
        buf[i + j] ^= gfMul(gen[j], factor);
      }
    }
    return buf.slice(dataBytes.length);
  }

  // [ecCodewordsPerBlock, [[blockCount, dataCodewordsPerBlock], ...]]
  var EC_TABLE = {
    1: {
      L: [7, [[1, 19]]],
      M: [10, [[1, 16]]],
      Q: [13, [[1, 13]]],
      H: [17, [[1, 9]]]
    },
    2: {
      L: [10, [[1, 34]]],
      M: [16, [[1, 28]]],
      Q: [22, [[1, 22]]],
      H: [28, [[1, 16]]]
    },
    3: {
      L: [15, [[1, 55]]],
      M: [26, [[1, 44]]],
      Q: [18, [[2, 17]]],
      H: [22, [[2, 13]]]
    },
    4: {
      L: [20, [[1, 80]]],
      M: [18, [[2, 32]]],
      Q: [26, [[2, 24]]],
      H: [16, [[4, 9]]]
    },
    5: {
      L: [26, [[1, 108]]],
      M: [24, [[2, 43]]],
      Q: [18, [[2, 15], [2, 16]]],
      H: [22, [[2, 11], [2, 12]]]
    },
    6: {
      L: [18, [[2, 68]]],
      M: [16, [[4, 27]]],
      Q: [24, [[4, 19]]],
      H: [28, [[4, 15]]]
    },
    7: {
      L: [20, [[2, 78]]],
      M: [18, [[4, 31]]],
      Q: [18, [[2, 14], [4, 15]]],
      H: [26, [[4, 13], [1, 14]]]
    },
    8: {
      L: [24, [[2, 97]]],
      M: [22, [[2, 38], [2, 39]]],
      Q: [22, [[4, 18], [2, 19]]],
      H: [26, [[4, 14], [2, 15]]]
    },
    9: {
      L: [30, [[2, 116]]],
      M: [22, [[3, 36], [2, 37]]],
      Q: [20, [[4, 16], [4, 17]]],
      H: [24, [[4, 12], [4, 13]]]
    },
    10: {
      L: [18, [[2, 68], [2, 69]]],
      M: [26, [[4, 43], [1, 44]]],
      Q: [24, [[6, 19], [2, 20]]],
      H: [28, [[6, 15], [2, 16]]]
    }
  };

  var ALIGNMENT_CENTERS = {
    1: [],
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
    8: [6, 24, 42],
    9: [6, 26, 46],
    10: [6, 28, 50]
  };

  var ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  function totalDataCodewords(version, ecc) {
    var groups = EC_TABLE[version][ecc][1];
    var sum = 0;
    for (var i = 0; i < groups.length; i++) {
      sum += groups[i][0] * groups[i][1];
    }
    return sum;
  }

  function isAlphanumeric(str) {
    for (var i = 0; i < str.length; i++) {
      if (ALPHANUMERIC_CHARSET.indexOf(str[i]) === -1) return false;
    }
    return true;
  }

  function toUtf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') {
      return Array.prototype.slice.call(new TextEncoder().encode(str));
    }
    var encoded = unescape(encodeURIComponent(str));
    var out = new Array(encoded.length);
    for (var i = 0; i < encoded.length; i++) {
      out[i] = encoded.charCodeAt(i);
    }
    return out;
  }

  function pushBits(bits, value, length) {
    for (var i = length - 1; i >= 0; i--) {
      bits.push((value >>> i) & 1);
    }
  }

  function cciLength(version, mode) {
    if (mode === 'Alphanumeric') return version <= 9 ? 9 : 11;
    return version <= 9 ? 8 : 16;
  }

  function buildDataCodewords(text, mode, payload, version, ecc) {
    var capBytes = totalDataCodewords(version, ecc);
    var capBits = capBytes * 8;
    var bits = [];

    if (mode === 'Alphanumeric') {
      pushBits(bits, 2, 4);
      pushBits(bits, text.length, cciLength(version, mode));
      for (var i = 0; i < text.length; i += 2) {
        var c1 = ALPHANUMERIC_CHARSET.indexOf(text[i]);
        if (i + 1 < text.length) {
          var c2 = ALPHANUMERIC_CHARSET.indexOf(text[i + 1]);
          pushBits(bits, c1 * 45 + c2, 11);
        } else {
          pushBits(bits, c1, 6);
        }
      }
    } else {
      pushBits(bits, 4, 4);
      pushBits(bits, payload.length, cciLength(version, mode));
      for (var b = 0; b < payload.length; b++) {
        pushBits(bits, payload[b], 8);
      }
    }

    // Terminator (up to 4 zeros)
    var termLen = Math.min(4, capBits - bits.length);
    for (var t = 0; t < termLen; t++) bits.push(0);

    // Byte boundary pad
    while (bits.length % 8 !== 0) bits.push(0);

    var bytes = [];
    for (var k = 0; k < bits.length; k += 8) {
      var val = 0;
      for (var bit = 0; bit < 8; bit++) {
        val = (val << 1) | bits[k + bit];
      }
      bytes.push(val);
    }

    var padIdx = 0;
    while (bytes.length < capBytes) {
      bytes.push(padIdx % 2 === 0 ? 0xec : 0x11);
      padIdx++;
    }

    return bytes;
  }

  function interleaveBlocks(dataBytes, version, ecc) {
    var spec = EC_TABLE[version][ecc];
    var ecCount = spec[0];
    var groups = spec[1];

    var dataBlocks = [];
    var ecBlocks = [];
    var offset = 0;
    var maxDataLen = 0;

    for (var g = 0; g < groups.length; g++) {
      var count = groups[g][0];
      var len = groups[g][1];
      if (len > maxDataLen) maxDataLen = len;
      for (var b = 0; b < count; b++) {
        var slice = dataBytes.slice(offset, offset + len);
        offset += len;
        dataBlocks.push(slice);
        ecBlocks.push(rsEncode(slice, ecCount));
      }
    }

    var result = [];
    for (var i = 0; i < maxDataLen; i++) {
      for (var db = 0; db < dataBlocks.length; db++) {
        if (i < dataBlocks[db].length) {
          result.push(dataBlocks[db][i]);
        }
      }
    }
    for (var j = 0; j < ecCount; j++) {
      for (var eb = 0; eb < ecBlocks.length; eb++) {
        result.push(ecBlocks[eb][j]);
      }
    }
    return result;
  }

  function createGrid(size, fillVal) {
    var grid = new Array(size);
    for (var r = 0; r < size; r++) {
      var row = new Array(size);
      for (var c = 0; c < size; c++) row[c] = fillVal;
      grid[r] = row;
    }
    return grid;
  }

  function cloneGrid(grid) {
    var out = new Array(grid.length);
    for (var r = 0; r < grid.length; r++) {
      out[r] = grid[r].slice();
    }
    return out;
  }

  function setFunctionModule(modules, isFunction, r, c, val) {
    if (r < 0 || r >= modules.length || c < 0 || c >= modules.length) return;
    modules[r][c] = val ? 1 : 0;
    isFunction[r][c] = true;
  }

  function drawFinderPattern(modules, isFunction, top, left) {
    var size = modules.length;
    for (var dr = -1; dr <= 7; dr++) {
      for (var dc = -1; dc <= 7; dc++) {
        var r = top + dr;
        var c = left + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        var dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        var dark = dist !== 2 && dist !== 4;
        setFunctionModule(modules, isFunction, r, c, dark ? 1 : 0);
      }
    }
  }

  function drawAlignmentPattern(modules, isFunction, centerR, centerC) {
    for (var dr = -2; dr <= 2; dr++) {
      for (var dc = -2; dc <= 2; dc++) {
        var dist = Math.max(Math.abs(dr), Math.abs(dc));
        setFunctionModule(modules, isFunction, centerR + dr, centerC + dc, dist !== 1 ? 1 : 0);
      }
    }
  }

  function bitLength(n) {
    var len = 0;
    while (n > 0) {
      n >>>= 1;
      len++;
    }
    return len;
  }

  function bchFormatBits(ecc, mask) {
    var data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
    var d = data << 10;
    while (bitLength(d) >= 11) {
      d ^= 0x537 << (bitLength(d) - 11);
    }
    return ((data << 10) | d) ^ 0x5412;
  }

  function bchVersionBits(version) {
    var d = version << 12;
    while (bitLength(d) >= 13) {
      d ^= 0x1f25 << (bitLength(d) - 13);
    }
    return (version << 12) | d;
  }

  function applyFormatBits(modules, isFunction, ecc, mask) {
    var size = modules.length;
    var bits = bchFormatBits(ecc, mask);

    for (var i = 0; i < 15; i++) {
      var bit = (bits >>> i) & 1;
      // Vertical top-left & horizontal bottom-left -> top-left
      if (i < 6) {
        setFunctionModule(modules, isFunction, i, 8, bit);
      } else if (i < 8) {
        setFunctionModule(modules, isFunction, i + 1, 8, bit);
      } else {
        setFunctionModule(modules, isFunction, size - 15 + i, 8, bit);
      }

      // Horizontal top-right & horizontal top-left
      if (i < 8) {
        setFunctionModule(modules, isFunction, 8, size - 1 - i, bit);
      } else if (i < 9) {
        setFunctionModule(modules, isFunction, 8, 15 - i, bit);
      } else {
        setFunctionModule(modules, isFunction, 8, 14 - i, bit);
      }
    }
    // Fixed dark module
    setFunctionModule(modules, isFunction, size - 8, 8, 1);
  }

  function applyVersionBits(modules, isFunction, version) {
    if (version < 7) return;
    var size = modules.length;
    var bits = bchVersionBits(version);
    for (var i = 0; i < 18; i++) {
      var bit = (bits >>> i) & 1;
      var a = Math.floor(i / 3);
      var b = i % 3;
      setFunctionModule(modules, isFunction, size - 11 + b, a, bit);
      setFunctionModule(modules, isFunction, a, size - 11 + b, bit);
    }
  }

  function buildBaseMatrix(version) {
    var size = 17 + 4 * version;
    var modules = createGrid(size, 0);
    var isFunction = createGrid(size, false);

    // Finder patterns
    drawFinderPattern(modules, isFunction, 0, 0);
    drawFinderPattern(modules, isFunction, 0, size - 7);
    drawFinderPattern(modules, isFunction, size - 7, 0);

    // Timing patterns
    for (var i = 8; i < size - 8; i++) {
      var val = i % 2 === 0 ? 1 : 0;
      setFunctionModule(modules, isFunction, 6, i, val);
      setFunctionModule(modules, isFunction, i, 6, val);
    }

    // Alignment patterns
    var centers = ALIGNMENT_CENTERS[version] || [];
    for (var rIdx = 0; rIdx < centers.length; rIdx++) {
      for (var cIdx = 0; cIdx < centers.length; cIdx++) {
        var cr = centers[rIdx];
        var cc = centers[cIdx];
        var overlapsFinder =
          (cr <= 8 && cc <= 8) ||
          (cr <= 8 && cc >= size - 8) ||
          (cr >= size - 8 && cc <= 8);
        if (!overlapsFinder) {
          drawAlignmentPattern(modules, isFunction, cr, cc);
        }
      }
    }

    // Reserve format & version areas before data placement
    applyFormatBits(modules, isFunction, 'L', 0);
    applyVersionBits(modules, isFunction, version);

    return { modules: modules, isFunction: isFunction };
  }

  function placeCodewords(modules, isFunction, codewords) {
    var size = modules.length;
    var bitIdx = 0;
    var totalBits = codewords.length * 8;
    var upward = true;

    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var step = 0; step < size; step++) {
        var r = upward ? size - 1 - step : step;
        for (var colOffset = 0; colOffset < 2; colOffset++) {
          var c = right - colOffset;
          if (isFunction[r][c]) continue;
          var bit = 0;
          if (bitIdx < totalBits) {
            var byteVal = codewords[bitIdx >>> 3];
            bit = (byteVal >>> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
          }
          modules[r][c] = bit;
        }
      }
      upward = !upward;
    }
  }

  function maskCondition(mask, r, c) {
    switch (mask) {
      case 0:
        return (r + c) % 2 === 0;
      case 1:
        return r % 2 === 0;
      case 2:
        return c % 3 === 0;
      case 3:
        return (r + c) % 3 === 0;
      case 4:
        return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5:
        return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6:
        return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7:
        return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      default:
        return false;
    }
  }

  function applyMask(modules, isFunction, mask) {
    var size = modules.length;
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (!isFunction[r][c] && maskCondition(mask, r, c)) {
          modules[r][c] ^= 1;
        }
      }
    }
  }

  function penaltyScore(modules) {
    var size = modules.length;
    var score = 0;

    // Rule 1: runs of 5+ same-color modules in rows and cols
    for (var r = 0; r < size; r++) {
      var runColorH = modules[r][0];
      var runLenH = 1;
      var runColorV = modules[0][r];
      var runLenV = 1;
      for (var c = 1; c < size; c++) {
        if (modules[r][c] === runColorH) {
          runLenH++;
        } else {
          if (runLenH >= 5) score += 3 + (runLenH - 5);
          runColorH = modules[r][c];
          runLenH = 1;
        }
        if (modules[c][r] === runColorV) {
          runLenV++;
        } else {
          if (runLenV >= 5) score += 3 + (runLenV - 5);
          runColorV = modules[c][r];
          runLenV = 1;
        }
      }
      if (runLenH >= 5) score += 3 + (runLenH - 5);
      if (runLenV >= 5) score += 3 + (runLenV - 5);
    }

    // Rule 2: 2x2 blocks of same color
    for (var r2 = 0; r2 < size - 1; r2++) {
      for (var c2 = 0; c2 < size - 1; c2++) {
        var color = modules[r2][c2];
        if (
          color === modules[r2][c2 + 1] &&
          color === modules[r2 + 1][c2] &&
          color === modules[r2 + 1][c2 + 1]
        ) {
          score += 3;
        }
      }
    }

    // Rule 3: 1:1:3:1:1 finder-like pattern with 4 light modules on either side
    function countPattern(getMod) {
      var matches = 0;
      for (var i = 0; i <= size - 11; i++) {
        var patA =
          getMod(i) === 1 &&
          getMod(i + 1) === 0 &&
          getMod(i + 2) === 1 &&
          getMod(i + 3) === 1 &&
          getMod(i + 4) === 1 &&
          getMod(i + 5) === 0 &&
          getMod(i + 6) === 1 &&
          getMod(i + 7) === 0 &&
          getMod(i + 8) === 0 &&
          getMod(i + 9) === 0 &&
          getMod(i + 10) === 0;
        var patB =
          getMod(i) === 0 &&
          getMod(i + 1) === 0 &&
          getMod(i + 2) === 0 &&
          getMod(i + 3) === 0 &&
          getMod(i + 4) === 1 &&
          getMod(i + 5) === 0 &&
          getMod(i + 6) === 1 &&
          getMod(i + 7) === 1 &&
          getMod(i + 8) === 1 &&
          getMod(i + 9) === 0 &&
          getMod(i + 10) === 1;
        if (patA || patB) matches++;
      }
      return matches;
    }

    for (var line = 0; line < size; line++) {
      score += 40 * countPattern(function (idx) { return modules[line][idx]; });
      score += 40 * countPattern(function (idx) { return modules[idx][line]; });
    }

    // Rule 4: dark module balance
    var darkCount = 0;
    for (var r4 = 0; r4 < size; r4++) {
      for (var c4 = 0; c4 < size; c4++) {
        if (modules[r4][c4]) darkCount++;
      }
    }
    var total = size * size;
    var pct = (darkCount * 100) / total;
    var k = Math.floor(Math.abs(pct - 50) / 5);
    score += k * 10;

    return score;
  }

  function encode(text, ecc) {
    if (typeof text !== 'string' || text.length === 0) {
      return { error: 'Enter a link or short text to generate a QR code.' };
    }
    var level = EC_TABLE[1][ecc] ? ecc : 'L';
    var alpha = isAlphanumeric(text);
    var mode = alpha ? 'Alphanumeric' : 'Byte';
    var payload = alpha ? null : toUtf8Bytes(text);

    var chosenVersion = null;
    for (var v = 1; v <= 10; v++) {
      var dataBits = 4 + cciLength(v, mode);
      if (alpha) {
        dataBits += Math.floor(text.length / 2) * 11 + (text.length % 2) * 6;
      } else {
        dataBits += payload.length * 8;
      }
      if (dataBits <= totalDataCodewords(v, level) * 8) {
        chosenVersion = v;
        break;
      }
    }

    if (!chosenVersion) {
      return { error: 'URL too long for marquee QR (max Version 10).' };
    }

    var dataBytes = buildDataCodewords(text, mode, payload, chosenVersion, level);
    var finalCodewords = interleaveBlocks(dataBytes, chosenVersion, level);
    var base = buildBaseMatrix(chosenVersion);
    placeCodewords(base.modules, base.isFunction, finalCodewords);

    var bestMatrix = null;
    var bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      var candidate = cloneGrid(base.modules);
      applyMask(candidate, base.isFunction, m);
      applyFormatBits(candidate, base.isFunction, level, m);
      applyVersionBits(candidate, base.isFunction, chosenVersion);
      var s = penaltyScore(candidate);
      if (s < bestScore) {
        bestScore = s;
        bestMatrix = candidate;
      }
    }

    return {
      version: chosenVersion,
      size: 17 + 4 * chosenVersion,
      mode: mode,
      ecc: level,
      matrix: bestMatrix
    };
  }

  function computeLayout(moduleCount, scaleMode, quietZoneMode, maxHeight) {
    var limitH = typeof maxHeight === 'number' && maxHeight > 0 ? maxHeight : 96;
    var qzPref = quietZoneMode === 'auto' ? 'auto' : Number(quietZoneMode);
    var scalePref = scaleMode === 'auto' ? 'auto' : Number(scaleMode);

    function fits(scale, qz) {
      return (moduleCount + 2 * qz) * scale <= limitH;
    }

    var chosenScale = 1;
    var chosenQz = qzPref === 'auto' ? 4 : qzPref;

    if (scalePref === 'auto' && qzPref === 'auto') {
      var combos = [
        [3, 4],
        [3, 3],
        [2, 4],
        [2, 3],
        [1, 4],
        [1, 3],
        [1, 2]
      ];
      for (var i = 0; i < combos.length; i++) {
        if (fits(combos[i][0], combos[i][1])) {
          chosenScale = combos[i][0];
          chosenQz = combos[i][1];
          break;
        }
      }
    } else if (scalePref === 'auto') {
      var scales = [3, 2, 1];
      chosenScale = 1;
      for (var s = 0; s < scales.length; s++) {
        if (fits(scales[s], chosenQz)) {
          chosenScale = scales[s];
          break;
        }
      }
    } else {
      // Explicit scale requested
      if (qzPref === 'auto') {
        var qzs = [4, 3, 2];
        var matched = false;
        for (var q = 0; q < qzs.length; q++) {
          if (fits(scalePref, qzs[q])) {
            chosenScale = scalePref;
            chosenQz = qzs[q];
            matched = true;
            break;
          }
        }
        if (!matched) {
          // Fall back to largest scale that fits with a 3- or 4-sq border
          var fallback = [
            [3, 4],
            [3, 3],
            [2, 4],
            [2, 3],
            [1, 4]
          ];
          for (var f = 0; f < fallback.length; f++) {
            if (fits(fallback[f][0], fallback[f][1])) {
              chosenScale = fallback[f][0];
              chosenQz = fallback[f][1];
              break;
            }
          }
        }
      } else if (fits(scalePref, chosenQz)) {
        chosenScale = scalePref;
      } else {
        var altScales = [3, 2, 1];
        chosenScale = 1;
        for (var a = 0; a < altScales.length; a++) {
          if (fits(altScales[a], chosenQz)) {
            chosenScale = altScales[a];
            break;
          }
        }
      }
    }

    var minQzForCheck = qzPref === 'auto' ? 3 : chosenQz;
    var dataPx = moduleCount * chosenScale;
    var totalPx = (moduleCount + 2 * chosenQz) * chosenScale;

    return {
      scale: chosenScale,
      quietZone: chosenQz,
      totalPx: totalPx,
      dataPx: dataPx,
      fitsScale3: fits(3, minQzForCheck),
      fitsScale2: fits(2, minQzForCheck),
      fitsScale1: fits(1, minQzForCheck)
    };
  }

  function toThumbDataUrl(matrix, quietZone) {
    if (typeof document === 'undefined' || !matrix || !matrix.length) return '';
    var qz = typeof quietZone === 'number' ? quietZone : 3;
    var modCount = matrix.length;
    var total = modCount + qz * 2;
    var canvas = document.createElement('canvas');
    canvas.width = total;
    canvas.height = total;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, total, total);
    ctx.fillStyle = '#000000';
    for (var r = 0; r < modCount; r++) {
      for (var c = 0; c < modCount; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(c + qz, r + qz, 1, 1);
        }
      }
    }
    return canvas.toDataURL('image/png');
  }

  var api = {
    encode: encode,
    computeLayout: computeLayout,
    toThumbDataUrl: toThumbDataUrl
  };

  if (typeof global !== 'undefined') {
    global.MarqueeQR = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
