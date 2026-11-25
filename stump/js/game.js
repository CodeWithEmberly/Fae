// STUMP! — game logic: chapters, world, talking, campaigning, debates, elections, council.
(function (ST) {
  'use strict';
  var P = ST.PAL, cv, ctx, SC = 2, VW = 200, VH = 300, M, mapFrames = [], t = 0, last = 0;
  var G = null, mode = 'title', npcs = [], camX = 0, camY = 0, overlay = false, elect = null, titlePan = 0;
  var pl = { x: 0, y: 0, tx: 0, ty: 0, path: [], dir: 1, frame: 0, ft: 0, target: null };
  var $ = function (id) { return document.getElementById(id); };
  var R = Math.random;
  function pick(a) { return a[Math.floor(R() * a.length)]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function NAME() { return G.name.toUpperCase(); }

  var HOME = { x: 4, y: 5 }, GOAL = 8;
  var CH = {
    5: { title: 'MAYOR' },
    1: { title: 'CH.1 CITIZEN', days: 3 },
    2: { title: 'CH.2 COUNCIL RACE', days: 4, debate: 3, opp: 'pruitt', seat: 'Town Council' },
    3: { title: 'CH.3 COUNCIL' },
    4: { title: 'CH.4 MAYOR RACE', days: 3, debate: 2, opp: 'bunny', seat: 'Mayor' },
  };

  // ================================================================ boot
  ST.boot = function () {
    cv = $('cv'); ctx = cv.getContext('2d');
    M = ST.buildMap();
    mapFrames = [ST.renderMap(M, 0), ST.renderMap(M, 1)];
    placeNPCs();
    resize(); window.addEventListener('resize', resize);
    bindInput();
    showTitle();
    requestAnimationFrame(loop);
  };
  function resize() {
    SC = Math.max(2, Math.floor(Math.min(innerWidth / 180, innerHeight / 260)));
    VW = Math.ceil(innerWidth / SC); VH = Math.ceil(innerHeight / SC);
    cv.width = VW; cv.height = VH; cv.style.width = VW * SC + 'px'; cv.style.height = VH * SC + 'px';
    ctx.imageSmoothingEnabled = false;
  }
  function placeNPCs() {
    var used = {};
    npcs = ST.NPCS.map(function (d) {
      var x = d.x, y = d.y;
      if (!M.walk(x, y) || used[x + ',' + y]) {
        outer: for (var r = 1; r < 6; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
          if (M.walk(d.x + dx, d.y + dy) && !used[(d.x + dx) + ',' + (d.y + dy)]) { x = d.x + dx; y = d.y + dy; break outer; }
        }
      }
      used[x + ',' + y] = 1;
      return { d: d, x: x, y: y, face: 1 };
    });
  }

  // ================================================================ state
  function newState(name, look) {
    return { v: 1, name: name, look: look, ch: 1, day: 1, energy: 6, sigs: 0, cause: null, learned: {}, n: {}, knocked: {},
      stance: { pothole: 0, smoke: 0, school: 0 }, good: { NW: 0, NE: 0, SW: 0, SE: 0 }, signs: {}, deb: { NW: 0, NE: 0, SW: 0, SE: 0 },
      funds: 0, ads: 0, cred: 0, favor: 0, debated: false, fundDay: 0, flips: [], billI: 0, votes: [], holeFilled: false, elm: 'ELM ST',
      record: { kept: 0, broken: 0, results: [] }, tries: { 1: 0, 2: 0, 4: 0 } };
  }
  function save() { try { localStorage.setItem('stump.save', JSON.stringify(G)); } catch (e) { } }
  function load() { try { var s = JSON.parse(localStorage.getItem('stump.save')); return s && s.v === 1 ? s : null; } catch (e) { return null; } }
  function ns(id) { return G.n[id] || (G.n[id] = { met: false, rap: 0, signed: false, chat: 0, pitched: false, sup: false }); }

  // ================================================================ UI helpers
  function win(o) {
    closeWin();
    var el = document.createElement('div');
    el.className = 'win ' + (o.cls || '');
    el.innerHTML = '<div class="tbar"><span class="box"></span><b>' + esc(o.title || '') + '</b><span class="box"></span></div>' +
      '<div class="wbody">' + (o.portrait ? '<div class="pframe"></div>' : '') + '<div class="wtext">' + (o.html || '') + '</div></div>' +
      '<div class="wbtns"></div>';
    if (o.portrait) el.querySelector('.pframe').appendChild(o.portrait);
    var bb = el.querySelector('.wbtns');
    (o.buttons || [{ t: 'OK' }]).forEach(function (b) {
      var btn = document.createElement('button');
      btn.className = 'pbtn' + (b.primary ? ' primary' : '') + (b.small ? ' small' : '');
      btn.innerHTML = b.t; btn.disabled = !!b.disabled;
      btn.onclick = function () { beep(b.disabled ? 0 : 1); if (!b.keep) closeWin(); if (b.f) b.f(); };
      bb.appendChild(btn);
    });
    $('layer').appendChild(el);
    if (o.after) o.after(el);
    return el;
  }
  function closeWin() { $('layer').innerHTML = ''; }
  function winOpen() { return !!$('layer').firstChild; }
  var toastT = null;
  function toast(s) { var el = $('toast'); el.textContent = s; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 2600); }
  var actx = null;
  function beep(k) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain(); o.type = 'square';
      o.frequency.value = k === 2 ? 880 : k === 3 ? 220 : k ? 520 : 140; g.gain.value = 0.03;
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + (k === 2 || k === 3 ? 0.18 : 0.05));
    } catch (e) { }
  }
  function paper(head, sub, extra, then, btn) {
    win({ title: 'THE WILLOW BEND BUGLE', cls: 'paper', html:
      '<div class="mast">THE WILLOW BEND BUGLE<small>All the News That Fits, Mostly · ' + (G && CH[G.ch] && CH[G.ch].days ? 'Day ' + G.day + ' · ' + CH[G.ch].title.replace(/^CH\.\d /, '') : 'Special Edition') + '</small></div>' +
      '<h1>' + esc(head) + '</h1><p class="sub">' + esc(sub) + '</p>' + (extra || ''),
      buttons: [{ t: btn || 'TURN THE PAGE', primary: true, f: then }] });
    beep(2);
  }

  function hud() {
    if (!G || (mode !== 'world')) { $('hud').classList.add('hidden'); $('bar').classList.add('hidden'); return; }
    $('hud').classList.remove('hidden'); $('bar').classList.remove('hidden');
    var c = CH[G.ch];
    $('hudTitle').textContent = c.title + ' · DAY ' + G.day + '/' + c.days;
    var s = '<span>⚡' + G.energy + '</span>';
    if (G.ch === 1) s += '<span>✍ ' + G.sigs + '/' + GOAL + '</span><span>' + (G.cause ? causeSlogan() : 'NO CAUSE YET') + '</span>';
    else s += '<span>$' + G.funds + '</span><span>VS ' + ST.OPPONENTS[c.opp].name.split(' ')[1].toUpperCase() + '</span>';
    $('hudStats').innerHTML = s;
    var b = '';
    if (G.ch === 1) b += btn('note', 'NOTES') + btn('help', '?') + btn('end', 'END DAY');
    else b += btn('plat', 'PLATFORM') + btn('poll', overlay ? 'MAP' : 'POLLS') + btn('help', '?') + btn('end', 'END DAY');
    $('bar').innerHTML = b;
    $('bar').querySelectorAll('button').forEach(function (e) { e.onclick = function () { beep(1); barAct(e.dataset.a); }; });
  }
  function btn(a, l) { return '<button class="pbtn" data-a="' + a + '">' + l + '</button>'; }
  function barAct(a) {
    if (winOpen()) return;
    if (a === 'end') return confirmEnd();
    if (a === 'note') return notebook();
    if (a === 'help') return help();
    if (a === 'plat') return platform(false);
    if (a === 'poll') { if (overlay) { overlay = false; hud(); } else polls(); }
  }
  function causeSlogan() { var c = G.cause; return c ? ST.ISSUES[c.issue][c.side > 0 ? 'pro' : 'con'].slogan : ''; }
  function sideLabel(issue, s) { return s === 0 ? 'Waffle' : ST.ISSUES[issue][s > 0 ? 'pro' : 'con'].label; }

  // ================================================================ title & creation
  function showTitle() {
    mode = 'title'; hud();
    var saved = load();
    win({ title: 'STUMP!', cls: 'title', html:
      '<div class="logo">STUMP!</div><div class="tag">A POLITICAL CLIMBING SIMULATION</div>' +
      '<p class="center">From soapbox to the big chair.<br>Starring you, a total nobody, in the town of Willow Bend.</p>',
      buttons: [{ t: 'NEW CAREER', primary: true, f: create }].concat(saved ? [{ t: 'CONTINUE', f: function () { G = saved; resume(); } }] : []).concat([{ t: 'HOW TO PLAY', f: function () { help(showTitle); } }]) });
  }
  var NAMES = ['Pat Kowalski', 'Jordan Reyes', 'Sam Abernathy', 'Robin Okoye', 'Casey Lindqvist', 'Alex Moreau', 'Drew Haddad'];
  function create() {
    var look = { skin: ST.LOOKS.skin[0], hair: ST.LOOKS.hair[1], hs: 0, shirt: ST.LOOKS.shirt[1], pants: P.navy }, idx = { skin: 0, hair: 1, hs: 0, shirt: 1 };
    var el = win({ title: 'CANDIDATE REGISTRATION (FORM 1-A)', html:
      '<p>Name, as it will appear on yard signs:</p><input id="nm" maxlength="20" value="' + pick(NAMES) + '">' +
      '<div class="creator"><div id="pv"></div><div class="cbtns"><button class="pbtn small" data-k="hs">HAIR</button><button class="pbtn small" data-k="hair">COLOR</button><button class="pbtn small" data-k="skin">SKIN</button><button class="pbtn small" data-k="shirt">SHIRT</button></div></div>',
      buttons: [{ t: 'BEGIN', primary: true, keep: true, f: function () {
        var name = ($('nm').value || '').trim() || 'Pat Kowalski';
        closeWin(); G = newState(name.slice(0, 20), look); startCh1();
      } }, { t: 'BACK', f: showTitle }] });
    function pv() { var c = ST.portrait(look, 1); $('pv').innerHTML = ''; $('pv').appendChild(c); }
    el.querySelectorAll('[data-k]').forEach(function (b) {
      b.onclick = function () { var k = b.dataset.k, arr = ST.LOOKS[k]; idx[k] = (idx[k] + 1) % arr.length; look[k] = arr[idx[k]]; beep(1); pv(); };
    });
    pv();
  }
  function resume() {
    if (G.ch === 3) return startCouncil();
    if (G.ch === 5) return ending();
    enterWorld(); toast('Welcome back, ' + G.name + '.');
  }

  // ================================================================ world
  function enterWorld() {
    mode = 'world'; overlay = false;
    pl.tx = HOME.x; pl.ty = HOME.y; pl.x = HOME.x * 8 + 4; pl.y = HOME.y * 8 + 8; pl.path = []; pl.target = null; pl.dir = 1;
    hud(); save();
  }
  function startCh1() {
    G.ch = 1; G.day = 1; G.energy = 8; G.sigs = 0; G.knocked = {};
    Object.keys(G.n).forEach(function (k) { G.n[k].signed = false; });
    enterWorld();
    paper(G.tries[1] ? 'DEADLINE MISSED; ' + NAME() + ' TRIES AGAIN' : 'NOTHING HAPPENS FOR 41ST STRAIGHT YEAR',
      G.tries[1] ? 'A whole year later, local resident vows to "own a pen this time"' : 'Local resident ' + G.name + ' reportedly "thinking about getting involved"',
      '<p class="brief">📋 <b>Goal:</b> get ' + GOAL + ' signatures on a petition within 3 days to make the council ballot. Tap a neighbor to talk. Start with <b>Bev</b>, the woman by the <b>BUGLE</b> office. Tip: knock on doors in neighborhoods that agree with your cause.</p>',
      function () { toast('Tap anywhere to walk. Tap people to talk.'); });
  }

  function npcAt(x, y) { for (var i = 0; i < npcs.length; i++) if (npcs[i].x === x && npcs[i].y === y) return npcs[i]; return null; }
  function walkable(x, y) { return M.walk(x, y) && !npcAt(x, y); }
  function findPath(goals) {
    var key = function (x, y) { return y * M.W + x; }, start = key(pl.tx, pl.ty), prev = {}, q = [[pl.tx, pl.ty]], seen = {};
    var gset = {}; goals.forEach(function (g) { gset[key(g[0], g[1])] = 1; });
    if (gset[start]) return [];
    seen[start] = 1;
    while (q.length) {
      var c = q.shift();
      for (var d = 0; d < 4; d++) {
        var nx = c[0] + [1, -1, 0, 0][d], ny = c[1] + [0, 0, 1, -1][d], k = key(nx, ny);
        if (seen[k] || !walkable(nx, ny)) continue;
        seen[k] = 1; prev[k] = c; q.push([nx, ny]);
        if (gset[k]) { var path = [[nx, ny]], p = c; while (key(p[0], p[1]) !== start) { path.unshift(p); p = prev[key(p[0], p[1])]; } return path; }
      }
    }
    return null;
  }
  function tapWorld(sx, sy) {
    if (winOpen() || mode !== 'world') return;
    var wx = sx / SC + camX, wy = sy / SC + camY, x = Math.floor(wx / 8), y = Math.floor(wy / 8);
    var n = npcAt(x, y) || npcAt(x, y + 1), goals, target;
    var sign = !n && G.ch !== 1 && M.signSpots.filter(function (s) { return s.x === x && (s.y === y || s.y === y + 1); })[0];
    var b = !n && !sign && M.bAt(x, y);
    if (n) { target = { k: 'npc', n: n }; goals = [[n.x + 1, n.y], [n.x - 1, n.y], [n.x, n.y + 1], [n.x, n.y - 1]].filter(function (g) { return walkable(g[0], g[1]) || (g[0] === pl.tx && g[1] === pl.ty); }); }
    else if (sign) { target = { k: 'sign', s: sign }; goals = [[sign.x, sign.y]]; }
    else if (b) { target = { k: 'bld', b: b }; goals = [[b.front.x, b.front.y]]; }
    else if (x === M.hole.x || x === M.hole.x + 1) { if (y === M.hole.y || y === M.hole.y + 1) { target = { k: 'hole' }; goals = [[18, 11], [19, 11], [18, 14], [19, 14]]; } }
    if (!goals) { if (!walkable(x, y)) return; goals = [[x, y]]; }
    var path = findPath(goals);
    if (path === null) return toast('Can’t get there from here.');
    pl.path = path; pl.target = target || null;
    beep(0);
    if (!path.length) arrive();
  }
  function arrive() {
    var tg = pl.target; pl.target = null; if (!tg) return;
    if (tg.k === 'npc') { var n = tg.n; n.face = n.x > pl.tx ? -1 : 1; pl.dir = n.x > pl.tx ? 1 : n.x < pl.tx ? -1 : pl.dir; talk(n); }
    else if (tg.k === 'bld') visit(tg.b);
    else if (tg.k === 'sign') signSpot(tg.s);
    else if (tg.k === 'hole') holeLook();
  }
  function spend(k) {
    if (G.energy < k) { toast('Out of energy. End the day.'); confirmEnd(); return false; }
    G.energy -= k; hud(); return true;
  }

  // ---------------------------------------------------------------- talking
  function talk(n) {
    var d = n.d, s = ns(d.id), por = ST.portrait(d.look, 0);
    if (!s.met) {
      s.met = true; if (d.issue && !d.special) G.learned[d.issue] = true;
      if (d.guide) ST.ISSUE_KEYS.forEach(function (k) { G.learned[k] = true; });
      var issueNote = d.issue && !d.special ? '<p class="note">📝 Noted: ' + esc(d.name.split(' ')[0]) + ' cares about <b>' + ST.ISSUES[d.issue].name + '</b> (' + sideLabel(d.issue, d.pref) + ').</p>' : '';
      win({ title: d.name + ' · ' + d.role, portrait: por, html: '<p>“' + esc(d.intro) + '”</p><p>“' + esc(d.concern) + '”</p>' + issueNote, buttons: [{ t: 'OK', primary: true }] });
      return;
    }
    var opts = [], line = pick(d.small);
    var canChat = s.chat !== G.ch * 100 + G.day;
    opts.push({ t: 'CHAT A WHILE ⚡1', disabled: !canChat, f: function () { if (!spend(1)) return; s.chat = G.ch * 100 + G.day; s.rap++; if (G.ch !== 1) G.good[M.prec(n.x, n.y)] += 0.5; say(d, pick(d.small) + (s.rap >= 2 ? ' You’re all right, you know that?' : ''), 1, '♥ Rapport up'); } });
    if (G.ch === 1 && !d.special) opts.push({ t: s.signed ? 'SIGNED ✓' : 'ASK TO SIGN ⚡1', disabled: s.signed, f: function () { askSign(n); } });
    if (G.ch !== 1 && !d.special) opts.push({ t: s.pitched ? 'PITCHED ✓' : 'MAKE YOUR PITCH ⚡1', disabled: s.pitched, f: function () { pitch(n); } });
    if (d.issue && !d.special) opts.push({ t: 'WHAT DO YOU CARE ABOUT?', small: true, f: function () { say(d, d.concern, 0); } });
    opts.push({ t: 'BYE', small: true });
    win({ title: d.name + ' · ' + d.role, portrait: por, html: '<p>“' + esc(line) + '”</p>' + (s.rap ? '<p class="note">Rapport: ' + '♥'.repeat(Math.min(5, s.rap)) + '</p>' : ''), buttons: opts });
  }
  function say(d, text, mood, note) {
    win({ title: d.name, portrait: ST.portrait(d.look, mood), html: '<p>“' + esc(text) + '”</p>' + (note ? '<p class="note">' + note + '</p>' : '') });
  }
  function askSign(n) {
    var d = n.d, s = ns(d.id);
    if (!G.cause) return say(d, 'Sign what? You don’t even have a cause yet. Go see Bev at the BUGLE office.', 0);
    if (d.kid) return say(d, 'I can’t sign, I’m eleven! But I’ll draw you a picture of the raccoon.', 1);
    if (!spend(1)) return;
    var c = G.cause, ch;
    if (c.issue === d.issue) ch = c.side === d.pref ? 1 : 0.05; else ch = 0.5 + 0.2 * s.rap;
    if (R() < ch) {
      s.signed = true; G.sigs++; hud(); beep(2);
      say(d, c.issue === d.issue ? 'For ' + causeSlogan() + '? Give me that pen. I’ll sign twice.' : pick(ST.DOOR.signYes), 1, '✍ Signature ' + G.sigs + '/' + GOAL + '');
      checkSigs();
    } else if (c.issue === d.issue) say(d, causeSlogan() + '?! You’ve got it exactly backwards. Not a chance.', -1, 'Try someone who agrees with you, or pick a different cause.');
    else say(d, pick(ST.DOOR.signNo), -1, s.rap < 2 ? 'Tip: chatting builds rapport, which makes people more willing to sign.' : '');
  }
  function checkSigs() { if (G.sigs === GOAL) setTimeout(function () { toast(GOAL + ' signatures! File them at TOWN HALL.'); }, 300); }
  function pitch(n) {
    var d = n.d, s = ns(d.id), p = M.prec(n.x, n.y);
    if (!spend(1)) return;
    s.pitched = true;
    if (d.kid) { G.good[p] += 1; return say(d, 'I’ll tell my mom you’re “fine.” That’s her highest rating.', 1, 'Support up in ' + ST.PRECINCTS[p].name); }
    var a = G.stance[d.issue] * d.pref, msg, mood;
    if (a > 0) { G.good[p] += 2; s.sup = true; mood = 1; msg = sideLabel(d.issue, d.pref) + '? That’s what I’ve been saying for years! You’ve got my vote, and my cousin’s.'; }
    else if (a === 0) { G.good[p] += 0.5; mood = 0; msg = 'You don’t have a position on ' + ST.ISSUES[d.issue].name.replace(/^The /, 'the ') + '? Well. At least you’re not wrong.'; }
    else if (s.rap >= 2) { G.good[p] += 0.5; mood = 0; msg = 'You’re dead wrong about ' + ST.ISSUES[d.issue].name.replace(/^The /, 'the ') + '. But you listened, and that’s rare. I’ll think about it.'; }
    else { G.good[p] -= 1; mood = -1; msg = 'You want to WHAT? I’m voting for ' + opp().name.split(' ')[0] + '. I’m telling my whole bowling league.'; }
    var extra = '';
    if (d.donor && G.stance.smoke < 0 && !G.n[d.id].donated) { G.n[d.id].donated = true; G.funds += 60; extra = ' 💵 Hank writes you a $60 check. It smells faintly.'; hud(); }
    say(d, msg, mood, (a > 0 ? '★ New supporter! ' : a < 0 && s.rap < 2 ? '✗ Lost support in ' + ST.PRECINCTS[p].name + '. ' : 'Small bump in ' + ST.PRECINCTS[p].name + '. ') + extra);
  }

  // ---------------------------------------------------------------- places
  function visit(b) {
    var k = b.k;
    if (k === 'house') return knock(b);
    if (k === 'bugle') {
      if (G.ch === 1) return declare();
      return win({ title: 'THE BUGLE · ADVERTISING', html: '<p>Bev: “A quarter page is $40. We’ll put your face next to the bowling scores. Prime real estate.”</p><p class="note">Ads bought this race: ' + G.ads + '/3</p>',
        buttons: [{ t: 'BUY AD $40', primary: true, disabled: G.funds < 40 || G.ads >= 3, f: function () { G.funds -= 40; G.ads++; hud(); toast('Ad placed! Small bump everywhere.'); } }, { t: 'NOT NOW' }] });
    }
    if (k === 'townhall') {
      if (G.ch === 1) {
        if (G.sigs >= GOAL) return win({ title: 'TOWN CLERK', html: '<p>The clerk counts your signatures twice, then once more for fun.</p><p>“Eight. Valid. Congratulations. You are officially a <b>Candidate</b>. Please don’t make it weird.”</p>', buttons: [{ t: 'FILE IT!', primary: true, f: winCh1 }] });
        return win({ title: 'TOWN CLERK', html: '<p>“To get on the ballot you need <b>' + GOAL + ' signatures</b>. You have ' + G.sigs + '. Also, our pen is chained to the desk, so bring your own.”</p>' });
      }
      return win({ title: 'TOWN HALL', html: '<p>A portrait of ' + (G.ch === 2 ? 'Dale Pruitt' : 'Mayor Thibodeaux') + ' stares at you from the lobby wall. You stare back. You blink first.</p>' });
    }
    if (k === 'diner') {
      if (G.ch === 1) return win({ title: 'THE SPOON', html: '<p>Ray slides you a coffee. “On the house. Don’t ask what’s in it.”</p><p>Councilman Pruitt is asleep in his booth. It is 10 a.m.</p>' });
      var can = G.fundDay !== G.ch * 100 + G.day;
      return win({ title: 'THE SPOON · FUNDRAISER', html: '<p>Host a pancake fundraiser? Ray will flip; you’ll shake hands until your arm falls off.</p><p class="note">Costs ⚡2, raises about $35. Once per day.</p>',
        buttons: [{ t: 'FLIP SOME PANCAKES', primary: true, disabled: !can, f: function () { if (!spend(2)) return; G.fundDay = G.ch * 100 + G.day; var amt = 30 + Math.floor(R() * 15); G.funds += amt; hud(); toast('Raised $' + amt + '. Three pancakes hit the ceiling.'); } }, { t: 'LEAVE' }] });
    }
    var flavor = {
      shop: b.label === 'GIFTS' ? 'Pothole snow globes, pothole mugs, and a cardboard cutout of the pothole for photos. It’s just a black circle.' : 'Hardware store. A man named Lyle has been deciding between two identical hammers since Tuesday.',
      school: 'The Old Schoolhouse. The bell still works. The heating works on alternate Thursdays. A banner reads “HOME OF THE FIGHTING BADGERS (WE HAVE ONE BADGER)”.',
      factory: 'Gristle Bros. Rendering. The smell here has a texture. A sign reads “412 DAYS WITHOUT AN INCIDENT WE’RE ALLOWED TO TALK ABOUT”.',
    };
    win({ title: b.label || 'BUILDING', html: '<p>' + (flavor[k] || 'Nobody answers.') + '</p>' });
  }
  function holeLook() {
    win({ title: 'THE GREAT POTHOLE', html: G.holeFilled ? '<p>Freshly paved. A small plaque reads “HERE LAY THE GREAT POTHOLE. IT TOOK THREE BUICKS WITH IT.”</p>' :
      '<p>You peer into the Great Pothole. It has a mailbox. The mailbox has mail in it.</p><p>Somewhere far below, something says “nice shoes.”</p>' });
  }
  function knock(b) {
    var key = G.ch + ':' + b.n;
    if (b.x === 2 && b.y === 2) return win({ title: 'HOME', html: '<p>Your house. Your cat is judging you from the window. Campaign HQ, technically.</p>' });
    if (G.knocked[key]) return win({ title: 'KNOCK KNOCK', html: '<p>You already knocked here. The curtains twitch meaningfully.</p>' });
    var p = M.prec(b.front.x, b.front.y), pr = ST.PRECINCTS[p].prefs;
    if (G.ch === 1) {
      if (!G.cause) return toast('Declare a cause at the BUGLE before asking for signatures.');
      if (!spend(1)) return;
      G.knocked[key] = 1;
      var pf = pr[G.cause.issue], ch = 0.5 + 0.16 * pf[0] * G.cause.side * pf[1];
      if (R() < ch) { G.sigs++; hud(); beep(2); win({ title: 'KNOCK KNOCK · ' + ST.PRECINCTS[p].name, html: '<p>“' + pick(ST.DOOR.signYes) + '”</p><p class="note">✍ Signature ' + G.sigs + '/' + GOAL + '</p>' }); checkSigs(); }
      else win({ title: 'KNOCK KNOCK · ' + ST.PRECINCTS[p].name, html: '<p>“' + pick(ST.DOOR.signNo) + '”</p>' });
      return;
    }
    if (!spend(1)) return;
    G.knocked[key] = 1;
    var sum = 0, wsum = 0;
    ST.ISSUE_KEYS.forEach(function (i) { sum += pr[i][0] * pr[i][1] * G.stance[i]; wsum += pr[i][1]; });
    var a = sum / wsum, dg = 0.5 + 1.6 * a; G.good[p] += dg;
    var line = a > 0.2 ? pick(ST.DOOR.yes) : a < -0.15 ? pick(ST.DOOR.no) : pick(ST.DOOR.meh);
    win({ title: 'KNOCK KNOCK · ' + ST.PRECINCTS[p].name, html: '<p>“' + esc(line) + '”</p><p class="note">' + (dg >= 0 ? 'Support up' : 'Support down') + ' in ' + ST.PRECINCTS[p].name + '. (' + ST.PRECINCTS[p].blurb + ')</p>' });
  }
  function signSpot(s) {
    if (s.up) return win({ title: 'YARD SIGN', html: '<p>Your sign. Someone has drawn a mustache on it. It’s a good mustache.</p>' });
    win({ title: 'YARD SIGN · ' + ST.PRECINCTS[s.p].name, html: '<p>Plant a yard sign here for $15? Signs boost name recognition in their neighborhood.</p>',
      buttons: [{ t: 'PLANT IT $15', primary: true, disabled: G.funds < 15, f: function () { G.funds -= 15; s.up = true; G.signs[s.p] = (G.signs[s.p] || 0) + 1; G.signUp = G.signUp || {}; G.signUp[s.x + ',' + s.y] = 1; hud(); beep(2); toast('Sign planted in ' + ST.PRECINCTS[s.p].name + '.'); } }, { t: 'NO' }] });
  }

  // ---------------------------------------------------------------- chapter 1 specifics
  function declare() {
    if (G.cause) return win({ title: 'THE BUGLE', html: '<p>Bev: “Your cause is <b>' + causeSlogan() + '</b>. Bold. Or at least loud. Now go get 10 signatures and file them at Town Hall.”</p>' });
    var learned = ST.ISSUE_KEYS.filter(function (k) { return G.learned[k]; });
    if (!learned.length) return win({ title: 'THE BUGLE', html: '<p>Bev: “You don’t know what anyone cares about yet. Talk to me first, out front. Or anyone. People love to complain.”</p>' });
    var btns = [];
    learned.forEach(function (k) { [1, -1].forEach(function (s) { btns.push({ t: ST.ISSUES[k][s > 0 ? 'pro' : 'con'].slogan, small: true, f: function () { G.cause = { issue: k, side: s }; G.stance[k] = s; hud(); beep(2); toast('Cause declared: ' + causeSlogan()); } }); }); });
    btns.push({ t: 'NOT YET', small: true });
    win({ title: 'THE BUGLE · DECLARE YOUR CAUSE', html: '<p>Bev slides a form across the desk. “Cause, in four words or fewer. People sign faster when they <i>agree</i> with you, so pick something your neighbors actually want.”</p>' +
      learned.map(function (k) { return '<p class="note">' + ST.ISSUES[k].icon + ' <b>' + ST.ISSUES[k].name + '</b>: ' + ST.ISSUES[k].desc + '</p>'; }).join(''), buttons: btns });
  }
  function notebook() {
    var h = '<p><b>Goal:</b> ' + GOAL + ' signatures by end of Day 3, then file them at TOWN HALL.</p><p><b>Cause:</b> ' + (G.cause ? causeSlogan() : 'none yet (declare at the BUGLE)') + '</p>';
    ST.ISSUE_KEYS.forEach(function (k) {
      if (!G.learned[k]) return h += '<p class="note">??? Talk to more people.</p>';
      var fans = ST.NPCS.filter(function (d) { return d.issue === k && G.n[d.id] && G.n[d.id].met && !d.special; }).map(function (d) { return d.name.split(' ')[d.name.startsWith('Coach') || d.name.startsWith('Pastor') ? 1 : 0] + (d.pref > 0 ? ' (+)' : ' (−)'); });
      h += '<p class="note">' + ST.ISSUES[k].icon + ' <b>' + ST.ISSUES[k].name + '</b><br>' + (fans.join(', ') || 'nobody yet') + '</p>';
    });
    h += '<p class="note">(+) wants ' + '“pro”: fill it / clean it / keep it open. (−) wants the opposite.</p>';
    win({ title: 'NOTEBOOK', html: h });
  }
  function confirmEnd() {
    win({ title: 'END THE DAY?', html: '<p>Go home and sleep? ' + (G.energy ? 'You still have ⚡' + G.energy + ' left.' : 'You are exhausted.') + '</p>',
      buttons: [{ t: 'SLEEP', primary: true, f: endDay }, { t: 'KEEP GOING', disabled: !G.energy }] });
  }
  function endDay() {
    var c = CH[G.ch];
    if (G.ch === 1) {
      if (G.day >= c.days) { if (G.sigs >= GOAL) return winCh1(); return failCh1(); }
      G.day++; G.energy = 8; enterWorld();
      var h = G.sigs === 0 ? ['LOCAL RESIDENT WALKS AROUND, LOOKS AT THINGS', 'Neighbors report being "mildly observed"'] :
        G.sigs < 5 ? [NAME() + ' COLLECTS SIGNATURES; PENS RUN LOW', G.sigs + ' residents sign petition; one thought it was a raffle'] :
          ['PETITION FEVER GRIPS WILLOW BEND', G.name + ' now ' + Math.max(0, GOAL - G.sigs) + ' signatures from the ballot. Pruitt "unbothered," says Pruitt'];
      return paper(h[0], h[1], '<p class="brief">Day ' + G.day + ' of 3. Signatures: ' + G.sigs + '/' + GOAL + '.' + (G.sigs >= GOAL ? ' You have enough: file at TOWN HALL!' : '') + '</p>');
    }
    // campaign days
    if (G.day === c.debate && !G.debated) return debate(function () { endDay(); });
    if (G.day >= c.days) return electionNight();
    G.day++; G.energy = 6; enterWorld();
    var sh = totalShare(true), lead = sh > 0.5, o = opp();
    var heads = lead ? [[NAME() + ' SURGES; ' + o.name.split(' ')[1].toUpperCase() + ' SEEN STRETCHING', 'Experts baffled; experts are Bev'], ['UPSTART LEADS IN BUGLE POLL', o.name + ' calls poll "a newspaper’s opinion"']] :
      [[o.name.split(' ')[1].toUpperCase() + ' LEADS; HAS ALWAYS LED', 'Will continue to lead, says ' + o.name], [NAME() + ' TRAILS, REMAINS "VERY PERKY"', 'Campaign insists polls "don’t count the cats"']];
    if (G.flips.length && !G.flipReported) { G.flipReported = true; heads = [[NAME() + ' FLIP-FLOPS ON ' + ST.ISSUES[G.flips[0]].short, 'Local sandal industry thrilled']]; }
    if (G.debated && !G.debReported) { G.debReported = true; var dsc = G.debScore; heads = [[dsc > 0.5 ? NAME() + ' WINS DEBATE' : dsc < -0.5 ? 'DEBATE: ' + NAME() + ' "SAID WORDS"' : 'DEBATE ENDS IN DRAW; DONUTS PRAISED', dsc > 0.5 ? 'Crowd applauds; one man applauds for an uncomfortable amount of time' : 'Moderator Bev Hollister: "That sure happened"']]; }
    var hd = pick(heads);
    paper(hd[0], hd[1], pollBox(), null);
  }
  function winCh1() {
    G.ch = 2; G.record.results.push('Made the ballot');
    paper(NAME() + ' FILES TO CHALLENGE PRUITT', 'Pruitt, unopposed since 1998, responds: "Who?"',
      '<p class="brief">🗳️ <b>Chapter 2: the Council Race.</b> You have 4 days to win more votes than Dale Pruitt. Set your platform, knock on doors, pitch neighbors, plant yard signs, raise money at the Spoon, and survive the debate on Day 3.</p>',
      function () { startCampaign(); }, 'ON TO THE RACE');
  }
  function failCh1() {
    G.tries[1]++;
    paper('DEADLINE PASSES; ' + NAME() + ' DISCOVERS PENS TOO LATE', 'Only ' + G.sigs + ' signatures collected. Pruitt wins unopposed for the 27th time',
      '<p class="brief">You needed ' + GOAL + '. Tip: declare a cause many neighbors agree with, chat to build rapport, and knock on doors.</p>', function () { startCh1(); }, 'TRY AGAIN NEXT YEAR');
  }

  // ================================================================ campaigns (ch2 & ch4)
  function opp() { return ST.OPPONENTS[CH[G.ch].opp]; }
  function startCampaign(retry) {
    var c = CH[G.ch];
    G.day = 1; G.energy = 6; G.funds = G.ch === 4 ? 80 : 60; G.ads = 0; G.signs = {}; G.signUp = {}; G.deb = { NW: 0, NE: 0, SW: 0, SE: 0 };
    G.debated = false; G.debReported = false; G.flipReported = false; G.knocked = {}; G.flips = [];
    if (retry) ST.PKEYS.forEach(function (p) { G.good[p] *= 0.7; });
    Object.keys(G.n).forEach(function (k) { G.n[k].pitched = false; G.n[k].sup = false; });
    M.signSpots.forEach(function (s) { s.up = false; });
    enterWorld();
    platform(true);
  }
  function platform(first) {
    var cur = Object.assign({}, G.stance), o = opp();
    function render() {
      return ST.ISSUE_KEYS.map(function (k) {
        var I = ST.ISSUES[k];
        return '<div class="plank"><b>' + I.icon + ' ' + I.name + '</b><small>' + I.desc + '</small><div class="seg">' +
          [1, 0, -1].map(function (s) { return '<button class="pbtn small' + (cur[k] === s ? ' sel' : '') + '" data-i="' + k + '" data-s="' + s + '">' + (s === 0 ? 'WAFFLE' : esc(I[s > 0 ? 'pro' : 'con'].slogan)) + '</button>'; }).join('') +
          '</div><small class="opp">' + o.name.split(' ')[1] + ': ' + (o.stances[k] === 0 ? 'waffles' : sideLabel(k, o.stances[k]).toLowerCase()) + '</small></div>';
      }).join('');
    }
    var el = win({ title: first ? 'YOUR PLATFORM' : 'PLATFORM (CHANGES COST CREDIBILITY)', html: '<p>' + (first ? 'Where do you stand? Each neighborhood weighs these issues differently. Waffling offends no one and impresses no one.' : 'Changing a stance mid-race is a flip-flop. The Bugle will notice.') + '</p><div id="planks">' + render() + '</div>',
      buttons: [{ t: 'LOCK IT IN', primary: true, f: function () {
        ST.ISSUE_KEYS.forEach(function (k) {
          if (cur[k] !== G.stance[k] && G.stance[k] !== 0 && (G.ch !== 2 || !first || (G.cause && G.cause.issue === k))) { G.cred -= 1; G.flips.push(k); }
          if (!first && cur[k] !== G.stance[k] && G.stance[k] === 0) { /* committing from a waffle is fine */ }
        });
        G.stance = cur; hud(); save();
        if (first) toast('Tap neighbors to pitch. Tap houses to knock.');
      } }].concat(first ? [] : [{ t: 'CANCEL' }]) });
    function bind() {
      el.querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { cur[b.dataset.i] = +b.dataset.s; beep(1); $('planks').innerHTML = render(); bind(); }; });
    }
    bind();
  }
  function shares(final) {
    var o = opp(), out = {};
    ST.PKEYS.forEach(function (p) {
      var pr = ST.PRECINCTS[p].prefs, m = o.base;
      ST.ISSUE_KEYS.forEach(function (i) { m += 0.025 * pr[i][1] * pr[i][0] * (G.stance[i] - o.stances[i]); if (G.stance[i] === 0) m -= 0.01; });
      m += 0.012 * G.good[p] + 0.012 * Math.min(3, G.signs[p] || 0) + G.deb[p] + 0.012 * G.cred + 0.01 * G.ads;
      if (G.ch === 4) m += 0.004 * G.favor;
      if (final) m += (R() - 0.5) * 0.04;
      out[p] = clamp(0.5 + m, 0.05, 0.95);
    });
    return out;
  }
  function totalShare(noisy) {
    var s = shares(false), v = 0, tot = 0;
    ST.PKEYS.forEach(function (p) { var n = ST.PRECINCTS[p].voters; v += n * s[p]; tot += n; });
    var r = v / tot;
    if (noisy) r += (ST.hash(G.day, G.ch, 3) - 0.5) * 0.03;
    return r;
  }
  function pollBox() {
    var s = shares(false), o = opp(), tot = totalShare(true);
    return '<div class="poll"><b>BUGLE POLL (margin of error: "a lot")</b>' +
      bar('ALL', tot) + ST.PKEYS.map(function (p) { return bar(ST.PRECINCTS[p].name, s[p] + (ST.hash(G.day, p.charCodeAt(1), G.ch) - 0.5) * 0.04); }).join('') +
      '<small>You vs. ' + esc(o.name) + '</small></div>';
  }
  function bar(label, v) {
    v = clamp(v, 0.02, 0.98); var pct = Math.round(v * 100);
    return '<div class="pbar"><span>' + esc(label) + '</span><i><em style="width:' + pct + '%"></em></i><b>' + pct + '%</b></div>';
  }
  function polls() {
    win({ title: 'POLLS', html: pollBox() + '<p class="note">Yellow bar = you. Tap SHOW ON MAP to see neighborhoods.</p>' + ST.PKEYS.map(function (p) {
      var pr = ST.PRECINCTS[p];
      return '<p class="note"><b>' + pr.name + '</b> (' + pr.voters + ' voters): ' + pr.blurb + '. Cares most about ' + ST.ISSUES[ST.ISSUE_KEYS.slice().sort(function (a, b) { return pr.prefs[b][1] - pr.prefs[a][1]; })[0]].name.replace('The ', '') + '.</p>';
    }).join(''), buttons: [{ t: 'SHOW ON MAP', primary: true, f: function () { overlay = true; hud(); } }, { t: 'CLOSE' }] });
  }

  // ---------------------------------------------------------------- debate
  function debate(done) {
    G.debated = true; G.debScore = 0;
    var o = opp(), bev = ST.NPCS.filter(function (d) { return d.id === 'bev'; })[0];
    var qs = G.ch === 2 ? [
      ['pothole', 'The Great Pothole. Fill it, or frame it?'],
      ['smoke', 'Gristle Brothers: jobs or noses?'],
      ['school', 'The Old Schoolhouse. And please, no speeches about your own childhood.'],
    ] : [
      ['pothole', 'The Mayor wants a parking garage where the pothole is. Your response?'],
      ['smoke', 'The plant’s smell has been detected by satellite. Thoughts?'],
      ['school', 'The county is coming for the school again. Where do you stand?'],
    ];
    var qi = 0;
    paper(G.ch === 2 ? 'TONIGHT: THE GREAT DEBATE' : 'MAYORAL DEBATE TONIGHT', 'Town Hall, 7 p.m. Donuts provided by the Spoon. Moderated by yours truly.',
      '<p class="brief">🎤 Answer three questions. Stating your stance wins over people who agree with it. Folksy stories charm everyone a little. Attacks are risky.</p>', ask, 'ENTER THE HALL');
    function ask() {
      if (qi >= qs.length) return finish();
      var q = qs[qi], issue = q[0];
      win({ title: 'DEBATE · QUESTION ' + (qi + 1) + ' OF 3', portrait: ST.portrait(bev.look, 0), cls: 'debate', html: '<p class="note">Moderator Bev Hollister:</p><p>“' + esc(q[1]) + '”</p><p class="note">Your stance: ' + sideLabel(issue, G.stance[issue]) + ' · ' + o.name.split(' ')[1] + ': ' + sideLabel(issue, o.stances[issue]) + '</p>',
        buttons: [
          { t: 'STATE YOUR POSITION', primary: true, f: function () { answer(issue, 'firm'); } },
          { t: 'TELL A FOLKSY STORY', f: function () { answer(issue, 'folk'); } },
          { t: 'ATTACK ' + o.name.split(' ')[1].toUpperCase(), f: function () { answer(issue, 'attack'); } },
          { t: 'CHANGE THE SUBJECT', small: true, f: function () { answer(issue, 'dodge'); } },
        ] });
    }
    function answer(issue, kind) {
      var line, crowd = 0, s = G.stance[issue], reply = o.reply[issue];
      ST.PKEYS.forEach(function (p) {
        var pr = ST.PRECINCTS[p].prefs[issue], d = 0;
        if (kind === 'firm') d = s === 0 ? -0.006 : 0.012 * pr[1] * pr[0] * s + 0.004;
        if (kind === 'folk') d = 0.007;
        if (kind === 'attack') d = o.stances[issue] === 0 ? 0.018 : (pr[0] * s > 0 ? 0.012 : -0.01);
        if (kind === 'dodge') d = -0.006;
        G.deb[p] += d; crowd += d * ST.PRECINCTS[p].voters;
      });
      crowd = crowd / 1400 * 100;
      if (kind === 'firm') line = ST.ISSUES[issue].say[String(s)];
      if (kind === 'folk') line = pick(ST.FOLKSY);
      if (kind === 'attack') { line = o.stances[issue] === 0 ? 'My opponent has had ' + (G.ch === 2 ? 'twenty-six years' : 'eight terms') + ' to decide about this and still hasn’t. That’s not leadership. That’s furniture.' : 'My opponent is wrong about this, and frankly, about most things, including the correct way to hold a fork.'; reply = o.attacked; }
      if (kind === 'dodge') line = pick(ST.DODGE);
      G.debScore += crowd;
      var meter = clamp(Math.round(5 + crowd * 3), 0, 10);
      var react = crowd > 1 ? 'APPLAUSE!' : crowd > 0.2 ? 'Polite clapping.' : crowd > -0.3 ? 'Someone coughs.' : 'A smattering of boos. And a kazoo.';
      win({ title: 'DEBATE', cls: 'debate', html: '<p><b>' + esc(G.name) + ':</b> “' + esc(line) + '”</p><p><b>' + esc(o.name) + ':</b> “' + esc(reply) + '”</p>' +
        '<div class="meter"><span>CROWD</span><i>' + '█'.repeat(meter) + '░'.repeat(10 - meter) + '</i></div><p class="note">' + react + '</p>',
        buttons: [{ t: qi < 2 ? 'NEXT QUESTION' : 'CLOSING BELL', primary: true, f: function () { qi++; ask(); } }] });
      beep(crowd > 0.2 ? 2 : crowd < -0.3 ? 3 : 1);
    }
    function finish() { save(); done(); }
  }

  // ---------------------------------------------------------------- election night
  function electionNight() {
    closeWin(); mode = 'election'; hud();
    var fin = shares(true), o = opp();
    elect = { fin: fin, rep: { NW: 0, NE: 0, SW: 0, SE: 0 }, t: 0, line: ST.ANCHOR[0], li: 0, done: false };
    $('elect').classList.remove('hidden');
    $('elect').innerHTML = '<div class="tv"><b>WBND-4 ELECTION DESK</b><small>' + esc(CH[G.ch].seat) + ' · Willow Bend</small><div id="tally"></div><p id="anchor"></p></div>';
    updateTally();
  }
  function updateTally() {
    var e = elect, o = opp(), me = 0, them = 0;
    ST.PKEYS.forEach(function (p) { var n = ST.PRECINCTS[p].voters * e.rep[p] / 100; me += Math.round(n * e.fin[p]); them += Math.round(n * (1 - e.fin[p])); });
    e.me = me; e.them = them;
    $('tally').innerHTML = '<div class="row me"><span>' + esc(G.name) + '</span><b>' + me + '</b></div><div class="row them"><span>' + esc(o.name) + '</span><b>' + them + '</b></div>' +
      '<small>' + Math.round(ST.PKEYS.reduce(function (a, p) { return a + e.rep[p]; }, 0) / 4) + '% of precincts reporting</small>';
    $('anchor').textContent = 'CHET: “' + e.line + '”';
  }
  function tickElection(dt) {
    var e = elect; if (!e || e.done) return;
    e.t += dt;
    if (e.t > 0.5) {
      e.t = 0;
      var left = ST.PKEYS.filter(function (p) { return e.rep[p] < 100; });
      if (!left.length) { e.done = true; return setTimeout(electionResult, 900); }
      var p = pick(left); e.rep[p] = Math.min(100, e.rep[p] + 10 + Math.floor(R() * 25));
      if (R() < 0.3) { e.li = (e.li + 1) % ST.ANCHOR.length; e.line = ST.ANCHOR[e.li]; }
      beep(0); updateTally();
    }
  }
  function electionResult() {
    var e = elect, won = e.me > e.them, o = opp(), pct = Math.round(e.me / (e.me + e.them) * 100);
    $('elect').classList.add('hidden'); elect = null;
    beep(won ? 2 : 3);
    G.record.results.push((won ? 'Won ' : 'Lost ') + CH[G.ch].seat + ' race, ' + pct + '%');
    if (won && G.ch === 2) {
      G.ch = 3; G.billI = 0; save();
      return paper(NAME() + ' UNSEATS PRUITT', pct + '% to ' + (100 - pct) + '%. Pruitt’s portrait to be moved "to a less prominent wall"',
        '<p class="brief">🏛️ <b>Chapter 3: Council Member ' + esc(G.name) + '.</b> Welcome to the chamber. The council is split 2–2 on everything, and as the newest member, you break the ties. The Mayor will be watching.</p>', startCouncil, 'TAKE YOUR SEAT');
    }
    if (won && G.ch === 4) { G.ch = 5; save(); return paper('MAYOR ' + NAME() + '!', 'Thibodeaux concedes, then un-concedes, then concedes again. ' + pct + '% of the vote', '<p class="brief">The keys to the city are a single key to a door nobody uses. You are the Mayor of Willow Bend.</p>', ending, 'ACCEPT THE KEY'); }
    G.tries[G.ch]++;
    paper(o.name.toUpperCase().split(' ').pop() + ' HOLDS ON', 'Challenger ' + G.name + ' falls short with ' + pct + '%. Gives "a really nice concession speech, actually"',
      '<p class="brief">You lost this one. Neighborhood goodwill partly carries over. Tip: check POLLS to see which neighborhoods you’re losing, and match your platform to what they care about.</p>',
      function () { startCampaign(true); }, 'RUN AGAIN');
  }

  // ================================================================ chapter 3: council
  function startCouncil() {
    mode = 'council'; hud(); closeWin();
    setTimeout(nextBill, 400);
  }
  function nextBill() {
    if (G.billI >= ST.BILLS.length) return toMayorRace();
    var b = ST.BILLS[G.billI], bunny = ST.OPPONENTS.bunny;
    var votes = ST.COUNCIL.map(function (m, i) { return m.vote !== 0 ? m.vote : b.split[i - 2]; });
    var tally = ST.COUNCIL.map(function (m, i) { return '<span class="' + (votes[i] > 0 ? 'y' : 'n') + '">' + esc(m.name) + ': ' + (votes[i] > 0 ? 'YES' : 'NO') + '</span>'; }).join('');
    var prom = '';
    if (b.promise && G.stance[b.promise[0]] !== 0) prom = '<p class="note">📣 You campaigned on <b>' + sideLabel(b.promise[0], G.stance[b.promise[0]]) + '</b>. Voters remember promises.</p>';
    win({ title: b.title, cls: 'bill', html: '<p class="note">NOW BEFORE THE COUNCIL</p><h2>' + esc(b.name) + '</h2><p>' + esc(b.desc) + '</p>' +
      '<div class="tally">' + tally + '</div><p class="note">It’s 2–2. As the newest member, you break the tie. Nobody remembers why that rule exists.</p>' +
      '<p class="whisper">🐰 <b>The Mayor whispers:</b> “' + esc(b.mayor) + '”</p><p class="whisper">✉️ <b>A letter from ' + esc(b.letter.who) + ':</b> “' + esc(b.letter.text) + '”</p>' + prom,
      buttons: [{ t: 'VOTE YES', primary: true, f: function () { castVote(b, 1); } }, { t: 'VOTE NO', f: function () { castVote(b, -1); } }] });
  }
  function castVote(b, v) {
    ST.PKEYS.forEach(function (p) { G.good[p] += (b.yes[p] || 0) * (v > 0 ? 1 : -0.5); });
    G.favor += b.favor * v;
    var note = '';
    if (b.promise && G.stance[b.promise[0]] !== 0) {
      var kept = v * b.promise[1] === G.stance[b.promise[0]];
      G.cred += kept ? 1 : -1; G.record[kept ? 'kept' : 'broken']++;
      note = kept ? '<p class="brief">✅ Promise kept. Your credibility rises.</p>' : '<p class="brief">💔 You broke a campaign promise. The Bugle has a long memory and a short headline.</p>';
    }
    if (b.id === 'hole' && v > 0) G.holeFilled = true;
    if (b.id === 'blvd' && v > 0) G.elm = 'BUNNY BLVD';
    G.votes.push(b.id + ':' + v); G.billI++; save(); beep(v > 0 ? 2 : 1);
    var h = v > 0 ? b.headYes : b.headNo;
    paper(h[0], h[1], '<p class="brief">The motion ' + (v > 0 ? 'PASSES 3–2' : 'FAILS 2–3') + '. ' + (b.favor * v > 0 ? 'The Mayor beams at you.' : 'The Mayor writes something in a small pink notebook.') + '</p>' + note, nextBill);
  }
  function toMayorRace() {
    paper('ONE YEAR LATER: THIBODEAUX SEEKS NINTH TERM', 'Mayor cites "momentum," "vibes," and "nobody else wants it"',
      '<p class="brief">Whispers around town say Council Member ' + esc(G.name) + ' should run. Ray at the Spoon has already printed pancake-shaped buttons.</p>',
      function () {
        win({ title: 'THE BIG DECISION', html: '<p>Run for Mayor of Willow Bend against Bunny Thibodeaux, eight-term incumbent and owner of the town’s only pink Cadillac?</p>',
          buttons: [{ t: 'RUN FOR MAYOR!', primary: true, f: function () { G.ch = 4; save(); paper(NAME() + ' ENTERS MAYOR’S RACE', 'Thibodeaux: "How adorable"', '<p class="brief">🗳️ <b>Chapter 4: the Mayor’s Race.</b> 3 days, debate on Day 2. Your council votes have shaped how each neighborhood sees you.</p>', function () { startCampaign(); }, 'HIT THE TRAIL'); } }] });
      });
  }

  // ================================================================ ending
  function ending() {
    mode = 'end'; hud(); save();
    var rungs = [['CITIZEN', 1], ['COUNCIL MEMBER', 1], ['MAYOR', 1], ['STATE REP', 0], ['GOVERNOR', 0], ['SENATOR', 0], ['THE BIG CHAIR', 0]];
    win({ title: 'THE LADDER', cls: 'title', html: '<div class="logo small">MAYOR ' + esc(G.name.toUpperCase()) + '</div>' +
      '<div class="ladder">' + rungs.slice().reverse().map(function (r) { return '<div class="rung' + (r[1] ? ' done' : '') + '">' + (r[1] ? '★ ' : '🔒 ') + r[0] + '</div>'; }).join('') + '</div>' +
      '<p class="note">Your record: ' + G.record.results.map(esc).join(' · ') + '. Promises kept: ' + G.record.kept + ', broken: ' + G.record.broken + '.</p>' +
      '<p class="center">End of the demo. Higher office awaits in a future chapter.</p>' +
      '<p class="center"><a class="pbtn link" href="https://claude.ai/artifact/1qLAy7qoz3oUZZqGtpznYb" target="_blank" rel="noopener">🏙️ Govern Willow Bend in Furrow to Skyline</a></p>',
      buttons: [{ t: 'NEW CAREER', primary: true, f: function () { try { localStorage.removeItem('stump.save'); } catch (e) { } location.hash = ''; G = null; showTitle(); } }] });
  }
  function help(back) {
    win({ title: 'HOW TO PLAY', html: '<p><b>Tap</b> the ground to walk. <b>Tap</b> a person to talk, a building to visit, a house to knock.</p>' +
      '<p><b>⚡ Energy:</b> talking, knocking and fundraising use energy. When you run out, END DAY.</p>' +
      '<p><b>Ch.1 Citizen:</b> learn what neighbors care about, declare a cause at the BUGLE, collect ' + GOAL + ' signatures, file at TOWN HALL.</p>' +
      '<p><b>Ch.2 &amp; 4 Races:</b> set a PLATFORM, pitch people who agree with you, knock doors, plant yard signs ($), fundraise at the SPOON, buy ads at the BUGLE, win the debate.</p>' +
      '<p><b>Ch.3 Council:</b> break 2–2 ties. Keep your promises.</p><p class="note">Keyboard: arrow keys walk.</p>',
      buttons: [{ t: 'OK', primary: true, f: back }] });
  }

  // ================================================================ input
  function bindInput() {
    var down = null;
    cv.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener('pointerup', function (e) {
      if (!down) return; var m = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
      if (m < 12 && mode === 'world') tapWorld(e.clientX, e.clientY);
    });
    window.addEventListener('keydown', function (e) {
      if (mode !== 'world' || winOpen()) { if (e.key === 'Enter' || e.key === ' ') { var b = document.querySelector('#layer .pbtn.primary:not(:disabled)'); if (b) { b.click(); e.preventDefault(); } } return; }
      var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d || pl.path.length) return;
      var nx = pl.tx + d[0], ny = pl.ty + d[1], n = npcAt(nx, ny), b = M.bAt(nx, ny);
      if (n) { pl.target = { k: 'npc', n: n }; arrive(); }
      else if (b && b.front.x === pl.tx && b.front.y === pl.ty) { pl.target = { k: 'bld', b: b }; arrive(); }
      else if (walkable(nx, ny)) pl.path = [[nx, ny]];
      e.preventDefault();
    });
  }

  // ================================================================ loop & draw
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; t += dt;
    requestAnimationFrame(loop);
    try {
      if (mode === 'world') stepPlayer(dt);
      if (mode === 'election') tickElection(dt);
      draw();
    } catch (e) { if (!loop.warned) { loop.warned = true; console.error(e); } }
  }
  function stepPlayer(dt) {
    if (!pl.path.length) return;
    var n = pl.path[0], gx = n[0] * 8 + 4, gy = n[1] * 8 + 8, sp = 56 * dt;
    var dx = gx - pl.x, dy = gy - pl.y, d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.1) pl.dir = dx > 0 ? 1 : -1; else if (dy < 0) pl.dir = 2; else pl.dir = 0;
    pl.ft += dt; if (pl.ft > 0.12) { pl.ft = 0; pl.frame++; }
    if (d <= sp) { pl.x = gx; pl.y = gy; pl.tx = n[0]; pl.ty = n[1]; pl.path.shift(); if (!pl.path.length) arrive(); }
    else { pl.x += dx / d * sp; pl.y += dy / d * sp; }
  }
  function draw() {
    ctx.fillStyle = P.ink; ctx.fillRect(0, 0, VW, VH);
    if (mode === 'council' || (mode === 'end')) return drawChamber();
    var mw = M.W * 8, mh = M.H * 8, padT = Math.ceil(52 / SC), padB = Math.ceil(70 / SC);
    if (mode === 'world') {
      camX = mw <= VW ? (mw - VW) / 2 : clamp(pl.x - VW / 2, 0, mw - VW);
      camY = clamp(pl.y - 6 - (VH + padT - padB) / 2 + padT, -padT, mh - VH + padB);
    } else if (mode === 'title') {
      titlePan += 0.15; camX = mw <= VW ? (mw - VW) / 2 : (Math.sin(titlePan / 90) * 0.5 + 0.5) * (mw - VW); camY = (Math.sin(titlePan / 140) * 0.5 + 0.5) * Math.max(0, mh - VH);
    } else if (mode === 'election') { camX = (mw - VW) / 2; camY = Math.max(-padT, (mh - VH) / 2 - 20); }
    camX = Math.round(camX); camY = Math.round(camY);
    ctx.save(); ctx.translate(-camX, -camY);
    ctx.drawImage(mapFrames[(t * 2 | 0) % 2], 0, 0);
    if (G && G.elm !== 'ELM ST') ST.text(ctx, G.elm, 2, 12 * 8 + 2, P.yellow);
    ST.drawHole(ctx, M, G && G.holeFilled, t);
    ST.drawSmoke(ctx, M, t);
    if (G) M.signSpots.forEach(function (s) { if (G.signUp && G.signUp[s.x + ',' + s.y]) { s.up = true; ST.drawSign(ctx, s, G.name[0]); } });
    // people sorted by y
    var ents = npcs.map(function (n, i) { return { y: n.y * 8 + 8, f: function () { drawNpc(n, i); } }; });
    if (mode === 'world') ents.push({ y: pl.y, f: function () { ST.drawPerson(ctx, pl.x, pl.y, G.look, pl.path.length ? pl.frame : 0, pl.dir, 0); } });
    ents.sort(function (a, b) { return a.y - b.y; }).forEach(function (e) { e.f(); });
    if ((overlay && mode === 'world' && CH[G.ch].opp) || (mode === 'election' && elect)) drawPrecincts();
    ctx.restore();
    if (mode === 'title') { ctx.fillStyle = 'rgba(16,16,24,0.45)'; ctx.fillRect(0, 0, VW, VH); }
  }
  function drawNpc(n, i) {
    var d = n.d, x = n.x * 8 + 4, y = n.y * 8 + 8, bob = Math.sin(t * 2 + i) > 0.85 ? -1 : 0;
    ST.drawPerson(ctx, x, y, d.look, 0, n.face, bob);
    if (!G || mode !== 'world') return;
    var s = G.n[d.id], mark = null, col = P.yellow;
    if (!s || !s.met) mark = '!';
    else if (G.ch === 1 && s.signed) { mark = '+'; col = P.lime; }
    else if (G.ch !== 1 && s.sup) { mark = '+'; col = P.pink; }
    if (mark) { var yy = y - 18 + (Math.sin(t * 4 + i) > 0 ? 0 : -1); ST.px(ctx, x - 3, yy - 1, 7, 7, P.ink); ST.text(ctx, mark, x - 1, yy, col); }
  }
  function drawPrecincts() {
    var s = elect ? null : shares(false);
    ST.PKEYS.forEach(function (p) {
      var x0 = p[1] === 'W' ? 0 : 14 * 8, x1 = p[1] === 'W' ? 14 * 8 : 27 * 8, y0 = p[0] === 'N' ? 0 : 26 * 8, y1 = p[0] === 'N' ? 26 * 8 : M.H * 8;
      var v, label;
      if (elect) { var r = elect.rep[p]; v = r ? elect.fin[p] : 0.5; label = r ? Math.round(elect.fin[p] * 100) + '% ' + r + '%RPT' : 'WAITING'; }
      else { v = s[p] + (ST.hash(G.day, p.charCodeAt(1), G.ch) - 0.5) * 0.04; label = Math.round(v * 100) + '%'; }
      var lead = v > 0.5;
      ctx.fillStyle = Math.abs(v - 0.5) < 0.005 ? 'rgba(200,200,190,0.25)' : lead ? 'rgba(236,212,74,' + (0.2 + Math.min(0.4, (v - 0.5) * 3)) + ')' : 'rgba(126,60,160,' + (0.2 + Math.min(0.4, (0.5 - v) * 3)) + ')';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
      var nm = ST.PRECINCTS[p].name.toUpperCase(), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      ST.px(ctx, Math.round(cx - ST.textW(nm) / 2) - 2, Math.round(cy) - 8, ST.textW(nm) + 4, 16, P.ink);
      ST.textC(ctx, nm, cx, Math.round(cy) - 6, P.paper); ST.textC(ctx, label, cx, Math.round(cy) + 1, lead ? P.yellow : P.pink);
    });
  }
  function drawChamber() {
    var w = VW, h = VH, k;
    // wood paneling
    for (k = 0; k < w; k += 6) { ctx.fillStyle = (k / 6) % 2 ? '#6a3e20' : P.brown; ctx.fillRect(k, 0, 6, h); }
    ctx.fillStyle = P.navy; ctx.fillRect(0, 0, w, 16); ST.textC(ctx, 'WILLOW BEND TOWN COUNCIL', w / 2, 6, P.yellow);
    // seal
    var cx = Math.round(w / 2), sy = 34;
    ctx.fillStyle = P.yellow; ctx.fillRect(cx - 9, sy - 9, 18, 18); ctx.fillStyle = P.navy; ctx.fillRect(cx - 7, sy - 7, 14, 14); ST.textC(ctx, 'WB', cx, sy - 2, P.yellow);
    // dais
    var dy = Math.round(h * 0.42);
    ctx.fillStyle = '#4a2a14'; ctx.fillRect(4, dy, w - 8, 26); ctx.fillStyle = P.tan; ctx.fillRect(4, dy, w - 8, 3);
    var people = ST.COUNCIL.slice(0, 2).concat([{ name: 'MAYOR', look: ST.OPPONENTS.bunny.look }]).concat(ST.COUNCIL.slice(2)).concat(G ? [{ name: 'YOU', look: G.look }] : []);
    var gap = (w - 16) / people.length;
    people.forEach(function (m, i) {
      var x = Math.round(8 + gap * (i + 0.5));
      ST.drawPerson(ctx, x, dy + 1, m.look, 0, 1, Math.sin(t * 2 + i) > 0.9 ? -1 : 0);
      ctx.fillStyle = P.paper; ctx.fillRect(x - 6, dy + 8, 12, 6); ST.textC(ctx, (m.name === 'MAYOR' || m.name === 'YOU' ? m.name : m.name.split(' ').pop()).slice(0, 3), x, dy + 9, P.ink);
    });
    // audience
    for (var r = 0; r < 3; r++) for (k = 0; k < 8; k++) {
      var ax = Math.round(10 + k * (w - 20) / 7), ay = h - 40 + r * 14;
      ST.drawPerson(ctx, ax, ay, { skin: ST.LOOKS.skin[(k + r) % 4], hair: ST.LOOKS.hair[(k * 3 + r) % 5], hs: (k + r) % 5, shirt: ST.LOOKS.shirt[(k + r * 2) % 6], pants: P.navy }, 0, 2, 0);
    }
  }
  // test hook (used by automated playthroughs)
  ST.dbg = {
    E: function () { return elect; }, G: function () { return G; }, mode: function () { return mode; }, M: function () { return M; },
    talk: function (id) { var n = npcs.filter(function (q) { return q.d.id === id; })[0]; talk(n); },
    visit: function (k, i) { visit(M.B.filter(function (b) { return b.k === k; })[i || 0]); },
    sign: function (i) { signSpot(M.signSpots[i]); }, endDay: endDay, tap: tapWorld, player: pl,
  };
})(window.ST);
