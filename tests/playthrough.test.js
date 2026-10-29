import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {weaponDamage} from '../web/castle.js';

for(const path of [{seed:47,branch:1,treasury:0,name:'crypts and sanctuary'},{seed:123,branch:0,treasury:1,name:'ramparts and treasury'}])test(`complete expedition through ${path.name}: combat, loot, upgrades and boss`,async()=>{
  const {instance}=await WebAssembly.instantiate(await readFile('dist/rogue_web.wasm'),{}),a=instance.exports;
  a.reset(path.seed,0,0);let jump=0,lastRoom=-1,settle=0;
  for(let tick=0;tick<30000&&a.stat(0)>0&&!a.stat(24);tick++){
    const room=a.stat(18),x=a.entity(0,0,0),y=a.entity(0,0,1),face=a.entity(0,0,4);
    if(room!==lastRoom){lastRoom=room;settle=0;a.choose_exit(room===0?path.branch:room===4?path.treasury:0);}
    let input=0;
    const enemies=Array.from({length:a.stat(3)},(_,i)=>({i,x:a.entity(1,i,0),hp:a.entity(1,i,5),attack:a.entity(1,i,6)})).filter(e=>e.hp>0).sort((p,q)=>Math.abs(p.x-x)-Math.abs(q.x-x));
    if(enemies.length){
      const enemy=enemies[0],distance=enemy.x-x,dir=distance>0?2:1;
      if(Math.abs(distance)>a.stat(32)-15||face!==(distance>0?1:-1))input|=dir;
      if(tick%(a.stat(31)+2)===0&&Math.abs(distance)<a.stat(32)+15)input|=8;
      if(a.stat(17)===0&&Math.abs(distance)<155&&tick%8===0)input|=256;
      if(enemy.attack>22&&enemy.attack<34&&Math.abs(distance)<110&&a.stat(9)===0)input|=16;
      if(a.entity(1,enemy.i,1)-y>65&&a.entity(0,0,11)){input|=32;if(tick%4===0)input|=4;jump=0;}
    }else{
      const interaction=a.stat(25),nearby=a.stat(34),better=nearby!==99&&weaponDamage(nearby,a.stat(35),a.stat(15))>a.stat(30);
      let target=925;
      if([3,5].includes(room)&&!a.stat(23)&&(room===5||a.stat(10)>=35))target=338;
      else if(!a.stat(22))target=708;
      if(Math.abs(target-x)>9)input|=target>x?2:1;
      else settle++;
      if((better||[2,3,4].includes(interaction))&&tick%10===0)input|=64;
      // Remain beside an opened chest long enough for its magnetic drops to settle.
      if(a.stat(22)&&settle>0&&settle<45)input&=~3;
    }
    if(a.stat(0)<=a.stat(16)-2&&a.stat(12)>0&&tick%12===0)input|=128;
    for(let i=0;i<a.stat(27);i++){
      const vent=a.entity(4,i,0),phase=a.entity(4,i,4);
      if(x>vent-55&&x<vent+a.entity(4,i,2)+35&&phase>105&&a.entity(0,0,11))jump=30;
    }
    if(jump>0){input|=4;jump--;}
    a.tick(input);
  }
  assert.equal(a.stat(24),1,`expedition ended in room ${a.stat(18)}, health ${a.stat(0)}, score ${a.stat(1)}, gear ${a.stat(13)}/${a.stat(14)}, power ${a.stat(15)}, position ${a.entity(0,0,0)}/${a.entity(0,0,1)}`);
  assert.equal(a.stat(18),8);assert.ok(a.stat(1)>=2000);assert.ok(a.stat(15)>0);assert.ok(a.stat(14)>0);
  assert.ok(a.stat(20)&(1<<(path.branch?2:1)));assert.ok(a.stat(21)&(1<<(path.treasury?6:5)));
});
