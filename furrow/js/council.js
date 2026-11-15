// Town council: agendas, stances, lobbying and votes.
(function (FS) {
  'use strict';
  var C = FS.council = {};

  C.seated = function (S) { return FS.COUNCIL.filter(function (m) { return m.seatEra <= Math.max(1, S.era); }); };

  C.available = function (S) {
    return FS.POLICIES.filter(function (p) {
      if (p.era > S.era) return false;
      if (p.group === 'style') return S.style !== p.style;
      return !S.policies[p.id];
    });
  };

  C.isReady = function (S) { return !!(S.stats.count && S.stats.count.hall) && S.month >= S.nextCouncil; };

  C.makeAgenda = function (S) {
    var st = S.stats, cand = [];
    C.available(S).forEach(function (p) {
      var w = 1, sponsor = FS.pick(FS.ADVISORS).name + ' (advisor)';
      if (p.id === 'farm_subsidy' && st.surplus < 3) { w = 5; sponsor = 'Citizens’ petition'; }
      if (p.id === 'greenbelt' && S.era >= 2) { w = 2; sponsor = 'Ada Whitcombe (council)'; }
      if (p.id === 'watch' && S.era >= 2 && st.cov.safety < 0.5) { w = 4; sponsor = 'Citizens’ petition'; }
      if (p.id === 'emissions' && st.avgPoll > 5) { w = 5; sponsor = 'Citizens’ petition'; }
      if (p.id === 'street_trees' && S.happy < 60) { w = 3; sponsor = 'Citizens’ petition'; }
      if (p.id === 'industry_incentive' && st.unemp > 0.08) { w = 4; sponsor = 'Sam Reyes (Workers’ Union)'; }
      if (p.id === 'market_day' && st.surplus > 8) { w = 3; sponsor = 'Mabel Thornberry (advisor)'; }
      if (p.id === 'upzone' && st.lvBlocked > 3) { w = 4; sponsor = 'Priya Raman (advisor)'; }
      if (p.id === 'height_limit' && S.era >= 3) { w = 2; sponsor = 'June Okonkwo (council)'; }
      if (p.group === 'style') { w = S.style === 'vernacular' ? 4 : 0.5; sponsor = p.style === 'modern' || p.style === 'deco' ? 'Marcus Bell (council)' : p.style === 'garden' ? 'Green Futures society' : 'June Okonkwo (council)'; }
      if (p.group === 'style' && p.style === 'vernacular') { w = 0.5; sponsor = 'Ada Whitcombe (council)'; }
      cand.push({ pid: p.id, act: 'enact', sponsor: sponsor, w: w });
    });
    Object.keys(S.policies).forEach(function (id) {
      var p = FS.POLICY[id];
      if (!S.policies[id] || !p || p.group === 'style') return;
      var foe = C.seated(S).filter(function (m) { return p.tags.some(function (t) { return m.dislikes[t]; }); })[0];
      if (foe) cand.push({ pid: id, act: 'repeal', sponsor: foe.name + ' (council)', w: 0.8 });
    });
    var agenda = [];
    while (agenda.length < 3 && cand.length) {
      var tot = cand.reduce(function (a, c) { return a + c.w; }, 0), r = FS.rand() * tot, k = 0;
      for (; k < cand.length - 1; k++) { r -= cand[k].w; if (r <= 0) break; }
      var c = cand.splice(k, 1)[0];
      agenda.push({ pid: c.pid, act: c.act, sponsor: c.sponsor, lobby: {}, result: null });
      // don't put two style codes on one agenda
      if (FS.POLICY[c.pid].group === 'style') cand = cand.filter(function (x) { return FS.POLICY[x.pid].group !== 'style'; });
    }
    return agenda;
  };

  C.stance = function (S, m, item) {
    var p = FS.POLICY[item.pid], s = 0;
    var tags = p.tags.concat(p.cost ? ['cost'] : []);
    tags.forEach(function (t) { s += (m.likes[t] || 0) - (m.dislikes[t] || 0); });
    if (item.act === 'repeal') s = -s;
    s += (S.relations[m.id] || 0) * 0.3;
    s += item.lobby[m.id] || 0;
    return s;
  };
  C.lean = function (s) { return s >= 0.75 ? 'yes' : s <= -0.75 ? 'no' : 'maybe'; };

  C.makeCase = function (S, item) {
    if (S.capital < 1) return 'Not enough political capital';
    S.capital -= 1;
    var moved = 0;
    C.seated(S).forEach(function (m) {
      var l = C.lean(C.stance(S, m, item));
      if (l === 'maybe') { item.lobby[m.id] = (item.lobby[m.id] || 0) + (FS.rand() < 0.75 ? 1.1 : 0.3); moved++; }
      else if (l === 'no') item.lobby[m.id] = (item.lobby[m.id] || 0) + 0.45;
    });
    return null;
  };
  C.dealCost = function (S) { return 150 * (S.era + 1); };
  C.deal = function (S, item, mid) {
    var cost = C.dealCost(S);
    if (S.money < cost) return 'Not enough money';
    S.money -= cost;
    item.lobby[mid] = (item.lobby[mid] || 0) + 2;
    S.relations[mid] = FS.clamp((S.relations[mid] || 0) + 0.5, -5, 5);
    return null;
  };

  C.vote = function (S, item) {
    var seats = C.seated(S), yes = 0, votes = [];
    seats.forEach(function (m) {
      var l = C.lean(C.stance(S, m, item)), v;
      if (l === 'maybe') v = FS.rand() < 0.5 + (S.approval - 50) / 100;
      else v = l === 'yes';
      if (v) yes++;
      votes.push({ id: m.id, yes: v });
    });
    var passed = yes > seats.length / 2;
    var p = FS.POLICY[item.pid];
    if (passed) {
      if (item.act === 'enact') {
        if (p.group === 'style') {
          FS.POLICIES.forEach(function (q) { if (q.group === 'style') delete S.policies[q.id]; });
          S.style = p.style;
        }
        S.policies[p.id] = true;
      } else {
        delete S.policies[p.id];
      }
      if (/petition/.test(item.sponsor)) S.approvalMod += 5;
      votes.forEach(function (v) { if (!v.yes) S.relations[v.id] = FS.clamp((S.relations[v.id] || 0) - 0.3, -5, 5); });
    }
    item.result = { passed: passed, yes: yes, no: seats.length - yes, votes: votes };
    S.log.unshift({ m: S.month, text: 'Council ' + (passed ? 'PASSED' : 'rejected') + ': ' + (item.act === 'repeal' ? 'repeal of ' : '') + p.name + ' (' + yes + '–' + (seats.length - yes) + ')' });
    if (S.log.length > 50) S.log.pop();
    FS.simMonth(S, true);
    return item.result;
  };

  C.adjourn = function (S) {
    S.councilsHeld++;
    S.nextCouncil = S.month + 3;
  };
})(window.FS);
