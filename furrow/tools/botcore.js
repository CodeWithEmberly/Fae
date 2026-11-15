// A simple scripted mayor, used for balance tests (node) and screenshot setups (browser).
(function (FS) {
  FS.botPlay = function (S, months, opts) {
    opts = opts || {};
    var N = FS.N, H = S.home, roadR = opts.roadR || 3, log = [];
    var tryPlace = function (id, x, y) { return !FS.place(S, id, x, y); };
    function spiral(fn, maxR) { maxR = maxR || 20; for (var r = 1; r <= maxR; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; if (fn(H.x + dx, H.y + dy)) return true; } return false; }
    var isRoadLine = function (x, y) { return ((x - (H.x + 1)) % 4 === 0) || ((y - H.y) % 5 === 0); };
    function buildRoads() { var n = 0; spiral(function (x, y) { if (!FS.inMap(x, y) || Math.abs(x - H.x) > roadR || Math.abs(y - H.y) > roadR) return false; var t = FS.tile(S, x, y); if (isRoadLine(x, y) && t.t !== 'water' && !t.b && !t.z) { if (S.money > 300 && tryPlace('road', x, y)) n++; } return n > 20; }, roadR); }
    function zone(z, count) { var n = 0; spiral(function (x, y) { var t = FS.tile(S, x, y); if (!t || t.b || t.z || t.t === 'water' || isRoadLine(x, y)) return false; if (!FS.maps.road[FS.idx(x, y)]) return false; if (z === 'I' && Math.abs(x - H.x) + Math.abs(y - H.y) < 8) return false; if (tryPlace('zone' + z, x, y)) n++; return n >= count; }); }
    function build(id) { return spiral(function (x, y) { var t = FS.tile(S, x, y); if (!t || isRoadLine(x, y) || !FS.maps.road[FS.idx(x, y)]) return false; return tryPlace(id, x, y); }); }
    function farm(id) { return spiral(function (x, y) { var t = FS.tile(S, x, y); if (!t || isRoadLine(x, y) || Math.abs(x - H.x) + Math.abs(y - H.y) < 6) return false; return tryPlace(id, x, y); }, 22); }
    for (var m = 0; m < months; m++) {
      var st = S.stats, c = st.count;
      if ((st.surplus < 4 + S.pop * 0.03 || st.unemp > 0.08 || (S.era === 0 && st.demand.R < 0.2)) && S.money > 100) farm((c.barn || 0) < (c.crop || 0) / 5 ? 'barn' : ((m % 5 === 0) ? 'orchard' : (m % 7 === 0) ? 'pasture' : 'crop'));
      if (S.money > 200) buildRoads();
      if (st.zones.R[0] < 3 && st.demand.R > 0.1) zone('R', 4);
      if (S.era >= 1 && st.zones.C[0] < 2 && st.demand.C > 0.1) zone('C', 3);
      if (S.era >= 1 && st.zones.I[0] < 2 && st.demand.I > 0.1) zone('I', 2);
      if (st.zones.R[0] + st.zones.C[0] + st.zones.I[0] < 2 && m % 3 === 0 && (st.demand.R > 0.2 || st.demand.C > 0.2)) roadR = Math.min(20, roadR + 1);
      var want = [['well', st.cov.water < 0.7], ['hall', S.era >= 1 && !c.hall], ['market', S.era >= 1 && !c.market], ['school', S.era >= 1 && st.cov.edu < 0.6],
        ['park', st.cov.fun < 0.6 || st.lvBlocked > 4], ['windmill', S.era >= 1 && st.powerBlocked > 0 && S.era < 2], ['powerplant', S.era >= 2 && (st.powerBlocked > 0 || st.powerSup < st.powerDem + 10)],
        ['police', S.era >= 2 && st.cov.safety < 0.6], ['fire', S.era >= 2 && st.cov.safety < 0.8], ['clinic', S.era >= 2 && st.cov.health < 0.6], ['townhall', S.era >= 2 && !c.townhall],
        ['library', S.era >= 2 && st.lvBlocked > 3], ['plaza', S.era >= 2 && st.lvBlocked > 3], ['hospital', S.era >= 3 && st.cov.health < 0.7], ['university', S.era >= 3 && !c.university], ['bigpark', S.era >= 3 && st.lvBlocked > 5],
        ['mill', S.era >= 1 && (c.crop || 0) > 5 && (c.mill || 0) < 2], ['solar', S.era >= 3 && st.powerBlocked > 0], ['station', S.era >= 3 && !c.station], ['stadium', S.era >= 4 && !c.stadium], ['beacon', S.era >= 4 && !c.beacon]];
      for (var k = 0; k < want.length; k++) if (want[k][1] && S.money > FS.BUILD[want[k][0]].cost + 200) { build(want[k][0]); break; }
      if (st.net < 0 && S.tax < 12 && m % 6 === 0) S.tax++;
      if (st.net > 100 && S.tax > 8 && m % 6 === 0) S.tax--;
      while (S.events.length) FS.resolveEvent(S, 0, 0);
      if (FS.council.isReady(S)) {
        var ag = FS.council.makeAgenda(S);
        if (opts.styles && opts.styles[S.era]) ag.unshift({ pid: opts.styles[S.era], act: 'enact', sponsor: 'Mayor', lobby: {}, result: null });
        ag.forEach(function (it) { var p = FS.POLICY[it.pid]; if ((p.cost || 0) * 3 > st.net || (p.group === 'style' && it.sponsor !== 'Mayor')) return; if (S.capital >= 1) FS.council.makeCase(S, it); if (it.sponsor === 'Mayor') it.lobby = { ada: 5, marcus: 5, june: 5, sam: 5, lila: 5 }; FS.council.vote(S, it); });
        FS.council.adjourn(S);
      }
      FS.simMonth(S);
      S.notices.forEach(function (n) { if (n.type === 'era' || n.type === 'mission') log.push(FS.dateStr(S) + ' ' + (n.type === 'era' ? 'ERA ' + FS.ERAS[n.era].name : 'mission ' + n.title)); });
      S.notices = [];
      if (opts.report && (m % opts.report === 0 || m === months - 1)) { var s = S.stats; log.push(FS.dateStr(S) + ' pop=' + S.pop + ' $=' + Math.round(S.money) + ' net=' + Math.round(s.net) + ' happy=' + Math.round(S.happy) + ' food=' + s.foodProd.toFixed(0) + '/' + s.foodCons.toFixed(0) + ' D=' + s.demand.R.toFixed(2) + ',' + s.demand.C.toFixed(2) + ',' + s.demand.I.toFixed(2) + ' unemp=' + (s.unemp * 100).toFixed(0) + '% lvBlk=' + s.lvBlocked + ' pwBlk=' + s.powerBlocked + ' zones R' + s.zones.R + ' C' + s.zones.C + ' I' + s.zones.I + ' style=' + S.style); }
    }
    return log;
  };
})(window.FS);
