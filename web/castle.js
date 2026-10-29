export const ROOMS=[
  {name:'Gatehouse',area:'The Overgrown Keep',kind:'Combat',column:1,row:2},
  {name:'Ramparts',area:'The Moonlit Ramparts',kind:'Elite patrol',column:2,row:1},
  {name:'Undercroft',area:'The Rootbound Crypts',kind:'Ember vents',column:2,row:3},
  {name:'Armory',area:'The Forgotten Armory',kind:'Vitality forge',column:3,row:2},
  {name:'Royal Gallery',area:'The Overgrown Keep',kind:'Elite patrol',column:4,row:2},
  {name:'Chapel',area:'The Quiet Sanctuary',kind:'Refill flasks',column:5,row:1},
  {name:'Treasury',area:'The Sealed Treasury',kind:'Locked relic chest',column:5,row:3},
  {name:'Throne Hall',area:'The Fallen Crown',kind:'The Castellan',column:6,row:2},
  {name:'Daybreak',area:'Beyond the Keep',kind:'Castle escaped',column:7,row:2},
];
export const EDGES=[[0,1],[0,2],[1,3],[2,3],[3,4],[4,5],[4,6],[5,7],[6,7],[7,8]];
export const WEAPONS=[{name:'Emberblade',damage:1,reach:64,duration:26,slot:4},{name:'Violet Pike',damage:2,reach:104,duration:34,slot:5},{name:'Quicksteel',damage:1,reach:50,duration:18,slot:4}];
export const RARITIES=['Worn','Tempered','Rare','Legendary'];
export const LOOT_SLOTS=[{x:40,y:170,w:370,h:280},{x:540,y:70,w:260,h:390},{x:910,y:145,w:410,h:310},{x:1360,y:70,w:390,h:390},{x:20,y:555,w:430,h:235},{x:467,y:555,w:540,h:235},{x:1012,y:490,w:312,h:380},{x:1324,y:560,w:440,h:240}];
export function weaponDamage(type,tier,power){return WEAPONS[type].damage+tier+Math.min(power,6);}
export function discoveredRooms(seen){let known=seen;for(const [a,b] of EDGES){if(seen&(1<<a))known|=1<<b;if(seen&(1<<b))known|=1<<a;}return known;}
export function weaponLabel(type,tier){return `${RARITIES[tier]} ${WEAPONS[type].name}`;}
