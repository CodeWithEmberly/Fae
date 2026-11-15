// Boot + game loop.
(function (FS) {
  'use strict';
  var acc = 0, last = performance.now(), yearMark = 0;

  FS.startGame = function (S, fresh) {
    FS.state = S;
    FS.ui.bind(S);
    FS.render.centerOn(S.home.x + 0.5, S.home.y + 0.5);
    FS.cam.zoom = Math.min(1.6, Math.max(0.9, window.innerWidth / 420));
    yearMark = Math.floor(S.month / 12); acc = 0;
    FS.ui.selectCat('inspect');
    if (fresh) FS.ui.showWelcome();
    else FS.ui.toast('Welcome back to ' + S.name + ', Mayor.', 'good');
  };

  function boot() {
    var cv = document.getElementById('view');
    FS.render.init(cv);
    FS.input.init(cv);
    FS.ui.init();
    var S = FS.load();
    FS.startGame(S || FS.newGame(), !S);
    document.addEventListener('visibilitychange', function () { if (document.hidden) FS.save(FS.state); });
    window.addEventListener('pagehide', function () { FS.save(FS.state); });
    requestAnimationFrame(frame);
  }

  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000), S = FS.state; last = now;
    var paused = FS.ui.sheetOpen || FS.ui.speed === 0;
    if (!paused) {
      acc += dt * FS.SPEEDS[FS.ui.speed];
      var steps = 0;
      while (acc >= FS.MONTH_SEC && steps++ < 3) {
        acc -= FS.MONTH_SEC;
        FS.simMonth(S);
        FS.ui.processNotices();
        if (FS.ui.cat !== 'inspect') FS.ui.renderTray();
        var y = Math.floor(S.month / 12);
        if (y !== yearMark) { yearMark = y; FS.save(S); }
      }
    }
    FS.fly.update(S, dt);
    FS.render.updateTraffic(S, dt);
    FS.render.draw(S, dt);
    FS.ui.hud();
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.FS);
