// STUMP! — pixel graphics: palette, 3x5 font, town map, sprites, portraits.
(function (ST) {
  'use strict';
  var P = ST.PAL = {
    ink: '#101018', navy: '#24305e', slate: '#4a5d8f', sky: '#7fb4e8', paper: '#f4f0e0', lgray: '#c0c0b8', gray: '#88887c',
    dgray: '#4c4c44', road: '#5c5c56', dgreen: '#2e6b34', green: '#58a83e', lime: '#a6d65a', brown: '#7a4a28', tan: '#c8925a',
    sand: '#e6c68a', red: '#c83a3a', dred: '#8a2a2a', yellow: '#ecd44a', pink: '#e488b0', orange: '#e08a30', water: '#3a78c8', water2: '#6aa8e8',
  };

  // ---------------------------------------------------------------- 3x5 pixel font
  var G = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
    G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
    S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101101111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
    '.': '000000000000010', '!': '010010010000010', '?': '110001010000010', '-': '000000111000000', "'": '010010000000000',
    ':': '000010000010000', '%': '101001010100101', '$': '011110010011110', '/': '001001010100100', '&': '010101010101011',
    ',': '000000000010100', ' ': '000000000000000', '+': '000010111010000', '#': '101111101111101',
  };
  ST.textW = function (s, sc) { sc = sc || 1; return s.length * 4 * sc - sc; };
  ST.text = function (ctx, s, x, y, col, sc) {
    sc = sc || 1; s = String(s).toUpperCase(); ctx.fillStyle = col;
    for (var i = 0; i < s.length; i++) {
      var g = G[s[i]] || G['?'];
      for (var k = 0; k < 15; k++) if (g[k] === '1') ctx.fillRect(x + i * 4 * sc + (k % 3) * sc, y + ((k / 3) | 0) * sc, sc, sc);
    }
  };
  ST.textC = function (ctx, s, cx, y, col, sc) { ST.text(ctx, s, Math.round(cx - ST.textW(String(s), sc) / 2), y, col, sc); };

  function hash(x, y, s) { var h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  ST.hash = hash;

  // ---------------------------------------------------------------- map
  var T = ST.T = { GRASS: 0, ROAD: 1, WALK: 2, WATER: 3, BRIDGE: 4, PARK: 5, BLD: 6, TREE: 7, HOLE: 8, FLOWER: 9 };
  ST.buildMap = function () {
    var W = 30, H = 44, t = new Uint8Array(W * H), cl = {}, i, x, y;
    function set(x, y, v) { if (x >= 0 && y >= 0 && x < W && y < H) t[y * W + x] = v; }
    function get(x, y) { return x < 0 || y < 0 || x >= W || y >= H ? -1 : t[y * W + x]; }
    for (y = 0; y < H; y++) for (x = 27; x < W; x++) set(x, y, T.WATER);
    function roadV(x0, y0, y1) { for (var y = y0; y <= y1; y++) { set(x0, y, T.ROAD); set(x0 + 1, y, T.ROAD); cl[x0 + ',' + y] = 'V'; } }
    function roadH(y0, x0, x1) { for (var x = x0; x <= x1; x++) { var b = get(x, y0) === T.WATER; set(x, y0, b ? T.BRIDGE : T.ROAD); set(x, y0 + 1, b ? T.BRIDGE : T.ROAD); if (!b) cl[x + ',' + y0] = cl[x + ',' + y0] ? 'X' : 'H'; } }
    roadV(13, 0, H - 1); roadH(12, 0, W - 1); roadH(26, 0, 26); roadH(35, 15, 26);
    // sidewalks
    var tt = t.slice();
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      if (tt[y * W + x] !== T.GRASS) continue;
      for (var d = 0; d < 4; d++) { var nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d]; if (nx >= 0 && ny >= 0 && nx < W && ny < H && tt[ny * W + nx] === T.ROAD) { set(x, y, T.WALK); break; } }
    }
    var B = [
      { k: 'house', x: 2, y: 2, w: 4, h: 3 }, { k: 'house', x: 7, y: 2, w: 4, h: 3 }, { k: 'house', x: 2, y: 7, w: 4, h: 3 }, { k: 'house', x: 7, y: 7, w: 4, h: 3 },
      { k: 'house', x: 2, y: 16, w: 4, h: 3 }, { k: 'house', x: 7, y: 16, w: 4, h: 3 }, { k: 'house', x: 2, y: 21, w: 4, h: 3 },
      { k: 'townhall', x: 17, y: 3, w: 7, h: 6, label: 'TOWN HALL' },
      { k: 'diner', x: 16, y: 15, w: 5, h: 4, label: 'SPOON' }, { k: 'bugle', x: 22, y: 15, w: 4, h: 4, label: 'BUGLE' },
      { k: 'shop', x: 16, y: 20, w: 4, h: 4, label: 'GIFTS', awn: P.red }, { k: 'shop', x: 21, y: 20, w: 4, h: 4, label: 'TOOLS', awn: P.navy },
      { k: 'school', x: 2, y: 29, w: 7, h: 5, label: 'SCHOOL' }, { k: 'house', x: 10, y: 30, w: 3, h: 3 },
      { k: 'house', x: 2, y: 37, w: 4, h: 3 }, { k: 'house', x: 8, y: 37, w: 4, h: 3 },
      { k: 'house', x: 16, y: 29, w: 3, h: 3 }, { k: 'house', x: 20, y: 29, w: 3, h: 3 },
      { k: 'factory', x: 16, y: 38, w: 10, h: 5, label: 'GRISTLE BROS' },
    ];
    B.forEach(function (b, n) {
      b.n = n;
      for (var yy = b.y; yy < b.y + b.h; yy++) for (var xx = b.x; xx < b.x + b.w; xx++) set(xx, yy, T.BLD);
      b.door = { x: b.x + (b.w >> 1), y: b.y + b.h - 1 }; b.front = { x: b.door.x, y: b.y + b.h };
    });
    // park with pond
    for (y = 29; y <= 33; y++) for (x = 23; x <= 26; x++) set(x, y, T.PARK);
    // the Great Pothole on Elm St
    var hole = { x: 18, y: 12 }; set(18, 12, T.HOLE); set(19, 12, T.HOLE); set(18, 13, T.HOLE); set(19, 13, T.HOLE);
    // trees & flowers
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var v = get(x, y); if (v !== T.GRASS && v !== T.PARK) continue;
      var isFront = B.some(function (b) { return b.front.x === x && b.front.y === y; });
      var r = hash(x, y, 7);
      if (!isFront && r < (v === T.PARK ? 0.25 : 0.1) && !(x === 24 && y === 31) && !(x === 25 && y === 31)) set(x, y, T.TREE);
      else if (r > 0.93) set(x, y, T.FLOWER);
    }
    var M = { W: W, H: H, t: t, cl: cl, B: B, hole: hole };
    M.get = get;
    M.prec = function (x, y) { return (x <= 13 ? 'W' : 'E') === 'W' ? (y < 26 ? 'NW' : 'SW') : (y < 26 ? 'NE' : 'SE'); };
    M.walk = function (x, y) { var v = get(x, y); return v === T.GRASS || v === T.ROAD || v === T.WALK || v === T.BRIDGE || v === T.PARK || v === T.FLOWER; };
    M.bAt = function (x, y) { for (var i = 0; i < B.length; i++) { var b = B[i]; if (x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h) return b; } return null; };
    M.signSpots = [[1, 11], [11, 6], [25, 11], [21, 24], [1, 25], [12, 41], [22, 33], [25, 37]].map(function (s) { if (get(s[0], s[1]) === T.TREE || get(s[0], s[1]) === T.FLOWER) set(s[0], s[1], T.GRASS); return s; }).filter(function (s) { return M.walk(s[0], s[1]); }).map(function (s) { return { x: s[0], y: s[1], p: M.prec(s[0], s[1]), up: false }; });
    return M;
  };

  // ---------------------------------------------------------------- render static map
  function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w || 1, h || 1); }
  ST.px = px;
  function tile(c, M, x, y, f) {
    var v = M.t[y * M.W + x], X = x * 8, Y = y * 8, k, r;
    switch (v) {
      case T.GRASS: case T.TREE: case T.FLOWER: case T.PARK:
        px(c, X, Y, 8, 8, v === T.PARK ? '#62b444' : P.green);
        for (k = 0; k < 4; k++) { r = hash(x, y, k); px(c, X + ((r * 8) | 0), Y + ((hash(y, x, k) * 8) | 0), 1, 1, r > 0.5 ? P.lime : P.dgreen); }
        if (v === T.FLOWER) { px(c, X + 2, Y + 3, 1, 1, P.pink); px(c, X + 5, Y + 5, 1, 1, P.yellow); px(c, X + 4, Y + 2, 1, 1, P.paper); }
        if (v === T.TREE) {
          px(c, X + 3, Y + 5, 2, 3, P.brown); px(c, X + 1, Y + 1, 6, 4, P.dgreen); px(c, X + 2, Y, 4, 6, P.dgreen);
          px(c, X + 2, Y + 1, 2, 2, P.green); px(c, X + 3, Y + 1, 1, 1, P.lime);
        }
        break;
      case T.ROAD: case T.HOLE:
        px(c, X, Y, 8, 8, P.road);
        if (hash(x, y, 3) > 0.7) px(c, X + ((hash(x, y, 4) * 7) | 0), Y + ((hash(x, y, 5) * 7) | 0), 1, 1, '#4e4e48');
        var cl = M.cl[x + ',' + y];
        if (cl === 'V') { px(c, X + 7, Y + 1, 1, 3, P.yellow); px(c, X + 7, Y + 5, 1, 2, P.yellow); }
        if (cl === 'H') { px(c, X + 1, Y + 7, 3, 1, P.yellow); px(c, X + 5, Y + 7, 2, 1, P.yellow); }
        break;
      case T.WALK:
        px(c, X, Y, 8, 8, P.lgray); px(c, X, Y + 7, 8, 1, '#a8a8a0'); px(c, X + 7, Y, 1, 8, '#a8a8a0');
        break;
      case T.WATER:
        px(c, X, Y, 8, 8, P.water);
        r = (hash(x, y, 1) * 6) | 0; px(c, X + ((r + f * 3) % 7), Y + 2 + (r % 4), 2, 1, P.water2);
        break;
      case T.BRIDGE:
        px(c, X, Y, 8, 8, P.tan); for (k = 0; k < 8; k += 2) px(c, X, Y + k, 8, 1, P.brown);
        if (M.get(x, y - 1) === T.WATER) px(c, X, Y, 8, 1, P.dgray);
        if (M.get(x, y + 1) === T.WATER) px(c, X, Y + 7, 8, 1, P.dgray);
        break;
      default: px(c, X, Y, 8, 8, P.green);
    }
  }
  var HOUSE_WALL = [P.sand, P.paper, P.pink, P.sky, '#d8d0a0'], HOUSE_ROOF = [P.red, P.brown, P.navy, P.dgreen, P.slate];
  function building(c, b) {
    var X = b.x * 8, Y = b.y * 8, W = b.w * 8, H = b.h * 8, k, i;
    var dx = b.door.x * 8 + 2, dy = Y + H - 6;
    switch (b.k) {
      case 'house': {
        var wall = HOUSE_WALL[b.n % 5], roof = HOUSE_ROOF[(b.n * 3) % 5], rh = Math.floor(H * 0.45);
        px(c, X + 1, Y + rh, W - 2, H - rh, wall); px(c, X + 1, Y + H - 1, W - 2, 1, P.ink);
        for (k = 0; k < rh; k++) px(c, X + Math.max(0, rh - k - 2) * 0, Y + k, W, 1, k % 2 ? roof : shade(roof));
        px(c, X, Y + rh - 1, W, 1, P.ink);
        px(c, X + W - 7, Y - 3, 3, 4, P.dred);
        for (i = X + 4; i < X + W - 4; i += 9) if (Math.abs(i + 1 - dx) > 4) { px(c, i, Y + rh + 3, 4, 4, P.ink); px(c, i + 1, Y + rh + 4, 2, 2, P.sky); }
        px(c, dx, dy, 4, 6, P.brown); px(c, dx + 3, dy + 3, 1, 1, P.yellow);
        break; }
      case 'townhall':
        px(c, X, Y + 10, W, H - 10, P.paper); px(c, X, Y + H - 3, W, 3, P.lgray);
        for (k = 0; k < 10; k++) px(c, X + 10 - k, Y + k, W - 2 * (10 - k), 1, k % 2 ? P.lgray : P.paper);
        px(c, X + 4, Y + 9, W - 8, 1, P.gray);
        for (i = X + 4; i < X + W - 4; i += 6) px(c, i, Y + 13, 2, H - 17, P.lgray);
        ST.text(c, b.label, X + ((W - ST.textW(b.label)) >> 1), Y + 3, P.navy);
        px(c, X + W - 8, Y - 10, 1, 12, P.dgray); px(c, X + W - 7, Y - 10, 6, 4, P.red); px(c, X + W - 7, Y - 8, 6, 1, P.paper);
        px(c, dx - 1, dy - 2, 6, 8, P.navy);
        break;
      case 'diner':
        px(c, X, Y + 6, W, H - 6, P.lgray); px(c, X, Y + 13, W, 3, P.red); px(c, X, Y + 6, W, 1, P.ink);
        for (i = X + 2; i < X + W - 2; i += 5) { px(c, i, Y + 18, 4, 5, P.ink); px(c, i + 1, Y + 19, 2, 3, P.yellow); }
        px(c, X + 2, Y, W - 4, 7, P.red); ST.text(c, b.label, X + ((W - ST.textW(b.label)) >> 1), Y + 1, P.yellow);
        px(c, dx, dy, 4, 6, P.sky);
        break;
      case 'bugle':
        px(c, X, Y + 4, W, H - 4, P.dred); for (k = Y + 6; k < Y + H; k += 3) for (i = X + ((k / 3) % 2 ? 0 : 2); i < X + W; i += 5) px(c, i, k, 1, 1, P.red);
        px(c, X + 1, Y + 6, W - 2, 7, P.paper); ST.text(c, b.label, X + ((W - ST.textW(b.label)) >> 1), Y + 7, P.ink);
        px(c, X, Y + 3, W, 1, P.ink); px(c, dx, dy, 4, 6, P.ink);
        break;
      case 'shop':
        px(c, X, Y + 4, W, H - 4, P.sand); px(c, X, Y + 3, W, 1, P.ink);
        px(c, X + 1, Y + 5, W - 2, 7, P.paper); ST.text(c, b.label, X + ((W - ST.textW(b.label)) >> 1), Y + 6, P.ink);
        for (i = 0; i < W; i += 2) px(c, X + i, Y + 14, 2, 4, (i / 2) % 2 ? b.awn : P.paper);
        px(c, X + 2, Y + 19, W - 4, 6, P.sky); px(c, X + 3, Y + 20, 3, 1, P.paper); px(c, dx, dy, 4, 6, P.brown);
        break;
      case 'school':
        px(c, X, Y + 6, W, H - 6, P.red); for (k = Y + 8; k < Y + H; k += 3) for (i = X + ((k / 3) % 2 ? 1 : 3); i < X + W; i += 5) px(c, i, k, 2, 1, P.dred);
        px(c, X, Y + 6, W, 2, P.paper);
        px(c, X + (W >> 1) - 5, Y - 6, 10, 12, P.paper); px(c, X + (W >> 1) - 2, Y - 3, 4, 4, P.yellow); px(c, X + (W >> 1) - 6, Y - 8, 12, 2, P.dred);
        px(c, X + 3, Y + 10, W - 6, 7, P.paper); ST.text(c, b.label, X + ((W - ST.textW(b.label)) >> 1), Y + 11, P.dred);
        for (i = X + 3; i < X + W - 3; i += 8) if (Math.abs(i - dx) > 5) { px(c, i, Y + 22, 4, 6, P.paper); px(c, i + 1, Y + 23, 2, 4, P.sky); }
        px(c, dx, dy, 4, 6, P.paper);
        break;
      case 'factory':
        px(c, X, Y + 8, W, H - 8, P.gray); px(c, X, Y + H - 1, W, 1, P.ink);
        for (i = 0; i < W - 8; i += 8) { for (k = 0; k < 6; k++) px(c, X + i, Y + 2 + k, 8 - k, 1, k ? P.dgray : P.ink); px(c, X + i + 7 - 0, Y + 2, 1, 6, P.sky); }
        px(c, X + 2, Y + 12, W - 16, 7, P.lgray); ST.text(c, b.label, X + 3, Y + 13, P.dred);
        px(c, X + W - 7, Y - 12, 5, H + 4, P.red); for (k = Y - 10; k < Y + 8; k += 4) px(c, X + W - 7, k, 5, 2, P.paper);
        for (i = X + 3; i < X + W - 10; i += 7) px(c, i, Y + 24, 4, 4, P.dgray);
        px(c, dx - 1, dy - 2, 6, 8, P.dgray);
        break;
    }
  }
  function shade(col) {
    var n = parseInt(col.slice(1), 16), r = (n >> 16) * 0.8, g = ((n >> 8) & 255) * 0.8, b = (n & 255) * 0.8;
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }
  ST.renderMap = function (M, f) {
    var cv = document.createElement('canvas'); cv.width = M.W * 8; cv.height = M.H * 8;
    var c = cv.getContext('2d');
    for (var y = 0; y < M.H; y++) for (var x = 0; x < M.W; x++) tile(c, M, x, y, f);
    // pond
    px(c, 24 * 8 + 1, 31 * 8 + 1, 14, 6, P.water); px(c, 24 * 8 + 3, 31 * 8, 10, 8, P.water); px(c, 24 * 8 + 4, 31 * 8 + 2, 3, 1, P.water2);
    M.B.forEach(function (b) { building(c, b); });
    return cv;
  };
  ST.drawHole = function (c, M, filled, t) {
    var X = M.hole.x * 8, Y = M.hole.y * 8;
    if (filled) { px(c, X + 1, Y + 1, 14, 14, '#3e3e3a'); ST.text(c, 'NEW', X + 2, Y + 5, P.yellow); return; }
    px(c, X + 2, Y + 1, 12, 14, P.ink); px(c, X + 1, Y + 3, 14, 10, P.ink); px(c, X + 4, Y + 3, 8, 10, '#000');
    // cones & the famous mailbox
    [[0, 0], [14, 0], [0, 13], [14, 13]].forEach(function (o) { px(c, X + o[0] + 1, Y + o[1], 1, 1, P.orange); px(c, X + o[0], Y + o[1] + 1, 3, 2, P.orange); px(c, X + o[0], Y + o[1] + 2, 3, 1, P.paper); });
    px(c, X + 7, Y + 4, 1, 4, P.paper); px(c, X + 6, Y + 2, 3, 2, P.sky);
    if ((t * 2 | 0) % 7 === 0) { px(c, X + 9, Y + 8, 1, 1, P.yellow); px(c, X + 11, Y + 8, 1, 1, P.yellow); } // eyes in the dark...
  };
  ST.drawSmoke = function (c, M, t) {
    var f = M.B[M.B.length - 1], X = (f.x + f.w) * 8 - 5, Y = f.y * 8 - 13;
    for (var k = 0; k < 4; k++) {
      var ph = (t * 0.25 + k / 4) % 1, r = 1 + Math.floor(ph * 4);
      px(c, Math.round(X + ph * 14 - r), Math.round(Y - ph * 20 - r), r * 2, r * 2, ph > 0.6 ? '#9a9a7c' : '#b8b89a');
    }
  };
  ST.drawSign = function (c, s, init) {
    var X = s.x * 8, Y = s.y * 8;
    px(c, X + 3, Y + 2, 1, 6, P.brown); px(c, X, Y - 3, 8, 6, P.ink); px(c, X + 1, Y - 2, 6, 4, P.yellow); ST.text(c, init, X + 2, Y - 2, P.navy);
  };

  // ---------------------------------------------------------------- people
  // feet at (x,y) bottom-center. 7 wide, 12 tall
  ST.drawPerson = function (c, x, y, L, frame, dir, bob) {
    var X = Math.round(x) - 3, Y = Math.round(y) - 12 + (bob || 0);
    px(c, X + 1, Y + 11, 5, 1, 'rgba(0,0,0,0.25)');
    var lw = frame % 2;
    px(c, X + 2, Y + 8, 1, 3 - lw, L.pants); px(c, X + 4, Y + 8, 1, 2 + lw, L.pants);
    px(c, X + 2, Y + 11 - lw, 1, 1, P.ink); px(c, X + 4, Y + 10 + lw, 1, 1, P.ink);
    px(c, X + 1, Y + 5, 5, 4, L.shirt); px(c, X, Y + 5 + lw, 1, 3, L.skin); px(c, X + 6, Y + 6 - lw, 1, 3, L.skin);
    px(c, X + 1, Y + 1, 5, 4, L.skin);
    if (L.hs !== 2) px(c, X + 1, Y, 5, 2, L.hair); else px(c, X + 1, Y, 5, 1, L.skin);
    if (L.hs === 1 || L.hs === 3) { px(c, X, Y + 1, 1, 4, L.hair); px(c, X + 6, Y + 1, 1, 4, L.hair); }
    if (L.hs === 3) px(c, X + 2, Y - 1, 3, 1, L.hair);
    if (L.hs === 4) { px(c, X, Y, 7, 2, L.shirt); px(c, X + (dir < 0 ? -1 : 5), Y + 1, 3, 1, L.shirt); }
    if (dir !== 2) { // not facing away
      var ex = dir < 0 ? 0 : dir > 0 && dir !== 1 ? 1 : 0;
      px(c, X + 2 + ex, Y + 2, 1, 1, P.ink); px(c, X + 4 + ex, Y + 2, 1, 1, P.ink);
      if (L.mu) px(c, X + 2 + ex, Y + 4, 3, 1, L.hair === P.paper ? P.lgray : L.hair);
      if (L.gl) px(c, X + 1 + ex, Y + 2, 5, 1, 'rgba(16,16,24,0.55)');
    }
  };

  // 24x24 portrait onto its own canvas, for dialog windows (CSS scales it up)
  ST.portrait = function (L, mood) {
    var cv = document.createElement('canvas'); cv.width = 24; cv.height = 24; var c = cv.getContext('2d');
    px(c, 0, 0, 24, 24, P.slate); for (var k = 0; k < 24; k += 2) px(c, 0, k, 24, 1, '#55689a');
    px(c, 3, 19, 18, 5, L.shirt); px(c, 9, 17, 6, 3, L.skin); px(c, 10, 19, 4, 1, L.skin);
    if (L.hs === 1 || L.hs === 3) px(c, 4, 5, 16, 12, L.hair);
    px(c, 6, 5, 12, 13, L.skin); px(c, 5, 8, 1, 6, L.skin); px(c, 18, 8, 1, 6, L.skin);
    if (L.hs === 0 || L.hs === 1) { px(c, 5, 3, 14, 4, L.hair); px(c, 5, 5, 2, 4, L.hair); }
    if (L.hs === 3) { px(c, 6, 3, 12, 3, L.hair); px(c, 9, 0, 6, 4, L.hair); }
    if (L.hs === 2) { px(c, 5, 8, 2, 4, L.hair); px(c, 17, 8, 2, 4, L.hair); }
    if (L.hs === 4) { px(c, 4, 3, 16, 4, L.shirt); px(c, 4, 6, 19, 2, shade(L.shirt)); }
    px(c, 8, 10, 2, 2, P.ink); px(c, 14, 10, 2, 2, P.ink); px(c, 8, 9, 3, 1, shade(L.hair)); px(c, 13, 9, 3, 1, shade(L.hair));
    px(c, 11, 12, 2, 2, shade(L.skin));
    if (L.gl) { c.strokeStyle = P.ink; c.lineWidth = 1; c.strokeRect(6.5, 8.5, 5, 4); c.strokeRect(12.5, 8.5, 5, 4); }
    if (L.mu) px(c, 9, 14, 6, 2, L.hair === P.paper ? P.lgray : L.hair);
    var m = mood || 0;
    if (m > 0) { px(c, 9, 15, 6, 1, P.dred); px(c, 8, 14, 1, 1, P.dred); px(c, 15, 14, 1, 1, P.dred); }
    else if (m < 0) { px(c, 9, 16, 6, 1, P.dred); px(c, 8, 17, 1, 1, P.dred); px(c, 15, 17, 1, 1, P.dred); }
    else px(c, 10, 16, 4, 1, P.dred);
    return cv;
  };
  ST.LOOKS = {
    skin: ['#f0c8a0', '#c89060', '#8a5a3a', '#5a3a24'],
    hair: ['#101018', '#7a4a28', '#e6c68a', '#c83a3a', '#88887c'],
    hs: [0, 1, 2, 3, 4],
    shirt: ['#c83a3a', '#4a5d8f', '#58a83e', '#ecd44a', '#e488b0', '#f4f0e0'],
  };
})(window.ST);
