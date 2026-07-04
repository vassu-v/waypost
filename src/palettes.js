// palettes.js — SINGLE SOURCE OF TRUTH for every color in the game.
// Each zone: locked palette + sky/fog/sun grading for day and night,
// which vibe.js blends by wrapped distance. Do not hex anywhere else.

export const ZONES = [
  {
    key: 'harbor', name: 'Harbor Town', cx: 200, cz: 255, radius: 78,
    colors: { water:'#2E8B8B', walls:'#F5EBDC', roofs:'#C1502E', lamps:'#E8B04B', stone:'#5B7A8C' },
    sky:   { day:['#8FD4D9','#F2E8CE'], night:['#16283C','#3A4A66'] },   // [zenith, horizon]
    fog:   { day:'#CBE4DC', night:'#1C2A3C' },
    sun:   { day:'#FFF0D0', night:'#93A8CC' },
    grade: { day:'#FFF6E0', night:'#26364E' },   // multiplicative color-grade tint
    ground:{ day:'#9FBE7A', night:'#3A4A44' },
    particles: 'gulls', ambience: 'harbor',
  },
  {
    key: 'farms', name: 'Terraced Farms', cx: 65, cz: 165, radius: 75,
    colors: { fields:'#D9A441', hedges:'#8A9A3B', mills:'#F2E3C6', soil:'#B5651D', pond:'#7FB3C8' },
    sky:   { day:['#9FD0E8','#F7E9BE'], night:['#1A2A40','#40506A'] },
    fog:   { day:'#E8DCB4', night:'#202E42' },
    sun:   { day:'#FFEEC2', night:'#8FA4C8' },
    grade: { day:'#FFF2CC', night:'#2A3850' },
    ground:{ day:'#C9A24E', night:'#4A4234' },
    particles: 'seeds', ambience: 'farms',
  },
  {
    key: 'pine', name: 'Pine Highlands', cx: 65, cz: 60, radius: 72,
    colors: { pines:'#1F4A38', moss:'#3E6B52', mist:'#8FA6A0', bark:'#6B4A36', foglight:'#D8DED9' },
    sky:   { day:['#A8C4BE','#E2E8DE'], night:['#121E26','#2E3E44'] },
    fog:   { day:'#C2D0CA', night:'#182430' },
    sun:   { day:'#F0F2E0', night:'#7E96AC' },
    grade: { day:'#E4F0E4', night:'#1E2E36' },
    ground:{ day:'#4E7A5C', night:'#28382E' },
    particles: 'mist', ambience: 'pine',
  },
  {
    key: 'spring', name: 'Hot-Spring Village', cx: 200, cz: 60, radius: 68,
    colors: { lanterns:'#B03A2E', timber:'#8C4A3C', melt:'#A9CDD4', steam:'#E8E0D0', nightstone:'#4A3B4F' },
    sky:   { day:['#A9CDD4','#F0E4D4'], night:['#241C34','#4A3050'] },
    fog:   { day:'#D6E0DC', night:'#2A2038' },
    sun:   { day:'#FFEFDD', night:'#B08AA0' },
    grade: { day:'#F4ECE4', night:'#38263E' },
    ground:{ day:'#8AA684', night:'#38343E' },
    particles: 'steam', ambience: 'spring',
  },
  {
    key: 'souk', name: 'Sandstone Souk', cx: 330, cz: 165, radius: 70,
    colors: { ochre:'#C98A3D', sand:'#E4C590', stripeA:'#8A3324', stripeB:'#33656B', dust:'#F0DFB8' },
    sky:   { day:['#B8D4E4','#F6E2B0'], night:['#1E2438','#4A425E'] },
    fog:   { day:'#EEDDB2', night:'#262238' },
    sun:   { day:'#FFE8B0', night:'#9A94C0' },
    grade: { day:'#FFEDC2', night:'#2E2A44' },
    ground:{ day:'#D9BC7E', night:'#4E4638' },
    particles: 'dust', ambience: 'souk',
  },
  {
    key: 'neon', name: 'Neon Junction', cx: 330, cz: 265, radius: 58,
    colors: { asphalt:'#1B1F2E', pink:'#F25C9B', cyan:'#3EE0D8', windowglow:'#F2C14E', wet:'#4A5578' },
    sky:   { day:['#7E96B0','#C8C0BE'], night:['#0E1220','#2E2444'] },
    fog:   { day:'#9AA6B4', night:'#181428' },
    sun:   { day:'#E8E0D8', night:'#8A78B8' },
    grade: { day:'#D8DCE4', night:'#221C3A' },
    ground:{ day:'#565E6E', night:'#20242F' },
    particles: 'rainmote', ambience: 'neon',
  },
  {
    key: 'marsh', name: 'The Marshes', cx: 65, cz: 265, radius: 72,
    colors: { reeds:'#5C6B4A', moss:'#7A8B6F', deepwater:'#3E4A3D', firefly:'#D4E06B', haze:'#9BAF9E' },
    sky:   { day:['#A8C0B0','#E4E8D0'], night:['#141E1E','#2E3E36'] },
    fog:   { day:'#C4D2BC', night:'#1A2622' },
    sun:   { day:'#F2F2D8', night:'#8AA496' },
    grade: { day:'#E6EED8', night:'#1E2C26' },
    ground:{ day:'#71855D', night:'#2C382C' },
    particles: 'fireflies', ambience: 'marsh',
  },
  {
    key: 'observatory', name: 'Observatory Hill', cx: 330, cz: 60, radius: 66,
    colors: { violet:'#5B4B8A', heather:'#8B7AB8', shadow:'#2E2A4A', brass:'#E8D5A3', starlight:'#F2E8FF' },
    sky:   { day:['#8B7AB8','#E8D8E8'], night:['#100E24','#3A2E5A'] },
    fog:   { day:'#C8BCD8', night:'#181430' },
    sun:   { day:'#F2E4EE', night:'#A090D0' },
    grade: { day:'#EEE2F2', night:'#241E42' },
    ground:{ day:'#7A7294', night:'#302A48' },
    particles: 'stars', ambience: 'observatory',
  },
  {
    // requested buffer: a dim transitional street between Harbor and Neon —
    // shuttered arcades whose signs wake as you approach. Narrow radius so it
    // only rules the seam.
    key: 'dimstreet', name: 'Lantern Row', cx: 268, cz: 262, radius: 30,
    colors: { asphalt:'#2A2E3A', shutter:'#6A5A4A', dimglow:'#B08A4E', wet:'#3E4658', paper:'#D8CCB4' },
    sky:   { day:['#8AA8B4','#E0D8C6'], night:['#121A2A','#33304E'] },
    fog:   { day:'#B4BCB8', night:'#1C2030' },
    sun:   { day:'#F4E8D4', night:'#8E88B4' },
    grade: { day:'#EAE4D4', night:'#242238' },
    ground:{ day:'#6E7264', night:'#262A2C' },
    particles: 'none', ambience: 'dimstreet',
  },
];

export const ZONE = Object.fromEntries(ZONES.map(z => [z.key, z]));

// UI accents (paper-and-ink post office look — mirrors style.css)
export const UI = { paper:'#F8F1E2', ink:'#3A3226', accent:'#C1502E', gold:'#E8B04B' };
