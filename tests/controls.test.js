import {test} from 'node:test';
import assert from 'node:assert/strict';
import {InputState,DEFAULT_BINDINGS,validBindings,keyLabel} from '../web/controls.js';

test('quick taps between simulation ticks are delivered exactly once',()=>{
  const state=new InputState();state.down('KeyJ');state.up('KeyJ');assert.equal(state.snapshot(),8);assert.equal(state.snapshot(),0);
  state.pointerDown(16);state.pointerUp(16);assert.equal(state.snapshot(),16);assert.equal(state.snapshot(),0);
});
test('held actions and combined input survive snapshots; clearing prevents stuck movement',()=>{
  const state=new InputState();state.down('KeyD');state.down('Space');assert.equal(state.snapshot(),6);assert.equal(state.snapshot(),6);
  state.up('Space');assert.equal(state.snapshot(16),18);state.clear();assert.equal(state.snapshot(),0);
});
test('remapped actions retain arrows and Shift aliases without duplicating invalid keys',()=>{
  const bindings=validBindings({...DEFAULT_BINDINGS,attack:'KeyF'});const state=new InputState(bindings);
  assert.equal(state.bit('KeyF'),8);assert.equal(state.bit('KeyJ'),0);assert.equal(state.bit('ArrowLeft'),1);assert.equal(state.bit('ShiftRight'),16);
  for(const invalid of [null,{}, {...DEFAULT_BINDINGS,attack:'KeyA'}, {...DEFAULT_BINDINGS,jump:'Escape'}, {...DEFAULT_BINDINGS,dodge:44}])assert.deepEqual(validBindings(invalid),DEFAULT_BINDINGS);
  assert.equal(keyLabel('KeyF'),'F');assert.equal(keyLabel('Space'),'Space');
});
test('older saved bindings retain custom keys when expedition actions are added',()=>{
  const old={left:'KeyA',right:'KeyD',jump:'Space',attack:'KeyE',dodge:'KeyK',down:'KeyS'};
  const migrated=validBindings(old);
  assert.equal(migrated.attack,'KeyE');assert.notEqual(migrated.interact,'KeyE');
  assert.equal(new Set(Object.values(migrated)).size,Object.keys(DEFAULT_BINDINGS).length);
  const state=new InputState(migrated);state.down(migrated.interact);assert.equal(state.snapshot(),64);
  state.clear();state.down(migrated.heal);assert.equal(state.snapshot(),128);
  state.clear();state.down(migrated.skill);assert.equal(state.snapshot(),256);
});
