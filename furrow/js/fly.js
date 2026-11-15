// Fly-over mode: pilot a little news helicopter over your city.
(function (FS) {
  'use strict';
  var F = FS.fly = { active: false, x: 0, y: 0, alt: 50, vx: 0, vy: 0, face: 1, joy: { x: 0, y: 0 }, climb: 0, keys: {}, quoteT: 0, saved: null };

  F.start = function (S) {
    var c = FS.screenToTileF(FS.render.size().w / 2, FS.render.size().h / 2);
    F.x = FS.clamp(c.x, 1, FS.N - 1); F.y = FS.clamp(c.y, 1, FS.N - 1);
    F.alt = 60; F.vx = F.vy = 0; F.quoteT = 2;
    F.saved = { zoom: FS.cam.zoom };
    FS.cam.zoom = 1.7;
    F.active = true;
  };
  F.stop = function () {
    F.active = false;
    if (F.saved) FS.cam.zoom = F.saved.zoom;
  };

  function heightAt(S, x, y) {
    var t = FS.tile(S, Math.floor(x), Math.floor(y)); if (!t) return 0;
    if (t.z && t.lv) return FS.LEVEL_H[t.lv] + 30;
    if (t.b === 'beacon') return 130;
    if (t.b && FS.BUILD[t.b].draw && FS.BUILD[t.b].draw.h) return FS.BUILD[t.b].draw.h + 12;
    return 6;
  }

  F.update = function (S, dt) {
    if (!F.active) return;
    var jx = F.joy.x, jy = F.joy.y, k = F.keys;
    if (k.ArrowLeft || k.a) jx -= 1; if (k.ArrowRight || k.d) jx += 1;
    if (k.ArrowUp || k.w) jy -= 1; if (k.ArrowDown || k.s) jy += 1;
    var mag = Math.min(1, Math.sqrt(jx * jx + jy * jy));
    if (mag > 0.05) { var n = Math.sqrt(jx * jx + jy * jy); jx /= n; jy /= n; } else { jx = jy = 0; }
    // screen direction -> tile direction
    var tx = (jx / 32 + jy / 16) / 2, ty = (jy / 16 - jx / 32) / 2, tl = Math.sqrt(tx * tx + ty * ty) || 1;
    var speed = 5 * mag;
    F.vx += ((tx / tl) * speed - F.vx) * Math.min(1, dt * 3);
    F.vy += ((ty / tl) * speed - F.vy) * Math.min(1, dt * 3);
    if (!mag) { F.vx *= 1 - Math.min(1, dt * 2); F.vy *= 1 - Math.min(1, dt * 2); }
    F.x = FS.clamp(F.x + F.vx * dt, 0.5, FS.N - 0.5);
    F.y = FS.clamp(F.y + F.vy * dt, 0.5, FS.N - 0.5);
    if (Math.abs(jx) > 0.1) F.face = jx > 0 ? 1 : -1;
    var climb = F.climb + (k.q || k.PageUp ? 1 : 0) - (k.e || k.PageDown ? 1 : 0);
    F.alt = FS.clamp(F.alt + climb * 45 * dt, 10, 170);
    var floor = heightAt(S, F.x, F.y);
    if (F.alt < floor) { F.alt += (floor - F.alt) * Math.min(1, dt * 6); if (FS.ui) FS.ui.flyWarn(); }
    var p = FS.P(F.x, F.y, F.alt * 0.6);
    FS.cam.x += (p[0] - FS.cam.x) * Math.min(1, dt * 4);
    FS.cam.y += (p[1] - FS.cam.y) * Math.min(1, dt * 4);

    // overhear the streets when flying low
    F.quoteT -= dt;
    var t = FS.tile(S, Math.floor(F.x), Math.floor(F.y));
    if (FS.ui) FS.ui.flyInfo(describe(S, t), Math.round(F.alt * 3) + ' ft');
    if (F.quoteT <= 0 && F.alt < 60 && t && ((t.z && t.lv) || t.b === 'farmhouse' || (t.b && FS.BUILD[t.b].farm))) {
      F.quoteT = 5;
      var r = FS.residentOf(S, t, Math.floor(F.x), Math.floor(F.y));
      if (FS.ui) FS.ui.flyQuote(r.mood + ' ' + r.name + ': “' + r.text + '”');
    }
  };

  function describe(S, t) {
    if (!t) return '';
    if (t.b) return FS.BUILD[t.b].name;
    if (t.z && t.lv) return FS.ZONES[t.z].names[t.lv] + ' · ' + FS.STYLES[t.st || 'vernacular'].name;
    if (t.z) return 'Empty ' + FS.ZONES[t.z].name.toLowerCase() + ' lot';
    return t.t === 'water' ? 'River' : t.t === 'forest' ? 'Woods' : 'Open fields';
  }

  F.draw = function (ctx, P, time) {
    var g = P(F.x, F.y, 0), b = P(F.x, F.y, F.alt), sc = FS.clamp(1.2 - F.alt / 260, 0.5, 1.1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(g[0], g[1], 11 * sc, 5 * sc, 0, 0, 6.283); ctx.fill();
    var bx = b[0], by = b[1] + Math.sin(time * 3) * 1.2, f = F.face;
    // tail
    ctx.strokeStyle = '#b22'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(bx - 4 * f, by); ctx.lineTo(bx - 17 * f, by - 3); ctx.stroke();
    ctx.fillStyle = '#b22'; ctx.fillRect(bx - 18 * f - 1, by - 7, 2, 6);
    // skids
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx - 7, by + 7); ctx.lineTo(bx + 8, by + 7); ctx.moveTo(bx - 3, by + 4); ctx.lineTo(bx - 3, by + 7); ctx.moveTo(bx + 4, by + 4); ctx.lineTo(bx + 4, by + 7); ctx.stroke();
    // body + canopy
    ctx.fillStyle = '#d63031'; ctx.beginPath(); ctx.ellipse(bx, by, 9, 5.5, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#a5dff9'; ctx.beginPath(); ctx.ellipse(bx + 4 * f, by - 1, 4.5, 3.5, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('NEWS', bx - 2 * f, by + 2.5);
    // rotor
    ctx.strokeStyle = 'rgba(40,40,40,0.75)'; ctx.lineWidth = 1.4;
    var a = time * 28; ctx.beginPath(); ctx.moveTo(bx - Math.cos(a) * 18, by - 8 - Math.sin(a) * 4); ctx.lineTo(bx + Math.cos(a) * 18, by - 8 + Math.sin(a) * 4); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.fillRect(bx - 0.8, by - 8, 1.6, 3);
  };
})(window.FS);
