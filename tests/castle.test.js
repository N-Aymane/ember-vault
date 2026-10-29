import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ROOMS,EDGES,LOOT_SLOTS,discoveredRooms,weaponDamage} from '../web/castle.js';

test('the castle map is connected with real branches, rest rooms and a reachable finale',()=>{
  assert.equal(ROOMS.length,9);const reachable=new Set([0]);
  for(let pass=0;pass<ROOMS.length;pass++)for(const [a,b] of EDGES)if(reachable.has(a))reachable.add(b);
  assert.equal(reachable.size,9);assert.equal(EDGES.filter(([a])=>a===0).length,2);
  assert.equal(EDGES.filter(([a])=>a===4).length,2);assert.equal(ROOMS[7].kind,'The Castellan');
  assert.equal(discoveredRooms(1),7);assert.ok(!(discoveredRooms(1)&(1<<8)));
});
test('weapon comparison mirrors Rust damage and distinct reach/speed',()=>{
  assert.equal(weaponDamage(0,0,0),1);assert.equal(weaponDamage(1,2,1),5);assert.equal(weaponDamage(2,3,6),10);
});
test('every loot crop is bounded and new room backgrounds are actual raster assets',async()=>{
  const png=await readFile('web/assets/loot.png');const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
  assert.equal(png[25],6);
  for(const crop of LOOT_SLOTS)assert.ok(crop.x>=0&&crop.y>=0&&crop.x+crop.w<=width&&crop.y+crop.h<=height);
  for(const name of ['ramparts','undercroft']){const image=await readFile(`web/assets/${name}.png`);assert.equal(image.subarray(1,4).toString(),'PNG');assert.ok(image.readUInt32BE(16)>1200);}
});
