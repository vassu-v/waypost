// story.js — every word anyone says, plus the mystery-parcel thread.
// Old Marin, the orrery, and the telescope that finally looks down.

export const GREETINGS = {
  odile: [
    "Morning, courier. The world's small but the mail isn't.",
    "You're standing straighter these days. Routes will do that.",
    "A letter delivered late is still a letter. But do hurry.",
  ],
  basira: [
    "Shhh — listen. Forty-one clocks, and not one agrees with another.",
    "Time isn't money, courier. Time is time. Money is money. I sell time.",
    "You wind a clock gently or not at all. Same with people.",
  ],
  yuzu: [
    "Careful where you stand, the glass remembers footprints.",
    "I blow glass so I can see the steam make shapes. The cups are a side effect.",
    "Soak first, talk after. That's the village rule.",
  ],
  tam: [
    "A boat's just a letter you send across water. Slower. Wetter.",
    "The marsh keeps every secret except the fireflies.",
    "Mind the herons — they judge.",
  ],
  vesper: [
    "You walk the loop; I watch it. Between us we almost understand it.",
    "Every night the sky forgives me for looking away all day.",
    "Stars don't wander. We do. It's a fair arrangement.",
  ],
  marin: [ "…", "……", "… (he keeps his eyes on the water. His satchel — it has the same trim as yours.)" ],
  pello: [
    "Wind's good today. Seeds'll be halfway to the souk by dusk.",
    "You can't rush barley and you can't slow a courier. Balance.",
  ],
  nikko: [
    "Broth's been going since yesterday. Or last year. It's a lineage.",
    "Neon's just lanterns that learned to shout.",
  ],
  bram: [
    "Every pine up here I've met personally.",
    "Woodsmoke means somebody's home. Somewhere, somebody always is.",
  ],
  poppy: [
    "Did you come the LONG way or the SHORT way? There's always a shorter way!",
    "When I grow up I'm going to deliver something to EVERYONE.",
  ],
  saffron: [
    "Soup's on for anyone who's walked more than a mile. So — always, for you.",
    "The inn's never full. The world's too small for strangers.",
  ],
  wick: [
    "I light them one by one. They only LOOK like they wake on their own.",
    "Lantern Row's shy, not dead. Dusk brings her round.",
  ],
};

// The tutorial: the postmaster's first three jobs (the third teaches the wrap)
export const TUTORIAL_JOBS = [
  {
    id: 'tut1', giver: 'odile', recipient: 'poppy', kind: 'letter',
    title: "Poppy's postcard",
    desc: "A postcard for Poppy — she's just up the street. Walk with WASD, run with Shift, press E to deliver.",
    dialog: "Welcome to the route, courier. Start small: this postcard goes to Poppy, the girl by the tall blue house. Off you go.",
    reward: 2,
  },
  {
    id: 'tut2', giver: 'odile', recipient: 'pello', kind: 'parcel',
    title: 'Seed ledger for Pello',
    fetchFrom: 'saffron',
    desc: "Collect the seed ledger from Saffron at the inn, then carry it west to Pello's farm. Follow the compass ribbon at the top.",
    dialog: "Saffron's holding Pello's seed ledger. Fetch it from the inn, then take the west road out to the farms. The compass ribbon up top always points to your job — the short way.",
    reward: 4,
  },
  {
    id: 'tut3', giver: 'odile', recipient: 'yuzu', kind: 'parcel',
    title: 'Glass sand for Yuzu',
    desc: "Take this sack of glass sand to Yuzu in the Hot-Spring Village. The signpost says NORTH… but trust your compass.",
    dialog: "Sand for the glassblower, up in the spring village. Now — the signs say the springs are north, and the signs aren't wrong, exactly. They're just old. Trust your compass, dear. The world is smaller than it looks.",
    reward: 6,
    wrapLesson: true,
  },
];

// ── the mystery parcels: Old Marin's unfinished orrery ──
// Unlocked one at a time by total deliveries; always offered by Odile.
export const STORY_PARCELS = [
  {
    stage: 0, minDeliveries: 4, recipient: 'basira',
    title: 'A faded parcel: "B."',
    item: 'a small brass gear, wrapped in wax paper',
    offer: "There's a drawer in this office I haven't opened in years. The old courier — Marin — left it full of parcels he never finished delivering. I'd like you to quietly finish his route. This first one just says \"B.\" — that'll be Basira.",
    memory: "Basira turns the gear over twice. \"Marin cut this on my own lathe, the winter the clocks froze. He was building something round. Wouldn't say what. He hummed while he worked — badly.\"",
  },
  {
    stage: 1, minDeliveries: 7, recipient: 'yuzu',
    title: 'A faded parcel: "for the glass one"',
    item: 'a lens, cloudy at the rim, perfect at the center',
    offer: "Another of Marin's parcels. \"For the glass one.\" Yuzu, surely. Careful with it — it rattles like regret.",
    memory: "Yuzu holds the lens to the steam. \"I taught him to grind glass and he swore at it for a month. Then one day — this. He said it had to be perfect in the middle, because someone would look through the middle at something far away.\"",
  },
  {
    stage: 2, minDeliveries: 10, recipient: 'tam',
    title: 'A faded parcel, smelling of cedar',
    item: 'a small counterweight of dense dark wood',
    offer: "This one's heavy for its size. Cedar. That's Tam's timber if I know anything.",
    memory: "Tam weighs it in one palm. \"Balance wood. For something that spins true. Marin sat right there and told me the world only feels big because we keep stopping. He stopped, in the end. Funny.\"",
  },
  {
    stage: 3, minDeliveries: 13, recipient: 'vesper',
    title: 'A faded parcel: "V. — sorry"',
    item: 'a ring of engraved brass — a horizon, tiny boats, a post office',
    offer: "…This one says \"V. — sorry.\" Vesper. His sister, courier. They quarrelled, years back, about whether this little world was worth staying in. He said yes so quietly she heard no. Take it gently.",
    memory: "Vesper doesn't speak for a long moment. \"It's the base ring of an orrery. A machine of the world. He was building me the world… I told him it was small. He was trying to show me it was complete.\"",
  },
  {
    stage: 4, minDeliveries: 16, recipient: 'vesper',
    title: 'The orrery pieces, assembled',
    item: "every piece of Marin's orrery, boxed and cushioned",
    offer: "Basira's cleaned the gear, Yuzu polished the lens, Tam trued the weight. Take the whole works to Vesper on the hill. Let her build what he started.",
    memory: "Vesper assembles it by lamplight, hands steady, eyes not. \"It turns. It — of course it turns. The fool. One piece missing: the sun. A little brass sun, right at the heart. Without it, nothing to circle.\"",
  },
  {
    stage: 5, minDeliveries: 18, recipient: 'marin',
    title: 'A parcel with no address at all',
    item: "a letter, sealed with observatory-violet wax, and a small brass sun",
    offer: "The last one. No address. But the ledger's last line reads: \"couldn't face the water.\" Courier… the ferry. The one that circles and circles and never docks. Take it to the ferryman. And — be kind. It's a reply he never dared collect: hers.",
    memory: "The ferryman reads it at the rail. The engine idles. When he turns around he is nobody but Old Marin, and he is crying, and he is laughing, and the ferry — for the first time in years — changes course. \"She says the world was never too small,\" he manages. \"She says it fit us exactly. Come to the hill at dusk, courier. Everyone. Please.\"",
  },
];

// stage 6: the finale gathering at the Great Eye
export const FINALE = {
  stage: 6,
  location: { x: 332, z: 62, r: 16 },
  lines: [
    ["Vesper", "The orrery has its sun back. Marin — you absolute gear-brained fool. You built me the world."],
    ["Marin", "You said it was small. I wanted you to see it was complete. It took… longer than the estimate."],
    ["Basira", "Twenty years. I have clocks that lost less time."],
    ["Yuzu", "Quiet. Look — she's pointing it DOWN."],
    ["Vesper", "The Great Eye has stared past us long enough. Tonight it looks at home. Courier — you first. You've walked every inch of it."],
    ["", "You look through the telescope. There is the harbor, and the pines, and the lanterns of Lantern Row, and the little bay, curved together like a letter folded to fit its envelope. Walk far enough in any direction and you come home. You knew that. Now you've seen it."],
    ["Marin", "The route's yours now, courier. It always loops back. That's the best thing about it."],
  ],
};

export const STAMP_ART = {
  harbor: '⚓', farms: '🌾', pine: '🌲', spring: '♨', souk: '🏺',
  neon: '🍜', marsh: '🪷', observatory: '🔭', dimstreet: '🏮',
};
