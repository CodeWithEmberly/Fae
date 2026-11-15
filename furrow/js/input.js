// Touch-first input: one finger builds (or pans with the Look tool), two fingers pan + pinch-zoom.
// Mouse: left = tool, right/middle drag = pan, wheel = zoom.
(function (FS) {
  'use strict';
  var I = FS.input = {};
  var pts = new Map(), mode = null, start = null, moved = false, lastMid = null, lastDist = 0;

  function mid() { var a = Array.from(pts.values()); return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) }; }
  function zoomAt(sx, sy, factor) {
    var cam = FS.cam, sz = FS.render.size();
    var wx = (sx - sz.w / 2) / cam.zoom + cam.x, wy = (sy - sz.h / 2) / cam.zoom + cam.y;
    cam.zoom = FS.clamp(cam.zoom * factor, 0.35, 3.2);
    cam.x = wx - (sx - sz.w / 2) / cam.zoom; cam.y = wy - (sy - sz.h / 2) / cam.zoom;
  }
  I.zoomBy = function (f) { var sz = FS.render.size(); zoomAt(sz.w / 2, sz.h / 2, f); FS.render.clampCam(); };

  I.init = function (cv) {
    cv.addEventListener('pointerdown', function (e) {
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (FS.fly.active) { mode = 'none'; return; }
      if (pts.size === 2) {
        if (mode === 'paint') FS.ui.paintCancel();
        mode = 'pinch'; var m = mid(); lastMid = m; lastDist = m.d; return;
      }
      if (pts.size > 2) return;
      start = { x: e.clientX, y: e.clientY }; moved = false;
      var panOnly = e.button === 1 || e.button === 2 || FS.ui.isLookTool();
      if (panOnly) { mode = 'pan'; lastMid = { x: e.clientX, y: e.clientY }; }
      else { mode = 'paint'; FS.ui.paintStart(FS.screenToTile(e.clientX, e.clientY)); }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) {
        if (e.pointerType === 'mouse' && FS.ui.hover) FS.ui.hover(FS.screenToTile(e.clientX, e.clientY));
        return;
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) moved = true;
      if (mode === 'pinch' && pts.size >= 2) {
        var m = mid();
        FS.cam.x -= (m.x - lastMid.x) / FS.cam.zoom; FS.cam.y -= (m.y - lastMid.y) / FS.cam.zoom;
        if (lastDist > 0) zoomAt(m.x, m.y, m.d / lastDist);
        lastMid = m; lastDist = m.d; FS.render.clampCam();
      } else if (mode === 'pan') {
        FS.cam.x -= (e.clientX - lastMid.x) / FS.cam.zoom; FS.cam.y -= (e.clientY - lastMid.y) / FS.cam.zoom;
        lastMid = { x: e.clientX, y: e.clientY }; FS.render.clampCam();
      } else if (mode === 'paint') {
        FS.ui.paintMove(FS.screenToTile(e.clientX, e.clientY));
      }
    });
    function end(e) {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (mode === 'pinch') {
        if (pts.size === 1) { mode = 'pan'; var a = Array.from(pts.values())[0]; lastMid = { x: a.x, y: a.y }; moved = true; }
        else if (!pts.size) mode = null;
        return;
      }
      if (mode === 'paint' && e.type === 'pointerup') FS.ui.paintEnd();
      else if (mode === 'paint') FS.ui.paintCancel();
      else if (mode === 'pan' && !moved && e.type === 'pointerup' && e.button === 0) FS.ui.tap(FS.screenToTile(e.clientX, e.clientY));
      if (!pts.size) mode = null;
    }
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); FS.render.clampCam();
    }, { passive: false });

    window.addEventListener('keydown', function (e) {
      if (FS.fly.active) { FS.fly.keys[e.key] = true; if (e.key === 'Escape') FS.ui.toggleFly(); return; }
      var c = FS.cam, step = 40 / c.zoom;
      if (e.key === 'ArrowLeft') c.x -= step; else if (e.key === 'ArrowRight') c.x += step;
      else if (e.key === 'ArrowUp') c.y -= step; else if (e.key === 'ArrowDown') c.y += step;
      else if (e.key === '+' || e.key === '=') I.zoomBy(1.2); else if (e.key === '-') I.zoomBy(1 / 1.2);
      else if (e.key === ' ') { FS.ui.togglePause(); e.preventDefault(); }
      else if (e.key === 'Escape') FS.ui.closeSheet();
      FS.render.clampCam();
    });
    window.addEventListener('keyup', function (e) { FS.fly.keys[e.key] = false; });
  };
})(window.FS);
