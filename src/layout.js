// layout.js — the authored map. Everything here is data; world.js turns it
// into meshes. Coordinates are on the 400×400 torus, +z is "south".
//
// Big picture (matches the approved ASCII map):
//   z 0..115    Pine Highlands | Hot-Spring Village | Observatory Hill
//   z 115..215  Terraced Farms |      meadow        | Sandstone Souk
//   z 215..300  The Marshes    |  HARBOR TOWN (hub) | Lantern Row → Neon Junction
//   z 305..345  the bay (water band, wraps east-west; ferry circles here)
//   z 355..400  south shore — coastal road, then the world wraps to z=0.

export const WATER = { z0: 305, z1: 345 };          // the bay band
export const COAST_Z = 360;                          // coastal road line

// ── Roads: axis-aligned strips, all full loops across the wrap ──
export const ROADS = [
  { axis: 'z', at: 65,  w: 4 },     // west spine: pine → farms → marshes
  { axis: 'z', at: 200, w: 5 },     // center spine: springs → meadow → harbor → pier
  { axis: 'z', at: 330, w: 4 },     // east spine: observatory → souk → neon
  { axis: 'x', at: 60,  w: 4 },     // north road
  { axis: 'x', at: 165, w: 4 },     // middle road
  { axis: 'x', at: 262, w: 5 },     // main street (harbor high street → Lantern Row → neon)
  { axis: 'x', at: COAST_Z, w: 4 }, // coastal road
];

// bridges where the three z-spines cross the bay
export const BRIDGES = [
  { x: 65,  z0: WATER.z0 - 4, z1: WATER.z1 + 4, w: 5 },
  { x: 200, z0: WATER.z0 - 4, z1: WATER.z1 + 4, w: 6 },
  { x: 330, z0: WATER.z0 - 4, z1: WATER.z1 + 4, w: 5 },
];

// ── Buildings: { type, x, z, rot, zone, w?, d?, h?, name? } ──
// types: house (walls+roof), tower, mill, stall, postoffice, bathhouse,
// observatory, shack, arcade (shuttered row), pagoda
export const BUILDINGS = [
  // Harbor Town — cream walls, rust roofs, huddled around the post office
  { type:'postoffice', x:196, z:270, rot: 0,        zone:'harbor', name:'Waypost Post Office' },
  { type:'house', x:182, z:252, rot: 0.3,  zone:'harbor', h:7 },
  { type:'house', x:212, z:250, rot:-0.2,  zone:'harbor', h:9 },
  { type:'house', x:222, z:262, rot: 1.6,  zone:'harbor', h:7 },
  { type:'house', x:176, z:268, rot: 1.5,  zone:'harbor', h:8, name:"Saffron's Inn" },
  { type:'house', x:188, z:238, rot: 0.1,  zone:'harbor', h:6 },
  { type:'house', x:210, z:236, rot:-0.4,  zone:'harbor', h:7 },
  { type:'tower', x:230, z:278, rot: 0,    zone:'harbor', name:'Harbor Light' },

  // Terraced Farms
  { type:'house', x:56,  z:152, rot: 0.2,  zone:'farms', h:6, name:"Pello's Farmhouse" },
  { type:'mill',  x:44,  z:172, rot: 0.9,  zone:'farms' },
  { type:'mill',  x:86,  z:140, rot: 2.1,  zone:'farms' },
  { type:'mill',  x:78,  z:188, rot: 4.0,  zone:'farms' },
  { type:'shack', x:92,  z:166, rot: 1.4,  zone:'farms' },

  // Pine Highlands
  { type:'shack', x:58,  z:52,  rot: 0.4,  zone:'pine', name:"Bram's Cabin" },
  { type:'shack', x:84,  z:74,  rot: 2.2,  zone:'pine' },
  { type:'tower', x:40,  z:80,  rot: 0,    zone:'pine', name:'Fire Watch' },

  // Hot-Spring Village
  { type:'bathhouse', x:206, z:48, rot: 0, zone:'spring', name:'The Steaming Kettle' },
  { type:'pagoda', x:186, z:60, rot: 0.2,  zone:'spring', name:"Yuzu's Glassworks" },
  { type:'pagoda', x:220, z:66, rot:-0.5,  zone:'spring' },
  { type:'pagoda', x:196, z:76, rot: 1.1,  zone:'spring' },

  // Sandstone Souk
  { type:'house', x:318, z:152, rot: 0.1,  zone:'souk', h:8, flat:true },
  { type:'house', x:344, z:158, rot:-0.3,  zone:'souk', h:6, flat:true, name:"Basira's Clockshop" },
  { type:'house', x:322, z:180, rot: 1.5,  zone:'souk', h:7, flat:true },
  { type:'house', x:346, z:178, rot: 0.8,  zone:'souk', h:9, flat:true },
  { type:'stall', x:330, z:166, rot: 0.0,  zone:'souk' },
  { type:'stall', x:336, z:172, rot: 1.2,  zone:'souk' },
  { type:'stall', x:324, z:160, rot:-0.9,  zone:'souk' },
  { type:'stall', x:338, z:158, rot: 2.3,  zone:'souk' },

  // Lantern Row — the dim transitional street (shuttered arcades)
  { type:'arcade', x:252, z:256, rot: 0,   zone:'dimstreet' },
  { type:'arcade', x:268, z:256, rot: 0,   zone:'dimstreet' },
  { type:'arcade', x:284, z:256, rot: 0,   zone:'dimstreet' },
  { type:'arcade', x:260, z:270, rot: Math.PI, zone:'dimstreet' },
  { type:'arcade', x:276, z:270, rot: Math.PI, zone:'dimstreet' },

  // Neon Junction
  { type:'house', x:322, z:252, rot: 0,    zone:'neon', h:13, flat:true, neon:true },
  { type:'house', x:340, z:254, rot: 0,    zone:'neon', h:16, flat:true, neon:true },
  { type:'house', x:322, z:276, rot: 0,    zone:'neon', h:11, flat:true, neon:true, name:"Nikko's Noodles" },
  { type:'house', x:340, z:276, rot: 0,    zone:'neon', h:14, flat:true, neon:true },
  { type:'house', x:352, z:264, rot: 0,    zone:'neon', h:12, flat:true, neon:true },

  // The Marshes
  { type:'shack', x:72,  z:274, rot: 0.6,  zone:'marsh', name:"Tam's Boathouse", stilts:true },
  { type:'shack', x:52,  z:258, rot: 2.0,  zone:'marsh', stilts:true },
  { type:'shack', x:88,  z:252, rot: 4.2,  zone:'marsh', stilts:true },

  // Observatory Hill
  { type:'observatory', x:332, z:52, rot: 0, zone:'observatory', name:'The Great Eye' },
  { type:'house', x:314, z:70, rot: 0.4,   zone:'observatory', h:6, name:"Vesper's Cottage" },
];

// ── Authored one-off props: { type, x, z, rot, zone } ──
// types: sign, dock, bench, lamppost, torii, laundry, antenna, neonsign,
// spring (steaming pool), well, cratepile, telescope-small
export const PROPS = [
  { type:'sign', x:204, z:258, rot: 0,  zone:'harbor',
    text:'HOT SPRINGS — NORTH ↑  (a long, scenic walk)' },   // the misleading sign
  { type:'sign', x:204, z:286, rot: Math.PI, zone:'harbor',
    text:'THE BAY — mind the gulls' },
  { type:'sign', x:330, z:212, rot: 0,  zone:'souk',  text:'SOUK ← → NEON JUNCTION' },
  { type:'sign', x:65,  z:110, rot: 0,  zone:'pine',  text:'HIGHLANDS ↑ · FARMS ↓' },
  { type:'sign', x:296, z:262, rot: 0,  zone:'dimstreet', text:'LANTERN ROW — lamps lit at dusk' },
  { type:'dock', x:200, z:300, rot: 0,  zone:'harbor' },
  { type:'dock', x:70,  z:300, rot: 0.2, zone:'marsh' },
  { type:'laundry', x:198, z:246, rot: 0.4, zone:'harbor' },
  { type:'laundry', x:216, z:256, rot:-0.8, zone:'harbor' },
  { type:'well',  x:200, z:262, rot: 0, zone:'harbor' },
  { type:'torii', x:200, z:90,  rot: 0, zone:'spring' },
  { type:'spring', x:212, z:40, rot: 0, zone:'spring' },
  { type:'spring', x:192, z:44, rot: 0, zone:'spring' },
  { type:'antenna', x:322, z:252, rot: 0, zone:'neon' },
  { type:'antenna', x:340, z:254, rot: 0.5, zone:'neon' },
  { type:'antenna', x:352, z:264, rot: 1.1, zone:'neon' },
  { type:'cratepile', x:190, z:280, rot: 0.7, zone:'harbor' },
  { type:'cratepile', x:334, z:162, rot: 1.9, zone:'souk' },
  { type:'bench', x:330, z:66, rot: 1.5, zone:'observatory' },
  { type:'bench', x:194, z:266, rot: 0, zone:'harbor' },
];

// ── Instanced scatter: deterministic (seeded) placement inside a rect.
// This is authored density data, not runtime procgen — same result each boot.
export const SCATTER = [
  { type:'pinetree',  x0: 10, x1:120, z0:  8, z1:110, n:90, seed: 11, avoidRoads:true },
  { type:'pinetree',  x0:130, x1:165, z0: 10, z1: 60, n:18, seed: 12, avoidRoads:true },
  { type:'roundtree', x0:150, x1:250, z0:220, z1:295, n:22, seed: 21, avoidRoads:true },
  { type:'roundtree', x0: 20, x1:120, z0:120, z1:205, n:16, seed: 22, avoidRoads:true },
  { type:'fieldrow',  x0: 24, x1:108, z0:128, z1:200, n:26, seed: 31, avoidRoads:true },
  { type:'palm',      x0:290, x1:375, z0:130, z1:205, n:20, seed: 41, avoidRoads:true },
  { type:'reed',      x0: 15, x1:120, z0:225, z1:300, n:120, seed: 51, avoidRoads:true },
  { type:'cattail',   x0: 15, x1:120, z0:240, z1:302, n:50, seed: 52, avoidRoads:true },
  { type:'heather',   x0:290, x1:375, z0: 15, z1:100, n:60, seed: 61, avoidRoads:true },
  { type:'lantern',   x0:170, x1:235, z0: 30, z1: 88, n:14, seed: 71, avoidRoads:false },
  { type:'lantern',   x0:240, x1:300, z0:252, z1:274, n:10, seed: 72, avoidRoads:false },
  { type:'rock',      x0:  0, x1:400, z0:  0, z1:300, n:40, seed: 81, avoidRoads:true },
  { type:'lamppost',  x0:170, x1:235, z0:230, z1:295, n:8,  seed: 91, avoidRoads:false },
  { type:'grasstuft', x0:  0, x1:400, z0:  0, z1:300, n:220, seed:101, avoidRoads:true },
  { type:'roundtree', x0:150, x1:260, z0:352, z1:396, n:14, seed:111, avoidRoads:true },
];

// ── Ferry: circles the whole bay band east-west (crosses the wrap — visibly) ──
export const FERRY = { z: 325, speed: 9, y: 0.0 };

// ── NPCs. Schedules are waypoint lists with a time-of-day window [t0,t1)
// (tod 0..1: 0=midnight, .25=morning, .5=noon, .75=dusk). Story NPCs get full
// home/work/wander loops; the other six get two-point loops (approved). ──
export const NPCS = [
  { key:'odile', name:'Odile', role:'Postmaster', zone:'harbor', story:true,
    color:'#C1502E', hat:'cap',
    sched: [
      { t0:.22, t1:.72, x:196, z:264 },              // at the post office
      { t0:.72, t1:.88, x:200, z:296 },              // evening walk to the pier
      { t0:.88, t1:.22, x:182, z:252 },              // home
    ] },
  { key:'basira', name:'Basira', role:'Clockmaker', zone:'souk', story:true,
    color:'#33656B', hat:'wrap',
    sched: [
      { t0:.20, t1:.55, x:344, z:162 },              // clockshop
      { t0:.55, t1:.70, x:330, z:168 },              // haggling at the stalls
      { t0:.70, t1:.20, x:346, z:178 },              // home
    ] },
  { key:'yuzu', name:'Yuzu', role:'Glassblower', zone:'spring', story:true,
    color:'#B03A2E', hat:'none',
    sched: [
      { t0:.25, t1:.60, x:186, z:64 },               // glassworks
      { t0:.60, t1:.80, x:206, z:44 },               // soaking at the bathhouse
      { t0:.80, t1:.25, x:196, z:76 },               // home
    ] },
  { key:'tam', name:'Tam', role:'Boatwright', zone:'marsh', story:true,
    color:'#5C6B4A', hat:'brim',
    sched: [
      { t0:.20, t1:.65, x:72, z:278 },               // boathouse
      { t0:.65, t1:.85, x:70, z:298 },               // the dock at dusk
      { t0:.85, t1:.20, x:72, z:274 },               // home (sleeps at the shop)
    ] },
  { key:'vesper', name:'Vesper', role:'Astronomer', zone:'observatory', story:true,
    color:'#5B4B8A', hat:'none',
    sched: [
      { t0:.30, t1:.70, x:314, z:74 },               // cottage (asleep by day, mostly)
      { t0:.70, t1:.30, x:332, z:56 },               // at the Great Eye all night
    ] },
  // Marin is special — he lives on the ferry until the finale. No schedule.
  { key:'marin', name:'the Ferryman', role:'—', zone:'harbor', story:true,
    color:'#5B7A8C', hat:'brim', onFerry:true, sched:[] },

  // the simpler six — two-point loops
  { key:'pello', name:'Pello', role:'Farmer', zone:'farms',
    color:'#D9A441', hat:'brim',
    sched: [ { t0:.20, t1:.75, x:66, z:170 }, { t0:.75, t1:.20, x:56, z:156 } ] },
  { key:'nikko', name:'Nikko', role:'Noodle vendor', zone:'neon',
    color:'#F25C9B', hat:'band',
    sched: [ { t0:.55, t1:.15, x:326, z:272 }, { t0:.15, t1:.55, x:340, z:276 } ] },
  { key:'bram', name:'Bram', role:'Forester', zone:'pine',
    color:'#3E6B52', hat:'cap',
    sched: [ { t0:.22, t1:.70, x:80, z:70 }, { t0:.70, t1:.22, x:60, z:56 } ] },
  { key:'poppy', name:'Poppy', role:'Kid', zone:'harbor',
    color:'#E8B04B', hat:'none', small:true,
    sched: [ { t0:.25, t1:.70, x:208, z:252 }, { t0:.70, t1:.25, x:212, z:248 } ] },
  { key:'saffron', name:'Saffron', role:'Innkeeper', zone:'harbor',
    color:'#8A3324', hat:'wrap',
    sched: [ { t0:.20, t1:.80, x:178, z:264 }, { t0:.80, t1:.20, x:176, z:270 } ] },
  { key:'wick', name:'Wick', role:'Lamplighter', zone:'dimstreet',
    color:'#B08A4E', hat:'cap',
    sched: [ { t0:.60, t1:.95, x:262, z:262 }, { t0:.95, t1:.60, x:286, z:266 } ] },
];

// spots the player interacts with that aren't NPCs
export const BOARD = { x: 199, z: 268 };          // job board outside the post office
export const SPAWN = { x: 200, z: 274 };          // outside the post office door

// simple circular colliders (filled from buildings at boot + these extras)
export const EXTRA_COLLIDERS = [
  { x: 332, z: 52, r: 7 },   // observatory dome
];
