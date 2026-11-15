// People: advisors, the governor (missions + letters), citizens' voices.
(function (FS) {
  'use strict';

  // ---------------------------------------------------------------- advisors
  FS.advice = function (S) {
    var st = S.stats, out = { ag: [], tr: [], pl: [], sf: [], cu: [] }, c = st.count || {};
    function say(a, pri, text) { out[a].push({ pri: pri, text: text }); }
    var farms = (c.crop || 0) + (c.orchard || 0) + (c.pasture || 0) + (c.greenhouse || 0);

    // agriculture
    if (st.surplus < 0) say('ag', 3, 'We are eating ' + Math.round(-st.surplus) + ' more food than we grow each month, and importing it is costly. Plant wheat fields, and put a Barn beside them.');
    if (FS.modSum(S, 'drought') > 0) say('ag', 2, 'The drought is withering the fields (−40% food). Greenhouses would shrug it off.');
    if (!c.barn && farms >= 2) say('ag', 2, 'A Barn boosts every farm touching it by 30%. Build one in the middle of your fields.');
    if (S.era >= 1 && !c.market && st.surplus > 4) say('ag', 1, 'We have ' + Math.round(st.surplus) + ' surplus food. A Farmers’ Market sells it for 25% more.');
    if (S.era >= 1 && (c.crop || 0) >= 4 && !c.mill) say('ag', 1, 'With this many wheat fields, a Grain Mill pays for itself.');
    if (!out.ag.length) say('ag', 0, 'Fields are healthy: ' + Math.round(st.foodProd) + ' food grown, ' + Math.round(st.foodCons) + ' eaten. Surplus sells at $' + st.foodPrice.toFixed(2) + ' each.');

    // treasury
    if (S.money < 150) say('tr', 3, 'The coffers are nearly empty (' + FS.money(S.money) + '). Pause big projects or nudge taxes up a point.');
    else if (st.net < 0) say('tr', 2, 'We are losing ' + FS.money(-st.net) + ' a month. Check service upkeep and policy costs in the Budget.');
    if (S.tax >= 13) say('tr', 1, 'Taxes at ' + S.tax + '% are making people grumble. Each point above 9% costs happiness.');
    if (!out.tr.length) say('tr', 0, 'Books are balanced: ' + (st.net >= 0 ? '+' : '') + FS.money(st.net) + ' per month. Food sales bring in ' + FS.money(st.income.food) + '.');

    // planning
    var emptyR = st.zones.R[0], emptyC = st.zones.C[0], emptyI = st.zones.I[0];
    var zonedR = st.zones.R.reduce(function (a, b) { return a + b; }, 0);
    if (!zonedR) say('pl', 3, 'Nobody can move in without homes. Zone some Residential land within two tiles of a road.');
    if (st.noRoad > 0) say('pl', 2, st.noRoad + ' zoned lots have no road within 2 tiles, so nothing will grow there.');
    if (st.demand.R > 0.3 && emptyR < 3) say('pl', 2, 'Families want to move here. Zone more Residential land.');
    if (S.era >= 1 && st.demand.C > 0.3 && emptyC < 2) say('pl', 2, 'Shopkeepers are looking for storefronts. Zone Commercial near homes.');
    if (S.era >= 1 && st.demand.I > 0.3 && emptyI < 2) say('pl', 1, 'Tradespeople need workshops. Zone Industrial, ideally downwind of homes.');
    if (st.powerBlocked > 0) say('pl', 3, 'Buildings want to grow taller but there isn’t enough power. Build windmills or a power plant.');
    if (st.lvBlocked > 2) say('pl', 1, 'Land values are holding back taller buildings. Parks, schools and civic buildings raise land value. So does being close to the town center.');
    if (st.unemp > 0.15 && S.era === 0) say('pl', 2, 'Settlers need work. Every new field or pasture employs two or three hands, and new hands bring new families.');
    else if (st.unemp > 0.15) say('pl', 2, Math.round(st.unemp * 100) + '% of workers have no job. Farms, shops and industry all create work.');
    if (!out.pl.length) say('pl', 0, 'Growth is healthy. Demand: homes ' + pct(st.demand.R) + ', shops ' + pct(st.demand.C) + ', industry ' + pct(st.demand.I) + '.');

    // safety
    if (S.era >= 2) {
      if (st.cov.safety < 0.5) say('sf', 2, 'Only ' + pct(st.cov.safety) + ' of homes are near police or fire coverage. Folks feel uneasy.');
      if (st.cov.health < 0.5) say('sf', 2, 'Only ' + pct(st.cov.health) + ' of homes are near a clinic.');
      if (st.avgPoll > 10) say('sf', 1, 'Smoke is drifting into neighborhoods. Keep industry away from homes, or pass Clean Air Standards.');
    }
    if (st.cov.water < 0.6) say('sf', 2, 'Many homes are far from clean water. Dig a Village Well nearby.');
    if (!out.sf.length) say('sf', 0, S.era >= 2 ? 'Streets are calm and well covered.' : 'A quiet place. In the Town era I’ll want fire and police.');

    // culture
    if (S.era >= 1 && !c.hall) say('cu', 3, 'We have no Meeting Hall. Without one the Town Council cannot meet, and no policies (including building styles) can pass.');
    if (c.hall && S.month >= S.nextCouncil) say('cu', 2, 'The council is ready to convene. Tap 🏛️ to open the session.');
    if (S.era >= 1 && S.style === 'vernacular' && c.hall) say('cu', 1, 'Our streets could have a signature look. Bring an architectural code (Brownstone, Art Deco, Garden City) before the council.');
    if (S.era >= 1 && st.cov.edu < 0.5) say('cu', 1, 'Children are walking miles to school. A Schoolhouse would help.');
    if (st.cov.fun < 0.4) say('cu', 1, 'People need green space. A Village Green or Orchard nearby lifts spirits.');
    if (!out.cu.length) say('cu', 0, 'Our city’s look: ' + FS.STYLES[S.style].name + '. Every building remembers the code it was built under.');

    var res = [];
    FS.ADVISORS.forEach(function (a) {
      out[a.id].sort(function (p, q) { return q.pri - p.pri; });
      res.push({ adv: a, items: out[a.id] });
    });
    return res;
  };
  function pct(v) { return Math.round(v * 100) + '%'; }

  // ---------------------------------------------------------------- missions (from the governor)
  FS.MISSIONS = [
    { title: 'Feed the Frontier', text: 'Grow at least 20 food per month.', reward: 400, check: function (S) { return S.stats.foodProd >= 20; } },
    { title: 'A Proper Settlement', text: 'Reach 60 residents to become a Village.', reward: 800, check: function (S) { return S.era >= 1; } },
    { title: 'Voice of the People', text: 'Build a Meeting Hall and hold your first council meeting.', reward: 1000, check: function (S) { return S.councilsHeld >= 1; } },
    { title: 'Market Town', text: 'Build a Farmers’ Market and have 30 shop jobs.', reward: 1200, check: function (S) { return S.stats.count.market && S.stats.jobsC >= 30; } },
    { title: 'Incorporation', text: 'Reach 350 residents to charter a Town.', reward: 2000, check: function (S) { return S.era >= 2; } },
    { title: 'A Look of Our Own', text: 'Pass an architectural code through the council.', reward: 1500, check: function (S) { return S.style !== 'vernacular'; } },
    { title: 'Safe Streets', text: 'Build a Police Station and a Fire House.', reward: 1500, check: function (S) { return S.stats.count.police && S.stats.count.fire; } },
    { title: 'City Charter', text: 'Reach 1,800 residents to become a City.', reward: 5000, check: function (S) { return S.era >= 3; } },
    { title: 'Higher Learning', text: 'Found a University.', reward: 5000, check: function (S) { return S.stats.count.university; } },
    { title: 'The Metropolis', text: 'Reach 7,500 residents.', reward: 15000, check: function (S) { return S.era >= 4; } },
    { title: 'Skyline', text: 'Have 12 buildings at the tallest tier.', reward: 25000, check: function (S) { var z = S.stats.zones; return z.R[5] + z.C[5] + z.I[5] >= 12; } },
  ];

  // ---------------------------------------------------------------- letters / events
  function relate(S, id, d) { S.relations[id] = FS.clamp((S.relations[id] || 0) + d, -5, 5); }
  function farmNearCenter(S) {
    var c = S.stats.center, best = null, bd = 99;
    S.tiles.forEach(function (t, i) {
      if (!t.b || !FS.BUILD[t.b].farm) return;
      var x = i % FS.N, y = (i / FS.N) | 0, d = Math.abs(x - c.x) + Math.abs(y - c.y);
      if (d < bd && d <= 9) { bd = d; best = { x: x, y: y }; }
    });
    return best;
  }

  FS.EVENTS = [
    { id: 'fair', from: 'gov', era: 1, once: true, title: 'The State Agricultural Fair',
      text: function (S) { return 'Mayor, the State Fair needs a host this year. It would cost the town $300 to prepare the grounds, but the Grange would be thrilled and folks would talk about it for months.'; },
      cond: function (S) { return S.stats.foodProd > 25; },
      choices: [
        { label: 'Host the fair (−$300)', fx: function (S) { S.money -= 300; FS.addMod(S, 'happy', 7, 6, 'State Fair'); relate(S, 'ada', 1); S.approvalMod += 4; return 'Ribbons, pies and prize hogs. Spirits are high!'; } },
        { label: 'Politely decline', fx: function (S) { relate(S, 'ada', -1); return 'The fair goes to a rival county. The Grange is disappointed.'; } },
      ] },
    { id: 'drought', from: 'nature', era: 0, title: 'A Dry Summer',
      text: function (S) { return 'Mabel reports the creek is low and the sky stubbornly clear. Without irrigation the fields will suffer for months. Irrigation ditches would cost ' + FS.money(irrCost(S)) + '.'; },
      cond: function (S) { var m = S.month % 12; return m >= 4 && m <= 6 && S.month > 14 && FS.modSum(S, 'drought') <= 0; },
      choices: [
        { label: function (S) { return 'Dig irrigation (−' + FS.money(irrCost(S)) + ')'; }, fx: function (S) { S.money -= irrCost(S); relate(S, 'ada', 1); return 'Water flows to the fields. Harvest saved.'; } },
        { label: 'Hope for rain', fx: function (S) { FS.addMod(S, 'drought', 1, 4, 'Drought'); return 'Drought! Farm output −40% for 4 months.'; } },
      ] },
    { id: 'developer', from: 'dev', era: 2, title: 'An Offer for the Old Farm',
      text: function (S) { var f = S.flags.devFarm || farmNearCenter(S); S.flags.devFarm = f; if (!f) return 'Brandt & Sons have withdrawn their offer.'; return 'Hollis Brandt of Brandt & Sons Development offers ' + FS.money(devPrice(S)) + ' for the farm near the town center at (' + f.x + ',' + f.y + '). He would turn it into housing. The Farmers’ Grange is watching closely.'; },
      cond: function (S) { return !S.stats.fx.protectFarms && !!farmNearCenter(S); },
      choices: [
        { label: function (S) { return 'Sell (+' + FS.money(devPrice(S)) + ')'; }, fx: function (S) { var f = S.flags.devFarm, t = f && FS.tile(S, f.x, f.y); if (t && t.b && FS.BUILD[t.b].farm) { t.b = null; t.z = 'R'; t.lv = 1; t.st = S.style; } S.money += devPrice(S); relate(S, 'ada', -2); relate(S, 'marcus', 1); return 'The plow gives way to the hammer. New homes rise where wheat once grew.'; } },
        { label: 'Refuse: the farm stays', fx: function (S) { relate(S, 'ada', 1); relate(S, 'june', 1); relate(S, 'marcus', -1); return 'The Grange cheers. Brandt mutters about "progress".'; } },
      ] },
    { id: 'railroad', from: 'dev', era: 2, once: true, title: 'The Railroad Comes Calling',
      text: function () { return 'The Northern & Coastal Railway wants to run a spur line through town. They will pay $800 for the right of way, and trains bring customers. Some say the whistle will be a nuisance.'; },
      cond: function () { return true; },
      choices: [
        { label: 'Welcome the railway (+$800)', fx: function (S) { S.money += 800; FS.addMod(S, 'comD', 0.15, 600, 'Railway'); FS.addMod(S, 'happy', -2, 12, 'Train noise'); relate(S, 'marcus', 2); relate(S, 'june', -1); return 'All aboard! Shops expect a steady stream of visitors.'; } },
        { label: 'Keep the trains out', fx: function (S) { relate(S, 'marcus', -1); relate(S, 'june', 1); return 'The line goes to the next valley instead.'; } },
      ] },
    { id: 'park_petition', from: 'citizens', era: 1, title: 'A Petition from the Neighbors',
      text: function (S) { return 'Forty-two residents signed a petition: "Our children need somewhere green to play." They ask the town to fund playground equipment and gardens ($200).'; },
      cond: function (S) { return S.stats.cov.fun < 0.6; },
      choices: [
        { label: 'Fund it (−$200)', fx: function (S) { S.money -= 200; FS.addMod(S, 'happy', 4, 12, 'Playgrounds'); S.approvalMod += 5; relate(S, 'lila', 1); return 'Swings and flowerbeds! The petitioners are delighted.'; } },
        { label: 'Not this year', fx: function (S) { S.approvalMod -= 4; return 'The petitioners leave disappointed.'; } },
      ] },
    { id: 'newcomers', from: 'gov', era: 1, title: 'Newcomers at the Harbor',
      text: function () { return 'A ship of families from across the sea has landed, looking for work and a place to settle. The Governor asks if our town will open its doors.'; },
      cond: function () { return true; },
      choices: [
        { label: 'Welcome them', fx: function (S) { FS.addMod(S, 'resD', 0.35, 8, 'Newcomers'); S.approvalMod += 2; relate(S, 'sam', 1); return 'New neighbors bring new recipes, songs and skills.'; } },
        { label: 'We are full', fx: function (S) { S.approvalMod -= 2; return 'The ship sails on.'; } },
      ] },
    { id: 'industrialist', from: 'dev', era: 2, title: 'An Industrialist’s Proposal',
      text: function () { return 'Cornelius Vane wants to open a textile works here and offers $1,000 toward the town treasury. Hundreds of jobs, and plenty of smoke.'; },
      cond: function () { return true; },
      choices: [
        { label: 'Shake hands (+$1,000)', fx: function (S) { S.money += 1000; FS.addMod(S, 'indD', 0.3, 12, 'Vane Textiles'); relate(S, 'sam', 1); relate(S, 'lila', -1); return 'Looms are on their way. Zone industry to make room.'; } },
        { label: 'Decline', fx: function (S) { relate(S, 'lila', 1); return 'Vane takes his looms elsewhere.'; } },
      ] },
    { id: 'harvest', from: 'citizens', era: 0, title: 'Harvest Festival',
      text: function (S) { return 'The barns are full (' + Math.round(S.stats.surplus) + ' surplus food this month). The neighbors want a harvest festival with music and a barn dance. $100 for lanterns and fiddlers?'; },
      cond: function (S) { var m = S.month % 12; return m >= 8 && m <= 10 && S.stats.surplus > 10; },
      choices: [
        { label: 'Throw the festival (−$100)', fx: function (S) { S.money -= 100; FS.addMod(S, 'happy', 6, 4, 'Harvest Festival'); S.approvalMod += 3; return 'The fiddles play until midnight.'; } },
        { label: 'Save the money', fx: function () { return 'A quiet autumn.'; } },
      ] },
    { id: 'highway', from: 'gov', era: 3, once: true, title: 'State Highway Funds',
      text: function () { return 'The state will grant $3,000 if we let the new highway pass along the river. Faster trade, but noisier neighborhoods.'; },
      cond: function () { return true; },
      choices: [
        { label: 'Accept (+$3,000)', fx: function (S) { S.money += 3000; FS.addMod(S, 'comD', 0.1, 600, 'Highway'); FS.addMod(S, 'happy', -3, 24, 'Highway noise'); relate(S, 'marcus', 1); relate(S, 'lila', -1); return 'Surveyors arrive next week.'; } },
        { label: 'Decline', fx: function (S) { relate(S, 'lila', 1); return 'The highway is rerouted.'; } },
      ] },
    { id: 'heatwave_power', from: 'nature', era: 2, title: 'Heat Wave',
      text: function () { return 'A brutal heat wave has everyone running fans. The power company asks for $400 to rent emergency generators.'; },
      cond: function (S) { var m = S.month % 12; return m >= 6 && m <= 7 && S.stats.powerSup > 0; },
      choices: [
        { label: 'Rent generators (−$400)', fx: function (S) { S.money -= 400; return 'The lights stay on.'; } },
        { label: 'Ride it out', fx: function (S) { FS.addMod(S, 'happy', -6, 2, 'Heat wave'); return 'Sweltering nights. Tempers flare.'; } },
      ] },
  ];
  FS.EVENT = {}; FS.EVENTS.forEach(function (e) { FS.EVENT[e.id] = e; });
  function irrCost(S) { return 150 + S.era * 100; }
  function devPrice(S) { return 600 + S.era * 400; }

  FS.resolveEvent = function (S, idx, choiceIdx) {
    var ev = S.events[idx]; if (!ev) return '';
    var def = FS.EVENT[ev.id], ch = def.choices[choiceIdx];
    var msg = ch.fx(S);
    if (ev.id === 'developer') S.flags.devFarm = null;
    S.events.splice(idx, 1);
    S.log.unshift({ m: S.month, text: def.title + ': ' + msg });
    if (S.log.length > 50) S.log.pop();
    FS.simMonth(S, true);
    return msg;
  };

  // ---------------------------------------------------------------- citizens
  var R = Math.random;
  function post(S, text, mood, who) {
    S.posts.unshift({ m: S.month, who: who || FS.personName(R), job: FS.pick(FS.JOBS[Math.min(4, S.era)]), text: text, mood: mood });
    if (S.posts.length > 40) S.posts.pop();
  }
  FS.citizenPosts = function (S) {
    var st = S.stats, pool = [];
    function add(w, mood, text) { pool.push({ w: w, mood: mood, text: text }); }
    if (st.surplus < 0) add(4, '😠', 'Bread costs twice what it did last spring. Where are the farms?');
    if (st.surplus > 15) add(2, '😀', 'Never seen the market stalls so full. Apples for a penny!');
    if (S.tax > 11) add(3, '😠', 'Taxes at ' + S.tax + '%? I work for the mayor now, apparently.');
    if (S.tax < 7) add(1, '😀', 'Low taxes and good land. This is the place to be.');
    if (st.unemp > 0.12) add(3, '😠', 'Been looking for work for weeks. Nobody’s hiring.');
    if (st.demand.R > 0.4) add(2, '😐', 'My cousins want to move here but there’s no house to be had.');
    if (st.avgPoll > 8) add(2, '😠', 'Can’t hang the washing out without it going grey from the smoke.');
    if (S.era >= 2 && st.cov.safety < 0.4) add(2, '😠', 'Someone took my bicycle right off the porch. Where are the police?');
    if (S.era >= 1 && st.cov.edu < 0.4) add(2, '😐', 'My kids walk two hours to school. We need a schoolhouse closer by.');
    if (st.cov.fun > 0.7) add(1, '😀', 'Sunday picnics on the green are the best part of my week.');
    if (S.style === 'brownstone') add(1, '😀', 'The new brownstones on my street are handsome. Sitting on the stoop is a pleasure.');
    if (S.style === 'deco') add(1, '😀', 'That brass and limestone! The new buildings shine like jewelry boxes.');
    if (S.style === 'modern') add(1, '😐', 'All glass and steel now. Efficient, but I miss the old cornices.');
    if (S.style === 'garden') add(1, '😀', 'There’s a vegetable garden on my roof. A roof!');
    if (S.happy > 70) add(2, '😀', 'I can’t imagine living anywhere else.');
    if (S.happy < 40) add(2, '😠', 'Thinking of packing up and heading west.');
    if (st.powerDem > st.powerSup && S.era >= 2) add(3, '😠', 'Lights flickering again. Is it so hard to keep the power on?');
    if (S.era === 0) add(2, '😐', 'Just us, the river and the wheat. Peaceful, if lonely.');
    if (S.era >= 3) add(1, '😀', 'Took the train downtown for a show. Feels like a real city now!');
    add(1, '😐', FS.pick(['Saw a heron by the river this morning.', 'Anyone know a good cobbler?', 'The mayor waved at me today!', 'Rain tomorrow, my knee says.', 'Lost: one grey cat, answers to Pickles.']));
    var tot = pool.reduce(function (a, p) { return a + p.w; }, 0), r = R() * tot;
    for (var i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) { post(S, pool[i].text, pool[i].mood); return; } }
  };

  // a resident's thought for an inspected home (stable-ish per tile)
  FS.residentOf = function (S, t, x, y) {
    var r = FS.rngFrom(t.v * 7919 + x * 31 + y), st = S.stats, i = FS.idx(x, y), M = FS.maps;
    var name = FS.personName(r), job = FS.pick(FS.JOBS[Math.min(4, S.era)], r);
    var moods = [];
    if (M.poll[i] > 8) moods.push(['😠', 'The smoke from the works down the road is awful.']);
    if (S.era >= 2 && M.cov.safety[i] <= 0 && st.fx.safetyBase < 0.3) moods.push(['😟', 'I lock my door twice now. No police anywhere near.']);
    if (S.era >= 1 && M.cov.edu[i] <= 0) moods.push(['😐', 'No school in walking distance for my kids.']);
    if (M.cov.fun[i] > 0) moods.push(['😀', 'I love being near the green. Evening walks are lovely.']);
    if (M.land[i] > 60) moods.push(['😀', 'This neighborhood has really come up in the world.']);
    if (t.st && t.st !== S.style) moods.push(['🙂', 'Our building is ' + FS.STYLES[t.st].name + '. They don’t make them like this anymore.']);
    if (S.tax > 11) moods.push(['😠', 'Taxes are eating my wages.']);
    if (t.b === 'farmhouse' || (t.b && FS.BUILD[t.b].farm)) moods.push(['🙂', FS.pick(['Up before dawn, but the soil here is rich.', 'Weather\u2019s been kind to the wheat this year.', 'Remember when this was all just us and the river?'], r)]);
    else if (!moods.length) moods.push(['🙂', 'Good neighbors, fair rent. Can’t complain.']);
    var m = moods[Math.floor(r() * moods.length)];
    return { name: name, job: job, mood: m[0], text: m[1] };
  };

  // ---------------------------------------------------------------- monthly hook
  FS.afterMonth = function (S) {
    var mi = FS.MISSIONS[S.mission];
    if (mi && mi.check(S)) {
      S.money += mi.reward; S.mission++;
      S.notices.push({ type: 'mission', title: mi.title, reward: mi.reward });
    }
    if (FS.rand() < 0.45) FS.citizenPosts(S);
    if (S.events.length < 2 && S.month > 8 && FS.rand() < 0.07) {
      var opts = FS.EVENTS.filter(function (e) {
        if (e.era > S.era) return false;
        if (e.once && S.eventsDone[e.id]) return false;
        if ((S.eventsDone[e.id] || -99) > S.month - 24) return false;
        if (S.events.some(function (x) { return x.id === e.id; })) return false;
        try { return e.cond(S); } catch (err) { return false; }
      });
      if (opts.length) {
        var e = FS.pick(opts);
        S.events.push({ id: e.id, m: S.month });
        S.eventsDone[e.id] = S.month;
        S.notices.push({ type: 'letter', title: e.title, from: e.from });
      }
    }
    if (S.stats.count.hall && S.month === S.nextCouncil) S.notices.push({ type: 'council' });
  };
})(window.FS);
