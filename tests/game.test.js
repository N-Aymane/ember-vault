import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {migrateSave} from '../web/storage.js';

async function game() {
  const bytes = await readFile(new URL('../dist/rogue_web.wasm', import.meta.url));
  const {instance} = await WebAssembly.instantiate(bytes, {});
  return instance.exports;
}
test('compiled Rust core regression suite executes in WebAssembly', async () => {
  const api = await game();
  assert.equal(api.self_test(), 14);
});
test('movement, boundaries, dodge cooldown and jump input edges', async () => {
  const api = await game();api.reset(4,0,0);
  for(let i=0;i<30;i++) api.tick(1);
  assert.equal(api.entity(0,0,0),12);
  api.tick(4); const y=api.entity(0,0,1); assert.ok(y<426);
  for(let i=0;i<12;i++) api.tick(4);
  assert.ok(api.entity(0,0,1)<y);
  api.tick(16);assert.equal(api.entity(0,0,7),16);
  api.tick(0);api.tick(16);assert.equal(api.entity(0,0,7),14);
  assert.equal(api.stat(9),46);
});
test('holding attack cannot restart the attack indefinitely', async () => {
  const api = await game();api.reset(4,0,0);api.tick(8);
  assert.equal(api.entity(0,0,6),26);
  for(let i=0;i<60;i++) api.tick(8);
  assert.equal(api.entity(0,0,6),0);
  api.tick(0);api.tick(8);assert.equal(api.entity(0,0,6),26);
});
test('the highest generated platform can be reached and landed on from the floor', async () => {
  const api=await game();
  for(let seed=1;seed<20;seed++) {
    api.reset(seed,0,0);
    const targetX=api.entity(2,1,0)+16,targetY=api.entity(2,1,1);
    for(let tick=0;tick<60 && api.entity(0,0,0)<targetX;tick++) api.tick(2);
    for(let tick=0;tick<25;tick++) api.tick(4);
    for(let tick=0;tick<100;tick++) api.tick(0);
    assert.equal(api.entity(0,0,1)+api.entity(0,0,3),targetY);
  }
});
test('forgiving controls: variable jump, input buffers, coyote time, combo queue, dodge cancel and drop-through', async () => {
  const api = await game(); assert.equal(api.controls_test(), 8);
});
test('enemies can kill the player; death freezes gameplay; reset restores a fresh run', async () => {
  const api = await game();api.reset(123,700,9);
  for(let i=0;i<3000 && api.stat(0)>0;i++) api.tick(0);
  assert.equal(api.stat(0),0);
  const position=api.entity(0,0,0);
  api.tick(2|4);assert.equal(api.entity(0,0,0),position);
  api.reset(123,api.stat(6),api.stat(7));
  assert.equal(api.stat(0),5);assert.equal(api.stat(6),700);assert.equal(api.stat(7),9);
});
test('generation is seeded, bounded, and snapshots reject invalid indices', async () => {
  const api=await game();
  const room=seed=>{api.reset(seed,0,0);return Array.from({length:api.stat(4)},(_,i)=>Array.from({length:4},(_,f)=>api.entity(2,i,f)));};
  assert.deepEqual(room(44),room(44));assert.notDeepEqual(room(44),room(45));
  for(let seed=0;seed<100;seed++) for(const [x,y,w,h] of room(seed)) {
    assert.ok(x>=0 && x+w<=960);assert.ok(y>=0 && y+h<=540);
  }
  assert.equal(api.entity(1,99999,0),0);assert.equal(api.stat(9999),0);
});
test('save migration validates malformed, legacy, and future profiles without mutating input', () => {
  const legacy={version:0,best:300};assert.deepEqual(migrateSave(legacy),{version:1,best:300,cleared:0});
  assert.deepEqual(legacy,{version:0,best:300});
  for(const bad of [null,{}, {version:9,best:3}, {version:1,best:-1,cleared:0}, {version:1,best:0,cleared:NaN}, {version:1,best:0,cleared:2**32}]) assert.throws(()=>migrateSave(bad));
});
test('a complete combat-room loop awards kills, opens the exit and persists progression', async () => {
  const api=await game();api.reset(47,0,0);
  for(let tick=0;tick<1500 && api.stat(2)===1 && api.stat(0)>0;tick++) {
    const x=api.entity(0,0,0);
    const enemy=Array.from({length:api.stat(3)},(_,i)=>i).find(i=>api.entity(1,i,5)>0);
    let input=2;
    if(enemy!==undefined) {
      const distance=api.entity(1,enemy,0)-x;
      input=Math.abs(distance)>40?(distance>0?2:1):0;
      if(tick%30===0) input|=8;
      if(api.entity(1,enemy,6)>24 && Math.abs(distance)<100 && api.stat(9)===0) input|=16;
    }
    api.tick(input);
  }
  assert.equal(api.stat(2),2);assert.equal(api.stat(1),200);
  assert.equal(api.stat(6),200);assert.equal(api.stat(7),1);assert.ok(api.stat(0)>0);
});
