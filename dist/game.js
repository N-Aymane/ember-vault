import {openSave} from './storage.js';
import {InputState, DEFAULT_BINDINGS, ACTION_BITS, keyLabel, validBindings} from './controls.js';

const $=id=>document.getElementById(id), canvas=$('game'), ctx=canvas.getContext('2d',{alpha:false});
const settings=$('settings'), input=new InputState();
let preferences={bindings:{...DEFAULT_BINDINGS},lessMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,volume:50};
try { const saved=JSON.parse(localStorage.getItem('ember-vault-controls')||'null'); if(saved){preferences={bindings:validBindings(saved.bindings),lessMotion:typeof saved.lessMotion==='boolean'?saved.lessMotion:preferences.lessMotion,volume:Number.isFinite(saved.volume)?Math.max(0,Math.min(100,saved.volume)):50};} } catch { /* Default controls remain usable without storage. */ }
input.bindings=preferences.bindings;
let wasm,store,art,running=false,started=false,accumulator=0,last=0,frame=0,muted=false,audio,master;
let savedBest=0,savedRooms=0,saveBusy=false,savePending=false,lastPad=false,padConnected=false;
let particles=[],floaters=[],ghosts=[],previous=[],current=[],hitStop=0,shake=0,noticeTime=0;
let resumeAfterSettings=false,remapping=null;
const step=1/60,seed=()=>crypto.getRandomValues(new Uint32Array(1))[0]||1;
const write=(id,text)=>{if($(id).textContent!==text)$(id).textContent=text;};
const eventTone={1:[240,.08,'triangle',.03],2:[180,.08,'sawtooth',.025],4:[90,.12,'triangle',.07],8:[65,.1,'square',.035],16:[440,.18,'triangle',.05],32:[48,.18,'sawtooth',.04],128:[660,.3,'triangle',.04]};

function overlay(label,title,copy,action){write('overlay-label',label);write('overlay-title',title);write('overlay-copy',copy);write('play',action);$('overlay').hidden=false;$('play').focus();}
function clearInput(){input.clear();wasm?.release_input();}
function pause(){if(!running)return;running=false;clearInput();accumulator=0;overlay('TAKE A BREATH','The vault can wait.','Your flame is safe here. Return when you are ready.','Resume run');write('pause','Resume');persist();}
async function soundReady(){try{if(!audio){audio=new AudioContext();master=audio.createGain();master.connect(audio.destination);}master.gain.value=preferences.volume/100;await audio.resume();}catch{/* Sound is optional. */}}
function tone(frequency,duration,type,volume){if(muted||!audio||audio.state!=='running')return;const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,audio.currentTime);oscillator.frequency.exponentialRampToValueAtTime(Math.max(30,frequency*.4),audio.currentTime+duration);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);oscillator.connect(gain);gain.connect(master);oscillator.start();oscillator.stop(audio.currentTime+duration);}
async function persist(){if(!store||!wasm)return;savePending=true;if(saveBusy)return;saveBusy=true;try{while(savePending){savePending=false;const best=wasm.stat(6),cleared=wasm.stat(7);if(best===savedBest&&cleared===savedRooms)continue;await store.write({version:1,best,cleared});savedBest=best;savedRooms=cleared;write('save-status',`Best ${best} · ${cleared} chambers cleared · saved on this device`);}}catch{write('save-status','Your run can continue. Progress could not be saved.');}finally{saveBusy=false;}}
function snapshots(){return [{kind:0,index:0,...readActor(0,0)},...Array.from({length:wasm.stat(3)},(_,index)=>({kind:1,index,...readActor(1,index)}))];}
function readActor(kind,index){const f=field=>wasm.entity(kind,index,field);return {x:f(0),y:f(1),w:f(2),h:f(3),facing:f(4),hp:f(5),attack:f(6),dodge:f(7),invulnerable:f(8),vx:f(9),combo:f(10),grounded:f(11),vy:f(12)};}
function start(){if(!wasm||!art||settings.open)return;soundReady();if(!started||wasm.stat(0)===0){wasm.reset(seed(),started?wasm.stat(6):savedBest,started?wasm.stat(7):savedRooms);started=true;particles=[];floaters=[];ghosts=[];frame=0;current=snapshots();previous=current;}running=true;accumulator=0;hitStop=0;clearInput();$('overlay').hidden=true;write('pause','Pause · Esc');canvas.focus();}
$('play').addEventListener('click',start);$('pause').addEventListener('click',()=>running?pause():start());
$('mute').addEventListener('click',()=>{muted=!muted;$('mute').setAttribute('aria-pressed',String(muted));$('mute').setAttribute('aria-label',muted?'Sound off':'Sound on');$('mute').querySelector('span').textContent=muted?'Sound off':'Sound on';if(!muted)soundReady();});

function savePreferences(){try{localStorage.setItem('ember-vault-controls',JSON.stringify(preferences));}catch{write('binding-status','Controls work for this session. This browser could not save your preferences.');}}
function showBindings(){const focusedAction=document.activeElement?.dataset.action;const labels={left:'Move left',right:'Move right',jump:'Jump',attack:'Strike',dodge:'Dodge',down:'Drop modifier'};$('binding-list').replaceChildren();for(const [action,label] of Object.entries(labels)){const row=document.createElement('div');row.className='binding-row';const text=document.createElement('span');text.textContent=label;const button=document.createElement('button');button.type='button';button.textContent=keyLabel(preferences.bindings[action]);button.setAttribute('aria-label',`Change ${label.toLowerCase()} key, currently ${button.textContent}`);button.addEventListener('click',()=>{remapping=action;showBindings();const selected=$('binding-list').querySelector(`[data-action="${action}"]`);selected.classList.add('listening');selected.textContent='Press a key';selected.focus();write('binding-status',`Choose a key for ${label.toLowerCase()}. Escape cancels.`);});button.dataset.action=action;row.append(text,button);$('binding-list').append(row);}for(const node of document.querySelectorAll('[data-key]'))node.textContent=keyLabel(preferences.bindings[node.dataset.key]);if(focusedAction)$('binding-list').querySelector('[data-action="'+focusedAction+'"]')?.focus();}
function openSettings(){resumeAfterSettings=running;pause();clearInput();remapping=null;showBindings();$('less-motion').checked=preferences.lessMotion;$('volume').value=preferences.volume;settings.showModal();}
function closeSettings(){remapping=null;settings.close();if(resumeAfterSettings)start();else $('controls').focus();}
$('controls').addEventListener('click',openSettings);$('close-settings').addEventListener('click',closeSettings);$('done-settings').addEventListener('click',closeSettings);
settings.addEventListener('cancel',event=>{event.preventDefault();if(remapping){remapping=null;showBindings();write('binding-status','Key change cancelled.');}else closeSettings();});
$('reset-controls').addEventListener('click',()=>{preferences.bindings={...DEFAULT_BINDINGS};input.bindings=preferences.bindings;remapping=null;showBindings();write('binding-status','Default keys restored.');savePreferences();});
$('less-motion').addEventListener('change',()=>{preferences.lessMotion=$('less-motion').checked;particles=[];ghosts=[];shake=0;savePreferences();});
$('volume').addEventListener('input',()=>{preferences.volume=Number($('volume').value);if(master)master.gain.value=preferences.volume/100;savePreferences();});
document.addEventListener('keydown',event=>{
  if(settings.open){if(remapping&&event.code!=='Escape'){event.preventDefault();const candidate={...preferences.bindings,[remapping]:event.code};if(JSON.stringify(validBindings(candidate))!==JSON.stringify(candidate)){write('binding-status','Choose a letter, number, Space, Shift or Control that is not already assigned.');return;}preferences.bindings=candidate;input.bindings=candidate;remapping=null;showBindings();write('binding-status','Key updated. Your controls are saved on this device.');savePreferences();}return;}
  if(event.code==='Escape'&&started){event.preventDefault();if(!event.repeat)running?pause():start();return;}
  if(event.code==='KeyR'&&started&&wasm?.stat(0)===0){start();return;}
  if(running&&input.bit(event.code)){event.preventDefault();input.down(event.code);}
});
document.addEventListener('keyup',event=>input.up(event.code));
canvas.addEventListener('pointerdown',event=>{if(!running||event.pointerType==='touch')return;event.preventDefault();canvas.focus();canvas.setPointerCapture(event.pointerId);input.pointerDown(event.button===2?16:8);});
canvas.addEventListener('pointerup',event=>input.pointerUp(event.button===2?16:8));canvas.addEventListener('pointercancel',()=>clearInput());canvas.addEventListener('contextmenu',event=>event.preventDefault());
for(const button of document.querySelectorAll('[data-input]')){const bit=Number(button.dataset.input);button.addEventListener('pointerdown',event=>{if(!running)return;event.preventDefault();button.setPointerCapture(event.pointerId);input.pointerDown(bit);});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>input.pointerUp(bit));}
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game-shell').requestFullscreen();}catch{write('hint','Fullscreen is unavailable in this browser. Your run can continue.');}}
$('fullscreen').addEventListener('click',fullscreen);$('fullscreen-exit').addEventListener('click',fullscreen);document.addEventListener('fullscreenchange',()=>{$('fullscreen-exit').hidden=!document.fullscreenElement;resize();});
function resize(){canvas.height=(innerWidth<=700||document.fullscreenElement)?540:390;}window.addEventListener('resize',resize);resize();
function gamepad(){const pad=navigator.getGamepads?.().find(p=>p?.connected);if(Boolean(pad)!==padConnected){padConnected=Boolean(pad);write('controller-text',pad?'Gamepad connected':'Gamepad supported');}if(!pad){lastPad=false;return 0;}const press=i=>Boolean(pad.buttons[i]?.pressed);const menu=press(9);if(menu&&!lastPad&&started&&!settings.open)running?pause():start();lastPad=menu;return ((pad.axes[0]<-.25||press(14))?1:0)|((pad.axes[0]>.25||press(15))?2:0)|(press(0)?4:0)|(press(2)?8:0)|(press(1)?16:0)|((pad.axes[1]>.5||press(13))?32:0);}

async function image(path){const result=new Image();result.src=path;await result.decode();return result;}
async function sprite(name){const response=await fetch(`assets/${name}.json`);if(!response.ok)throw new Error(`Could not load ${name} animations`);const metadata=await response.json();const sheet=await image(`assets/${metadata.image}`);return {sheet,...metadata};}
function spriteFrame(sprite,row,index){const frames=sprite.rows[row];return sprite.frames[frames[Math.min(frames.length-1,Math.max(0,index))]];}
function drawSprite(sprite,pose,row,index,alpha=1){const f=spriteFrame(sprite,row,index),scale=56/(f.height||196);ctx.save();ctx.translate(Math.round(pose.x+pose.w/2),Math.round(pose.y+pose.h));ctx.scale(pose.facing,1);ctx.globalAlpha=alpha;if(pose.invulnerable&&!preferences.lessMotion)ctx.filter='brightness(1.55)';ctx.drawImage(sprite.sheet,f.x,f.y,f.w,f.h,-f.anchorX*scale,-f.anchorY*scale,f.w*scale,f.h*scale);ctx.restore();}
function actor(pose,index,alpha){if(pose.hp<=0)return;const old=previous[index]||pose;const p={...pose,x:old.x+(pose.x-old.x)*alpha,y:old.y+(pose.y-old.y)*alpha};const sprite=pose.kind===0?art.hero:art.sentry;
  let row=Math.abs(pose.vx)>12?1:0, animation=Math.floor(frame/(row===1?6:14))%sprite.rows[row].length;
  if(pose.kind===0&&pose.dodge){row=3;animation=Math.floor((16-pose.dodge)/16*sprite.rows[3].length);}
  else if(pose.attack){row=2;const length=pose.kind===0?(pose.combo===3?32:26):50,elapsed=length-pose.attack;animation=pose.kind===0?(elapsed<6?0:elapsed<=11?1:sprite.rows[2].length-1):(elapsed<15?0:elapsed<28?1:elapsed<=38?2:3);}
  if(!pose.grounded&&!pose.dodge&&!pose.attack){row=1;animation=pose.vy<0?1:2;}
  ctx.fillStyle='#020b0c66';ctx.beginPath();ctx.ellipse(p.x+p.w/2,p.y+p.h+1,17,3,0,0,Math.PI*2);ctx.fill();
  drawSprite(sprite,p,row,animation);
  if(pose.kind===1){const maximum=3+Math.min(Math.floor(wasm.stat(2)/3),3);if(p.hp<maximum){ctx.fillStyle='#162c2b';ctx.fillRect(p.x-4,p.y-13,32,3);ctx.fillStyle='#bf8298';ctx.fillRect(p.x-4,p.y-13,32*p.hp/maximum,3);}if(p.attack>22){const progress=(50-p.attack)/28;ctx.strokeStyle='#ffc479';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x+12,p.y-22,7,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.stroke();}}
}
function draw(){ctx.imageSmoothingEnabled=false;ctx.fillStyle='#09191e';ctx.fillRect(0,0,960,canvas.height);if(!art||!wasm)return;
  const cameraY=canvas.height===390?132:0;ctx.save();ctx.translate(!preferences.lessMotion&&shake>0?Math.sin(frame*7)*shake:0,-cameraY);
  ctx.save();ctx.filter='brightness(.78) saturate(.8)';ctx.drawImage(art.vault,0,44,960,art.vault.height*960/art.vault.width);ctx.restore();
  const open=wasm.stat(8);ctx.save();if(!open)ctx.filter='brightness(.55) saturate(.55)';ctx.drawImage(art.environment,40,10,860,860,832,466-763/860*140,140,140);ctx.restore();
  for(let i=1;i<wasm.stat(4);i++){const x=wasm.entity(2,i,0),y=wasm.entity(2,i,1),w=wasm.entity(2,i,2),sourceY=i%2?180:552;ctx.drawImage(art.environment,945,sourceY,780,300,x,y-48/780*w,w,300/780*w);}
  if(open){ctx.fillStyle='#ffe1a9';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText('GATE OPEN',906,329);ctx.textAlign='left';}
  if(!preferences.lessMotion){for(let i=0;i<25;i++){const x=(i*137+frame*.16)%960,y=220+(i*89)%245-Math.sin(frame*.015+i)*8;ctx.fillStyle=i%3?'#c5a86b66':'#81c7ac66';ctx.fillRect(x,y,i%4===0?2:1,1);}}
  for(const g of ghosts){const fake={...g.pose,invulnerable:0};drawSprite(art.hero,fake,3,g.frame,g.life*.3);}
  const alpha=running?accumulator/step:1;current.forEach((p,index)=>actor(p,index,alpha));
  for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*3);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.globalAlpha=1;
  for(const p of floaters){ctx.fillStyle=p.color;ctx.font='bold 12px monospace';ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillText(p.text,p.x,p.y);}ctx.globalAlpha=1;ctx.restore();
  updateHud();
}
function updateHud(){const hp=wasm.stat(0);$('health').setAttribute('aria-label',`Health ${hp} of 5`);Array.from($('health').children).forEach((bar,i)=>bar.classList.toggle('lost',i>=hp));$('dodge-meter').value=48-wasm.stat(9);write('dodge-label',wasm.stat(9)?'DODGE RECOVERING':'DODGE READY');write('score',String(wasm.stat(1)).padStart(6,'0'));write('best',String(wasm.stat(6)).padStart(6,'0'));write('room',`CHAMBER ${String(wasm.stat(2)).padStart(2,'0')}`);const chapter=$('chapter-name');const text=`Chamber ${String(wasm.stat(2)).padStart(2,'0')} / The Hollow`;if(chapter.textContent!==text)chapter.textContent=text;
  const warning=current.some(p=>p.kind===1&&p.hp>0&&p.attack>22&&Math.abs(p.x-current[0].x)<140);write('hint',wasm.stat(8)?'Gate open. Follow the light to the right.':warning?'Read the gold wind-up. Dodge through the lunge.':'Defeat the sentries. Reach the gate.');
}
function effects(bits){for(const [event,parameters] of Object.entries(eventTone))if(bits&Number(event))tone(...parameters);
  if(bits&8){hitStop=.045;if(!preferences.lessMotion)shake=2;const hero=current[0];const target=current.find(p=>p.kind===1&&p.invulnerable>0);if(target)floaters.push({x:target.x,y:target.y-13,life:.6,color:'#ffe0ab',text:hero.combo===3?'2':'1'});}
  if(bits&32){if(!preferences.lessMotion)shake=3;floaters.push({x:current[0].x,y:current[0].y-12,life:.7,color:'#f2a187',text:'−1'});}
  if(bits&(8|16|32)&&!preferences.lessMotion){const hero=current[0];for(let i=0;i<12;i++)particles.push({x:hero.x+12+hero.facing*30,y:hero.y+16,vx:Math.cos(i*2.4)*100,vy:-70-Math.sin(i)*90,life:.4,size:i%3?2:3,color:bits&32?'#d98b85':'#edb475'});}
  if(bits&128){write('room-notice',`Chamber ${String(wasm.stat(2)).padStart(2,'0')} · Keep the flame alive`);$('room-notice').classList.add('visible');noticeTime=2;previous=current;}
}
function loop(time){const delta=Math.min((time-last)/1000||0,.1);last=time;const pad=gamepad();if(running){if(hitStop>0){hitStop=Math.max(0,hitStop-delta);}else{accumulator+=delta;while(accumulator>=step){const bits=input.snapshot(pad);previous=current;wasm.tick(bits);current=snapshots();effects(wasm.stat(5));accumulator-=step;frame++;
      if(current[0].dodge&&!preferences.lessMotion&&frame%3===0)ghosts.push({pose:{...current[0]},frame:Math.floor((16-current[0].dodge)/16*art.hero.rows[3].length),life:.3});
      if(wasm.stat(5)&(16|64|128))persist();if(wasm.stat(0)===0){running=false;clearInput();overlay('THE FLAME GOES QUIET','One more descent.',`Score ${wasm.stat(1)} · Chamber ${wasm.stat(2)} · Best ${wasm.stat(6)}`,'Try again');break;}if(hitStop){accumulator=0;break;}
    }}
    particles=particles.filter(p=>{p.life-=delta;p.x+=p.vx*delta;p.y+=p.vy*delta;p.vy+=400*delta;return p.life>0;});floaters=floaters.filter(p=>{p.life-=delta;p.y-=delta*28;return p.life>0;});ghosts=ghosts.filter(g=>{g.life-=delta;return g.life>0;});shake=Math.max(0,shake-delta*20);noticeTime=Math.max(0,noticeTime-delta);if(!noticeTime)$('room-notice').classList.remove('visible');}
  draw();requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
async function boot(){try{const response=await fetch('rogue_web.wasm');if(!response.ok)throw new Error(`WebAssembly download failed (${response.status})`);const {instance}=await WebAssembly.instantiate(await response.arrayBuffer(),{});wasm=instance.exports;if(wasm.self_test()!==14||wasm.controls_test()!==8)throw new Error('Gameplay verification failed');
    const [vault,environment,hero,sentry]=await Promise.all([image('assets/vault.png'),image('assets/environment.png'),sprite('hero'),sprite('sentry')]);art={vault,environment,hero,sentry};
    try{store=await openSave();savedBest=store.current.best;savedRooms=store.current.cleared;write('save-status',`Best ${savedBest} · ${savedRooms} chambers cleared · saved on this device`);}catch(error){write('save-status',`Session only: ${error.message}. Existing saves will not be overwritten.`);}
    wasm.reset(47,savedBest,savedRooms);current=snapshots();previous=current;$('play').disabled=false;write('play','Begin descent →');$('pause').disabled=false;
  }catch(error){overlay('COULD NOT OPEN THE VAULT','Loading failed.',`${error.message}. Reload to try again.`,'Reload');$('play').disabled=false;$('play').onclick=()=>location.reload();}}
showBindings();boot();
