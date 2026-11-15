// Monthly simulation: food, jobs, demand, organic growth, land value, money, happiness.
(function (FS) {
  'use strict';

  var COVS = ['water', 'fun', 'edu', 'safety', 'health'];
  FS.COV_INFO = {
    water: { name: 'Water', era: 0, w: 5, icon: '💧' },
    fun: { name: 'Parks & Fun', era: 0, w: 6, icon: '🌳' },
    edu: { name: 'Education', era: 1, w: 8, icon: '📚' },
    safety: { name: 'Safety', era: 2, w: 10, icon: '🛡️' },
    health: { name: 'Health', era: 2, w: 9, icon: '⚕️' },
  };

  FS.policyFx = function (S) {
    var fx = { happy: 0, food: 0, foodPrice: 0, comD: 0, indD: 0, resD: 0, lvR: 0, lvAll: 0, lvReq: 0, pollMul: 1,
      safetyBase: 0, growth: 0, maxLevel: 5, protectFarms: false, cost: 0 };
    Object.keys(S.policies).forEach(function (id) {
      if (!S.policies[id]) return;
      var p = FS.POLICY[id]; if (!p) return;
      fx.cost += p.cost || 0;
      Object.keys(p.fx).forEach(function (k) {
        var v = p.fx[k];
        if (k === 'pollMul') fx.pollMul *= v;
        else if (k === 'maxLevel') fx.maxLevel = Math.min(fx.maxLevel, v);
        else if (typeof v === 'boolean') fx[k] = fx[k] || v;
        else fx[k] += v;
      });
    });
    return fx;
  };

  FS.modSum = function (S, key) {
    var s = 0;
    for (var i = 0; i < S.mods.length; i++) if (S.mods[i].key === key && S.mods[i].until > S.month) s += S.mods[i].val;
    return s;
  };
  FS.addMod = function (S, key, val, months, label) {
    S.mods.push({ key: key, val: val, until: S.month + months, label: label || '' });
  };

  function spreadCov(arr, x, y, r) {
    var N = FS.N;
    for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      var xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      if (dx * dx + dy * dy <= r * r + 0.5) arr[yy * N + xx] += 1;
    }
  }
  function spreadLin(arr, x, y, r, amt) {
    var N = FS.N;
    for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
      var xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r) arr[yy * N + xx] += amt * (1 - d / (r + 1));
    }
  }

  FS.hasAdjacent = function (S, x, y, b, diag) {
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      if (!diag && dx && dy) continue;
      var t = FS.tile(S, x + dx, y + dy);
      if (t && t.b === b) return true;
    }
    return false;
  };

  FS.simMonth = function (S, analyzeOnly) {
    var N = FS.N, NN = N * N, T = S.tiles, fx = FS.policyFx(S), era = FS.ERAS[S.era];
    var M = FS.maps = { lvRaw: new Float32Array(NN), land: new Float32Array(NN), poll: new Float32Array(NN), road: new Uint8Array(NN), cov: {} };
    COVS.forEach(function (c) { M.cov[c] = new Float32Array(NN); });
    var st = {
      foodProd: 0, foodCons: 0, jobsFarm: 0, jobsC: 0, jobsI: 0, jobsSvc: 0, resCap: 0, powerSup: 0, powerDem: 0,
      upkeep: 0, incomeExtra: 0, roads: 0, count: {}, zones: { R: [0, 0, 0, 0, 0, 0], C: [0, 0, 0, 0, 0, 0], I: [0, 0, 0, 0, 0, 0] },
      center: null, centerW: 0, capitalBonus: 0, happyBonus: 0, noRoad: 0, lvBlocked: 0, powerBlocked: 0, grew: 0,
    };
    var i, t, d, x, y;

    // ---- pass 1: buildings & zones
    for (i = 0; i < NN; i++) {
      t = T[i]; x = i % N; y = (i / N) | 0;
      if (t.b === 'road') {
        st.roads++;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 2) continue;
          if (FS.inMap(x + dx, y + dy)) M.road[(y + dy) * N + x + dx] = 1;
        }
        continue;
      }
      if (t.b) {
        d = FS.BUILD[t.b];
        st.count[t.b] = (st.count[t.b] || 0) + 1;
        st.upkeep += d.upkeep || 0;
        if (d.farm) st.jobsFarm += d.jobs || 0; else if (d.jobs) st.jobsSvc += d.jobs;
        if (d.power) st.powerSup += d.power;
        if (d.income) st.incomeExtra += d.income;
        if (d.residents) st.resCap += d.residents;
        if (d.radius) {
          if (d.cov) spreadCov(M.cov[d.cov], x, y, d.radius);
          if (d.lv) spreadLin(M.lvRaw, x, y, d.radius, d.lv);
        }
        if (d.poll) spreadLin(M.poll, x, y, d.pollR, d.poll * fx.pollMul);
        if (d.center && d.center > st.centerW) { st.centerW = d.center; st.center = { x: x, y: y }; }
        if (d.capital) st.capitalBonus += d.capital;
        if (d.happy) st.happyBonus += d.happy;
      }
      if (t.z) {
        var lvl = t.lv;
        st.zones[t.z][lvl]++;
        if (lvl > 0) {
          var cap = FS.ZONES[t.z].cap[lvl];
          if (t.z === 'R') st.resCap += cap; else if (t.z === 'C') st.jobsC += cap; else st.jobsI += cap;
          st.powerDem += FS.POWER_NEED[lvl];
          if (t.z === 'I') spreadLin(M.poll, x, y, lvl >= 3 ? 3 : 2, lvl * 4 * fx.pollMul * (lvl === 5 ? 0.3 : 1));
          if (t.z === 'C' && lvl >= 3) spreadLin(M.lvRaw, x, y, 3, lvl * 1.5);
        }
      }
    }

    // ---- food
    var drought = FS.modSum(S, 'drought') > 0;
    var cropMult = 1 + Math.min(2, st.count.mill || 0) * 0.15;
    for (i = 0; i < NN; i++) {
      t = T[i]; if (!t.b) continue; d = FS.BUILD[t.b]; if (!d.food) continue;
      x = i % N; y = (i / N) | 0;
      var m = 1;
      if (d.farm && FS.hasAdjacent(S, x, y, 'barn', true)) m += 0.3;
      if (d.crop) m *= cropMult;
      m *= 1 + fx.food;
      if (drought && !d.droughtProof) m *= 0.6;
      st.foodProd += d.food * m;
    }

    // ---- land value
    var center = st.center || S.home;
    st.center = center;
    var lvAll = fx.lvAll + FS.modSum(S, 'lv');
    for (i = 0; i < NN; i++) {
      t = T[i]; x = i % N; y = (i / N) | 0;
      if (t.t === 'water') { M.land[i] = 0; continue; }
      var dist = Math.sqrt((x - center.x) * (x - center.x) + (y - center.y) * (y - center.y));
      var v = 14 + Math.max(0, 30 - dist * 1.5) + Math.min(48, M.lvRaw[i]) + lvAll - M.poll[i] * 0.9;
      for (var k = 0; k < 4; k++) {
        var nt = FS.tile(S, x + [1, -1, 0, 0][k], y + [0, 0, 1, -1][k]);
        if (nt && nt.t === 'water') { v += 8; break; }
      }
      if (t.z === 'R') v += fx.lvR;
      M.land[i] = FS.clamp(v, 0, 100);
    }

    // ---- population, jobs, demand
    var pop = Math.round(st.resCap * (0.75 + 0.25 * S.happy / 100));
    S.pop = pop;
    var workers = pop * [0.3, 0.38, 0.45, 0.5, 0.5][S.era];
    var jobs = st.jobsFarm + st.jobsC + st.jobsI + st.jobsSvc;
    st.workers = workers; st.jobs = jobs;
    st.foodCons = pop * [0.15, 0.13, 0.1, 0.06, 0.04][S.era]; // later eras import most food by rail
    var surplus = st.foodProd - st.foodCons;
    st.surplus = surplus;

    var attract = 12 + S.era * 8 + (S.happy - 50) * 0.25;
    var resD = ((jobs - workers) + attract) / (pop * 0.1 + 12) + fx.resD + FS.modSum(S, 'resD');
    if (surplus < 0) resD -= 0.4 * Math.min(1, -surplus / Math.max(1, st.foodCons));
    var comD = 0, indD = 0;
    if (S.era >= 1) {
      var comBoost = (st.count.station ? 0.12 : 0) + fx.comD + FS.modSum(S, 'comD');
      comD = (pop * 0.22 + 4 - st.jobsC) / (pop * 0.08 + 10) + comBoost;
      indD = (pop * 0.17 + Math.max(0, surplus) * 0.25 + 4 - st.jobsI) / (pop * 0.08 + 10) + fx.indD + FS.modSum(S, 'indD');
    }
    st.demand = { R: FS.clamp(resD, -1, 1), C: FS.clamp(comD, -1, 1), I: FS.clamp(indD, -1, 1) };
    st.fx = fx;

    // ---- growth
    if (!analyzeOnly) {
      var maxLv = Math.min(era.maxLevel, fx.maxLevel);
      var powerFree = st.powerSup - st.powerDem;
      var order = [];
      for (i = 0; i < NN; i++) if (T[i].z) order.push(i);
      for (i = order.length - 1; i > 0; i--) { var j = Math.floor(FS.rand() * (i + 1)); var tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
      var budget = Math.max(2, Math.ceil(order.length * 0.04));
      for (var oi = 0; oi < order.length; oi++) {
        i = order[oi]; t = T[i];
        var dm = st.demand[t.z];
        if (!M.road[i]) { st.noRoad++; continue; }
        if (t.lv === 0) {
          if (budget > 0 && dm > 0.05 && FS.rand() < 0.04 + dm * 0.18) { t.lv = 1; t.st = S.style; budget--; st.grew++; }
          continue;
        }
        var req = FS.LV_REQ[t.lv + 1] + fx.lvReq;
        if (t.lv < maxLv && dm > 0.12) {
          if (M.land[i] < req) { st.lvBlocked++; }
          else if (budget > 0 && FS.rand() < (0.012 + dm * 0.045) * (1 + fx.growth * (t.z === 'R' ? 0.5 : 1))) {
            var need = FS.POWER_NEED[t.lv + 1] - FS.POWER_NEED[t.lv];
            if (need > 0 && powerFree < need) { st.powerBlocked++; continue; }
            powerFree -= need; t.lv++; t.st = S.style; budget--; st.grew++;
            continue;
          }
        }
        if (dm < -0.35 && FS.rand() < 0.03) { t.lv--; if (!t.lv) t.st = null; continue; }
        if (t.st !== S.style && FS.rand() < 0.002) t.st = S.style; // occasional renovation
      }
    }

    // ---- money
    var tax = S.tax / 100 * (pop * 1.4 + (st.jobsC + st.jobsI) * 1.0);
    var foodPrice = 1 + (st.count.market ? 0.25 : 0) + (st.count.cannery ? 0.5 : 0) + fx.foodPrice;
    var foodMoney = surplus >= 0 ? surplus * foodPrice : surplus * 2;
    var cityCost = S.era >= 2 ? pop * 0.03 * S.era : 0;
    var expenses = st.upkeep + st.roads * 0.1 + fx.cost + cityCost;
    st.income = { tax: tax, food: foodMoney, other: st.incomeExtra, upkeep: -st.upkeep, roads: -st.roads * 0.1, policies: -fx.cost, city: -cityCost };
    st.net = tax + foodMoney + st.incomeExtra - expenses;
    st.foodPrice = foodPrice;

    // ---- coverage & happiness
    var resTotal = 0, covSum = {}, pollSum = 0;
    COVS.forEach(function (c) { covSum[c] = 0; });
    for (i = 0; i < NN; i++) {
      t = T[i];
      var w = t.z === 'R' && t.lv ? FS.ZONES.R.cap[t.lv] : (t.b === 'farmhouse' ? 6 : 0);
      if (!w) continue;
      resTotal += w; pollSum += M.poll[i] * w;
      for (var c = 0; c < COVS.length; c++) if (M.cov[COVS[c]][i] > 0) covSum[COVS[c]] += w;
    }
    st.cov = {};
    COVS.forEach(function (c) { st.cov[c] = resTotal ? covSum[c] / resTotal : 1; });
    st.cov.safety = FS.clamp(st.cov.safety + fx.safetyBase, 0, 1);
    st.avgPoll = resTotal ? pollSum / resTotal : 0;
    st.unemp = Math.max(0, workers - jobs) / Math.max(1, workers);

    var target = 54, parts = {};
    parts.food = surplus >= 0 ? 4 : -(S.era >= 3 ? 8 : 18) * Math.min(1, -surplus / Math.max(1, st.foodCons));
    parts.tax = (9 - S.tax) * 2.2;
    parts.jobs = -st.unemp * (S.era ? 35 : 20);
    parts.services = 0;
    COVS.forEach(function (c) { if (S.era >= FS.COV_INFO[c].era) parts.services += (st.cov[c] - 0.7) * FS.COV_INFO[c].w * 1.5; });
    parts.pollution = -st.avgPoll * 0.5;
    parts.policies = Math.min(10, fx.happy) + st.happyBonus;
    parts.crowding = S.era >= 3 ? -Math.min(12, pop / 2500) : 0;
    parts.events = FS.modSum(S, 'happy');
    parts.power = st.powerDem > st.powerSup && S.era >= 2 ? -8 : 0;
    Object.keys(parts).forEach(function (k) { target += parts[k]; });
    st.happyParts = parts;
    st.happyTarget = FS.clamp(target, 0, 100);

    S.stats = st;
    if (analyzeOnly) return st;

    S.money += st.net;
    S.happy = FS.clamp(S.happy * 0.7 + st.happyTarget * 0.3, 0, 100);
    S.approvalMod *= 0.92;
    S.approval = FS.clamp(S.happy + S.approvalMod, 0, 100);
    S.capital = Math.min(10, S.capital + (S.approval > 65 ? 0.35 : S.approval > 45 ? 0.2 : 0.05) + st.capitalBonus);
    S.mods = S.mods.filter(function (m) { return m.until > S.month; });

    if (S.era < FS.ERAS.length - 1 && pop >= FS.ERAS[S.era + 1].minPop) {
      S.era++;
      S.notices.push({ type: 'era', era: S.era });
      if (S.era === 1) S.nextCouncil = S.month + 1;
    }
    if (S.money < 0 && !S.flags.debtWarned) { S.flags.debtWarned = true; S.notices.push({ type: 'toast', text: 'The treasury is in debt! Cut costs or raise taxes.', bad: true }); }
    if (S.money >= 0) S.flags.debtWarned = false;

    S.hist.push({ m: S.month, pop: pop, money: Math.round(S.money), happy: Math.round(S.happy), food: Math.round(surplus) });
    if (S.hist.length > 360) S.hist.shift();
    S.month++;
    if (FS.afterMonth) FS.afterMonth(S);
    return st;
  };

  // ---------------------------------------------------------------- placement
  FS.canPlace = function (S, id, x, y) {
    var t = FS.tile(S, x, y); if (!t) return 'Off the map';
    var d = FS.BUILD[id];
    if (d.era > S.era) return 'Unlocks in the ' + FS.ERAS[d.era].name + ' era';
    if (id === 'road') {
      if (t.b === 'road') return 'Already a road';
      if (t.b || (t.z && t.lv > 0)) return 'Occupied';
      return null;
    }
    if (t.t === 'water') return 'Cannot build on water';
    if (d.zone) {
      if (t.b) return 'Occupied';
      if (t.z === d.zone) return 'Already zoned';
      if (t.z && t.lv > 0) return 'Bulldoze the building first';
      return null;
    }
    if (t.b || t.z) return 'Occupied';
    if (d.unique && S.stats.count && S.stats.count[id]) return 'You can only have one';
    return null;
  };
  FS.placeCost = function (S, id, x, y) {
    var t = FS.tile(S, x, y), d = FS.BUILD[id], c = d.cost;
    if (id === 'road' && t.t === 'water') c = 50;
    if (t.t === 'forest' && id !== 'tree') c += 3;
    return c;
  };
  FS.place = function (S, id, x, y) {
    var err = FS.canPlace(S, id, x, y); if (err) return err;
    var cost = FS.placeCost(S, id, x, y);
    if (S.money < cost) return 'Not enough money';
    var t = FS.tile(S, x, y), d = FS.BUILD[id];
    S.money -= cost;
    if (d.zone) { t.z = d.zone; t.lv = 0; t.st = null; }
    else { t.b = id; t.z = null; t.lv = 0; }
    if (t.t === 'forest' && id !== 'tree' && id !== 'road') t.t = 'grass';
    if (t.t === 'forest' && id === 'road') t.t = 'grass';
    return null;
  };
  FS.bulldoze = function (S, x, y) {
    var t = FS.tile(S, x, y); if (!t) return 'Off the map';
    if (t.b === 'farmhouse') return 'Your family home stays put';
    if (!t.b && !t.z && t.t !== 'forest') return 'Nothing here';
    var cost = t.t === 'forest' && !t.b && !t.z ? 3 : 5 + (t.lv || 0) * 10;
    if (S.money < cost) return 'Not enough money';
    S.money -= cost;
    if (t.t === 'forest' && !t.b && !t.z) t.t = 'grass';
    t.b = null; t.z = null; t.lv = 0; t.st = null;
    return null;
  };
})(window.FS);
