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
