import {ROOMS,EDGES,WEAPONS,LOOT_SLOTS,discoveredRooms,weaponDamage,weaponLabel} from './castle.js';

const $=id=>document.getElementById(id);
let api,art,keyLabel,notice;
let roomStamp=-1,loadoutStamp='';
export function initExpedition(wasm,images,getKey,showNotice){api=wasm;art=images;keyLabel=getKey;notice=showNotice;paintIcons();}
export function room(){return ROOMS[api.stat(18)];}
export function lootSprite(context,slot,x,y,w,h){const crop=LOOT_SLOTS[slot];const scale=Math.min(w/crop.w,h/crop.h);const dw=crop.w*scale,dh=crop.h*scale;context.drawImage(art.loot,crop.x,crop.y,crop.w,crop.h,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
function paintIcons(){for(const canvas of document.querySelectorAll('canvas[data-loot-icon]')){const context=canvas.getContext('2d');context.clearRect(0,0,canvas.width,canvas.height);context.imageSmoothingEnabled=false;lootSprite(context,Number(canvas.dataset.lootIcon),0,0,canvas.width,canvas.height);}}
export function drawExpedition(context,frame,lessMotion){
  if(!api.stat(22)){lootSprite(context,2,695,423,52,45);if(api.stat(18)===6){context.fillStyle='#efd094';context.font='9px monospace';context.textAlign='center';context.fillText('KEY REQUIRED',720,417);context.textAlign='left';}}
  else if(![5,7,8].includes(api.stat(18)))lootSprite(context,3,695,423,52,45);
  if([3,5].includes(api.stat(18))&&!api.stat(23)){context.save();context.globalAlpha=.8;context.drawImage(art.environment,40,10,860,860,314,410,72,72);context.restore();lootSprite(context,api.stat(18)===3?6:1,332,422,30,34);context.fillStyle='#bbdfba';context.textAlign='center';context.font='9px monospace';context.fillText(api.stat(18)===3?'VITALITY FORGE':'SANCTUARY',350,405);context.textAlign='left';}
  if(api.stat(33)){context.fillStyle='#a4b99f';context.font='10px monospace';context.fillText('← RETURN',18,408);}
  for(let i=0;i<api.stat(27);i++){
    const x=api.entity(4,i,0),width=api.entity(4,i,2),phase=api.entity(4,i,4);
    context.fillStyle='#341c18';context.fillRect(x,461,width,5);
    if(phase<120)continue;
    context.strokeStyle=phase>=150?'#ffd29b':'#c8884e';context.lineWidth=phase>=150?3:1;context.setLineDash(phase>=150?[]:[3,4]);context.strokeRect(x,phase>=150?408:455,width,phase>=150?58:10);context.setLineDash([]);
    if(phase>=150){for(let j=0;j<9;j++){const y=466-((frame*5+j*7)%58),px=x+((j*13)%width);context.globalAlpha=lessMotion?.6:Math.max(.15,(466-y)/58);context.fillStyle=j%2?'#f2a153':'#ffe0ab';context.fillRect(px,y,3,7);}context.globalAlpha=1;}
  }
  for(let i=0;i<api.stat(26);i++){
    if(!api.entity(3,i,5))continue;
    const x=api.entity(3,i,0),y=api.entity(3,i,1),kind=api.entity(3,i,2),amount=api.entity(3,i,3),rarity=api.entity(3,i,4);
    const slot=kind===0?0:kind===1?1:kind===2?WEAPONS[amount].slot:kind===3?6:7;
    const bob=lessMotion?0:Math.sin(frame*.06+i)*2;
    if(kind===2){context.fillStyle=['#9eaaa0','#e7c38c','#bc9bea','#ffc468'][rarity];context.fillRect(x-16,y+14,32,1);lootSprite(context,slot,x-26,y-18+bob,52,29);}
    else lootSprite(context,slot,x-11,y-11+bob,22,22);
  }
}
export function updateExpedition(running){
  const gold=api.stat(10),keys=api.stat(11),power=api.stat(15),type=api.stat(13),tier=api.stat(14),flasks=api.stat(12),skill=api.stat(17),interaction=api.stat(25);
  $('gold').textContent=gold;$('keys').textContent=keys;$('power').textContent=power;
  const stamp=`${type},${tier},${power}`;
  if(stamp!==loadoutStamp){loadoutStamp=stamp;$('weapon-name').textContent=weaponLabel(type,tier);$('weapon-name').style.color=['#c7cbbb','#e8bd80','#c9a6f2','#ffce77'][tier];$('weapon-stats').textContent=`${api.stat(30)} damage · ${['balanced','long reach','fast strikes'][type]}`;$('weapon-icon').dataset.lootIcon=WEAPONS[type].slot;paintIcons();}
  $('flask-label').textContent=`Flask ${flasks}/2`;$('heal-button').disabled=!running||flasks===0||api.stat(0)===api.stat(16);
  $('skill-label').textContent=skill?`Rune ${Math.ceil(skill/60)}s`:'Rune burst';$('skill-button').disabled=!running||skill>0;
  $('interact-button').disabled=!running||!interaction||interaction===7;$('interact-button').querySelector('span').textContent=interaction===1?'Swap':interaction===2?'Chest':interaction===3?'Forge':interaction===4?'Refill':interaction===6?'Return':'Interact';
  const nearby=api.stat(34);$('loot-compare').hidden=nearby===99;
  if(nearby!==99){const rarity=api.stat(35),damage=weaponDamage(nearby,rarity,power),delta=damage-api.stat(30);$('loot-name').textContent=weaponLabel(nearby,rarity);$('loot-stats').textContent=`${damage} damage (${delta>=0?'+':''}${delta}) · ${WEAPONS[nearby].reach} reach · ${(WEAPONS[nearby].duration/60).toFixed(2)}s strike`;$('loot-action').textContent=`${keyLabel('interact')} to swap · current ${weaponLabel(type,tier)}`;}
  const id=api.stat(18);if(id!==roomStamp){roomStamp=id;$('area-name').textContent=ROOMS[id].area.toUpperCase();}
  const boss=api.stat(18)===7&&api.entity(1,0,5)>0;$('boss-bar').hidden=!boss;if(boss){$('boss-health').max=api.entity(1,0,14);$('boss-health').value=api.entity(1,0,5);}
}
export function interactionHint(){
  const key=keyLabel('interact'),interaction=api.stat(25);
  if(interaction===1)return `${key}: compare and swap weapon. Gold, scrolls and keys collect nearby.`;
  if(interaction===2)return api.stat(18)===6?`${key}: unlock the treasury chest · costs 1 key`:`${key}: open chest · weapon, gold and a power scroll`;
  if(interaction===3)return `${key}: vitality forge · 35 gold for +1 max health and healing`;
  if(interaction===4)return `${key}: sanctuary · heal fully and refill both flasks, once`;
  if(interaction===5)return `${key}: enter ${ROOMS[api.route(api.stat(29))].name} · M to choose your route`;
  if(interaction===6)return `${key}: return to the previous room. Loot and enemies keep their state.`;
  if(interaction===7)return 'The chest is sealed until this room is cleared.';
  if(api.stat(8))return api.stat(28)>1?'Room secured. Open the map to choose your next path.':'Room secured. Search for treasure, then reach the right-hand gate.';
  return api.stat(27)?'Watch the ember vents. Jump or dodge when their warning turns gold.':null;
}
export function expeditionEffects(bits){
  if(bits&1024)notice('Chest opened · claim your relic');
  if(bits&2048)notice(`Equipped ${weaponLabel(api.stat(13),api.stat(14))}`);
  if(bits&4096)notice('Healing restored');
  if(bits&16384)notice('Power gained · stronger for this run');
  if(bits&32768)notice(api.stat(25)===2?'A treasury key is required':api.stat(25)===3?'The forge needs 35 gold':api.stat(0)===api.stat(16)?'Health is already full':api.stat(12)===0?'No healing flasks remain':'Flask is recharging');
  if(bits&131072)notice('Room secured · treasure and exits unlocked');
}
export function renderMap(){
  const board=$('map-board'),focused=document.activeElement?.dataset.room;board.replaceChildren();const seen=api.stat(20),cleared=api.stat(21),current=api.stat(18),known=discoveredRooms(seen),selected=api.route(api.stat(29));
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 892 292');svg.setAttribute('aria-hidden','true');
  for(const [a,b] of EDGES){const from=ROOMS[a],to=ROOMS[b],line=document.createElementNS(svg.namespaceURI,'path');const x1=(from.column-1)*130+112,y1=(from.row-1)*95+38,x2=(to.column-1)*130,y2=(to.row-1)*95+38;line.setAttribute('d',`M ${x1} ${y1} C ${x1+32} ${y1}, ${x2-32} ${y2}, ${x2} ${y2}`);line.setAttribute('fill','none');line.setAttribute('stroke',(known&(1<<a))&&(known&(1<<b))?'#68816b':'#273c36');line.setAttribute('stroke-width','2');svg.append(line);}board.append(svg);
  for(const [id,room] of ROOMS.entries()){
    const button=document.createElement('button'),discovered=Boolean(known&(1<<id)),isCleared=Boolean(cleared&(1<<id));button.dataset.room=String(id);button.className=`map-node${current===id?' current':''}${isCleared?' cleared':''}${!discovered?' unknown':''}${selected===id?' selected':''}`;button.style.left=`${(room.column-1)*130}px`;button.style.top=`${(room.row-1)*95}px`;button.append(document.createTextNode(discovered?room.name:'Unknown'));const small=document.createElement('small');small.textContent=current===id?'YOU ARE HERE':isCleared?'CLEARED':seen&(1<<id)?'VISITED':discovered?room.kind:'UNEXPLORED';button.append(small);
    const choice=Array.from({length:api.stat(28)},(_,i)=>i).find(i=>api.route(i)===id);button.disabled=choice===undefined;button.setAttribute('aria-label',`${discovered?room.name:'Unknown room'}, ${small.textContent}${choice!==undefined?', select this route':''}`);if(choice!==undefined)button.addEventListener('click',()=>{api.choose_exit(choice);$('map-help').textContent=`Route selected: ${room.name}. Clear this room and reach the right-hand gate to travel.`;renderMap();});board.append(button);
  }
  if(focused)board.querySelector('[data-room="'+focused+'"]')?.focus();
  $('map-summary').textContent=`${ROOMS[current].name} · ${api.stat(10)} gold · ${api.stat(11)} keys · ${api.stat(12)} flasks · ${weaponLabel(api.stat(13),api.stat(14))}`;
  $('map-help').textContent=selected===99?'You escaped the keep. A new expedition starts with fresh loot.':`Next route: ${ROOMS[selected].name}. ${api.stat(8)?'Reach the right-hand gate to travel.':'Secure this room before using its exit.'} Choose an adjacent room to change your path.`;
}
