// Furrow to Skyline — static game data.
// Everything here is plain data so the simulation can run headless (node) for balance tests.
window.FS = window.FS || {};
(function (FS) {
  'use strict';

  FS.N = 44;            // map is N x N tiles
  FS.TW = 64;           // iso tile width (world px)
  FS.TH = 32;           // iso tile height (world px)
  FS.START_YEAR = 1850;
  FS.MONTH_SEC = 2.4;   // real seconds per game month at 1x
  FS.SPEEDS = [0, 1, 3, 8];
  FS.MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ---------------------------------------------------------------- eras
  FS.ERAS = [
    { name: 'Homestead', minPop: 0, maxLevel: 1, icon: '🌾',
      blurb: 'A lone family farm on the river bend. Grow food, lay a dirt road, and make room for neighbors.' },
    { name: 'Village', minPop: 60, maxLevel: 2, icon: '🏡',
      blurb: 'Neighbors arrive. Shops and workshops open, and a Meeting Hall lets you convene the first Town Council.' },
    { name: 'Town', minPop: 350, maxLevel: 3, icon: '🏘️',
      blurb: 'Main Street fills with brick storefronts and rowhouses. Factories need power; a Town Hall can rise.' },
    { name: 'City', minPop: 1800, maxLevel: 4, icon: '🏙️',
      blurb: 'Apartment blocks, office buildings, rail, hospitals and universities. The council grows to five seats.' },
    { name: 'Metropolis', minPop: 7500, maxLevel: 5, icon: '🌆',
      blurb: 'Towers and a true skyline. Every block tells a century of history in its architecture.' },
  ];

  // ---------------------------------------------------------------- zones
  FS.ZONES = {
    R: { name: 'Residential', color: '#5cb85c', cap: [0, 6, 16, 48, 180, 600],
      names: ['Empty lot', 'Cottage', 'Family House', 'Rowhouses', 'Apartment Block', 'Residential Tower'] },
    C: { name: 'Commercial', color: '#4a90d9', cap: [0, 3, 8, 24, 90, 320],
      names: ['Empty lot', 'Market Stall', 'General Store', 'Main Street Shops', 'Office Building', 'Skyscraper'] },
    I: { name: 'Industrial', color: '#e0b030', cap: [0, 4, 10, 30, 100, 240],
      names: ['Empty lot', 'Workshop', 'Mill Works', 'Factory', 'Industrial Plant', 'Tech Campus'] },
  };
  FS.LV_REQ = [0, 0, 10, 24, 40, 56];     // land value needed to grow INTO level n
  FS.POWER_NEED = [0, 0, 0, 2, 6, 16];    // power units a zone building of level n draws
  FS.LEVEL_H = [0, 9, 14, 26, 52, 98];    // nominal building heights (world px)

  // ---------------------------------------------------------------- buildings
  // cat: toolbar category. era: unlock era. cost/upkeep in $. jobs/food/power/income per month.
  // radius+cov: service coverage. lv: land value bonus within radius. poll/pollR: pollution.
  FS.BUILD = {
    // tools-as-buildings
    road: { name: 'Road', icon: '🛣️', cat: 'road', era: 0, cost: 10, desc: 'Dirt track now, paved later. Zones need a road within 2 tiles to grow. Can bridge water ($50).' },
    zoneR: { name: 'Residential Zone', icon: '🏠', cat: 'zone', era: 0, cost: 5, zone: 'R', desc: 'Homes grow here by themselves: cottages first, towers one day.' },
    zoneC: { name: 'Commercial Zone', icon: '🏪', cat: 'zone', era: 1, cost: 5, zone: 'C', desc: 'Shops and, eventually, offices and skyscrapers.' },
    zoneI: { name: 'Industrial Zone', icon: '🏭', cat: 'zone', era: 1, cost: 5, zone: 'I', desc: 'Workshops, mills and factories. Jobs, with some pollution.' },

    // agriculture
    crop: { name: 'Wheat Field', icon: '🌾', cat: 'farm', era: 0, cost: 40, food: 6, jobs: 3, farm: true, crop: true,
      desc: 'Steady food. +30% next to a Barn.', draw: 'crop' },
    orchard: { name: 'Orchard', icon: '🍎', cat: 'farm', era: 0, cost: 70, food: 5, jobs: 3, farm: true, radius: 3, cov: 'fun', lv: 4,
      desc: 'Fruit trees: food plus a little beauty for neighbors.', draw: 'orchard' },
    pasture: { name: 'Pasture', icon: '🐑', cat: 'farm', era: 0, cost: 60, food: 3, income: 6, jobs: 2, farm: true,
      desc: 'Sheep and cattle: some food and $6/mo from wool and dairy.', draw: 'pasture' },
    barn: { name: 'Barn', icon: '🛖', cat: 'farm', era: 0, cost: 120, upkeep: 1, jobs: 2,
      desc: 'Boosts every adjacent farm by 30%.', draw: { kind: 'box', s: 0.78, h: 15, wall: '#b23a2e', roof: '#5a2a22', roofType: 'gable', trim: '#f2e6d0' } },
    market: { name: "Farmers' Market", icon: '🧺', cat: 'farm', era: 1, cost: 200, upkeep: 3, jobs: 4, radius: 5, cov: 'fun', lv: 6, foodPrice: 0.25,
      desc: 'Food surplus sells for 25% more. Neighbors love it.', draw: 'market' },
    mill: { name: 'Grain Mill', icon: '⚙️', cat: 'farm', era: 1, cost: 300, upkeep: 4, jobs: 6, cropBoost: 0.15, poll: 3, pollR: 2,
      desc: 'All wheat fields +15% (up to 2 mills).', draw: { kind: 'box', s: 0.7, h: 24, wall: '#c8b48a', roof: '#6b4f3a', roofType: 'hip', icon: '🌾' } },
    greenhouse: { name: 'Greenhouse', icon: '🪴', cat: 'farm', era: 2, cost: 350, upkeep: 4, food: 14, jobs: 4, farm: true, droughtProof: true,
      desc: 'Year-round produce, immune to drought.', draw: 'greenhouse' },
    cannery: { name: 'Food Processing Plant', icon: '🥫', cat: 'farm', era: 3, cost: 900, upkeep: 10, jobs: 40, foodPrice: 0.5, poll: 10, pollR: 3,
      desc: 'Food exports worth 50% more. Some pollution.', draw: { kind: 'box', s: 0.92, h: 26, wall: '#9aa3a8', roof: '#5e676c', roofType: 'flat', icon: '🥫', stack: true } },

    // civic
    well: { name: 'Village Well', icon: '🪣', cat: 'civic', era: 0, cost: 60, upkeep: 0.5, radius: 6, cov: 'water', lv: 3,
      desc: 'Clean water for nearby homes.', draw: 'well' },
    hall: { name: 'Meeting Hall', icon: '🔔', cat: 'civic', era: 1, cost: 400, upkeep: 4, jobs: 2, unique: true, radius: 7, lv: 8, center: 2,
      desc: 'Convenes the Town Council every season so you can enact policies, including how buildings look.', draw: 'chapel' },
    school: { name: 'Schoolhouse', icon: '🏫', cat: 'civic', era: 1, cost: 300, upkeep: 6, jobs: 4, radius: 8, cov: 'edu', lv: 6,
      desc: 'Education coverage. Educated towns grow taller.', draw: { kind: 'box', s: 0.8, h: 15, wall: '#b8463a', roof: '#4a3b35', roofType: 'gable', icon: '🏫', bell: true } },
    clinic: { name: 'Clinic', icon: '⚕️', cat: 'civic', era: 2, cost: 450, upkeep: 8, jobs: 6, radius: 8, cov: 'health', lv: 5,
      desc: 'Health coverage.', draw: { kind: 'box', s: 0.8, h: 16, wall: '#f2f2ee', roof: '#c23b3b', roofType: 'hip', icon: '⚕️' } },
    fire: { name: 'Fire House', icon: '🚒', cat: 'civic', era: 2, cost: 500, upkeep: 8, jobs: 6, radius: 9, cov: 'safety', lv: 3,
      desc: 'Safety coverage; protects against fires.', draw: { kind: 'box', s: 0.85, h: 18, wall: '#a83228', roof: '#3d2a26', roofType: 'cornice', icon: '🚒' } },
    police: { name: 'Police Station', icon: '🚓', cat: 'civic', era: 2, cost: 500, upkeep: 8, jobs: 8, radius: 9, cov: 'safety', lv: 4,
      desc: 'Safety coverage.', draw: { kind: 'box', s: 0.85, h: 18, wall: '#3c5a8a', roof: '#26344d', roofType: 'cornice', icon: '🚓' } },
    townhall: { name: 'Town Hall', icon: '🏛️', cat: 'civic', era: 2, cost: 1200, upkeep: 10, jobs: 12, unique: true, radius: 10, lv: 12, center: 3, capital: 0.25,
      desc: 'The new civic heart. Raises land value and earns extra political capital.', draw: 'townhall' },
    library: { name: 'Library', icon: '📚', cat: 'civic', era: 2, cost: 600, upkeep: 6, jobs: 4, radius: 8, cov: 'edu', lv: 8,
      desc: 'Education and prestige.', draw: { kind: 'box', s: 0.85, h: 18, wall: '#d9d2c0', roof: '#7a6a55', roofType: 'cornice', icon: '📚', columns: true } },
    hospital: { name: 'Hospital', icon: '🏥', cat: 'civic', era: 3, cost: 2000, upkeep: 25, jobs: 60, radius: 14, cov: 'health', lv: 8,
      desc: 'Wide health coverage.', draw: { kind: 'box', s: 0.92, h: 40, wall: '#eef0f2', roof: '#9aa5ad', roofType: 'flat', icon: '🏥' } },
    university: { name: 'University', icon: '🎓', cat: 'civic', era: 3, cost: 3000, upkeep: 30, jobs: 80, radius: 14, cov: 'edu', lv: 14,
      desc: 'Wide education coverage and big land value.', draw: { kind: 'box', s: 0.92, h: 30, wall: '#9c5a40', roof: '#3a2a25', roofType: 'cornice', icon: '🎓', tower: true } },
    station: { name: 'Rail Station', icon: '🚉', cat: 'civic', era: 3, cost: 1500, upkeep: 12, jobs: 20, radius: 10, lv: 12, comBoost: 0.12,
      desc: 'Commuters and visitors. +Commercial demand.', draw: { kind: 'box', s: 0.92, h: 20, wall: '#c9b48c', roof: '#56606a', roofType: 'hip', icon: '🚉' } },
    stadium: { name: 'Stadium', icon: '🏟️', cat: 'civic', era: 4, cost: 5000, upkeep: 40, jobs: 50, radius: 16, cov: 'fun', lv: 10,
      desc: 'Game day! Huge entertainment coverage.', draw: 'stadium' },
    beacon: { name: 'Harbor Beacon', icon: '🗼', cat: 'civic', era: 4, cost: 8000, upkeep: 20, unique: true, radius: 20, lv: 20, happy: 5,
      desc: 'A landmark tower that defines the skyline. +5 happiness citywide.', draw: 'beacon' },

    // utilities
    windmill: { name: 'Windmill', icon: '🌬️', cat: 'util', era: 1, cost: 150, upkeep: 1, power: 8,
      desc: '8 units of power. Taller buildings (level 3+) need power.', draw: 'windmill' },
    watertower: { name: 'Water Tower', icon: '🚰', cat: 'util', era: 2, cost: 300, upkeep: 3, radius: 11, cov: 'water', lv: 2,
      desc: 'Wide water coverage.', draw: 'watertower' },
    powerplant: { name: 'Coal Power Plant', icon: '🏭', cat: 'util', era: 2, cost: 1500, upkeep: 20, jobs: 20, power: 120, poll: 22, pollR: 5,
      desc: '120 power. Smoky.', draw: { kind: 'box', s: 0.95, h: 22, wall: '#7d6f66', roof: '#4a423d', roofType: 'flat', stack: 2 } },
    solar: { name: 'Solar Farm', icon: '☀️', cat: 'util', era: 3, cost: 2500, upkeep: 10, jobs: 4, power: 80,
      desc: '80 clean power.', draw: 'solar' },

    // nature
    tree: { name: 'Tree', icon: '🌳', cat: 'nature', era: 0, cost: 5, radius: 1, lv: 2, desc: 'Shade and a little land value.', draw: 'tree' },
    park: { name: 'Village Green', icon: '⛲', cat: 'nature', era: 0, cost: 80, upkeep: 1, radius: 5, cov: 'fun', lv: 8,
      desc: 'Lawn, paths and benches. Raises land value.', draw: 'park' },
    plaza: { name: 'Plaza', icon: '🏛', cat: 'nature', era: 2, cost: 250, upkeep: 3, radius: 6, cov: 'fun', lv: 10,
      desc: 'Paved square with a fountain.', draw: 'plaza' },
    bigpark: { name: 'Grand Park', icon: '🌲', cat: 'nature', era: 3, cost: 1500, upkeep: 15, radius: 12, cov: 'fun', lv: 18,
      desc: 'A great urban park. Huge land value boost.', draw: 'bigpark' },

    // special (not buildable)
    farmhouse: { name: 'Family Farmhouse', icon: '🏡', cat: null, era: 0, residents: 6, radius: 4, cov: 'water', center: 1, jobs: 2,
      desc: 'Where it all began. Your family home.', draw: 'farmhouse' },
  };

  FS.CATS = [
    { id: 'inspect', icon: '👆', name: 'Look' },
    { id: 'road', icon: '🛣️', name: 'Roads', items: ['road'] },
    { id: 'farm', icon: '🌾', name: 'Farms', items: ['crop', 'orchard', 'pasture', 'barn', 'market', 'mill', 'greenhouse', 'cannery'] },
    { id: 'zone', icon: '🏘️', name: 'Zones', items: ['zoneR', 'zoneC', 'zoneI'] },
    { id: 'civic', icon: '🏛️', name: 'Civic', items: ['well', 'hall', 'school', 'clinic', 'fire', 'police', 'townhall', 'library', 'hospital', 'university', 'station', 'stadium', 'beacon'] },
    { id: 'util', icon: '⚡', name: 'Utility', items: ['windmill', 'watertower', 'powerplant', 'solar'] },
    { id: 'nature', icon: '🌳', name: 'Nature', items: ['tree', 'park', 'plaza', 'bigpark'] },
    { id: 'bulldoze', icon: '🧨', name: 'Clear' },
  ];

  // ---------------------------------------------------------------- architecture
  // A building keeps the style that was law when it was built or last renovated,
  // so the city accumulates layers of history block by block.
  FS.STYLES = {
    vernacular: { name: 'Vernacular Timber', walls: ['#efe2c2', '#e2cfa5', '#dccbb0', '#f3ead6', '#cfd8d0'], roofs: ['#8a4b38', '#6a5a48', '#55707d', '#7d3b2f'],
      trim: '#7a5a3a', win: '#45525e', tall: 'cornice', tallWalls: ['#cdbfa6', '#bfb39b', '#d6cbb5'] },
    brownstone: { name: 'Brownstone Heritage', walls: ['#8c4b36', '#7b3f2d', '#9a5a40', '#6e3a2b'], roofs: ['#3a2a25', '#4a332b'],
      trim: '#e8dcc4', win: '#f1e5bf', tall: 'cornice' },
    deco: { name: 'Art Deco Revival', walls: ['#efe4c6', '#e8d7a8', '#ddd2bb', '#f2e8cf'], roofs: ['#d8ccab', '#cbbd98'],
      trim: '#c9a227', win: '#33414f', tall: 'setback' },
    modern: { name: 'Glass & Steel', walls: ['#7fb2df', '#5d93c8', '#9cc9d9', '#6aa0c0', '#8fa9b8', '#5fa6a0'], roofs: ['#5a6a78', '#6f7d88', '#4a5866'],
      trim: '#dbe6ee', win: '#d6ecfa', tall: 'glass', glass: true },
    garden: { name: 'Garden City', walls: ['#e6e9dc', '#d8e2cf', '#efe9da', '#dfe8e0'], roofs: ['#5f9e4a', '#6aa84f'],
      trim: '#6b8f5a', win: '#405a4c', tall: 'green' },
  };

  // ---------------------------------------------------------------- policies
  // tags drive council member stances. fx are read by the simulation.
  FS.POLICIES = [
    { id: 'style_vernacular', name: 'Vernacular Timber Code', group: 'style', style: 'vernacular', era: 0, tags: ['farm', 'heritage'],
      desc: 'Clapboard, gables and porches. The look of a farming settlement.', fx: {} },
    { id: 'style_brownstone', name: 'Brownstone Heritage Code', group: 'style', style: 'brownstone', era: 1, tags: ['heritage', 'growth'],
      desc: 'New and renovated buildings use brownstone and brick with stoops and cornices. +Residential land value.', fx: { lvR: 6 } },
    { id: 'style_garden', name: 'Garden City Code', group: 'style', style: 'garden', era: 2, tags: ['green', 'culture'], cost: 20,
      desc: 'Pale stucco, planted roofs and courtyards. +3 happiness, $20/mo.', fx: { happy: 3 } },
    { id: 'style_deco', name: 'Art Deco Revival Code', group: 'style', style: 'deco', era: 2, tags: ['business', 'culture'],
      desc: 'Limestone, brass, setbacks and spires. +Commercial demand.', fx: { comD: 0.12 } },
    { id: 'style_modern', name: 'Glass & Steel Code', group: 'style', style: 'modern', era: 3, tags: ['business', 'modern', 'growth'],
      desc: 'Curtain walls and clean lines. Offices and towers grow faster; heritage fans grumble.', fx: { growth: 0.25, happy: -1 } },

    { id: 'farm_subsidy', name: 'Farm Subsidy', era: 1, tags: ['farm', 'services'], cost: 40,
      desc: 'All farms produce +25% food. $40/mo.', fx: { food: 0.25 } },
    { id: 'greenbelt', name: 'Farmland Protection Act', era: 1, tags: ['farm', 'green', 'limits'],
      desc: 'Farms are protected from developers. +10% food, slightly lower housing demand.', fx: { food: 0.1, resD: -0.05, protectFarms: true } },
    { id: 'market_day', name: 'Weekly Market Day', era: 1, tags: ['business', 'farm', 'culture'], cost: 15,
      desc: 'Food sells for 15% more; +Commercial demand. $15/mo.', fx: { foodPrice: 0.15, comD: 0.08 } },
    { id: 'watch', name: 'Neighborhood Watch', era: 1, tags: ['services', 'safety'], cost: 10,
      desc: 'Volunteers count as partial safety coverage everywhere. $10/mo.', fx: { safetyBase: 0.35 } },
    { id: 'school_lunch', name: 'Free School Lunches', era: 1, tags: ['services', 'farm'], cost: 30,
      desc: '+3 happiness; farms sell more locally (+5% food price). $30/mo.', fx: { happy: 3, foodPrice: 0.05 } },
    { id: 'street_trees', name: 'Street Tree Program', era: 1, tags: ['green', 'culture'], cost: 25,
      desc: '+3 land value everywhere, +2 happiness. $25/mo.', fx: { lvAll: 3, happy: 2 } },
    { id: 'industry_incentive', name: 'Industrial Tax Break', era: 1, tags: ['industry', 'jobs', 'business'], cost: 35,
      desc: '+Industrial demand. More smoke. $35/mo.', fx: { indD: 0.2, pollMul: 1.2 } },
    { id: 'emissions', name: 'Clean Air Standards', era: 2, tags: ['green', 'limits'],
      desc: 'Halves industrial pollution but lowers industrial demand.', fx: { pollMul: 0.5, indD: -0.12 } },
    { id: 'height_limit', name: 'Skyline Height Limit', era: 2, tags: ['heritage', 'limits'],
      desc: 'Nothing taller than rowhouses (level 3). +4 happiness; slows growth.', fx: { maxLevel: 3, happy: 4 } },
    { id: 'upzone', name: 'Upzoning Reform', era: 3, tags: ['growth', 'business', 'modern'],
      desc: 'Lowers the land value needed to build taller by 8.', fx: { lvReq: -8, happy: -1 } },
    { id: 'transit', name: 'Public Transit Levy', era: 3, tags: ['services', 'green', 'growth'], cost: 80,
      desc: '+5 land value everywhere, +3 happiness. $80/mo.', fx: { lvAll: 5, happy: 3 } },
    { id: 'night_life', name: 'Late-Night Licenses', era: 2, tags: ['business', 'culture'],
      desc: '+Commercial demand, +1 happiness; a little less safe.', fx: { comD: 0.1, happy: 1, safetyBase: -0.1 } },
    { id: 'arts_fund', name: 'Arts & Murals Fund', era: 2, tags: ['culture', 'heritage'], cost: 30,
      desc: '+2 happiness, +2 land value. $30/mo.', fx: { happy: 2, lvAll: 2 } },
  ];
  FS.POLICY = {};
  FS.POLICIES.forEach(function (p) { FS.POLICY[p.id] = p; });

  // ---------------------------------------------------------------- people
  FS.COUNCIL = [
    { id: 'ada', name: 'Ada Whitcombe', faction: 'Farmers’ Grange', color: '#7cb342', seatEra: 1,
      likes: { farm: 2, heritage: 1, services: 0.5 }, dislikes: { industry: 1, modern: 1.5, growth: 0.5 } },
    { id: 'marcus', name: 'Marcus Bell', faction: 'Merchants’ Chamber', color: '#f4a300', seatEra: 1,
      likes: { business: 2, growth: 1.5, modern: 1 }, dislikes: { limits: 2, cost: 0.6 } },
    { id: 'june', name: 'June Okonkwo', faction: 'Heritage Society', color: '#8e44ad', seatEra: 1,
      likes: { heritage: 2, culture: 1.5 }, dislikes: { modern: 2, industry: 0.5 } },
    { id: 'sam', name: 'Sam Reyes', faction: 'Workers’ Union', color: '#e53935', seatEra: 2,
      likes: { industry: 1.5, jobs: 2, services: 1, safety: 1 }, dislikes: { limits: 1 } },
    { id: 'lila', name: 'Lila Fernsby', faction: 'Green Futures', color: '#26a69a', seatEra: 3,
      likes: { green: 2, services: 1, culture: 0.5 }, dislikes: { industry: 2, growth: 0.5 } },
  ];

  FS.ADVISORS = [
    { id: 'ag', name: 'Mabel Thornberry', title: 'Agriculture', color: '#7cb342', icon: '🌾' },
    { id: 'tr', name: 'Desmond Achebe', title: 'Treasury', color: '#e0a800', icon: '💰' },
    { id: 'pl', name: 'Priya Raman', title: 'Planning', color: '#4a90d9', icon: '📐' },
    { id: 'sf', name: 'Rosa Delgado', title: 'Public Safety', color: '#e53935', icon: '🛡️' },
    { id: 'cu', name: 'Theo Lindqvist', title: 'Culture & Heritage', color: '#8e44ad', icon: '🎭' },
  ];

  FS.GOVERNOR = { name: 'Governor Eleanor Castellane', short: 'Gov. Castellane', icon: '🎖️' };

  FS.FIRST = ['Ada', 'Abel', 'Clara', 'Eli', 'Hattie', 'Silas', 'Nell', 'Otis', 'Rosa', 'Wen', 'Amara', 'Luis', 'Ivy', 'Tobias',
    'Mei', 'Jonah', 'Priya', 'Kofi', 'Greta', 'Ezra', 'Lena', 'Malik', 'June', 'Felix', 'Noor', 'Theo', 'Ruth', 'Dante', 'Yara', 'Hugo'];
  FS.LAST = ['Hale', 'Moreno', 'Okafor', 'Lindgren', 'Baptiste', 'Sato', 'Kowalski', 'Byrne', 'Abernathy', 'Nguyen', 'Castillo',
    'Whitlock', 'Haddad', 'Fischer', 'Mensah', 'Rossi', 'Ostrowski', 'Calloway', 'Dubois', 'Iyer', 'Pemberton', 'Vargas'];
  FS.JOBS = {
    0: ['farmhand', 'blacksmith', 'miller', 'carpenter', 'midwife', 'shepherd'],
    1: ['shopkeeper', 'teacher', 'baker', 'cooper', 'seamstress', 'wheelwright'],
    2: ['clerk', 'mill worker', 'printer', 'nurse', 'conductor', 'machinist'],
    3: ['accountant', 'engineer', 'dock worker', 'reporter', 'doctor', 'architect'],
    4: ['software developer', 'barista', 'designer', 'trader', 'paramedic', 'chef'],
  };
})(window.FS);
