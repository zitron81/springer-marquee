/**
 * Springer Elementary Marquee Maker - Presets, Fonts, Swatches, and Built-in Stickers
 * All assets are self-contained (zero external image URLs) so canvas export never taints.
 */
(function (global) {
  'use strict';

  var WIDTH = 256;
  var HEIGHT = 96;

  var FONTS = [
    {
      id: 'montserrat',
      label: 'Montserrat (Clean Bold)',
      css: '"Montserrat", "Arial Black", "Segoe UI", sans-serif',
      weight: '800'
    },
    {
      id: 'fredoka',
      label: 'Fredoka (Friendly Rounded)',
      css: '"Fredoka", "Trebuchet MS", "Arial Rounded MT Bold", sans-serif',
      weight: '700'
    },
    {
      id: 'anton',
      label: 'Anton (Tall Impact)',
      css: '"Anton", Impact, "Arial Black", sans-serif',
      weight: '400'
    },
    {
      id: 'oswald',
      label: 'Oswald (Compact Condensed)',
      css: '"Oswald", "Arial Narrow", Impact, sans-serif',
      weight: '700'
    },
    {
      id: 'system-bold',
      label: 'Classic Block (Offline Safe)',
      css: '"Arial Black", Impact, system-ui, sans-serif',
      weight: '900'
    }
  ];

  var SWATCHES = [
    { name: 'Crisp White', hex: '#ffffff' },
    { name: 'Stinger Gold', hex: '#ffd60a' },
    { name: 'Sky Blue', hex: '#38bdf8' },
    { name: 'Bright Mint', hex: '#34d399' },
    { name: 'Bright Orange', hex: '#fb923c' },
    { name: 'Coral Pink', hex: '#ff4d8d' },
    { name: 'Springer Green', hex: '#15803d' },
    { name: 'Royal Blue', hex: '#2563eb' },
    { name: 'Dark Green', hex: '#0b4f26' },
    { name: 'Deep Navy', hex: '#120d31' },
    { name: 'Dark Charcoal', hex: '#111827' },
    { name: 'Pure Black', hex: '#000000' }
  ];

  function encodeSvg(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
  }

  var BUILTIN_STICKERS = [
    {
      id: 'stinger-bee',
      name: 'Stinger Logo',
      defaultSize: 48,
      src: encodeSvg(
        global.SPRINGER_STINGER_SVG ||
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="#ffd60a"/></svg>'
      )
    },
    {
      id: 'balloon',
      name: 'Balloon',
      defaultSize: 44,
      src: encodeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80">' +
          '<path d="M32 52 C28 60, 36 68, 30 78" fill="none" stroke="#334155" stroke-width="3" stroke-linecap="round"/>' +
          '<ellipse cx="32" cy="28" rx="22" ry="26" fill="#ff4d8d" stroke="#1e293b" stroke-width="2.5"/>' +
          '<polygon points="32,52 26,58 38,58" fill="#ff4d8d" stroke="#1e293b" stroke-width="1.8" stroke-linejoin="round"/>' +
          '<ellipse cx="23" cy="19" rx="5" ry="9" transform="rotate(-22 23 19)" fill="#ffd1e3" opacity="0.9"/>' +
        '</svg>'
      )
    },
    {
      id: 'cake',
      name: 'Birthday Cake',
      defaultSize: 44,
      src: encodeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<rect x="29" y="10" width="6" height="14" rx="2" fill="#22d3ee" stroke="#1e293b" stroke-width="1.8"/>' +
          '<path d="M32 2 C36 6, 36 11, 32 12 C28 11, 28 6, 32 2 Z" fill="#ffd60a" stroke="#92400e" stroke-width="1.5"/>' +
          '<rect x="12" y="24" width="40" height="15" rx="4" fill="#ff4d8d" stroke="#1e293b" stroke-width="2.2"/>' +
          '<rect x="8" y="38" width="48" height="20" rx="5" fill="#ffd60a" stroke="#1e293b" stroke-width="2.2"/>' +
          '<path d="M12 31 Q18 36 24 31 T36 31 T48 31" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>' +
        '</svg>'
      )
    },
    {
      id: 'star',
      name: 'Gold Star',
      defaultSize: 40,
      src: encodeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<polygon points="32,4 40,22 60,24 45,37 49,57 32,47 15,57 19,37 4,24 24,22" fill="#ffd60a" stroke="#1e293b" stroke-width="3" stroke-linejoin="round"/>' +
        '</svg>'
      )
    },
    {
      id: 'confetti',
      name: 'Confetti Burst',
      defaultSize: 44,
      src: encodeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<polygon points="10,54 22,22 42,42" fill="#ffd60a" stroke="#1e293b" stroke-width="2.5" stroke-linejoin="round"/>' +
          '<circle cx="44" cy="18" r="5" fill="#ff4d8d" stroke="#1e293b" stroke-width="1.5"/>' +
          '<circle cx="54" cy="34" r="4.5" fill="#22d3ee" stroke="#1e293b" stroke-width="1.5"/>' +
          '<circle cx="28" cy="12" r="4.5" fill="#84cc16" stroke="#1e293b" stroke-width="1.5"/>' +
          '<rect x="47" y="45" width="9" height="9" rx="2" transform="rotate(20 51 49)" fill="#ff8c00" stroke="#1e293b" stroke-width="1.5"/>' +
          '<rect x="16" y="14" width="8" height="8" rx="2" transform="rotate(-15 20 18)" fill="#ffffff" stroke="#1e293b" stroke-width="1.5"/>' +
        '</svg>'
      )
    },
    {
      id: 'heart',
      name: 'Heart',
      defaultSize: 38,
      src: encodeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<path d="M32 56 C14 43 6 31 6 20 C6 11 13 6 21 6 C26 6 30 9 32 13 C34 9 38 6 43 6 C51 6 58 11 58 20 C58 31 50 43 32 56 Z" fill="#ff4d8d" stroke="#1e293b" stroke-width="3" stroke-linejoin="round"/>' +
        '</svg>'
      )
    },
    {
      id: 'trophy',
      name: 'Trophy',
      defaultSize: 42,
      src: encodeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<path d="M18 10 H46 V26 C46 35 40 42 32 42 C24 42 18 35 18 26 Z" fill="#ffd60a" stroke="#1e293b" stroke-width="2.5"/>' +
          '<path d="M18 14 H10 C10 24 14 28 18 28" fill="none" stroke="#92400e" stroke-width="4" stroke-linecap="round"/>' +
          '<path d="M46 14 H54 C54 24 50 28 46 28" fill="none" stroke="#92400e" stroke-width="4" stroke-linecap="round"/>' +
          '<rect x="28" y="42" width="8" height="10" fill="#ffd60a" stroke="#1e293b" stroke-width="2"/>' +
          '<rect x="20" y="52" width="24" height="6" rx="2" fill="#334155" stroke="#1e293b" stroke-width="2"/>' +
        '</svg>'
      )
    }
  ];

  var PRESETS = [
    {
      id: 'springer-stingers',
      name: 'Springer Stingers',
      tagline: 'School green + gold & Stinger bee',
      previewColors: ['#0b4f26', '#ffd60a', '#ffffff'],
      config: {
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
        starterSticker: { stickerId: 'stinger-bee', x: 24, y: 48, size: 36, rotation: 0, layer: 'front' }
      }
    },
    {
      id: 'stinger-gold',
      name: 'Sunny Stinger Gold',
      tagline: 'Bright gold gradient + dark text',
      previewColors: ['#ffe033', '#f59e0b', '#111827'],
      config: {
        bgStyle: 'gradient',
        bgColor: '#ffe033',
        bgColor2: '#f59e0b',
        bgGradDir: 'horizontal',
        motif: 'top-bar',
        motifColor: '#0b4f26',
        fontId: 'montserrat',
        align: 'center',
        textOutline: false,
        autoFit: true,
        lines: [
          { text: 'SPRINGER PTA', size: 15, color: '#0b4f26', offsetX: -18, offsetY: 0, rotation: 0 },
          { text: 'GO STINGERS!', size: 23, color: '#111827', offsetX: -18, offsetY: 0, rotation: 0 },
          { text: 'MEETING TONIGHT 6PM', size: 14, color: '#0b4f26', offsetX: -18, offsetY: 0, rotation: 0 }
        ],
        starterSticker: { stickerId: 'stinger-bee', x: 232, y: 48, size: 36, rotation: 0, layer: 'front' }
      }
    },
    {
      id: 'sunny-birthday',
      name: 'Sunny Birthday',
      tagline: 'Bright sunshine yellow-to-pink + confetti',
      previewColors: ['#fef08a', '#fbcfe8', '#be123c'],
      config: {
        bgStyle: 'gradient',
        bgColor: '#fef08a',
        bgColor2: '#fbcfe8',
        bgGradDir: 'horizontal',
        motif: 'confetti',
        motifColor: '#be123c',
        fontId: 'fredoka',
        align: 'center',
        textOutline: false,
        autoFit: true,
        lines: [
          { text: 'HAPPY BIRTHDAY', size: 17, color: '#be123c', offsetX: 0, offsetY: 0, rotation: 0 },
          { text: 'MAYA!', size: 32, color: '#111827', offsetX: 0, offsetY: 0, rotation: 0 },
          { text: 'HAVE A GREAT DAY!', size: 14, color: '#0f766e', offsetX: 0, offsetY: 0, rotation: 0 }
        ],
        starterSticker: { stickerId: 'balloon', x: 26, y: 48, size: 42, rotation: -10, layer: 'front' }
      }
    },
    {
      id: 'bright-sky-event',
      name: 'Bright Sky Event',
      tagline: 'Daylight sky gradient + navy banner',
      previewColors: ['#e0f2fe', '#38bdf8', '#0f172a'],
      config: {
        bgStyle: 'gradient',
        bgColor: '#e0f2fe',
        bgColor2: '#38bdf8',
        bgGradDir: 'vertical',
        motif: 'top-bar',
        motifColor: '#0f172a',
        fontId: 'oswald',
        align: 'center',
        textOutline: false,
        autoFit: true,
        lines: [
          { text: 'BOOK FAIR THIS WEEK', size: 23, color: '#0f172a', offsetX: 0, offsetY: 0, rotation: 0 },
          { text: 'MON - FRI  |  8AM - 3PM', size: 16, color: '#1e3a8a', offsetX: 0, offsetY: 0, rotation: 0 },
          { text: '', size: 14, color: '#0f172a', offsetX: 0, offsetY: 0, rotation: 0 }
        ],
        starterSticker: null
      }
    },
    {
      id: 'clean-white',
      name: 'Clean White Notice',
      tagline: 'Crisp white card + Springer green',
      previewColors: ['#ffffff', '#156136', '#111827'],
      config: {
        bgStyle: 'solid',
        bgColor: '#ffffff',
        bgColor2: '#f1f5f9',
        bgGradDir: 'horizontal',
        motif: 'border',
        motifColor: '#156136',
        fontId: 'montserrat',
        align: 'center',
        textOutline: false,
        autoFit: true,
        lines: [
          { text: 'WALK TO SCHOOL DAY', size: 19, color: '#0b4f26', offsetX: 0, offsetY: 0, rotation: 0 },
          { text: 'FRIDAY 8:00 AM', size: 22, color: '#111827', offsetX: 0, offsetY: 0, rotation: 0 },
          { text: 'FRONT GATE', size: 14, color: '#15803d', offsetX: 0, offsetY: 0, rotation: 0 }
        ],
        starterSticker: null
      }
    },
    {
      id: 'birthday-party',
      name: 'Birthday Spotlight',
      tagline: 'Deep indigo-to-purple glow',
      previewColors: ['#1e1b4b', '#6b21a8', '#ffd60a'],
      config: {
        bgStyle: 'gradient',
        bgColor: '#1e1b4b',
        bgColor2: '#6b21a8',
        bgGradDir: 'horizontal',
        motif: 'none',
        motifColor: '#ffd60a',
        fontId: 'fredoka',
        align: 'center',
        textOutline: true,
        autoFit: true,
        lines: [
          { text: 'HAPPY BIRTHDAY', size: 17, color: '#ffd60a', offsetX: 0, offsetY: 0, rotation: 0 },
          { text: 'MAYA!', size: 30, color: '#ffffff', offsetX: 0, offsetY: 0, rotation: 0 },
          { text: 'HAVE A GREAT DAY!', size: 14, color: '#ff4d8d', offsetX: 0, offsetY: 0, rotation: 0 }
        ],
        starterSticker: { stickerId: 'balloon', x: 24, y: 50, size: 42, rotation: -6, layer: 'front' }
      }
    },
    {
      id: 'birthday-confetti',
      name: 'Birthday Confetti',
      tagline: 'Dark slate + crisp LED confetti',
      previewColors: ['#111827', '#22d3ee', '#ffd60a'],
      config: {
        bgStyle: 'solid',
        bgColor: '#111827',
        bgColor2: '#0b4f26',
        bgGradDir: 'horizontal',
        motif: 'confetti',
        motifColor: '#ffd60a',
        fontId: 'montserrat',
        align: 'center',
        textOutline: true,
        autoFit: true,
        lines: [
          { text: 'HAPPY 8TH', size: 18, color: '#22d3ee', offsetX: 0, offsetY: 0, rotation: 0 },
          { text: 'BIRTHDAY LEO!', size: 24, color: '#ffd60a', offsetX: 0, offsetY: 0, rotation: 0 },
          { text: '', size: 14, color: '#ffffff', offsetX: 0, offsetY: 0, rotation: 0 }
        ],
        starterSticker: null
      }
    },
    {
      id: 'high-visibility',
      name: 'Traffic High-Contrast',
      tagline: 'Pure black + bright yellow',
      previewColors: ['#000000', '#ffe600', '#ffffff'],
      config: {
        bgStyle: 'solid',
        bgColor: '#000000',
        bgColor2: '#111827',
        bgGradDir: 'horizontal',
        motif: 'none',
        motifColor: '#ffe600',
        fontId: 'anton',
        align: 'center',
        textOutline: false,
        autoFit: true,
        lines: [
          { text: 'NO SCHOOL FRIDAY', size: 26, color: '#ffe600', offsetX: 0, offsetY: 0, rotation: 0 },
          { text: 'ENJOY THE WEEKEND!', size: 18, color: '#ffffff', offsetX: 0, offsetY: 0, rotation: 0 },
          { text: '', size: 14, color: '#ffffff', offsetX: 0, offsetY: 0, rotation: 0 }
        ],
        starterSticker: null
      }
    }
  ];

  global.MarqueePresets = {
    WIDTH: WIDTH,
    HEIGHT: HEIGHT,
    FONTS: FONTS,
    SWATCHES: SWATCHES,
    BUILTIN_STICKERS: BUILTIN_STICKERS,
    PRESETS: PRESETS,
    getFontById: function (id) {
      for (var i = 0; i < FONTS.length; i++) {
        if (FONTS[i].id === id) return FONTS[i];
      }
      return FONTS[0];
    },
    getPresetById: function (id) {
      for (var i = 0; i < PRESETS.length; i++) {
        if (PRESETS[i].id === id) return PRESETS[i];
      }
      return PRESETS[0];
    },
    getStickerById: function (id) {
      for (var i = 0; i < BUILTIN_STICKERS.length; i++) {
        if (BUILTIN_STICKERS[i].id === id) return BUILTIN_STICKERS[i];
      }
      return null;
    }
  };
})(window);
