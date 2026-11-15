// Isometric canvas renderer. Everything is procedural: no image assets.
(function (FS) {
  'use strict';
  var R = FS.render = {};
  var cv, ctx, W = 0, H = 0, dpr = 1, time = 0;
  var cam = FS.cam = { x: 0, y: 0, zoom: 1 };
  R.overlay = null;      // null | 'land' | 'poll' | 'safety' | 'edu' | 'health' | 'fun'
  R.preview = null;      // { tiles:[{x,y,ok}], ghost:id }
  R.highlight = null;    // {x,y}

  R.init = function (canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    R.resize();
    window.addEventListener('resize', R.resize);
  };
  R.resize = function () {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  };
  R.size = function () { return { w: W, h: H }; };

  // ---------------------------------------------------------------- projection
  function P(tx, ty, h) { return [(tx - ty) * 32, (tx + ty) * 16 - (h || 0)]; }
  FS.P = P;
  FS.worldToScreen = function (wx, wy) { return { x: (wx - cam.x) * cam.zoom + W / 2, y: (wy - cam.y) * cam.zoom + H / 2 }; };
  FS.screenToTileF = function (sx, sy) {
    var wx = (sx - W / 2) / cam.zoom + cam.x, wy = (sy - H / 2) / cam.zoom + cam.y;
    return { x: (wx / 32 + wy / 16) / 2, y: (wy / 16 - wx / 32) / 2 };
  };
  FS.screenToTile = function (sx, sy) { var t = FS.screenToTileF(sx, sy); return { x: Math.floor(t.x), y: Math.floor(t.y) }; };
  R.centerOn = function (tx, ty) { var p = P(tx, ty, 0); cam.x = p[0]; cam.y = p[1]; };
  R.clampCam = function () {
    var N = FS.N, c = P(N / 2, N / 2, 0);
    cam.x = FS.clamp(cam.x, c[0] - N * 32, c[0] + N * 32);
    cam.y = FS.clamp(cam.y, c[1] - N * 16 - 60, c[1] + N * 16);
    cam.zoom = FS.clamp(cam.zoom, 0.35, 3.2);
  };

  // ---------------------------------------------------------------- color helpers
  var shadeCache = {};
  function shade(hex, amt) {
    var k = hex + amt; if (shadeCache[k]) return shadeCache[k];
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    var out = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
    shadeCache[k] = out; return out;
  }
  R.shade = shade;

  function poly(pts, fill) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function quadPath(a, b, c, d) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); }
  function diamond(x, y, inset, fill, h) {
    var a = inset || 0; h = h || 0;
    poly([P(x + a, y + a, h), P(x + 1 - a, y + a, h), P(x + 1 - a, y + 1 - a, h), P(x + a, y + 1 - a, h)], fill);
  }

  // box in tile coords: footprint [x0,x1]x[y0,y1], from height h0 to h1
  function box(x0, y0, x1, y1, h0, h1, wall, top) {
    poly([P(x0, y1, h0), P(x1, y1, h0), P(x1, y1, h1), P(x0, y1, h1)], shade(wall, 0.02));
    poly([P(x1, y0, h0), P(x1, y1, h0), P(x1, y1, h1), P(x1, y0, h1)], shade(wall, -0.2));
    if (top) poly([P(x0, y0, h1), P(x1, y0, h1), P(x1, y1, h1), P(x0, y1, h1)], top);
  }
  function windows(x0, y0, x1, y1, h0, h1, color, gap, cols, wh) {
    if (cam.zoom < 0.55) return;
    gap = gap || 6; cols = cols || 3; wh = wh || gap * 0.5;
    ctx.beginPath();
    for (var h = h0 + gap * 0.5; h + wh <= h1 - 1; h += gap) {
      for (var c = 0; c < cols; c++) {
        var fa = (c + 0.22) / cols, fb = (c + 0.78) / cols;
        var ax = x0 + (x1 - x0) * fa, bx = x0 + (x1 - x0) * fb;
        quadPath(P(ax, y1, h), P(bx, y1, h), P(bx, y1, h + wh), P(ax, y1, h + wh));
        var ay = y0 + (y1 - y0) * fa, by = y0 + (y1 - y0) * fb;
        quadPath(P(x1, ay, h), P(x1, by, h), P(x1, by, h + wh), P(x1, ay, h + wh));
      }
    }
    ctx.fillStyle = color; ctx.fill();
  }
  function hipRoof(x0, y0, x1, y1, h, rh, color) {
    var A = P(x0, y0, h), B = P(x1, y0, h), C = P(x1, y1, h), D = P(x0, y1, h), E = P((x0 + x1) / 2, (y0 + y1) / 2, h + rh);
    poly([A, B, E], shade(color, -0.05)); poly([D, A, E], shade(color, 0.12));
    poly([D, C, E], shade(color, 0.04)); poly([C, B, E], shade(color, -0.22));
  }
  function gableRoof(x0, y0, x1, y1, h, rh, color, wall, alongX) {
    var A = P(x0, y0, h), B = P(x1, y0, h), C = P(x1, y1, h), D = P(x0, y1, h), R0, R1;
    if (alongX) {
      var ym = (y0 + y1) / 2; R0 = P(x0, ym, h + rh); R1 = P(x1, ym, h + rh);
      poly([A, B, R1, R0], shade(color, 0.1)); poly([D, C, R1, R0], shade(color, -0.02));
      poly([B, C, R1], shade(wall, -0.2));
    } else {
      var xm = (x0 + x1) / 2; R0 = P(xm, y0, h + rh); R1 = P(xm, y1, h + rh);
      poly([A, D, R1, R0], shade(color, 0.12)); poly([B, C, R1, R0], shade(color, -0.2));
      poly([D, C, R1], shade(wall, 0.02));
    }
  }
  function cornice(x0, y0, x1, y1, h, trim, roof) {
    box(x0 - 0.025, y0 - 0.025, x1 + 0.025, y1 + 0.025, h, h + 2, trim, roof);
  }
  function tree(tx, ty, s, kind, col) {
    var base = P(tx, ty, 0);
    ctx.fillStyle = '#6b4a2f'; ctx.fillRect(base[0] - 0.8 * s, base[1] - 4 * s, 1.6 * s, 4 * s);
    if (kind === 1) {
      ctx.beginPath(); ctx.moveTo(base[0], base[1] - 15 * s); ctx.lineTo(base[0] + 4.5 * s, base[1] - 3 * s); ctx.lineTo(base[0] - 4.5 * s, base[1] - 3 * s); ctx.closePath();
      ctx.fillStyle = col || '#2f6b3a'; ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(base[0], base[1] - 8 * s, 4.6 * s, 0, 6.283); ctx.fillStyle = col || '#3f8a3c'; ctx.fill();
      ctx.beginPath(); ctx.arc(base[0] - 1.4 * s, base[1] - 9.4 * s, 2.2 * s, 0, 6.283); ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fill();
    }
  }
  function icon(tx, ty, h, glyph) {
    if (cam.zoom < 0.7) return;
    var p = P(tx, ty, h);
    ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(glyph, p[0], p[1]);
  }
  function smoke(tx, ty, h, seed) {
    for (var k = 0; k < 3; k++) {
      var ph = ((time * 0.35 + k / 3 + seed * 0.13) % 1);
      var p = P(tx, ty, h + ph * 18);
      ctx.beginPath(); ctx.arc(p[0] + ph * 6, p[1], 2 + ph * 3.5, 0, 6.283);
      ctx.fillStyle = 'rgba(210,210,210,' + (0.55 * (1 - ph)).toFixed(2) + ')'; ctx.fill();
    }
  }

  // ---------------------------------------------------------------- palette
  var GRASS = ['#7cb562', '#78b05d', '#81b967', '#74ab59'];
  function seasonCrop(S) {
    var m = S.month % 12;
    if (m <= 1 || m === 11) return '#c9c3a6';
    if (m <= 4) return '#8fbf55';
    if (m <= 7) return '#cfb64a';
    return '#c79a45';
  }

  // ---------------------------------------------------------------- ground pass
  function ground(S, t, x, y) {
    var g = GRASS[t.v & 3];
    if (t.t === 'water') {
      diamond(x, y, 0, '#3f86c6');
      var w = (Math.sin(time * 1.4 + x * 0.9 + y * 0.6) + 1) * 0.5;
      var a = P(x + 0.25, y + 0.5 + w * 0.1, 0), b = P(x + 0.6, y + 0.35 + w * 0.1, 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      if (t.b === 'road') road(S, t, x, y, true);
      return;
    }
    if (t.t === 'forest') g = shade(g, -0.12);
    diamond(x, y, 0, g);
    if (t.b) {
      var d = FS.BUILD[t.b];
      if (t.b === 'road') return road(S, t, x, y, false);
      if (t.b === 'crop') return cropField(S, t, x, y);
      if (t.b === 'orchard') return diamond(x, y, 0.04, '#6fa04f');
      if (t.b === 'pasture') return pastureGround(t, x, y);
      if (t.b === 'park' || t.b === 'bigpark') { diamond(x, y, 0.04, '#5fae4f'); pathCross(x, y, '#d8cfae'); return; }
      if (t.b === 'plaza') { diamond(x, y, 0.03, '#d6d0c2'); diamond(x, y, 0.2, '#c8c0ae'); return; }
      if (t.b === 'market') { diamond(x, y, 0.05, '#c9b48c'); return; }
      if (t.b === 'solar') { diamond(x, y, 0.04, '#9aa58f'); return; }
      if (d && d.draw && d.draw.kind === 'box') diamond(x, y, 0.04, '#b9b2a2');
      if (t.b === 'farmhouse') diamond(x, y, 0.04, '#8cc26c');
      return;
    }
    if (t.z) {
      var zc = FS.ZONES[t.z].color;
      if (!t.lv) {
        diamond(x, y, 0.06, zc + '77');
        var c0 = P(x + 0.1, y + 0.1), c1 = P(x + 0.9, y + 0.1), c2 = P(x + 0.9, y + 0.9), c3 = P(x + 0.1, y + 0.9);
        ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); ctx.beginPath();
        ctx.moveTo(c0[0], c0[1]); ctx.lineTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(c3[0], c3[1]); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      } else if (t.z === 'R') diamond(x, y, 0.03, t.lv >= 4 ? '#b8b3a6' : '#8fc477');
      else if (t.z === 'C') diamond(x, y, 0.02, t.lv >= 2 ? '#c4beb1' : '#b5c98f');
      else diamond(x, y, 0.02, '#a69f8c');
    }
  }
  function cropField(S, t, x, y) {
    var c = seasonCrop(S);
    diamond(x, y, 0.04, c);
    ctx.strokeStyle = shade(c, -0.22); ctx.lineWidth = 0.8; ctx.beginPath();
    for (var k = 1; k < 6; k++) {
      var yy = y + 0.04 + k * 0.92 / 6, a = P(x + 0.06, yy, 0), b = P(x + 0.94, yy, 0);
      if (t.v & 1) { a = P(x + 0.04 + k * 0.92 / 6, y + 0.06, 0); b = P(x + 0.04 + k * 0.92 / 6, y + 0.94, 0); }
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
  }
  function pastureGround(t, x, y) {
    diamond(x, y, 0.03, '#97c873');
    var c = [P(x + 0.08, y + 0.08, 0), P(x + 0.92, y + 0.08, 0), P(x + 0.92, y + 0.92, 0), P(x + 0.08, y + 0.92, 0)];
    ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 1; ctx.beginPath();
    for (var i = 0; i < 4; i++) { var a = c[i], b = c[(i + 1) % 4]; ctx.moveTo(a[0], a[1] - 2); ctx.lineTo(b[0], b[1] - 2); }
    ctx.stroke();
  }
  function pathCross(x, y, col) {
    poly([P(x + 0.45, y + 0.05), P(x + 0.55, y + 0.05), P(x + 0.55, y + 0.95), P(x + 0.45, y + 0.95)], col);
    poly([P(x + 0.05, y + 0.45), P(x + 0.95, y + 0.45), P(x + 0.95, y + 0.55), P(x + 0.05, y + 0.55)], col);
  }
  function isRoad(S, x, y) { var t = FS.tile(S, x, y); return t && t.b === 'road'; }
  function road(S, t, x, y, bridge) {
    var paved = S.era >= 2, col = paved ? '#5f6368' : '#a8895c', w = 0.3, cx = x + 0.5, cy = y + 0.5;
    var nb = [isRoad(S, x + 1, y), isRoad(S, x - 1, y), isRoad(S, x, y + 1), isRoad(S, x, y - 1)];
    if (bridge) {
      poly([P(cx - w - 0.06, cy - w - 0.06, 0), P(cx + w + 0.06, cy - w - 0.06, 0), P(cx + w + 0.06, cy + w + 0.06, 0), P(cx - w - 0.06, cy + w + 0.06, 0)], '#7a6a58');
    }
    if (paved) { // sidewalks
      var sw = '#c9c4b8', s2 = w + 0.1;
      poly([P(cx - s2, cy - s2), P(cx + s2, cy - s2), P(cx + s2, cy + s2), P(cx - s2, cy + s2)], sw);
      if (nb[0]) poly([P(cx, cy - s2), P(x + 1, cy - s2), P(x + 1, cy + s2), P(cx, cy + s2)], sw);
      if (nb[1]) poly([P(x, cy - s2), P(cx, cy - s2), P(cx, cy + s2), P(x, cy + s2)], sw);
      if (nb[2]) poly([P(cx - s2, cy), P(cx + s2, cy), P(cx + s2, y + 1), P(cx - s2, y + 1)], sw);
      if (nb[3]) poly([P(cx - s2, y), P(cx + s2, y), P(cx + s2, cy), P(cx - s2, cy)], sw);
    }
    poly([P(cx - w, cy - w), P(cx + w, cy - w), P(cx + w, cy + w), P(cx - w, cy + w)], col);
    if (nb[0]) poly([P(cx, cy - w), P(x + 1, cy - w), P(x + 1, cy + w), P(cx, cy + w)], col);
    if (nb[1]) poly([P(x, cy - w), P(cx, cy - w), P(cx, cy + w), P(x, cy + w)], col);
    if (nb[2]) poly([P(cx - w, cy), P(cx + w, cy), P(cx + w, y + 1), P(cx - w, y + 1)], col);
    if (nb[3]) poly([P(cx - w, y), P(cx + w, y), P(cx + w, cy), P(cx - w, cy)], col);
    if (paved && cam.zoom > 0.6) {
      ctx.strokeStyle = S.era >= 3 ? '#f2d16b' : '#e8e2cf'; ctx.lineWidth = 0.7; ctx.setLineDash([2.5, 2.5]); ctx.beginPath();
      var c = P(cx, cy);
      if (nb[0]) { var e = P(x + 1, cy); ctx.moveTo(c[0], c[1]); ctx.lineTo(e[0], e[1]); }
      if (nb[1]) { e = P(x, cy); ctx.moveTo(c[0], c[1]); ctx.lineTo(e[0], e[1]); }
      if (nb[2]) { e = P(cx, y + 1); ctx.moveTo(c[0], c[1]); ctx.lineTo(e[0], e[1]); }
      if (nb[3]) { e = P(cx, y); ctx.moveTo(c[0], c[1]); ctx.lineTo(e[0], e[1]); }
      ctx.stroke(); ctx.setLineDash([]);
    } else if (!paved && cam.zoom > 0.6) {
      ctx.fillStyle = 'rgba(90,60,30,0.18)';
      var q = P(cx - 0.1, cy - 0.1); ctx.fillRect(q[0], q[1], 2, 1);
    }
  }

  // ---------------------------------------------------------------- object pass
  function object(S, t, x, y) {
    if (t.b) return building(S, t, x, y);
    if (t.z && t.lv) return zoneBuilding(S, t, x, y);
    if (t.t === 'forest') {
      var v = t.v;
      tree(x + 0.3, y + 0.35, 1, v & 1, '#2f6b3a'); tree(x + 0.72, y + 0.3, 0.9, (v >> 1) & 1, '#3b7d3c');
      tree(x + 0.45, y + 0.75, 1.1, (v >> 2) & 1, '#2e6a36');
    }
  }

  function building(S, t, x, y) {
    var d = FS.BUILD[t.b], dr = d.draw, v = t.v;
    if (!dr) return;
    if (typeof dr === 'object' && dr.kind === 'box') {
      var s = dr.s || 0.8, m = (1 - s) / 2, x0 = x + m, y0 = y + m, x1 = x + 1 - m, y1 = y + 1 - m;
      box(x0, y0, x1, y1, 0, dr.h, dr.wall, dr.roofType === 'flat' || dr.roofType === 'cornice' ? dr.roof : null);
      if (dr.columns) { ctx.fillStyle = '#f4f0e6'; for (var c = 0; c < 4; c++) { var p0 = P(x0 + (c + 0.3) * (x1 - x0) / 4, y1, 0); ctx.fillRect(p0[0] - 0.7, p0[1] - dr.h + 2, 1.4, dr.h - 3); } }
      windows(x0, y0, x1, y1, 0, dr.h, dr.roofType === 'flat' && dr.h > 30 ? '#cfe3f0' : '#3d4954', dr.h > 30 ? 6 : 5, 3);
      if (dr.roofType === 'hip') hipRoof(x0, y0, x1, y1, dr.h, 9, dr.roof);
      else if (dr.roofType === 'gable') gableRoof(x0, y0, x1, y1, dr.h, 9, dr.roof, dr.wall, v & 1);
      else if (dr.roofType === 'cornice') cornice(x0, y0, x1, y1, dr.h, dr.trim || '#e8dcc4', dr.roof);
      if (dr.tower) { box(x + 0.4, y + 0.4, x + 0.6, y + 0.6, dr.h, dr.h + 18, dr.wall, null); hipRoof(x + 0.4, y + 0.4, x + 0.6, y + 0.6, dr.h + 18, 8, '#3a5a6a'); }
      if (dr.bell) { box(x + 0.42, y + 0.6, x + 0.56, y + 0.74, dr.h, dr.h + 8, '#f0e6d6', null); hipRoof(x + 0.42, y + 0.6, x + 0.56, y + 0.74, dr.h + 8, 5, dr.roof); }
      if (dr.stack) {
        var n = dr.stack === true ? 1 : dr.stack;
        for (var k = 0; k < n; k++) { var sx = x0 + 0.08 + k * 0.25; box(sx, y0 + 0.08, sx + 0.1, y0 + 0.18, dr.h, dr.h + 22, '#8a5a48', '#5a3a30'); smoke(sx + 0.05, y0 + 0.13, dr.h + 24, v + k); }
      }
      if (dr.icon) icon(x + 0.5, y + 0.5, dr.h + 14, dr.icon);
      return;
    }
    switch (dr) {
      case 'tree': tree(x + 0.5, y + 0.55, 1.15, v & 1, ['#3f8a3c', '#4a9a40', '#2f6b3a'][v % 3]); break;
      case 'orchard':
        for (var oy = 0; oy < 2; oy++) for (var ox = 0; ox < 2; ox++) {
          tree(x + 0.3 + ox * 0.4, y + 0.3 + oy * 0.4, 0.8, 0, '#4f9a3a');
          var fp = P(x + 0.3 + ox * 0.4, y + 0.3 + oy * 0.4, 7);
          if ((S.month % 12) >= 6 && (S.month % 12) <= 9) { ctx.fillStyle = '#d8402f'; ctx.fillRect(fp[0] - 1.5, fp[1] - 1, 1.4, 1.4); ctx.fillRect(fp[0] + 1, fp[1] + 0.5, 1.4, 1.4); }
        }
        break;
      case 'pasture':
        for (var a = 0; a < 3; a++) {
          var ph = time * 0.15 + v * 0.7 + a * 2.1;
          var px = x + 0.5 + Math.sin(ph) * 0.25, py = y + 0.5 + Math.cos(ph * 0.8 + a) * 0.25, pp = P(px, py, 0);
          ctx.fillStyle = a === 2 && (v & 1) ? '#5a4030' : '#f4f1e8';
          ctx.beginPath(); ctx.ellipse(pp[0], pp[1] - 2.5, 3, 2, 0, 0, 6.283); ctx.fill();
          ctx.fillStyle = '#333'; ctx.fillRect(pp[0] + 2, pp[1] - 3.5, 1.5, 1.5);
        }
        break;
      case 'farmhouse':
        box(x + 0.2, y + 0.25, x + 0.72, y + 0.75, 0, 13, '#f2ece0', null);
        windows(x + 0.2, y + 0.25, x + 0.72, y + 0.75, 0, 13, '#4a5a66', 6, 2);
        gableRoof(x + 0.2, y + 0.25, x + 0.72, y + 0.75, 13, 9, '#9b3b2e', '#f2ece0', 1);
        // silo
        var sp = P(x + 0.83, y + 0.3, 0);
        ctx.fillStyle = '#b8b8b0'; ctx.fillRect(sp[0] - 3.5, sp[1] - 22, 7, 22);
        ctx.fillStyle = '#9a9a92'; ctx.fillRect(sp[0], sp[1] - 22, 3.5, 22);
        ctx.beginPath(); ctx.arc(sp[0], sp[1] - 22, 3.5, Math.PI, 0); ctx.fillStyle = '#7a7a72'; ctx.fill();
        break;
      case 'well': {
        var c = P(x + 0.5, y + 0.5, 0);
        ctx.fillStyle = '#9a948a'; ctx.beginPath(); ctx.ellipse(c[0], c[1] - 2, 7, 3.5, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#2a4f70'; ctx.beginPath(); ctx.ellipse(c[0], c[1] - 3, 5, 2.3, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#6b4a2f'; ctx.fillRect(c[0] - 6, c[1] - 13, 1.5, 11); ctx.fillRect(c[0] + 4.5, c[1] - 13, 1.5, 11);
        hipRoof(x + 0.32, y + 0.32, x + 0.68, y + 0.68, 11, 5, '#7d3b2f');
        break; }
      case 'market': {
        var cols = ['#d9534f', '#f0ad4e', '#5bc0de', '#5cb85c'];
        for (var i = 0; i < 3; i++) {
          var bx = x + 0.12 + (i % 2) * 0.42, by = y + 0.12 + Math.floor(i / 2) * 0.42 + (i === 2 ? 0.0 : 0);
          box(bx, by, bx + 0.3, by + 0.3, 0, 4, '#8a6a48', null);
          hipRoof(bx - 0.03, by - 0.03, bx + 0.33, by + 0.33, 6, 4, cols[(i + v) % 4]);
        }
        icon(x + 0.5, y + 0.5, 22, '🧺');
        break; }
      case 'greenhouse':
        box(x + 0.12, y + 0.15, x + 0.88, y + 0.85, 0, 8, '#bfe3d6', null);
        gableRoof(x + 0.12, y + 0.15, x + 0.88, y + 0.85, 8, 8, '#d9f2ea', '#bfe3d6', 1);
        windows(x + 0.12, y + 0.15, x + 0.88, y + 0.85, 0, 8, 'rgba(60,140,90,0.35)', 3, 5, 2);
        break;
      case 'chapel':
        box(x + 0.2, y + 0.18, x + 0.8, y + 0.82, 0, 14, '#f4f1ea', null);
        windows(x + 0.2, y + 0.18, x + 0.8, y + 0.82, 0, 14, '#5b6b8a', 7, 3, 5);
        gableRoof(x + 0.2, y + 0.18, x + 0.8, y + 0.82, 14, 10, '#5a5450', '#f4f1ea', 0);
        box(x + 0.42, y + 0.68, x + 0.58, y + 0.84, 0, 30, '#f4f1ea', null);
        hipRoof(x + 0.42, y + 0.68, x + 0.58, y + 0.84, 30, 14, '#5a5450');
        icon(x + 0.5, y + 0.76, 52, '🔔');
        break;
      case 'townhall':
        box(x + 0.08, y + 0.12, x + 0.92, y + 0.88, 0, 22, '#e9e2d0', '#cfc6b0');
        ctx.fillStyle = '#fbf8f0';
        for (var col = 0; col < 6; col++) { var cp = P(x + 0.14 + col * 0.14, y + 0.88, 0); ctx.fillRect(cp[0] - 0.8, cp[1] - 21, 1.6, 19); }
        cornice(x + 0.08, y + 0.12, x + 0.92, y + 0.88, 22, '#f4efe2', '#cfc6b0');
        box(x + 0.32, y + 0.36, x + 0.68, y + 0.64, 24, 34, '#e9e2d0', null);
        var dc = P(x + 0.5, y + 0.5, 34);
        ctx.beginPath(); ctx.arc(dc[0], dc[1], 9, Math.PI, 0); ctx.fillStyle = '#7fa89a'; ctx.fill();
        ctx.fillStyle = '#c9a227'; ctx.fillRect(dc[0] - 0.7, dc[1] - 15, 1.4, 6);
        icon(x + 0.5, y + 0.5, 62, '🏛️');
        break;
      case 'windmill': {
        var b0 = P(x + 0.5, y + 0.5, 0);
        ctx.fillStyle = '#e8e0cf';
        ctx.beginPath(); ctx.moveTo(b0[0] - 7, b0[1]); ctx.lineTo(b0[0] + 7, b0[1]); ctx.lineTo(b0[0] + 3.5, b0[1] - 30); ctx.lineTo(b0[0] - 3.5, b0[1] - 30); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#cfc6b2'; ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b0[0] + 7, b0[1]); ctx.lineTo(b0[0] + 3.5, b0[1] - 30); ctx.lineTo(b0[0], b0[1] - 30); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7d3b2f'; ctx.beginPath(); ctx.moveTo(b0[0] - 5, b0[1] - 30); ctx.lineTo(b0[0] + 5, b0[1] - 30); ctx.lineTo(b0[0], b0[1] - 38); ctx.closePath(); ctx.fill();
        var hub = [b0[0] - 1, b0[1] - 31], ang = time * 1.6 + v;
        ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 2;
        for (var bl = 0; bl < 4; bl++) {
          var aa = ang + bl * Math.PI / 2;
          ctx.beginPath(); ctx.moveTo(hub[0], hub[1]); ctx.lineTo(hub[0] + Math.cos(aa) * 15, hub[1] + Math.sin(aa) * 15); ctx.stroke();
        }
        break; }
      case 'watertower': {
        var w0 = P(x + 0.5, y + 0.5, 0);
        ctx.strokeStyle = '#6a6a6a'; ctx.lineWidth = 1.2; ctx.beginPath();
        ctx.moveTo(w0[0] - 7, w0[1]); ctx.lineTo(w0[0] - 5, w0[1] - 26); ctx.moveTo(w0[0] + 7, w0[1]); ctx.lineTo(w0[0] + 5, w0[1] - 26);
        ctx.moveTo(w0[0], w0[1] + 2); ctx.lineTo(w0[0], w0[1] - 26); ctx.stroke();
        ctx.fillStyle = '#8fb8c8'; ctx.beginPath(); ctx.ellipse(w0[0], w0[1] - 33, 10, 9, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#6f98a8'; ctx.beginPath(); ctx.ellipse(w0[0] + 4, w0[1] - 33, 5, 8, 0, 0, 6.283); ctx.fill();
        break; }
      case 'solar':
        for (var r = 0; r < 3; r++) {
          var ry = y + 0.15 + r * 0.26;
          poly([P(x + 0.12, ry, 3), P(x + 0.88, ry, 3), P(x + 0.88, ry + 0.18, 7), P(x + 0.12, ry + 0.18, 7)], '#2d4a7a');
        }
        break;
      case 'park':
        tree(x + 0.25, y + 0.25, 0.9, 0); tree(x + 0.78, y + 0.3, 0.8, 0, '#4a9a40'); tree(x + 0.3, y + 0.78, 0.85, 1);
        var bp = P(x + 0.5, y + 0.5, 0); ctx.fillStyle = '#9ccde8'; ctx.beginPath(); ctx.ellipse(bp[0], bp[1], 5, 2.5, 0, 0, 6.283); ctx.fill();
        break;
      case 'bigpark':
        var pp2 = P(x + 0.62, y + 0.62, 0); ctx.fillStyle = '#4f93c9'; ctx.beginPath(); ctx.ellipse(pp2[0], pp2[1], 9, 4.5, 0, 0, 6.283); ctx.fill();
        tree(x + 0.2, y + 0.2, 1, 0); tree(x + 0.5, y + 0.15, 0.9, 1); tree(x + 0.15, y + 0.55, 1, 0, '#4a9a40'); tree(x + 0.85, y + 0.3, 0.9, 0); tree(x + 0.3, y + 0.85, 1, 1);
        break;
      case 'plaza': {
        var fc = P(x + 0.5, y + 0.5, 0);
        ctx.fillStyle = '#a9a294'; ctx.beginPath(); ctx.ellipse(fc[0], fc[1] - 1, 9, 4.5, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#7fc1e6'; ctx.beginPath(); ctx.ellipse(fc[0], fc[1] - 2, 7, 3.4, 0, 0, 6.283); ctx.fill();
        var jet = 6 + Math.sin(time * 5) * 1.5;
        ctx.strokeStyle = 'rgba(220,240,255,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(fc[0], fc[1] - 2); ctx.lineTo(fc[0], fc[1] - 2 - jet); ctx.stroke();
        tree(x + 0.15, y + 0.15, 0.7, 0); tree(x + 0.85, y + 0.85, 0.7, 0);
        break; }
      case 'stadium': {
        box(x + 0.05, y + 0.05, x + 0.95, y + 0.95, 0, 14, '#b9b3a8', null);
        poly([P(x + 0.05, y + 0.05, 14), P(x + 0.95, y + 0.05, 14), P(x + 0.95, y + 0.95, 14), P(x + 0.05, y + 0.95, 14)], '#8d877c');
        poly([P(x + 0.22, y + 0.22, 14), P(x + 0.78, y + 0.22, 14), P(x + 0.78, y + 0.78, 14), P(x + 0.22, y + 0.78, 14)], '#4f9e4a');
        icon(x + 0.5, y + 0.5, 30, '🏟️');
        break; }
      case 'beacon': {
        box(x + 0.25, y + 0.25, x + 0.75, y + 0.75, 0, 12, '#9b8d78', '#8a7c68');
        box(x + 0.4, y + 0.4, x + 0.6, y + 0.6, 12, 110, '#e9e2d0', null);
        windows(x + 0.4, y + 0.4, x + 0.6, y + 0.6, 12, 110, '#c9a227', 10, 1, 4);
        box(x + 0.36, y + 0.36, x + 0.64, y + 0.64, 110, 116, '#c9a227', '#e6c65a');
        var gl = P(x + 0.5, y + 0.5, 124);
        ctx.fillStyle = 'rgba(255,230,140,' + (0.6 + Math.sin(time * 3) * 0.3).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(gl[0], gl[1], 6, 0, 6.283); ctx.fill();
        break; }
    }
  }

  // ---------------------------------------------------------------- zone buildings (style-aware)
  function zoneBuilding(S, t, x, y) {
    var sty = FS.STYLES[t.st || 'vernacular'] || FS.STYLES.vernacular, v = t.v, lv = t.lv;
    var wall = sty.walls[v % sty.walls.length], roof = sty.roofs[v % sty.roofs.length];
    if (t.z === 'R') return resBuilding(sty, wall, roof, lv, v, x, y, t.st);
    if (t.z === 'C') return comBuilding(sty, wall, roof, lv, v, x, y, t.st);
    return indBuilding(sty, lv, v, x, y, t.st);
  }

  function tallTop(sty, x0, y0, x1, y1, h, wall, roof, lv, v) {
    var kind = sty.tall;
    if (kind === 'setback') { cornice(x0, y0, x1, y1, h, sty.trim, roof); return; }
    if (kind === 'cornice') { cornice(x0, y0, x1, y1, h, sty.trim, roof); if (lv >= 4) box(x0 + 0.2, y0 + 0.2, x0 + 0.35, y0 + 0.35, h + 2, h + 8, '#7a6a5a', '#5a4a3a'); }
    else if (kind === 'glass') { poly([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], roof); if (v & 1) box(x0 + 0.15, y0 + 0.15, x0 + 0.4, y0 + 0.4, h, h + 5, '#8a96a0', '#6a7680'); else cornice(x0, y0, x1, y1, h, '#c9d3da', roof); }
    else if (kind === 'green') {
      poly([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], '#6aa84f');
      ctx.save(); ctx.translate(0, -h); tree(x0 + 0.25, y0 + 0.3, 0.6, 0, '#4a9a40'); tree(x1 - 0.2, y1 - 0.25, 0.5, 0, '#5fae4f'); ctx.restore();
    } else poly([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], roof);
  }

  function tallBody(sty, x0, y0, x1, y1, h, wall, roof, lv, v) {
    if (sty.tall === 'setback' && lv >= 4) {
      var h1 = h * 0.6, h2 = h * 0.84, i1 = (x1 - x0) * 0.12, i2 = (x1 - x0) * 0.24;
      box(x0, y0, x1, y1, 0, h1, wall, shade(wall, -0.1)); windows(x0, y0, x1, y1, 0, h1, sty.win, 6, 4);
      box(x0 + i1, y0 + i1, x1 - i1, y1 - i1, h1, h2, wall, shade(wall, -0.1)); windows(x0 + i1, y0 + i1, x1 - i1, y1 - i1, h1, h2, sty.win, 6, 3);
      box(x0 + i2, y0 + i2, x1 - i2, y1 - i2, h2, h, wall, sty.trim); windows(x0 + i2, y0 + i2, x1 - i2, y1 - i2, h2, h, sty.win, 6, 2);
      // vertical brass piers
      ctx.fillStyle = sty.trim;
      var pa = P((x0 + x1) / 2, y1, 0); ctx.fillRect(pa[0] - 0.6, pa[1] - h1, 1.2, h1);
      if (lv >= 5) { var sp = P((x0 + x1) / 2, (y0 + y1) / 2, h); ctx.beginPath(); ctx.moveTo(sp[0] - 3, sp[1]); ctx.lineTo(sp[0] + 3, sp[1]); ctx.lineTo(sp[0], sp[1] - 30); ctx.closePath(); ctx.fillStyle = '#d8b84a'; ctx.fill(); }
      return;
    }
    if (sty.glass) {
      box(x0, y0, x1, y1, 0, h, wall, null);
      // mullions
      if (cam.zoom > 0.55) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.5; ctx.beginPath();
        for (var k = 1; k < 4; k++) {
          var a = P(x0 + (x1 - x0) * k / 4, y1, 0), b = P(x0 + (x1 - x0) * k / 4, y1, h); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
          a = P(x1, y0 + (y1 - y0) * k / 4, 0); b = P(x1, y0 + (y1 - y0) * k / 4, h); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        }
        for (var hh = 6; hh < h; hh += 6) { a = P(x0, y1, hh); b = P(x1, y1, hh); var c = P(x1, y0, hh); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); }
        ctx.stroke();
        // sky reflection
        poly([P(x0, y1, h * 0.55), P(x0 + (x1 - x0) * 0.4, y1, h * 0.9), P(x0 + (x1 - x0) * 0.55, y1, h * 0.9), P(x0 + (x1 - x0) * 0.15, y1, h * 0.55)], 'rgba(255,255,255,0.18)');
      }
      tallTop(sty, x0, y0, x1, y1, h, wall, roof, lv, v);
      if (lv >= 5 && (v & 1)) { var ap = P((x0 + x1) / 2, (y0 + y1) / 2, h); ctx.fillStyle = '#ccc'; ctx.fillRect(ap[0] - 0.5, ap[1] - 18, 1, 18); }
      return;
    }
    var w2 = sty === FS.STYLES.vernacular && sty.tallWalls ? sty.tallWalls[v % sty.tallWalls.length] : wall;
    box(x0, y0, x1, y1, 0, h, w2, null);
    windows(x0, y0, x1, y1, 0, h, sty.win, 6, lv >= 4 ? 4 : 3);
    if (sty.tall === 'cornice' && lv >= 3) { // stone banding
      ctx.fillStyle = shade(sty.trim, -0.05);
      [h * 0.33, h * 0.66].forEach(function (bh) { if (lv < 4) return; poly([P(x0, y1, bh), P(x1, y1, bh), P(x1, y1, bh + 1), P(x0, y1, bh + 1)], ctx.fillStyle); });
    }
    tallTop(sty, x0, y0, x1, y1, h, w2, roof, lv, v);
  }

  function resBuilding(sty, wall, roof, lv, v, x, y, st) {
    var flat = st === 'modern';
    if (lv <= 2) {
      var s = lv === 1 ? 0.5 : 0.66, h = lv === 1 ? 8 : 13, ox = ((v >> 2) % 3 - 1) * 0.06, m = (1 - s) / 2;
      var x0 = x + m + ox, y0 = y + m, x1 = x0 + s, y1 = y0 + s;
      if (lv === 2 && (v & 4)) tree(x + 0.15, y + 0.85, 0.7, 0);
      box(x0, y0, x1, y1, 0, h, wall, flat ? roof : null);
      windows(x0, y0, x1, y1, 0, h, sty.win, lv === 1 ? 8 : 6.5, 2, 3);
      // door
      var dp = P(x0 + s * 0.45, y1, 0); ctx.fillStyle = shade(sty.trim, -0.25); ctx.fillRect(dp[0] - 1.2, dp[1] - 5, 2.4, 5);
      if (flat) { box(x0 + 0.05, y0 + 0.05, x0 + s * 0.5, y0 + s * 0.5, h, h + 4, wall, roof); }
      else if (st === 'garden') gableRoof(x0, y0, x1, y1, h, 7, '#6aa84f', wall, v & 1);
      else gableRoof(x0, y0, x1, y1, h, lv === 1 ? 7 : 8, roof, wall, v & 1);
      if (lv === 2 && !flat) { var cx0 = x0 + s * 0.7, cy0 = y0 + s * 0.2; box(cx0, cy0, cx0 + 0.08, cy0 + 0.08, h, h + 10, '#8a5a48', '#5a3a30'); }
      if (st === 'brownstone' && lv === 2) { var sp = P(x0 + s * 0.45, y1 + 0.04, 0); ctx.fillStyle = sty.trim; ctx.fillRect(sp[0] - 2.5, sp[1] - 2, 5, 2); }
      return;
    }
    var fs = lv === 3 ? 0.9 : lv === 4 ? 0.84 : 0.7, H = FS.LEVEL_H[lv] + (v % 4) * (lv >= 4 ? 6 : 2), mm = (1 - fs) / 2;
    var X0 = x + mm, Y0 = y + mm, X1 = x + 1 - mm, Y1 = y + 1 - mm;
    if (lv === 3) {
      if (sty.tall === 'cornice' && st !== 'vernacular' || st === 'deco') {
        // rowhouses: three narrow units with stoops
        for (var u = 0; u < 3; u++) {
          var ux0 = X0 + u * (X1 - X0) / 3, ux1 = ux0 + (X1 - X0) / 3, uh = H - u % 2 * 2;
          box(ux0, Y0, ux1, Y1, 0, uh, sty.walls[(v + u) % sty.walls.length], null);
          windows(ux0, Y0, ux1, Y1, 0, uh, sty.win, 6, 1, 3.5);
          cornice(ux0, Y0, ux1, Y1, uh, sty.trim, roof);
          var stp = P(ux0 + (ux1 - ux0) * 0.5, Y1 + 0.05, 0); ctx.fillStyle = shade(sty.trim, -0.15); ctx.fillRect(stp[0] - 2, stp[1] - 3, 4, 3);
        }
        return;
      }
      if (st === 'vernacular') {
        box(X0, Y0, X1, Y1, 0, H - 4, wall, null); windows(X0, Y0, X1, Y1, 0, H - 4, sty.win, 6, 3);
        gableRoof(X0, Y0, X1, Y1, H - 4, 9, roof, wall, v & 1);
        return;
      }
    }
    tallBody(sty, X0, Y0, X1, Y1, H, wall, roof, lv, v);
  }

  function comBuilding(sty, wall, roof, lv, v, x, y, st) {
    var awn = ['#d9534f', '#2e86ab', '#5cb85c', '#f0ad4e'][v % 4];
    if (lv === 1) {
      var x0 = x + 0.25, y0 = y + 0.25, x1 = x + 0.75, y1 = y + 0.75;
      box(x0, y0, x1, y1, 0, 6, '#b08a5a', '#8a6a48');
      poly([P(x0 - 0.05, y1 + 0.12, 5), P(x1 + 0.05, y1 + 0.12, 5), P(x1 + 0.05, y1 - 0.05, 9), P(x0 - 0.05, y1 - 0.05, 9)], awn);
      return;
    }
    if (lv === 2) {
      var X0 = x + 0.16, Y0 = y + 0.16, X1 = x + 0.84, Y1 = y + 0.84, h = 13;
      box(X0, Y0, X1, Y1, 0, h, wall, roof);
      // false front with a sign
      poly([P(X0, Y1, h), P(X1, Y1, h), P(X1, Y1, h + 6), P(X0, Y1, h + 6)], shade(wall, 0.05));
      poly([P(X0 + 0.1, Y1, h + 1), P(X1 - 0.1, Y1, h + 1), P(X1 - 0.1, Y1, h + 5), P(X0 + 0.1, Y1, h + 5)], sty.trim);
      poly([P(X0 + 0.05, Y1, 1), P(X1 - 0.05, Y1, 1), P(X1 - 0.05, Y1, 7), P(X0 + 0.05, Y1, 7)], '#9fc3d6');
      poly([P(X0, Y1 + 0.1, 7), P(X1, Y1 + 0.1, 7), P(X1, Y1 - 0.02, 10), P(X0, Y1 - 0.02, 10)], awn);
      return;
    }
    var fs = lv === 3 ? 0.9 : lv === 4 ? 0.84 : 0.72, H = FS.LEVEL_H[lv] + (v % 4) * (lv >= 4 ? 8 : 2), m = (1 - fs) / 2;
    var a0 = x + m, b0 = y + m, a1 = x + 1 - m, b1 = y + 1 - m;
    if (lv === 3) {
      box(a0, b0, a1, b1, 0, H, wall, null);
      windows(a0, b0, a1, b1, 8, H, sty.win, 6, 3);
      // storefront band + awning
      poly([P(a0 + 0.04, b1, 1), P(a1 - 0.04, b1, 1), P(a1 - 0.04, b1, 7), P(a0 + 0.04, b1, 7)], '#a9cde0');
      poly([P(a1, b0 + 0.04, 1), P(a1, b1 - 0.04, 1), P(a1, b1 - 0.04, 7), P(a1, b0 + 0.04, 7)], '#7fa6ba');
      poly([P(a0, b1 + 0.1, 7), P(a1, b1 + 0.1, 7), P(a1, b1 - 0.02, 10), P(a0, b1 - 0.02, 10)], awn);
      tallTop(sty, a0, b0, a1, b1, H, wall, roof, lv, v);
      return;
    }
    tallBody(sty, a0, b0, a1, b1, H, wall, roof, lv, v);
  }

  function indBuilding(sty, lv, v, x, y, st) {
    var brick = st === 'modern' ? '#8f9aa3' : st === 'deco' ? '#c9b48c' : ['#8d5a45', '#7d6a58', '#946049'][v % 3];
    if (lv === 1) {
      box(x + 0.2, y + 0.22, x + 0.8, y + 0.78, 0, 9, '#9c7a55', null);
      gableRoof(x + 0.2, y + 0.22, x + 0.8, y + 0.78, 9, 6, '#5a4a3a', '#9c7a55', v & 1);
      var lp = P(x + 0.88, y + 0.4, 0); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(lp[0] - 3, lp[1] - 3, 6, 3);
      return;
    }
    if (lv === 2) {
      box(x + 0.12, y + 0.15, x + 0.85, y + 0.85, 0, 14, brick, null);
      windows(x + 0.12, y + 0.15, x + 0.85, y + 0.85, 0, 14, '#3d4954', 7, 3, 4);
      gableRoof(x + 0.12, y + 0.15, x + 0.85, y + 0.85, 14, 6, '#4a423d', brick, 1);
      box(x + 0.7, y + 0.2, x + 0.8, y + 0.3, 14, 30, '#7a4a38', '#4a2a20'); smoke(x + 0.75, y + 0.25, 32, v);
      return;
    }
    if (lv === 3 || lv === 4) {
      var h = lv === 3 ? 18 : 24;
      box(x + 0.06, y + 0.08, x + 0.94, y + 0.92, 0, h, brick, null);
      windows(x + 0.06, y + 0.08, x + 0.94, y + 0.92, 0, h, '#3d4954', 7, 4, 4);
      for (var k = 0; k < 4; k++) { // sawtooth roof
        var sx0 = x + 0.06 + k * 0.22, sx1 = sx0 + 0.22;
        poly([P(sx0, y + 0.08, h), P(sx0, y + 0.92, h), P(sx1, y + 0.92, h + 6), P(sx1, y + 0.08, h + 6)], '#5e5650');
        poly([P(sx1, y + 0.08, h + 6), P(sx1, y + 0.92, h + 6), P(sx1, y + 0.92, h), P(sx1, y + 0.08, h)], '#a8c6d6');
      }
      box(x + 0.12, y + 0.12, x + 0.22, y + 0.22, h, h + 30, '#7a4a38', '#4a2a20'); smoke(x + 0.17, y + 0.17, h + 32, v);
      if (lv === 4) {
        box(x + 0.28, y + 0.12, x + 0.38, y + 0.22, h, h + 26, '#7a4a38', '#4a2a20'); smoke(x + 0.33, y + 0.17, h + 28, v + 1);
        var tp = P(x + 0.8, y + 0.8, 0); ctx.fillStyle = '#c8ccd0'; ctx.beginPath(); ctx.ellipse(tp[0], tp[1] - 18, 6, 3, 0, 0, 6.283); ctx.fill(); ctx.fillRect(tp[0] - 6, tp[1] - 18, 12, 16);
      }
      return;
    }
    // tech campus
    box(x + 0.08, y + 0.1, x + 0.92, y + 0.9, 0, 20, '#7fb2df', '#6aa84f');
    windows(x + 0.08, y + 0.1, x + 0.92, y + 0.9, 0, 20, '#d6ecfa', 5, 5, 3);
    tree(x + 0.3, y + 0.3, 0.6, 0);
  }

  // ---------------------------------------------------------------- traffic
  var cars = [];
  R.updateTraffic = function (S, dt) {
    var want = Math.min(60, Math.floor((S.stats.roads || 0) / 3), Math.floor(S.pop / 12));
    while (cars.length > want) cars.pop();
    var tries = 0;
    while (cars.length < want && tries++ < 20) {
      var i = Math.floor(Math.random() * S.tiles.length);
      if (S.tiles[i].b === 'road') cars.push({ x: i % FS.N, y: (i / FS.N) | 0, nx: i % FS.N, ny: (i / FS.N) | 0, t: 1, c: ['#d33', '#36c', '#eee', '#333', '#e8b53a', '#2a7'][cars.length % 6], sp: 0.6 + Math.random() * 0.6 });
    }
    cars.forEach(function (c) {
      c.t += dt * c.sp;
      if (c.t >= 1) {
        var px = c.x, py = c.y; c.x = c.nx; c.y = c.ny; c.t = 0;
        var opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function (d) { return isRoad(S, c.x + d[0], c.y + d[1]) && !(c.x + d[0] === px && c.y + d[1] === py); });
        if (!opts.length) { opts = isRoad(S, px, py) ? [[px - c.x, py - c.y]] : []; }
        if (!opts.length) { c.nx = c.x; c.ny = c.y; c.t = 1; return; }
        var o = opts[Math.floor(Math.random() * opts.length)]; c.nx = c.x + o[0]; c.ny = c.y + o[1];
      }
    });
  };
  function drawCars(S) {
    cars.forEach(function (c) {
      if (!isRoad(S, c.x, c.y)) return;
      var dx = c.nx - c.x, dy = c.ny - c.y, fx = c.x + 0.5 + dx * c.t, fy = c.y + 0.5 + dy * c.t;
      fx += -dy * 0.12; fy += dx * 0.12; // keep right
      var s = 0.09;
      box(fx - s, fy - s, fx + s, fy + s, 0, 3.5, c.c, shade(c.c, 0.25));
    });
  }

  // ---------------------------------------------------------------- overlays
  function overlayColor(S, i) {
    var M = FS.maps, v;
    switch (R.overlay) {
      case 'land': v = M.land[i] / 80; return 'hsla(' + Math.round(10 + v * 110) + ',75%,50%,0.55)';
      case 'poll': v = Math.min(1, M.poll[i] / 25); return v < 0.03 ? 'rgba(0,0,0,0)' : 'rgba(120,80,40,' + (0.15 + v * 0.6).toFixed(2) + ')';
      default: v = M.cov[R.overlay] ? M.cov[R.overlay][i] : 0; return v > 0 ? 'rgba(60,170,255,0.45)' : 'rgba(255,80,60,0.25)';
    }
  }

  // ---------------------------------------------------------------- frame
  R.draw = function (S, dt) {
    time += dt;
    var N = FS.N, z = cam.zoom;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#2b4a5e'); sky.addColorStop(1, '#4d7a6a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z), dpr * (H / 2 - cam.y * z));

    var vx0 = cam.x - W / 2 / z - 40, vx1 = cam.x + W / 2 / z + 40, vy0 = cam.y - H / 2 / z - 40, vy1 = cam.y + H / 2 / z + 160;
    var T = S.tiles, vis = [];
    for (var d = 0; d <= 2 * N - 2; d++) {
      var xs = Math.max(0, d - N + 1), xe = Math.min(d, N - 1);
      for (var x = xs; x <= xe; x++) {
        var y = d - x, cx = (x - y) * 32, cy = (x + y + 1) * 16;
        if (cx < vx0 || cx > vx1 || cy < vy0 || cy > vy1) continue;
        vis.push(y * N + x);
      }
    }
    // map edge (dirt cliff)
    poly([P(0, N, 0), P(N, N, 0), P(N, N, -14), P(0, N, -14)], '#6b5434');
    poly([P(N, 0, 0), P(N, N, 0), P(N, N, -14), P(N, 0, -14)], '#57432a');
    var i, t;
    for (var k = 0; k < vis.length; k++) { i = vis[k]; t = T[i]; ground(S, t, i % N, (i / N) | 0); }
    if (z > 0.9) {
      ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 0.5; ctx.beginPath();
      for (var g = 0; g <= N; g++) { var a = P(g, 0), b = P(g, N); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); a = P(0, g); b = P(N, g); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke();
    }
    // selection preview (on the ground)
    if (R.preview) R.preview.tiles.forEach(function (p) { diamond(p.x, p.y, 0.02, p.ok ? 'rgba(120,255,160,0.45)' : 'rgba(255,90,80,0.45)'); });
    if (R.highlight) { var hl = R.highlight; diamond(hl.x, hl.y, 0, 'rgba(255,255,255,0.3)'); }
    drawCars(S);
    for (k = 0; k < vis.length; k++) { i = vis[k]; t = T[i]; object(S, t, i % N, (i / N) | 0); }
    // ghost of the building to be placed
    if (R.preview && R.preview.ghost && R.preview.tiles.length === 1) {
      var gp = R.preview.tiles[0], gt = FS.tile(S, gp.x, gp.y);
      if (gt) { ctx.globalAlpha = 0.6; building(S, { b: R.preview.ghost, v: 7, t: 'grass' }, gp.x, gp.y); ctx.globalAlpha = 1; }
    }
    if (R.overlay && FS.maps) {
      for (k = 0; k < vis.length; k++) { i = vis[k]; if (T[i].t === 'water') continue; diamond(i % N, (i / N) | 0, 0.02, overlayColor(S, i)); }
    }
    if (FS.fly && FS.fly.active) FS.fly.draw(ctx, P, time);
  };
})(window.FS);
