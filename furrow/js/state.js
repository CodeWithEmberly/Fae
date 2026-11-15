// Game state: map generation, save/load, small helpers.
(function (FS) {
  'use strict';

  FS.rngFrom = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  FS.rand = Math.random;
  FS.pick = function (arr, r) { return arr[Math.floor((r || FS.rand)() * arr.length)]; };
  FS.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  FS.idx = function (x, y) { return y * FS.N + x; };
  FS.inMap = function (x, y) { return x >= 0 && y >= 0 && x < FS.N && y < FS.N; };
  FS.tile = function (S, x, y) { return FS.inMap(x, y) ? S.tiles[y * FS.N + x] : null; };
  FS.money = function (v) { var s = Math.round(Math.abs(v)).toLocaleString('en-US'); return (v < 0 ? '-$' : '$') + s; };
  FS.dateStr = function (S) { return FS.MONTHS[S.month % 12] + ' ' + (FS.START_YEAR + Math.floor(S.month / 12)); };
  FS.yearOf = function (S) { return FS.START_YEAR + Math.floor(S.month / 12); };
  FS.personName = function (r) { return FS.pick(FS.FIRST, r) + ' ' + FS.pick(FS.LAST, r); };

  function valueNoise(rng, N, cell) {
    var gw = Math.ceil(N / cell) + 2, g = [];
    for (var i = 0; i < gw * gw; i++) g.push(rng());
    return function (x, y) {
      var fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      var a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    };
  }

  FS.newGame = function (seed, cityName) {
    seed = seed || Math.floor(Math.random() * 1e9);
    var N = FS.N, rng = FS.rngFrom(seed), tiles = [];
    var n1 = valueNoise(rng, N, 7), n2 = valueNoise(rng, N, 3);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var f = n1(x, y) * 0.75 + n2(x, y) * 0.25;
      tiles.push({ t: f > 0.64 ? 'forest' : 'grass', b: null, z: null, lv: 0, st: null, v: Math.floor(rng() * 1000) });
    }
    // river: meanders north->south on the east side, with a bay at the south end
    var rx = Math.floor(N * (0.66 + rng() * 0.1));
    for (y = 0; y < N; y++) {
      rx += Math.round((rng() - 0.5) * 2.2);
      rx = FS.clamp(rx, Math.floor(N * 0.58), Math.floor(N * 0.86));
      var w = y > N * 0.78 ? 2 + Math.floor((y - N * 0.78) * 0.9) : 2;
      for (var k = 0; k < w; k++) if (rx + k < N) tiles[y * N + rx + k].t = 'water';
    }
    // a pond in the west
    var px = Math.floor(N * 0.12 + rng() * 5), py = Math.floor(N * 0.18 + rng() * 6);
    for (y = py - 2; y <= py + 2; y++) for (x = px - 3; x <= px + 3; x++) {
      if (FS.inMap(x, y) && ((x - px) * (x - px)) / 9 + ((y - py) * (y - py)) / 4 <= 1.05) tiles[y * N + x].t = 'water';
    }
    // homestead
    var fx = Math.floor(N * 0.4), fy = Math.floor(N * 0.5);
    for (y = fy - 6; y <= fy + 6; y++) for (x = fx - 6; x <= fx + 6; x++) {
      if (FS.inMap(x, y) && tiles[y * N + x].t === 'forest' && Math.abs(x - fx) + Math.abs(y - fy) < 8) tiles[y * N + x].t = 'grass';
    }
    function put(x, y, b) { var t = tiles[y * N + x]; t.t = 'grass'; t.b = b; t.z = null; }
    put(fx, fy, 'farmhouse');
    for (y = fy - 4; y <= fy + 4; y++) put(fx + 1, y, 'road');
    put(fx, fy + 1, 'crop'); put(fx - 1, fy + 1, 'crop'); put(fx - 1, fy, 'crop');
    put(fx, fy - 1, 'tree'); put(fx - 1, fy - 2, 'tree');
    for (y = fy - 1; y <= fy; y++) for (x = fx + 2; x <= fx + 3; x++) { var t = tiles[y * N + x]; t.t = 'grass'; t.z = 'R'; }

    var S = {
      v: 1, seed: seed, name: cityName || 'Willow Bend', tiles: tiles,
      month: 3, money: 2000, pop: 6, happy: 62, approval: 62, approvalMod: 0, capital: 2,
      era: 0, tax: 9, style: 'vernacular', policies: { style_vernacular: true },
      mission: 0, councilsHeld: 0, nextCouncil: 0, relations: {},
      events: [], eventsDone: {}, mods: [], posts: [], log: [], hist: [],
      home: { x: fx, y: fy }, stats: {}, notices: [], flags: {},
    };
    FS.COUNCIL.forEach(function (m) { S.relations[m.id] = 0; });
    FS.simMonth(S, true);
    S.notices = [];
    return S;
  };

  FS.save = function (S, slot) {
    try {
      var copy = Object.assign({}, S, { notices: [] });
      localStorage.setItem('furrow.save.' + (slot || 'auto'), JSON.stringify(copy));
      return true;
    } catch (e) { return false; }
  };
  FS.load = function (slot) {
    try {
      var raw = localStorage.getItem('furrow.save.' + (slot || 'auto'));
      if (!raw) return null;
      var S = JSON.parse(raw);
      if (!S || !S.tiles || S.tiles.length !== FS.N * FS.N) return null;
      S.notices = [];
      FS.simMonth(S, true);
      return S;
    } catch (e) { return null; }
  };
  FS.hasSave = function (slot) { try { return !!localStorage.getItem('furrow.save.' + (slot || 'auto')); } catch (e) { return false; } };
})(window.FS);
