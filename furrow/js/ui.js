// DOM UI: HUD, toolbar, painting, sheets for people / council / letters / budget.
(function (FS) {
  'use strict';
  var U = FS.ui = {};
  var $ = function (id) { return document.getElementById(id); };
  var S = null;
  U.tool = 'inspect'; U.cat = 'inspect'; U.speed = 1; U.sheetOpen = false;
  var paint = null, session = null, sheetState = null, lastHud = 0;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtMonth(m) { return FS.MONTHS[m % 12] + ' ' + (FS.START_YEAR + Math.floor(m / 12)); }

  U.bind = function (state) { S = state; U.renderToolbar(); U.hud(true); };

  // ---------------------------------------------------------------- toasts / hints
  U.toast = function (text, kind, ms) {
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = text;
    $('toasts').appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, ms || 3200);
    setTimeout(function () { el.remove(); }, (ms || 3200) + 400);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  };
  var hintTimer = null;
  function hint(text, ms) {
    var h = $('hint'); h.innerHTML = text || ''; h.classList.toggle('show', !!text);
    clearTimeout(hintTimer); if (text && !paint) hintTimer = setTimeout(function () { h.classList.remove('show'); }, ms || 5000);
  }

  // ---------------------------------------------------------------- toolbar & tray
  U.renderToolbar = function () {
    var tb = $('toolbar');
    tb.innerHTML = FS.CATS.map(function (c) {
      return '<button class="cat' + (U.cat === c.id ? ' on' : '') + '" data-cat="' + c.id + '"><span>' + c.icon + '</span><small>' + c.name + '</small></button>';
    }).join('');
    tb.querySelectorAll('button').forEach(function (b) { b.onclick = function () { U.selectCat(b.dataset.cat); }; });
  };
  U.selectCat = function (cat) {
    var c = FS.CATS.filter(function (x) { return x.id === cat; })[0];
    if (!c.items) {
      U.cat = cat; U.tool = cat; $('tray').classList.remove('open');
      hint(cat === 'inspect' ? 'Tap anything to learn about it. Drag to pan, pinch to zoom.' : 'Drag across tiles to clear them. Two fingers pan.');
      U.renderToolbar(); return;
    }
    if (U.cat === cat && $('tray').classList.contains('open')) { $('tray').classList.remove('open'); return; }
    U.cat = cat; U.renderToolbar(); U.renderTray();
    $('tray').classList.add('open');
  };
  U.renderTray = function () {
    var c = FS.CATS.filter(function (x) { return x.id === U.cat; })[0];
    if (!c || !c.items) return;
    $('tray').innerHTML = c.items.map(function (id) {
      var d = FS.BUILD[id], locked = d.era > S.era, have = d.unique && S.stats.count[id];
      return '<button class="item' + (U.tool === id ? ' on' : '') + (locked ? ' locked' : '') + '" data-id="' + id + '"' + (locked ? ' disabled' : '') + '>' +
        '<span class="ic">' + (locked ? '🔒' : d.icon) + '</span><b>' + d.name + '</b>' +
        '<small>' + (locked ? FS.ERAS[d.era].name : have ? 'Built' : '$' + d.cost) + '</small></button>';
    }).join('');
    $('tray').querySelectorAll('button.item').forEach(function (b) { b.onclick = function () { U.selectTool(b.dataset.id); }; });
  };
  U.selectTool = function (id) {
    U.tool = id; U.renderTray();
    var d = FS.BUILD[id], how = paintKind(id) === 'line' ? 'Drag to draw' : paintKind(id) === 'rect' ? 'Tap, or drag a rectangle' : 'Tap (or slide) to place';
    hint('<b>' + d.icon + ' ' + d.name + '</b> · $' + d.cost + (d.upkeep ? ' · $' + d.upkeep + '/mo upkeep' : '') + '<br><span>' + d.desc + '</span><br><em>' + how + ' · two fingers to pan</em>');
  };
  U.isLookTool = function () { return U.tool === 'inspect'; };
  function paintKind(tool) {
    if (tool === 'road') return 'line';
    if (tool === 'bulldoze') return 'rect';
    var d = FS.BUILD[tool];
    if (d && (d.zone || id(tool, ['tree', 'crop', 'orchard', 'pasture']))) return 'rect';
    return 'single';
  }
  function id(t, arr) { return arr.indexOf(t) >= 0; }

  // ---------------------------------------------------------------- painting
  function selection(a, b, kind) {
    var out = [];
    if (kind === 'single') return [{ x: b.x, y: b.y }];
    if (kind === 'line') {
      var x = a.x, y = a.y;
      var sx = b.x > a.x ? 1 : -1, sy = b.y > a.y ? 1 : -1;
      var horizFirst = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
      out.push({ x: x, y: y });
      if (horizFirst) { while (x !== b.x) { x += sx; out.push({ x: x, y: y }); } while (y !== b.y) { y += sy; out.push({ x: x, y: y }); } }
      else { while (y !== b.y) { y += sy; out.push({ x: x, y: y }); } while (x !== b.x) { x += sx; out.push({ x: x, y: y }); } }
      return out.slice(0, 60);
    }
    var x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    x1 = Math.min(x1, x0 + 11); y1 = Math.min(y1, y0 + 11);
    for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) out.push({ x: xx, y: yy });
    return out;
  }
  function evalTiles(tiles) {
    var cost = 0, ok = 0;
    tiles.forEach(function (p) {
      if (!FS.inMap(p.x, p.y)) { p.ok = false; return; }
      if (U.tool === 'bulldoze') {
        var t = FS.tile(S, p.x, p.y); p.ok = !!(t && (t.b || t.z || t.t === 'forest') && t.b !== 'farmhouse');
        if (p.ok) cost += t.t === 'forest' && !t.b && !t.z ? 3 : 5 + (t.lv || 0) * 10;
      } else {
        p.err = FS.canPlace(S, U.tool, p.x, p.y); p.ok = !p.err;
        if (p.ok) cost += FS.placeCost(S, U.tool, p.x, p.y);
      }
      if (p.ok) ok++;
    });
    return { cost: cost, ok: ok };
  }
  function updatePreview() {
    var kind = paintKind(U.tool), tiles = selection(paint.a, paint.b, kind).filter(function (p) { return FS.inMap(p.x, p.y); });
    var r = evalTiles(tiles);
    FS.render.preview = { tiles: tiles, ghost: kind === 'single' && FS.BUILD[U.tool] && FS.BUILD[U.tool].draw ? U.tool : null };
    var msg = r.ok ? (U.tool === 'bulldoze' ? 'Clear ' : 'Build ') + r.ok + ' tile' + (r.ok > 1 ? 's' : '') + ' · <b class="' + (r.cost > S.money ? 'bad' : '') + '">' + FS.money(r.cost) + '</b>'
      : (tiles[0] && tiles[0].err ? tiles[0].err : 'Nothing to do here');
    hint(msg);
  }
  U.paintStart = function (t) {
    if (U.tool === 'inspect') return;
    paint = { a: t, b: t }; updatePreview();
  };
  U.paintMove = function (t) {
    if (!paint || (t.x === paint.b.x && t.y === paint.b.y)) return;
    paint.b = t; updatePreview();
  };
  U.paintCancel = function () { paint = null; FS.render.preview = null; hint(''); };
  U.paintEnd = function () {
    if (!paint) return;
    var kind = paintKind(U.tool), tiles = selection(paint.a, paint.b, kind), done = 0, spent = 0, lastErr = null, before = S.money;
    tiles.forEach(function (p) {
      var err = U.tool === 'bulldoze' ? FS.bulldoze(S, p.x, p.y) : FS.place(S, U.tool, p.x, p.y);
      if (!err) done++; else lastErr = err;
    });
    spent = before - S.money;
    paint = null; FS.render.preview = null;
    if (done) {
      FS.simMonth(S, true);
      hint((U.tool === 'bulldoze' ? 'Cleared ' : 'Built ') + done + ' · ' + FS.money(spent));
      if (U.tool === 'hall') U.toast('🔔 The Meeting Hall is open! The Town Council will convene ' + (S.month >= S.nextCouncil ? 'now' : 'in ' + fmtMonth(S.nextCouncil)) + '.', 'good', 4500);
      if (FS.BUILD[U.tool] && FS.BUILD[U.tool].unique) U.renderTray();
      if (navigator.vibrate) navigator.vibrate(8);
    } else if (lastErr) { hint(lastErr); U.toast(lastErr, 'bad', 1800); }
    U.hud(true);
  };

  // ---------------------------------------------------------------- HUD
  U.hud = function (force) {
    var now = performance.now(); if (!force && now - lastHud < 250) return; lastHud = now;
    var st = S.stats, era = FS.ERAS[S.era];
    $('cityName').textContent = S.name;
    $('era').textContent = era.icon + ' ' + era.name;
    $('date').textContent = FS.dateStr(S);
    $('money').innerHTML = '💰 ' + FS.money(S.money) + ' <small class="net ' + (st.net >= 0 ? 'good' : 'bad') + '">' + (st.net >= 0 ? '+' : '') + Math.round(st.net) + '</small>';
    $('pop').innerHTML = '👥 ' + S.pop.toLocaleString('en-US') + (S.era < 4 ? ' <small>/' + FS.ERAS[S.era + 1].minPop.toLocaleString('en-US') + '</small>' : '');
    $('food').innerHTML = '🌾 <span class="' + (st.surplus >= 0 ? 'good' : 'bad') + '">' + (st.surplus >= 0 ? '+' : '') + Math.round(st.surplus) + '</span>';
    $('happy').innerHTML = (S.approval >= 65 ? '😀' : S.approval >= 45 ? '🙂' : S.approval >= 30 ? '😐' : '😠') + ' ' + Math.round(S.approval) + '% <small class="cap">⭐' + S.capital.toFixed(1) + '</small>';
    ['R', 'C', 'I'].forEach(function (z) {
      var v = st.demand[z], el = $('d' + z);
      el.style.height = Math.round(Math.abs(v) * 26) + 'px';
      el.className = v >= 0 ? 'pos' : 'neg';
      el.parentNode.style.opacity = z !== 'R' && S.era < 1 ? 0.3 : 1;
    });
    var adv = FS.advice(S), urgent = adv.some(function (a) { return a.items[0].pri >= 3; });
    setBadge('bPeople', urgent ? '!' : '');
    setBadge('bCouncil', FS.council.isReady(S) ? '●' : '');
    setBadge('bLetters', S.events.length ? S.events.length : '');
    document.querySelectorAll('#speed button').forEach(function (b) { b.classList.toggle('on', +b.dataset.s === U.speed); });
  };
  function setBadge(id, v) { var b = $(id).querySelector('.badge'); b.textContent = v; b.style.display = v === '' ? 'none' : 'block'; }

  U.togglePause = function () { U.setSpeed(U.speed ? 0 : (U.prevSpeed || 1)); };
  U.setSpeed = function (s) { if (s) U.prevSpeed = s; U.speed = s; U.hud(true); };

  // ---------------------------------------------------------------- notices from the sim
  U.processNotices = function () {
    while (S.notices.length) {
      var n = S.notices.shift();
      if (n.type === 'toast') U.toast(n.text, n.bad ? 'bad' : '');
      else if (n.type === 'mission') U.toast('🎖️ <b>Governor:</b> “' + esc(n.title) + '” complete! State grant of ' + FS.money(n.reward) + '.', 'good', 5000);
      else if (n.type === 'letter') U.toast('✉️ A letter has arrived: <b>' + esc(n.title) + '</b>', '', 4000);
      else if (n.type === 'council') U.toast('🏛️ The Town Council is ready to convene.', '', 4000);
      else if (n.type === 'era') U.showEra(n.era);
    }
  };

  // ---------------------------------------------------------------- sheets
  U.openSheet = function (title, tabs, render, active) {
    sheetState = { title: title, tabs: tabs || null, render: render, active: active || (tabs ? tabs[0].id : null) };
    U.sheetOpen = true; $('sheetWrap').classList.remove('hidden');
    U.redrawSheet();
  };
  U.redrawSheet = function () {
    if (!sheetState) return;
    $('sheetTitle').innerHTML = sheetState.title;
    var tabs = $('sheetTabs');
    if (sheetState.tabs) {
      tabs.innerHTML = sheetState.tabs.map(function (t) { return '<button data-t="' + t.id + '" class="' + (t.id === sheetState.active ? 'on' : '') + '">' + t.label + '</button>'; }).join('');
      tabs.querySelectorAll('button').forEach(function (b) { b.onclick = function () { sheetState.active = b.dataset.t; U.redrawSheet(); }; });
      tabs.style.display = '';
    } else { tabs.innerHTML = ''; tabs.style.display = 'none'; }
    var body = $('sheetBody');
    body.innerHTML = sheetState.render(sheetState.active);
    body.querySelectorAll('[data-act]').forEach(function (el) { el.onclick = function (e) { e.stopPropagation(); U.act(el.dataset.act, el.dataset); }; });
  };
  U.closeSheet = function () {
    if (session && !session.done) { /* leaving mid-session keeps it open for later */ }
    sheetState = null; U.sheetOpen = false; $('sheetWrap').classList.add('hidden'); FS.render.highlight = null;
  };

  // central action dispatcher for sheet buttons
  U.act = function (a, ds) {
    switch (a) {
      case 'tax': S.tax = FS.clamp(S.tax + (+ds.d), 0, 20); FS.simMonth(S, true); break;
      case 'letter': {
        var msg = FS.resolveEvent(S, +ds.i, +ds.c);
        U.toast('✉️ ' + esc(msg), 'good', 4000);
        if (!S.events.length) { U.closeSheet(); U.hud(true); return; }
        break; }
      case 'forum': U.townForum(); break;
      case 'bulldozeTile': {
        var err = FS.bulldoze(S, +ds.x, +ds.y); if (err) U.toast(err, 'bad'); else { FS.simMonth(S, true); U.closeSheet(); U.hud(true); return; }
        break; }
      case 'case': { var e2 = FS.council.makeCase(S, session.items[session.i]); if (e2) U.toast(e2, 'bad'); break; }
      case 'deal': { var e3 = FS.council.deal(S, session.items[session.i], ds.m); if (e3) U.toast(e3, 'bad'); break; }
      case 'vote': FS.council.vote(S, session.items[session.i]); if (navigator.vibrate) navigator.vibrate([10, 40, 10]); break;
      case 'table': session.items[session.i].result = { tabled: true }; break;
      case 'next': session.i++; break;
      case 'motion': session.picking = true; break;
      case 'pickMotion': session.items.push({ pid: ds.p, act: 'enact', sponsor: 'Mayor’s motion', lobby: {}, result: null }); session.picking = false; break;
      case 'cancelPick': session.picking = false; break;
      case 'adjourn': FS.council.adjourn(S); session = null; U.closeSheet(); U.toast('🏛️ The council is adjourned. Next session: ' + fmtMonth(S.nextCouncil) + '.'); U.hud(true); return;
      case 'beginCouncil': session = { items: FS.council.makeAgenda(S), i: 0 }; break;
      case 'save': { var ok = FS.save(S); U.toast(ok ? '💾 Saved' : 'Could not save', ok ? 'good' : 'bad'); break; }
      case 'newgame': U.menuConfirm = true; break;
      case 'newgameNo': U.menuConfirm = false; break;
      case 'newgameYes': U.menuConfirm = false; U.closeSheet(); session = null; FS.startGame(FS.newGame(), true); FS.save(FS.state); return;
      case 'rename': { var inp = $('nameInput'), nm = inp && inp.value; if (nm && nm.trim()) { S.name = nm.trim().slice(0, 28); U.hud(true); U.toast('✏️ Renamed to ' + esc(S.name), 'good'); } break; }
      case 'help': U.showHelp(); return;
      case 'close': U.closeSheet(); return;
      case 'goto': FS.render.centerOn(+ds.x + 0.5, +ds.y + 0.5); U.closeSheet(); return;
    }
    U.redrawSheet(); U.hud(true);
  };

  // ---------------------------------------------------------------- inspect
  U.tap = function (t) {
    if (!FS.inMap(t.x, t.y)) return;
    var tile = FS.tile(S, t.x, t.y), i = FS.idx(t.x, t.y), M = FS.maps, name, body = '';
    FS.render.highlight = t;
    var lv = Math.round(M.land[i]), poll = Math.round(M.poll[i]);
    if (tile.b) {
      var d = FS.BUILD[tile.b]; name = d.icon + ' ' + d.name;
      body += '<p>' + d.desc + '</p><div class="kv">';
      if (d.food) body += '<span>🌾 Food</span><b>' + d.food + '/mo base' + (FS.hasAdjacent(S, t.x, t.y, 'barn', true) && d.farm ? ' (+30% barn)' : '') + '</b>';
      if (d.jobs) body += '<span>👷 Jobs</span><b>' + d.jobs + '</b>';
      if (d.power) body += '<span>⚡ Power</span><b>' + d.power + '</b>';
      if (d.upkeep) body += '<span>💸 Upkeep</span><b>$' + d.upkeep + '/mo</b>';
      if (d.radius) body += '<span>📡 Reach</span><b>' + d.radius + ' tiles</b>';
      body += '</div>';
      if (tile.b === 'farmhouse' || d.farm) { var r0 = FS.residentOf(S, tile, t.x, t.y); body += voice(r0, d.farm ? 'Farmer' : 'Your family'); }
    } else if (tile.z) {
      var z = FS.ZONES[tile.z]; name = z.names[tile.lv] + (tile.lv ? '' : ' (' + z.name + ')');
      body += '<div class="kv"><span>Zone</span><b>' + z.name + '</b>';
      if (tile.lv) body += '<span>' + (tile.z === 'R' ? '👥 Residents' : '👷 Jobs') + '</span><b>' + z.cap[tile.lv] + '</b><span>🏛 Style</span><b>' + FS.STYLES[tile.st || 'vernacular'].name + '</b>';
      body += '<span>🏷 Level</span><b>' + tile.lv + ' / ' + Math.min(FS.ERAS[S.era].maxLevel, S.stats.fx.maxLevel) + '</b>';
      var need = FS.LV_REQ[tile.lv + 1] + S.stats.fx.lvReq;
      if (tile.lv < 5) body += '<span>⬆ Next level needs</span><b>land value ' + need + (FS.POWER_NEED[tile.lv + 1] ? ', power' : '') + '</b>';
      body += '</div>';
      if (!M.road[i]) body += '<p class="warn">⚠️ No road within 2 tiles. Nothing will grow here.</p>';
      if (tile.lv && tile.z === 'R') body += voice(FS.residentOf(S, tile, t.x, t.y), 'Resident');
      if (tile.lv && tile.z !== 'R') { var rr = FS.residentOf(S, tile, t.x, t.y); body += voice(rr, tile.z === 'C' ? 'Shopkeeper' : 'Foreman'); }
    } else {
      name = tile.t === 'water' ? '🌊 River' : tile.t === 'forest' ? '🌲 Woods' : '🌱 Open land';
      body += '<p>' + (tile.t === 'forest' ? 'Clearing woods costs a little extra.' : tile.t === 'water' ? 'Roads can bridge water.' : 'Ready to build.') + '</p>';
    }
    body += '<div class="kv"><span>📈 Land value</span><b>' + lv + '</b>' + (poll > 1 ? '<span>🏭 Pollution</span><b>' + poll + '</b>' : '');
    Object.keys(FS.COV_INFO).forEach(function (c) { if (S.era >= FS.COV_INFO[c].era) body += '<span>' + FS.COV_INFO[c].icon + ' ' + FS.COV_INFO[c].name + '</span><b>' + (M.cov[c][i] > 0 ? '✔︎ covered' : '—') + '</b>'; });
    body += '</div>';
    if ((tile.b && tile.b !== 'farmhouse') || tile.z) body += '<button class="btn danger" data-act="bulldozeTile" data-x="' + t.x + '" data-y="' + t.y + '">🧨 Demolish</button>';
    U.openSheet(name, null, function () { return body; });
  };
  function voice(r, role) {
    return '<div class="voice"><div class="face">' + r.mood + '</div><div><b>' + esc(r.name) + '</b> <small>' + role + ' · ' + r.job + '</small><p>“' + esc(r.text) + '”</p></div></div>';
  }

  // ---------------------------------------------------------------- People
  U.showPeople = function (tab) {
    U.openSheet('👥 Your People', [
      { id: 'adv', label: 'Advisors' }, { id: 'gov', label: 'Governor' }, { id: 'sq', label: 'Town Square' },
      { id: 'pol', label: 'Policies' }, { id: 'bud', label: 'Budget' }, { id: 'log', label: 'Chronicle' },
    ], renderPeople, tab);
  };
  function portrait(icon, color) { return '<div class="portrait" style="background:' + color + '">' + icon + '</div>'; }
  function renderPeople(tab) {
    var st = S.stats, h = '';
    if (tab === 'adv') {
      FS.advice(S).forEach(function (a) {
        var top = a.items[0];
        h += '<div class="card adv pri' + top.pri + '">' + portrait(a.adv.icon, a.adv.color) + '<div><b>' + a.adv.name + '</b> <small>' + a.adv.title + '</small>' +
          a.items.slice(0, 3).map(function (it) { return '<p class="pri' + it.pri + '">' + it.text + '</p>'; }).join('') + '</div></div>';
      });
    } else if (tab === 'gov') {
      var mi = FS.MISSIONS[S.mission];
      h += '<div class="card">' + portrait('🎖️', '#3b5b7a') + '<div><b>' + FS.GOVERNOR.name + '</b><small> · State Capitol</small>' +
        '<p>“Mayor, the state is watching ' + esc(S.name) + ' with great interest. Meet my goals and you will not find the treasury ungrateful.”</p></div></div>';
      if (mi) h += '<div class="mission"><small>CURRENT DIRECTIVE</small><b>' + mi.title + '</b><p>' + mi.text + '</p><span>Reward: ' + FS.money(mi.reward) + '</span></div>';
      else h += '<div class="mission"><b>All directives complete!</b><p>The Governor calls ' + esc(S.name) + ' the jewel of the state.</p></div>';
      h += '<h4>Completed</h4><ul class="done">' + FS.MISSIONS.slice(0, S.mission).map(function (m) { return '<li>✔︎ ' + m.title + ' <small>' + FS.money(m.reward) + '</small></li>'; }).join('') + '</ul>';
    } else if (tab === 'sq') {
      var cd = (S.flags.forumAt || -99) + 12 - S.month, fc = 50 * (S.era + 1);
      h += '<div class="row"><button class="btn" data-act="forum"' + (cd > 0 ? ' disabled' : '') + '>🎤 Hold a Town Forum ($' + fc + ')</button><small>' + (cd > 0 ? 'Next forum in ' + cd + ' months' : 'Hear concerns directly, and boost approval.') + '</small></div>';
      h += '<h4>What shapes their mood <small>(target ' + Math.round(st.happyTarget) + '%)</small></h4><div class="bars">';
      var labels = { food: '🌾 Food', tax: '💰 Taxes', jobs: '👷 Jobs', services: '🏛 Services', pollution: '🏭 Pollution', policies: '📜 Policies', events: '📅 Events', power: '⚡ Power', crowding: '🏙 Crowding' };
      Object.keys(st.happyParts).forEach(function (k) {
        var v = st.happyParts[k]; if (Math.abs(v) < 0.5) return;
        h += '<div class="bar"><span>' + labels[k] + '</span><i class="' + (v >= 0 ? 'pos' : 'neg') + '" style="width:' + Math.min(100, Math.abs(v) * 4) + '%"></i><b>' + (v > 0 ? '+' : '') + Math.round(v) + '</b></div>';
      });
      h += '</div><h4>Voices from the street</h4>';
      h += S.posts.slice(0, 14).map(function (p) { return '<div class="post"><div class="face">' + p.mood + '</div><div><b>' + esc(p.who) + '</b> <small>' + p.job + ' · ' + fmtMonth(p.m) + '</small><p>' + esc(p.text) + '</p></div></div>'; }).join('') || '<p class="muted">It is quiet. Too quiet.</p>';
    } else if (tab === 'pol') {
      h += '<p class="muted">Policies are enacted (and repealed) by the Town Council. Tap 🏛️ when it convenes.</p><h4>In force</h4>';
      FS.POLICIES.forEach(function (p) { if (S.policies[p.id]) h += polCard(p, true); });
      h += '<h4>Could be proposed</h4>';
      FS.council.available(S).forEach(function (p) { h += polCard(p, false); });
      var locked = FS.POLICIES.filter(function (p) { return p.era > S.era; });
      if (locked.length) h += '<p class="muted">🔒 ' + locked.length + ' more unlock in later eras.</p>';
    } else if (tab === 'bud') {
      var inc = st.income;
      h += '<div class="taxrow"><button class="btn" data-act="tax" data-d="-1">−</button><div><small>Tax rate</small><b>' + S.tax + '%</b></div><button class="btn" data-act="tax" data-d="1">+</button></div>';
      h += '<p class="muted">Each point above 9% costs about 2 happiness; below 9% earns it.</p><div class="kv">';
      h += row('Taxes', inc.tax) + row('Food ' + (st.surplus >= 0 ? 'exports' : 'imports'), inc.food) + row('Wool & dairy', inc.other) + row('Building upkeep', inc.upkeep) + row('Roads', inc.roads) + row('Policies', inc.policies) + (inc.city ? row('City services', inc.city) : '');
      h += '<span><b>Net per month</b></span><b class="' + (st.net >= 0 ? 'good' : 'bad') + '">' + (st.net >= 0 ? '+' : '') + FS.money(st.net) + '</b></div>';
      h += '<h4>Economy</h4><div class="kv"><span>🌾 Food grown / eaten</span><b>' + Math.round(st.foodProd) + ' / ' + Math.round(st.foodCons) + '</b><span>💲 Food price</span><b>$' + st.foodPrice.toFixed(2) + '</b>' +
        '<span>👷 Jobs / workers</span><b>' + Math.round(st.jobs) + ' / ' + Math.round(st.workers) + '</b><span>⚡ Power used / made</span><b>' + st.powerDem + ' / ' + st.powerSup + '</b></div>';
      h += sparkline();
    } else if (tab === 'log') {
      h += S.log.length ? S.log.map(function (l) { return '<div class="logline"><small>' + fmtMonth(l.m) + '</small> ' + esc(l.text) + '</div>'; }).join('') : '<p class="muted">The chronicle of ' + esc(S.name) + ' is yet to be written.</p>';
    }
    return h;
  }
  function row(label, v) { return '<span>' + label + '</span><b class="' + (v >= 0 ? '' : 'bad') + '">' + (v >= 0 ? '+' : '') + FS.money(v) + '</b>'; }
  function polCard(p, on) {
    return '<div class="pol' + (on ? ' on' : '') + '"><b>' + p.name + (p.group === 'style' ? ' <span class="tag">architecture</span>' : '') + '</b><p>' + p.desc + '</p><small>' + p.tags.map(function (t) { return '#' + t; }).join(' ') + (p.cost ? ' · $' + p.cost + '/mo' : '') + '</small></div>';
  }
  function sparkline() {
    var hs = S.hist.slice(-120); if (hs.length < 3) return '';
    var max = Math.max.apply(null, hs.map(function (x) { return x.pop; })) || 1, w = 300, hh = 60;
    var pts = hs.map(function (x, k) { return (k / (hs.length - 1) * w).toFixed(1) + ',' + (hh - x.pop / max * hh).toFixed(1); }).join(' ');
    return '<h4>Population, last ' + Math.round(hs.length / 12) + ' years</h4><svg class="spark" viewBox="0 0 ' + w + ' ' + hh + '" preserveAspectRatio="none"><polyline points="' + pts + '"/></svg>';
  }

  U.townForum = function () {
    var cost = 50 * (S.era + 1);
    if (S.money < cost) return U.toast('Not enough money', 'bad');
    S.money -= cost; S.flags.forumAt = S.month; S.approvalMod += 6;
    for (var k = 0; k < 3; k++) FS.citizenPosts(S);
    var parts = S.stats.happyParts, worst = Object.keys(parts).sort(function (a, b) { return parts[a] - parts[b]; })[0];
    var tips = { food: 'food prices', tax: 'taxes', jobs: 'finding work', services: 'missing services (water, schools, safety, clinics)', pollution: 'smoke and pollution', power: 'power cuts', crowding: 'crowding', policies: 'recent policies', events: 'recent events' };
    U.toast('🎤 The forum was packed. The loudest concern: <b>' + (tips[worst] || worst) + '</b>. Approval +6.', 'good', 5000);
    S.log.unshift({ m: S.month, text: 'Town forum held. Top concern: ' + (tips[worst] || worst) + '.' });
  };

  // ---------------------------------------------------------------- Council
  U.showCouncil = function () { U.openSheet('🏛️ Town Council', null, renderCouncil); };
  function memberChip(S, m, item, showDeal) {
    var rel = S.relations[m.id] || 0, lean = item ? FS.council.lean(FS.council.stance(S, m, item)) : null, vote = null;
    if (item && item.result && item.result.votes) vote = item.result.votes.filter(function (v) { return v.id === m.id; })[0];
    var face = vote ? (vote.yes ? '✅' : '❌') : lean === 'yes' ? '👍' : lean === 'no' ? '👎' : lean ? '🤔' : '';
    var deal = showDeal && !vote && lean !== 'yes' ? '<button class="mini" data-act="deal" data-m="' + m.id + '">🤝 $' + FS.council.dealCost(S) + '</button>' : '';
    return '<div class="member"><div class="portrait sm" style="background:' + m.color + '">' + m.name.split(' ').map(function (w) { return w[0]; }).join('') + '</div>' +
      '<b>' + m.name.split(' ')[0] + '</b><small>' + m.faction + '</small><small class="rel">' + (rel > 0.5 ? '♥'.repeat(Math.min(3, Math.round(rel))) : rel < -0.5 ? '💢' : '·') + '</small>' +
      (face ? '<div class="lean">' + face + '</div>' : '') + deal + '</div>';
  }
  function renderCouncil() {
    var h = '', seats = FS.council.seated(S);
    if (S.era < 1) return '<p>Your homestead is too small for a council. Grow to a <b>Village</b> (60 residents), then build a <b>Meeting Hall</b>.</p>';
    if (!S.stats.count.hall) return '<p>The council needs somewhere to meet. Build a <b>🔔 Meeting Hall</b> from the Civic menu.</p><div class="members">' + seats.map(function (m) { return memberChip(S, m, null); }).join('') + '</div>';
    if (!session) {
      if (!FS.council.isReady(S)) {
        h += '<p>The council meets each season. Next session: <b>' + fmtMonth(S.nextCouncil) + '</b>.</p>';
        h += '<div class="members">' + seats.map(function (m) { return memberChip(S, m, null); }).join('') + '</div>';
        h += '<p class="muted">Political capital ⭐' + S.capital.toFixed(1) + ' grows with your approval rating. Spend it to persuade undecided members.</p>';
        h += '<h4>Recent votes</h4>' + (S.log.filter(function (l) { return /^Council/.test(l.text); }).slice(0, 6).map(function (l) { return '<div class="logline"><small>' + fmtMonth(l.m) + '</small> ' + esc(l.text) + '</div>'; }).join('') || '<p class="muted">None yet.</p>');
        return h;
      }
      h += '<p>The councillors take their seats. ' + seats.length + ' members; a majority passes a measure.</p>';
      h += '<div class="members">' + seats.map(function (m) { return memberChip(S, m, null); }).join('') + '</div>';
      h += '<button class="btn primary" data-act="beginCouncil">🔨 Call the session to order</button>';
      return h;
    }
    if (session.picking) {
      h += '<h4>Mayor’s motion: choose a policy</h4>';
      FS.council.available(S).filter(function (p) { return !session.items.some(function (it) { return it.pid === p.id; }); }).forEach(function (p) {
        h += '<div class="pol pick" data-act="pickMotion" data-p="' + p.id + '">' + '<b>' + p.name + '</b><p>' + p.desc + '</p></div>';
      });
      return h + '<button class="btn" data-act="cancelPick">Back</button>';
    }
    var it = session.items[session.i];
    h += '<div class="agenda">' + session.items.map(function (x, k) {
      var cls = k === session.i ? 'cur' : x.result ? (x.result.tabled ? 'tab' : x.result.passed ? 'yes' : 'no') : '';
      return '<span class="' + cls + '">' + (k + 1) + '</span>';
    }).join('') + (session.items.length < 4 && !session.items.some(function (x) { return x.sponsor === 'Mayor’s motion'; }) ? '<button class="mini" data-act="motion">+ Mayor’s motion</button>' : '') + '</div>';
    if (!it) {
      h += '<p>That concludes the agenda.</p>';
      session.items.forEach(function (x) { var p = FS.POLICY[x.pid]; h += '<div class="logline">' + (x.result.tabled ? '⏸ Tabled' : x.result.passed ? '✅ Passed' : '❌ Failed') + ': ' + (x.act === 'repeal' ? 'Repeal ' : '') + p.name + '</div>'; });
      return h + '<button class="btn primary" data-act="adjourn">🔨 Adjourn</button>';
    }
    var p = FS.POLICY[it.pid];
    h += '<div class="motion"><small>' + (it.act === 'repeal' ? 'MOTION TO REPEAL' : 'MOTION TO ENACT') + ' · sponsored by ' + esc(it.sponsor) + '</small><b>' + p.name + (p.group === 'style' ? ' <span class="tag">architecture</span>' : '') + '</b><p>' + p.desc + '</p>' +
      (p.group === 'style' ? '<div class="swatches">' + FS.STYLES[p.style].walls.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '<i style="background:' + FS.STYLES[p.style].trim + '"></i></div><p class="muted">Existing buildings keep their look until renovated, so your skyline records its history.</p>' : '') +
      '<small>' + p.tags.map(function (t) { return '#' + t; }).join(' ') + (p.cost ? ' · costs $' + p.cost + '/mo' : '') + '</small></div>';
    var voted = !!it.result;
    h += '<div class="members">' + seats.map(function (m) { return memberChip(S, m, it, !voted); }).join('') + '</div>';
    if (!voted) {
      h += '<div class="actions"><button class="btn" data-act="case"' + (S.capital < 1 ? ' disabled' : '') + '>🗣️ Make the case (⭐1, have ' + S.capital.toFixed(1) + ')</button>' +
        '<button class="btn primary" data-act="vote">🗳️ Call the vote</button><button class="btn ghost" data-act="table">Table it</button></div>';
      h += '<p class="muted">👍 likely yes · 👎 likely no · 🤔 undecided (swings with your approval, ' + Math.round(S.approval) + '%)</p>';
    } else {
      h += it.result.tabled ? '<p>The motion is tabled for another day.</p>' : '<p class="verdict ' + (it.result.passed ? 'good' : 'bad') + '">' + (it.result.passed ? '✅ The motion PASSES ' : '❌ The motion FAILS ') + it.result.yes + '–' + it.result.no + '</p>';
      h += '<button class="btn primary" data-act="next">Next item ▸</button>';
    }
    return h;
  }

  // ---------------------------------------------------------------- Letters
  U.showLetters = function () {
    if (!S.events.length) return U.openSheet('✉️ Letters', null, function () { return '<p class="muted">No letters waiting. The Governor, developers and citizens write from time to time.</p>' + (S.log.length ? '<h4>Past decisions</h4>' + S.log.slice(0, 8).map(function (l) { return '<div class="logline"><small>' + fmtMonth(l.m) + '</small> ' + esc(l.text) + '</div>'; }).join('') : ''); });
    U.openSheet('✉️ Letters', null, function () {
      var froms = { gov: ['🎖️', FS.GOVERNOR.short, '#3b5b7a'], citizens: ['👥', 'Citizens', '#5c8a4a'], dev: ['💼', 'Business', '#7a5b3b'], nature: ['🌦️', 'Mabel Thornberry', '#7cb342'] };
      return S.events.map(function (ev, i) {
        var def = FS.EVENT[ev.id], f = froms[def.from] || froms.citizens;
        return '<div class="letter"><div class="lhead">' + portrait(f[0], f[2]) + '<div><small>From ' + f[1] + ' · ' + fmtMonth(ev.m) + '</small><b>' + def.title + '</b></div></div><p>' + esc(def.text(S)) + '</p><div class="actions">' +
          def.choices.map(function (c, k) { return '<button class="btn' + (k ? '' : ' primary') + '" data-act="letter" data-i="' + i + '" data-c="' + k + '">' + esc(typeof c.label === 'function' ? c.label(S) : c.label) + '</button>'; }).join('') + '</div></div>';
      }).join('');
    });
  };

  // ---------------------------------------------------------------- era / help / menu
  U.showEra = function (e) {
    var era = FS.ERAS[e];
    var unlocked = Object.keys(FS.BUILD).filter(function (k) { return FS.BUILD[k].era === e && FS.BUILD[k].cat; });
    var pols = FS.POLICIES.filter(function (p) { return p.era === e; });
    var seats = FS.COUNCIL.filter(function (m) { return m.seatEra === e && e > 1; });
    U.openSheet(era.icon + ' ' + esc(S.name) + ' is now a ' + era.name + '!', null, function () {
      return '<p class="big">' + era.blurb + '</p>' +
        '<h4>New buildings</h4><div class="unlocks">' + unlocked.map(function (k) { return '<span>' + FS.BUILD[k].icon + ' ' + FS.BUILD[k].name + '</span>'; }).join('') + '</div>' +
        (pols.length ? '<h4>New policies for the council</h4><div class="unlocks">' + pols.map(function (p) { return '<span>📜 ' + p.name + '</span>'; }).join('') + '</div>' : '') +
        (seats.length ? '<h4>New council seat</h4><div class="unlocks">' + seats.map(function (m) { return '<span>🪑 ' + m.name + ', ' + m.faction + '</span>'; }).join('') + '</div>' : '') +
        '<p class="muted">Buildings can now grow to level ' + era.maxLevel + ': ' + ['R', 'C', 'I'].map(function (z) { return FS.ZONES[z].names[era.maxLevel]; }).join(', ') + '.</p>' +
        '<button class="btn primary" data-act="close">Onward!</button>';
    });
    if (navigator.vibrate) navigator.vibrate([20, 60, 20]);
  };
  U.showWelcome = function () {
    U.openSheet('🌾 Furrow to Skyline', null, function () {
      return '<p class="big">Spring, ' + FS.START_YEAR + '. Your family has staked a homestead on a bend of the river: a farmhouse, three wheat fields and a dirt track.</p>' +
        '<p>Grow food, give settlers work, and watch a village become a town, a city, and one day a skyline. Talk to your advisors, answer the Governor’s letters, and win over the Town Council to decide even how your streets <i>look</i>.</p>' +
        '<ol class="howto"><li>🌾 <b>Farms</b> make food and jobs. Put a Barn among them.</li><li>🏘️ <b>Zone</b> Residential land next to a road. Houses grow by themselves.</li><li>👥 Check your <b>People</b> for advice. A red “!” means urgent.</li><li>🏛️ At 60 people, build a <b>Meeting Hall</b> and convene the council.</li></ol>' +
        '<p class="muted">One finger builds · two fingers pan & pinch · 👆 Look tool pans with one finger.</p>' +
        '<button class="btn primary" data-act="close">Break ground</button>';
    });
  };
  U.showHelp = function () {
    U.openSheet('❓ How to play', null, function () {
      return '<h4>Controls</h4><ul><li><b>Build:</b> pick a category, then an item. One finger taps or drags to place.</li><li><b>Pan / zoom:</b> two fingers, or the 👆 Look tool with one finger. Mouse: right-drag and wheel.</li><li><b>Inspect:</b> 👆 Look tool, tap any tile. Residents will tell you what they think.</li></ul>' +
        '<h4>Growth</h4><ul><li>Zones grow when there is <b>demand</b> (R/C/I bars at left), a <b>road</b> within 2 tiles, and enough <b>land value</b> for taller buildings.</li><li>Land value rises near the town center, water, parks and civic buildings, and falls near smoke.</li><li>Level 3+ buildings need <b>power</b>.</li><li>Each era raises the height limit: cottages, then houses, rowhouses, apartments and towers.</li></ul>' +
        '<h4>People</h4><ul><li><b>Advisors</b> watch farms, money, planning, safety and culture.</li><li>The <b>Governor</b> sets directives with cash rewards and sends letters.</li><li><b>Town Square</b> shows what citizens are saying. Hold a forum to hear them out.</li><li>The <b>Council</b> meets each season. Persuade undecided members with ⭐ political capital or a deal.</li></ul>' +
        '<h4>Architecture</h4><p>Pass a style code (Brownstone, Art Deco, Garden City, Glass & Steel) and new and renovated buildings follow it. Old blocks keep their look, so the city shows its history.</p>' +
        '<h4>Fly-over</h4><p>Tap 🚁 to pilot the news helicopter. Fly low over homes to overhear residents.</p>' +
        '<button class="btn primary" data-act="close">Got it</button>';
    });
  };
  U.showMenu = function () {
    U.menuConfirm = false;
    U.openSheet('☰ ' + esc(S.name), null, function () {
      return '<div class="menu"><div class="row"><input id="nameInput" maxlength="28" value="' + esc(S.name) + '" aria-label="Settlement name"><button class="btn" data-act="rename">✏️ Rename</button></div>' +
        '<button class="btn" data-act="save">💾 Save now</button><button class="btn" data-act="help">❓ How to play</button>' +
        (U.menuConfirm ? '<div class="confirm"><p>Start a brand new homestead? Your current city will be replaced.</p><div class="actions"><button class="btn danger" data-act="newgameYes">Yes, start over</button><button class="btn" data-act="newgameNo">Keep my city</button></div></div>'
          : '<button class="btn danger" data-act="newgame">🌱 New homestead</button>') + '</div>' +
        '<p class="muted">Autosaves every year and when you leave. Founded ' + FS.START_YEAR + ' · seed ' + S.seed + '</p>';
    });
  };

  var OVERLAYS = [null, 'land', 'poll', 'water', 'fun', 'edu', 'safety', 'health'];
  var OV_NAMES = { land: '📈 Land value (red low → green high)', poll: '🏭 Pollution', water: '💧 Water coverage', fun: '🌳 Parks coverage', edu: '📚 Education coverage', safety: '🛡️ Safety coverage', health: '⚕️ Health coverage' };
  U.cycleOverlay = function () {
    var k = (OVERLAYS.indexOf(FS.render.overlay) + 1) % OVERLAYS.length;
    FS.render.overlay = OVERLAYS[k];
    $('bOverlay').classList.toggle('on', !!OVERLAYS[k]);
    hint(OVERLAYS[k] ? 'Map view: <b>' + OV_NAMES[OVERLAYS[k]] + '</b>. Tap 🗺️ again for the next one.' : '');
  };

  // ---------------------------------------------------------------- fly mode
  U.toggleFly = function () {
    if (FS.fly.active) { FS.fly.stop(); document.body.classList.remove('flying'); $('flyUI').classList.add('hidden'); return; }
    U.paintCancel(); U.closeSheet();
    FS.fly.start(S); document.body.classList.add('flying'); $('flyUI').classList.remove('hidden');
    U.toast('🚁 Drag the stick to fly. ⬆⬇ to change altitude. Fly low to hear the streets.', '', 4000);
  };
  var flyInfoLast = '';
  U.flyInfo = function (where, alt) { var s = where + '|' + alt; if (s === flyInfoLast) return; flyInfoLast = s; $('flyWhere').textContent = where; $('flyAlt').textContent = alt; };
  var quoteTimer = null;
  U.flyQuote = function (text) {
    var q = $('flyQuote'); q.textContent = text; q.classList.remove('hidden');
    clearTimeout(quoteTimer); quoteTimer = setTimeout(function () { q.classList.add('hidden'); }, 4200);
  };
  var warnT = 0;
  U.flyWarn = function () { var n = performance.now(); if (n - warnT > 2500) { warnT = n; U.toast('⚠️ Pull up!', 'bad', 1200); } };
  function bindJoystick() {
    var joy = $('joy'), knob = $('joyKnob'), active = null;
    function set(e) {
      var r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2 - 10;
      var dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      FS.fly.joy.x = dx / R; FS.fly.joy.y = dy / R;
    }
    joy.addEventListener('pointerdown', function (e) { active = e.pointerId; joy.setPointerCapture(e.pointerId); set(e); });
    joy.addEventListener('pointermove', function (e) { if (e.pointerId === active) set(e); });
    function up(e) { if (e.pointerId !== active) return; active = null; knob.style.transform = ''; FS.fly.joy.x = FS.fly.joy.y = 0; }
    joy.addEventListener('pointerup', up); joy.addEventListener('pointercancel', up);
    function hold(id, v) {
      var b = $(id);
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); FS.fly.climb = v; });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { FS.fly.climb = 0; }); });
    }
    hold('flyUp', 1); hold('flyDown', -1);
    $('flyExit').onclick = U.toggleFly;
  }

  // ---------------------------------------------------------------- init
  U.init = function () {
    $('sheetClose').onclick = U.closeSheet;
    $('sheetWrap').addEventListener('click', function (e) { if (e.target.id === 'sheetWrap') U.closeSheet(); });
    $('bPeople').onclick = function () { U.showPeople(); };
    $('bCouncil').onclick = U.showCouncil;
    $('bLetters').onclick = U.showLetters;
    $('bOverlay').onclick = U.cycleOverlay;
    $('bFly').onclick = U.toggleFly;
    $('bMenu').onclick = U.showMenu;
    $('cityName').onclick = function () { U.showPeople('gov'); };
    $('zIn').onclick = function () { FS.input.zoomBy(1.25); };
    $('zOut').onclick = function () { FS.input.zoomBy(0.8); };
    document.querySelectorAll('#speed button').forEach(function (b) { b.onclick = function () { U.setSpeed(+b.dataset.s); }; });
    $('rci').onclick = function () { U.showPeople('adv'); };
    bindJoystick();
  };
})(window.FS);
