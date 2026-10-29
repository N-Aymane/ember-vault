export const DEFAULT_BINDINGS = Object.freeze({left:'KeyA',right:'KeyD',jump:'Space',attack:'KeyJ',dodge:'KeyK',down:'KeyS',interact:'KeyE',heal:'KeyH',skill:'KeyQ'});
export const ACTION_BITS = Object.freeze({left:1,right:2,jump:4,attack:8,dodge:16,down:32,interact:64,heal:128,skill:256});
const ALIASES = {ArrowLeft:1,ArrowRight:2,ArrowUp:4,ArrowDown:32,ShiftLeft:16,ShiftRight:16};
export function keyLabel(code) { return code.replace(/^Key/,'').replace(/^Digit/,'').replace('Arrow','').replace('Left','').replace('Right','') || code; }
export function validBindings(value) {
  if(!value || typeof value!=='object') return {...DEFAULT_BINDINGS};
  const merged={...DEFAULT_BINDINGS,...value};
  const used=new Set();
  for(const key of Object.keys(DEFAULT_BINDINGS)){
    if(value[key]===undefined&&used.has(merged[key]))merged[key]=['KeyG','KeyT','KeyV','KeyB','KeyP'].find(code=>!used.has(code));
    used.add(merged[key]);
  }
  const values=Object.keys(DEFAULT_BINDINGS).map(key=>merged[key]);
  if(values.some(code=>typeof code!=='string' || !/^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|ShiftRight|ControlLeft|ControlRight)$/.test(code)) || new Set(values).size!==values.length) return {...DEFAULT_BINDINGS};
  return Object.fromEntries(Object.keys(DEFAULT_BINDINGS).map(key=>[key,merged[key]]));
}
export class InputState {
  constructor(bindings=DEFAULT_BINDINGS) { this.bindings={...bindings};this.keys=new Set();this.mouse=new Set();this.pending=0; }
  bit(code) { const action=Object.keys(this.bindings).find(action=>this.bindings[action]===code);return action?ACTION_BITS[action]:(ALIASES[code]||0); }
  down(code) { const bit=this.bit(code);if(!this.keys.has(code))this.pending|=bit;this.keys.add(code);return bit; }
  up(code) { this.keys.delete(code); }
  pointerDown(bit) { if(!this.mouse.has(bit))this.pending|=bit;this.mouse.add(bit); }
  pointerUp(bit) { this.mouse.delete(bit); }
  snapshot(pad=0) { let bits=this.pending|pad;for(const code of this.keys)bits|=this.bit(code);for(const bit of this.mouse)bits|=bit;this.pending=0;return bits; }
  clear() { this.keys.clear();this.mouse.clear();this.pending=0; }
}
