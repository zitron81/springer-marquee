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
    { name: 'Pure Black', hex: '#000000' },
    { name: 'Springer Dark Green', hex: '#0b4f26' },
    { name: 'Deep Navy', hex: '#120d31' },
    { name: 'Dark Charcoal', hex: '#111827' },
    { name: 'Springer Gold', hex: '#ffd60a' },
    { name: 'Crisp White', hex: '#ffffff' },
    { name: 'Coral Pink', hex: '#ff4d8d' },
    { name: 'Bright Cyan', hex: '#22d3ee' },
    { name: 'Neon Lime', hex: '#84cc16' },
    { name: 'Bright Orange', hex: '#ff8c00' }
  ];

  function encodeSvg(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
  }

  var BUILTIN_STICKERS = [
    {
      id: 'balloon',
      name: 'Balloon',
      defaultSize: 44,
      src: encodeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80">' +
          '<path d="M32 52 C28 60, 36 68, 30 78" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>' +
          '<ellipse cx="32" cy="28" rx="22" ry="26" fill="#ff4d8d" stroke="#ffffff" stroke-width="2.5"/>' +
          '<polygon points="32,52 26,58 38,58" fill="#ff4d8d"/>' +
          '<ellipse cx="23" cy="19" rx="5" ry="9" transform="rotate(-22 23 19)" fill="#ffd1e3" opacity="0.85"/>' +
        '</svg>'
      )
    },
    {
      id: 'cake',
      name: 'Birthday Cake',
      defaultSize: 44,
      src: encodeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<rect x="29" y="10" width="6" height="14" rx="2" fill="#22d3ee"/>' +
          '<path d="M32 2 C36 6, 36 11, 32 12 C28 11, 28 6, 32 2 Z" fill="#ffd60a"/>' +
          '<rect x="12" y="24" width="40" height="15" rx="4" fill="#ff4d8d" stroke="#ffffff" stroke-width="2"/>' +
          '<rect x="8" y="38" width="48" height="20" rx="5" fill="#ffd60a" stroke="#ffffff" stroke-width="2"/>' +
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
          '<polygon points="32,4 40,22 60,24 45,37 49,57 32,47 15,57 19,37 4,24 24,22" fill="#ffd60a" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>' +
        '</svg>'
      )
    },
    {
      id: 'confetti',
      name: 'Confetti Burst',
      defaultSize: 44,
      src: encodeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<polygon points="10,54 22,22 42,42" fill="#ffd60a" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>' +
          '<circle cx="44" cy="18" r="5" fill="#ff4d8d"/>' +
          '<circle cx="54" cy="34" r="4.5" fill="#22d3ee"/>' +
          '<circle cx="28" cy="12" r="4.5" fill="#84cc16"/>' +
          '<rect x="47" y="45" width="9" height="9" rx="2" transform="rotate(20 51 49)" fill="#ff8c00"/>' +
          '<rect x="16" y="14" width="8" height="8" rx="2" transform="rotate(-15 20 18)" fill="#ffffff"/>' +
        '</svg>'
      )
    },
    {
      id: 'heart',
      name: 'Heart',
      defaultSize: 38,
      src: encodeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<path d="M32 56 C14 43 6 31 6 20 C6 11 13 6 21 6 C26 6 30 9 32 13 C34 9 38 6 43 6 C51 6 58 11 58 20 C58 31 50 43 32 56 Z" fill="#ff4d8d" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>' +
        '</svg>'
      )
    },
    {
      id: 'trophy',
      name: 'Trophy',
      defaultSize: 42,
      src: encodeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
          '<path d="M18 10 H46 V26 C46 35 40 42 32 42 C24 42 18 35 18 26 Z" fill="#ffd60a" stroke="#ffffff" stroke-width="2.5"/>' +
          '<path d="M18 14 H10 C10 24 14 28 18 28" fill="none" stroke="#ffd60a" stroke-width="4" stroke-linecap="round"/>' +
          '<path d="M46 14 H54 C54 24 50 28 46 28" fill="none" stroke="#ffd60a" stroke-width="4" stroke-linecap="round"/>' +
          '<rect x="28" y="42" width="8" height="10" fill="#ffd60a"/>' +
          '<rect x="20" y="52" width="24" height="6" rx="2" fill="#ffffff"/>' +
        '</svg>'
      )
    }
  ];

  var PRESETS = [
    {
      id: 'birthday-party',
      name: 'Birthday Spotlight',
      tagline: 'Deep navy glow + bold gold & pink',
      previewColors: ['#120d31', '#ffd60a', '#ff4d8d'],
      config: {
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
        starterSticker: { stickerId: 'balloon', x: 24, y: 50, size: 42 }
      }
    },
    {
      id: 'birthday-confetti',
      name: 'Birthday Confetti',
      tagline: 'Dark slate + crisp LED confetti dots',
      previewColors: ['#111827', '#22d3ee', '#ff4d8d'],
      config: {
        bgStyle: 'solid',
        bgColor: '#111827',
        bgColor2: '#0b4f26',
        motif: 'confetti',
        motifColor: '#ffd60a',
        fontId: 'montserrat',
        align: 'center',
        textOutline: true,
        autoFit: true,
        textOffsetY: 0,
        lines: [
          { text: 'HAPPY 8TH', size: 18, color: '#22d3ee' },
          { text: 'BIRTHDAY LEO!', size: 24, color: '#ffd60a' },
          { text: '', size: 14, color: '#ffffff' }
        ],
        starterSticker: null
      }
    },
    {
      id: 'springer-pride',
      name: 'Springer Pride',
      tagline: 'School dark green & gold frame',
      previewColors: ['#0b4f26', '#ffd60a', '#ffffff'],
      config: {
        bgStyle: 'solid',
        bgColor: '#0b4f26',
        bgColor2: '#052e16',
        motif: 'border',
        motifColor: '#ffd60a',
        fontId: 'montserrat',
        align: 'center',
        textOutline: false,
        autoFit: true,
        textOffsetY: 0,
        lines: [
          { text: 'SPRINGER PTA', size: 16, color: '#ffd60a' },
          { text: 'GO EAGLES!', size: 26, color: '#ffffff' },
          { text: 'MEETING TONIGHT 6PM', size: 14, color: '#ffd60a' }
        ],
        starterSticker: null
      }
    },
    {
      id: 'school-event',
      name: 'School Event Bar',
      tagline: 'Emerald with bold yellow header bar',
      previewColors: ['#062e18', '#ffd60a', '#ffffff'],
      config: {
        bgStyle: 'solid',
        bgColor: '#062e18',
        bgColor2: '#0b4f26',
        motif: 'top-bar',
        motifColor: '#ffd60a',
        fontId: 'oswald',
        align: 'center',
        textOutline: false,
        autoFit: true,
        textOffsetY: 4,
        lines: [
          { text: 'BOOK FAIR THIS WEEK', size: 22, color: '#ffffff' },
          { text: 'MON - FRI  |  8AM - 3PM', size: 16, color: '#ffd60a' },
          { text: '', size: 14, color: '#ffffff' }
        ],
        starterSticker: null
      }
    },
    {
      id: 'high-visibility',
      name: 'Traffic High-Contrast',
      tagline: 'Pure black + bright yellow for cars',
      previewColors: ['#000000', '#ffe600', '#ffffff'],
      config: {
        bgStyle: 'solid',
        bgColor: '#000000',
        bgColor2: '#111827',
        motif: 'none',
        motifColor: '#ffe600',
        fontId: 'anton',
        align: 'center',
        textOutline: false,
        autoFit: true,
        textOffsetY: 0,
        lines: [
          { text: 'NO SCHOOL FRIDAY', size: 26, color: '#ffe600' },
          { text: 'ENJOY THE WEEKEND!', size: 18, color: '#ffffff' },
          { text: '', size: 14, color: '#ffffff' }
        ],
        starterSticker: null
      }
    },
    {
      id: 'image-check',
      name: 'Test Existing Image',
      tagline: 'Clear text to preview an uploaded graphic',
      previewColors: ['#000000', '#22d3ee', '#ffffff'],
      isImageCheck: true,
      config: {
        bgStyle: 'solid',
        bgColor: '#000000',
        bgColor2: '#000000',
        motif: 'none',
        motifColor: '#ffd60a',
        fontId: 'montserrat',
        align: 'center',
        textOutline: true,
        autoFit: true,
        textOffsetY: 0,
        lines: [
          { text: '', size: 18, color: '#ffd60a' },
          { text: '', size: 26, color: '#ffffff' },
          { text: '', size: 14, color: '#ffffff' }
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
