// STUMP! — content: issues, precincts, people, lines, bills, headlines.
window.ST = window.ST || {};
(function (ST) {
  'use strict';

  ST.ISSUES = {
    pothole: { name: 'The Great Pothole', short: 'POTHOLE', icon: '🕳️',
      desc: 'A pothole on Elm Street so big it has its own zip code.',
      pro: { label: 'Fill it in', slogan: 'FILL THE HOLE' }, con: { label: 'Keep it. It’s a landmark.', slogan: 'SAVE THE HOLE' },
      say: { 1: 'Fill. That. Hole. I will personally hold the shovel.', 0: 'I believe in holes, AND I believe in roads.', '-1': 'That pothole is our Grand Canyon. You don’t pave the Grand Canyon.' } },
    smoke: { name: 'The Smell', short: 'SMELL', icon: '🏭',
      desc: 'Gristle Bros. Rendering employs 200 people and produces one smell nobody can describe.',
      pro: { label: 'Clean up the plant', slogan: 'CLEAR THE AIR' }, con: { label: 'Protect the jobs', slogan: 'JOBS NOT NOSES' },
      say: { 1: 'People deserve jobs AND the ability to open a window.', 0: 'I have formed an exploratory committee to smell it.', '-1': 'That smell is the smell of a paycheck, and I love it.' } },
    school: { name: 'The Old Schoolhouse', short: 'SCHOOL', icon: '🏫',
      desc: 'The county wants to close it and bus kids forty minutes away.',
      pro: { label: 'Keep it open', slogan: 'SAVE OUR SCHOOL' }, con: { label: 'Bus them to the county', slogan: 'THE BUS IS FINE' },
      say: { 1: 'Our kids learn best in a building that was built when kids learned best.', 0: 'Education is very important, and so are buses.', '-1': 'A long bus ride builds character. And podcasts.' } },
  };
  ST.ISSUE_KEYS = ['pothole', 'smoke', 'school'];

  // prefs: issue -> [side wanted (+1 pro / -1 con), weight]
  ST.PRECINCTS = {
    NW: { name: 'Maple Heights', blurb: 'Retirees and lawn flamingos', voters: 420, color: '#c8925a', prefs: { pothole: [1, 2], smoke: [1, 1], school: [-1, 1] } },
    NE: { name: 'Downtown', blurb: 'Shopkeepers and both traffic lights', voters: 260, color: '#7fb4e8', prefs: { pothole: [-1, 2], smoke: [-1, 1], school: [1, 1] } },
    SW: { name: 'School Hill', blurb: 'Families and minivans', voters: 380, color: '#a6d65a', prefs: { pothole: [1, 1], smoke: [1, 1], school: [1, 3] } },
    SE: { name: 'The Flats', blurb: 'Plant workers and strong coffee', voters: 340, color: '#e488b0', prefs: { pothole: [1, 1], smoke: [-1, 3], school: [1, 1] } },
  };
  ST.PKEYS = ['NW', 'NE', 'SW', 'SE'];

  var L = function (skin, hair, hs, shirt, pants, extra) { return Object.assign({ skin: skin, hair: hair, hs: hs, shirt: shirt, pants: pants }, extra || {}); };

  ST.OPPONENTS = {
    pruitt: { name: 'Dale Pruitt', title: 'Councilman (26 years)', slogan: 'PRUITT: STILL HERE', base: -0.09,
      stances: { pothole: 0, smoke: -1, school: -1 }, look: L('#f0c8a0', '#c0c0b8', 2, '#24305e', '#4c4c44', { mu: 1, gl: 1 }),
      reply: { pothole: 'I have been studying the pothole since 1998. These things take time.', smoke: 'Gristle Brothers sponsors my bowling team, and I won’t apologize for bowling.', school: 'When I was a boy, we didn’t have a school. We had a field. And we were grateful.' },
      attacked: 'Twenty-six years and I have never once been caught doing anything. That’s a record.' },
    bunny: { name: 'Bunny Thibodeaux', title: 'Mayor (8 terms)', slogan: 'BUNNY: HOP TO IT', base: -0.1,
      stances: { pothole: -1, smoke: -1, school: 0 }, look: L('#f0c8a0', '#e6c68a', 3, '#e488b0', '#e488b0', { gl: 1 }),
      reply: { pothole: 'The pothole is the future site of the Bunny Thibodeaux Parking Garage. You’re welcome.', smoke: 'I have a very weak sense of smell, which makes me a very strong mayor.', school: 'I have appointed a committee to appoint a committee. Results expected never.' },
      attacked: 'Eight terms, darling. Eight. You can’t even spell “incumbent”.' },
  };

  // people around town. x,y are tile coords; pref is the side they want on their issue
  ST.NPCS = [
    { id: 'gladys', name: 'Gladys Ferncastle', role: 'retired, Elm St.', x: 5, y: 11, issue: 'pothole', pref: 1, look: L('#f0c8a0', '#f4f0e0', 3, '#e488b0', '#7a4a28', { gl: 1 }),
      intro: 'Gladys Ferncastle. I’ve lived on Elm since it was called Mud.',
      concern: 'That pothole ate my Buick in 2009. When they fished it out, there was a 1974 Buick underneath. FILL. IT. IN.',
      small: ['I’m baking a pie for whoever fills that hole. A big pie.', 'My grandson says I should “get online.” Online where?'] },
    { id: 'walt', name: 'Walt Hubbard', role: 'retired mailman', x: 9, y: 5, issue: 'school', pref: -1, look: L('#c89060', '#88887c', 0, '#7fb4e8', '#24305e', { mu: 1 }),
      intro: 'Walt Hubbard. Delivered mail here 38 years. I know what everyone gets in the mail. Everyone.',
      concern: 'That schoolhouse costs us a fortune in taxes. Bus the kids to the county. I walked forty minutes to school. In July. Uphill.',
      small: ['You get a lot of catalogs. I’m not judging.', 'Never trust a man who owns two lawnmowers.'] },
    { id: 'lu', name: 'Pastor Lu Abernathy', role: 'First Church of Willow Bend', x: 7, y: 20, issue: 'smoke', pref: 1, look: L('#8a5a3a', '#101018', 0, '#101018', '#101018'),
      intro: 'Pastor Lu Abernathy. Sundays at ten, potluck at noon, guilt at all hours.',
      concern: 'Every Sunday I preach about brimstone. Gristle Brothers manufactures it. The plant has to clean up.',
      small: ['The choir has asked me to stop singing along.', 'Bless you. You looked like you needed it.'] },
    { id: 'bev', name: 'Bev Hollister', role: 'editor, the Bugle', x: 26, y: 20, issue: 'school', pref: 1, guide: true, look: L('#f0c8a0', '#c83a3a', 1, '#4a5d8f', '#4c4c44', { gl: 1 }),
      intro: 'Bev Hollister, editor of the Willow Bend Bugle. Circulation 900. Readership 900 and one cat.',
      concern: 'Want on the council ballot? You need 8 signatures before the deadline. Folks here care about three things: the Great Pothole, the Smell from the plant, and the Old Schoolhouse. Learn what people want, pick a cause, then declare it at my office. It’s the building that says BUGLE.',
      small: ['Off the record? Everything is off the record. Nobody reads the record.', 'Our crossword has had the same answer since 1994. It’s “PRUITT”.'] },
    { id: 'darlene', name: 'Darlene Okafor', role: 'Pothole Gifts & Sundries', x: 18, y: 25, issue: 'pothole', pref: -1, look: L('#5a3a24', '#101018', 1, '#ecd44a', '#24305e'),
      intro: 'Darlene Okafor. I own Pothole Gifts & Sundries. Yes, that pothole.',
      concern: 'Pothole snow globes. Pothole mugs. “I Fell In The Great Pothole” T-shirts. Fill it in and I’m ruined. It’s a LANDMARK.',
      small: ['Tourists come from three whole counties to look at it.', 'Want a mug? It’s just a black circle. Our bestseller.'] },
    { id: 'ray', name: 'Ray Szabo', role: 'owner, the Spoon diner', x: 15, y: 17, issue: 'smoke', pref: -1, look: L('#f0c8a0', '#7a4a28', 4, '#f4f0e0', '#4c4c44', { mu: 1 }),
      intro: 'Ray Szabo. I own the Spoon. Best pancakes in the county, according to me.',
      concern: 'Plant workers eat three breakfasts a day. You mess with Gristle Brothers, you mess with my pancakes.',
      small: ['Coffee’s free if you don’t ask what’s in it.', 'Pruitt’s had the same booth since 1997. It has a dent shaped like him.'] },
    { id: 'coach', name: 'Coach Gus Petrakis', role: 'gym, health and lunch duty', x: 9, y: 35, issue: 'school', pref: 1, look: L('#c89060', '#101018', 4, '#c83a3a', '#24305e', { mu: 1 }),
      intro: 'Coach Gus Petrakis. Gym, health, driver’s ed, and lunch duty.',
      concern: 'If they close that school, where am I supposed to yell at children? Keep it open!',
      small: ['Hustle! Sorry. Force of habit.', 'Dodgeball builds character. And bruises. Mostly bruises.'] },
    { id: 'maya', name: 'Maya Lindqvist', role: 'parent of three', x: 7, y: 41, issue: 'school', pref: 1, look: L('#f0c8a0', '#e6c68a', 1, '#58a83e', '#4a5d8f'),
      intro: 'Maya Lindqvist. Mother of three, driver of three, referee of three.',
      concern: 'Forty minutes on a bus each way? My kids can’t sit still for four. Keep the school open.',
      small: ['Do you know how to get glitter out of a dog? Asking for a dog.', 'I haven’t finished a hot coffee since 2016.'] },
    { id: 'theo', name: 'Theo Banks', role: 'age 11', x: 11, y: 28, issue: 'pothole', pref: 1, kid: true, look: L('#8a5a3a', '#101018', 4, '#e08a30', '#24305e'),
      intro: 'I’m Theo. I’m eleven. I can’t sign stuff or vote or drive.',
      concern: 'But I saw a raccoon go INTO the pothole and come out WEARING A HAT. Somebody should look into that.',
      small: ['My mom says politicians are “a whole thing.” Are you a whole thing?', 'I’m going to be governor. Or a dinosaur.'] },
    { id: 'hank', name: 'Hank Gristle Jr.', role: 'VP, Gristle Bros. Rendering', x: 21, y: 37, issue: 'smoke', pref: -1, donor: true, look: L('#f0c8a0', '#ecd44a', 0, '#88887c', '#24305e'),
      intro: 'Hank Gristle Jr. Vice President of Smell. Ha! That’s a joke. Mostly.',
      concern: 'Two hundred jobs, friend. Folks don’t mind how money smells until they don’t have any. Protect the plant.',
      small: ['Daddy says the smell is “proprietary.”', 'We’re rebranding the smell as “rustic.”'] },
    { id: 'rosa', name: 'Rosa Medina', role: 'night shift, 14 years', x: 17, y: 33, issue: 'smoke', pref: -1, look: L('#c89060', '#101018', 3, '#4a5d8f', '#4c4c44'),
      intro: 'Rosa Medina. Night shift at the plant, fourteen years.',
      concern: 'Yes, it stinks. It’s also my mortgage. Don’t let them shut us down.',
      small: ['I sleep from 8 a.m. to 3 p.m. Do NOT knock.', 'My kids think I work at a soup factory. Let’s keep it that way.'] },
    { id: 'earl', name: 'Earl Dobbs', role: 'independent researcher', x: 24, y: 34, issue: 'pothole', pref: 1, look: L('#f0c8a0', '#7a4a28', 1, '#2e6b34', '#7a4a28', { mu: 1 }),
      intro: 'Earl Dobbs. Independent researcher. Very independent. Nobody funds me.',
      concern: 'That pothole goes down nine hundred feet. I lowered a walkie-talkie in. Something answered. FILL IT before it’s too late.',
      small: ['The birds are fine. That’s what THEY want you to think.', 'I wear the hat for reasons.'] },
    { id: 'pruitt', name: 'Dale Pruitt', role: 'Councilman (26 years)', x: 16, y: 10, special: true, look: ST.OPPONENTS.pruitt.look,
      intro: 'Dale Pruitt, councilman. Twenty-six years of service. You may know me from my portrait in the post office. And the library. And the diner restroom.',
      concern: 'Petition? Ha! I’ve run unopposed so long, the ballot just says “PRUITT (obviously).”',
      small: ['Have you met my mustache? It has also served 26 years.', 'I don’t campaign. I simply continue.'] },
    { id: 'bunny', name: 'Mayor Bunny Thibodeaux', role: 'Mayor (8 terms)', x: 23, y: 10, special: true, look: ST.OPPONENTS.bunny.look,
      intro: 'Mayor Bunny Thibodeaux! Eight terms. I’ve cut more ribbons than a hairdresser.',
      concern: 'Have you seen my plans for the Bunny Thibodeaux Parking Garage? It goes right where the pothole is. Visionary, I know.',
      small: ['Smile! You’re in Willow Bend! (Smiling is mandatory. Ordinance 12.)', 'I sign all my emails with a little bunny. It’s branding.'] },
  ];

  ST.DOOR = {
    yes: ['Sure, I’ll vote for you. You have a trustworthy chin.', 'My cat likes you. That’s good enough for me.', 'You had me at “Hello, I’m running for—”.', 'Finally, someone who knocks instead of texting.', 'You agree with me? Then you’re obviously very smart.'],
    meh: ['I’ll think about it. I won’t, but I’ll say I will.', 'Is this about my car’s extended warranty?', 'I vote for whoever has the shortest name.', '*a dog barks for forty-five seconds*'],
    no: ['You want WHAT about the pothole? Get off my porch.', 'We don’t want any. Of anything. Ever.', 'My uncle voted for Pruitt, and his uncle voted for Pruitt.', 'I’m in my robe. This is a robe household.'],
    signYes: ['I’ll sign anything. I once signed up for a timeshare in Ohio.', 'Sure. Is this a petition or a birthday card? Either way.', 'Hand me the pen. I love a pen.'],
    signNo: ['I don’t sign things. That’s how they get you.', 'Sign? In this economy?', 'I only sign petitions about squirrels.'],
  };

  ST.FOLKSY = [
    'My grandpa used to say, “A town is just a bunch of porches that agreed to be neighbors.” Then he’d fall asleep.',
    'I once helped Ray at the Spoon flip four hundred pancakes for the fire department. Three hit the ceiling. Two are still there.',
    'When I was little, I got stuck in a tree on Maple Street, and the whole block brought lawn chairs. That’s Willow Bend.',
  ];
  ST.DODGE = ['Great question. Let me answer a different one: have you seen the moon lately?', 'I’d like to use my time to thank the donut table.'];

  ST.ANCHOR = [
    'Chet Bramble here at the WBND-4 Election Desk, which is also my kitchen.',
    'Turnout is high, mostly because the polling place has free donuts.',
    'We’re told one write-in vote was cast for “the pothole.” The pothole is not a candidate.',
    'My producer says I have to stop calling it “the big game.”',
    'Maple Heights always reports first. They vote at 6 a.m. sharp, in slippers.',
    'This one’s tight, folks. Tighter than my slacks after the donut table.',
    'The Flats are coming in now. The night shift voted on the way home.',
  ];

  ST.COUNCIL = [
    { name: 'Fern Wagner', note: 'votes YES on everything', vote: 1, look: L('#f0c8a0', '#c0c0b8', 3, '#a6d65a', '#7a4a28', { gl: 1 }) },
    { name: 'Otis Pike', note: 'has voted NO since 1987', vote: -1, look: L('#c89060', '#f4f0e0', 2, '#7a4a28', '#4c4c44', { mu: 1 }) },
    { name: 'Dr. Ana Ruiz', note: 'veterinarian, pragmatist', vote: 0, look: L('#c89060', '#101018', 1, '#f4f0e0', '#24305e') },
    { name: 'Mo Kessler', note: 'owns the bowling alley', vote: 0, look: L('#5a3a24', '#101018', 0, '#e08a30', '#24305e') },
  ];

  // goodwill deltas by precinct for YES; NO is the opposite (halved). promise: issue+side that YES fulfills
  ST.BILLS = [
    { id: 'blvd', title: 'Ordinance 24-7', name: 'Rename Elm Street “Bunny Thibodeaux Boulevard”',
      desc: 'The Mayor would like the town’s oldest street named after her. She is alive and well, and would like to stay that way on a street sign.',
      mayor: 'Vote yes, dear, and I’ll name a bench after you. A nice bench. Near a bin.',
      letter: { who: 'Gladys Ferncastle', text: 'It’s been Elm Street since it was called Mud. Leave it alone.' },
      split: [1, -1], yes: { NW: -2, NE: 1, SW: 0, SE: 0 }, favor: 2,
      headYes: ['ELM ST. NOW “BUNNY BLVD.”', 'Residents report mail arriving to “Bunny” addressed to them personally'],
      headNo: ['ELM STREET STAYS ELM', 'Mayor seen glaring at a street sign for 40 minutes'] },
    { id: 'odor', title: 'Ordinance 24-8', name: 'Gristle Bros. Odor Abatement Act',
      desc: 'Requires the rendering plant to install a filter. The filter is expensive. So is a nose transplant.',
      mayor: 'Hank Gristle Jr. golfs with me. Vote no. Think of my golf.',
      letter: { who: 'Rosa Medina', text: 'If they make the plant pay for a filter, they’ll cut the night shift. That’s me.' },
      split: [-1, 1], yes: { NW: 2, NE: -1, SW: 1, SE: -2 }, favor: -1, promise: ['smoke', 1],
      headYes: ['PLANT MUST INSTALL FILTER', 'Town smells “almost like a town,” says Pastor Lu'],
      headNo: ['SMELL SURVIVES ANOTHER YEAR', 'Gristle Bros. celebrates with a commemorative odor'] },
    { id: 'hole', title: 'Ordinance 24-9', name: 'Fill the Great Pothole',
      desc: 'Costs the entire road budget. And the snow-globe industry. And possibly whatever lives down there.',
      mayor: 'If you fill it, where would my parking garage go? Vote no. Think of the garage.',
      letter: { who: 'Darlene Okafor', text: 'I have 4,000 pothole mugs in my storeroom. FOUR THOUSAND.' },
      split: [1, -1], yes: { NW: 2, NE: -2, SW: 1, SE: 1 }, favor: -2, promise: ['pothole', 1],
      headYes: ['THE GREAT POTHOLE IS NO MORE', 'Crews report finding three Buicks and “a raccoon in a hat”'],
      headNo: ['POTHOLE LIVES', 'Gift shop announces “Still Here” commemorative mug'] },
  ];
})(window.ST);
