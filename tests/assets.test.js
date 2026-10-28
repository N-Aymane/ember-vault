import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('every generated animation crop and ground anchor fits its actual PNG',async()=>{
  for(const name of ['hero','sentry']){
    const spec=JSON.parse(await readFile(`web/assets/${name}.json`,'utf8'));
    const png=await readFile(`web/assets/${spec.image}`);
    assert.equal(png.subarray(1,4).toString(),'PNG');
    const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
    assert.equal(png[25],6,'Character art must retain its RGBA transparency');
    for(const f of spec.frames){assert.ok(f.x>=0&&f.y>=0&&f.w>0&&f.h>0&&f.x+f.w<=width&&f.y+f.h<=height);assert.ok(f.anchorX>=0&&f.anchorX<=f.w&&f.anchorY>=0&&f.anchorY<=f.h&&f.height>0);}
    assert.equal(spec.rows.length,4);for(const row of spec.rows){assert.ok(row.length>0);for(const index of row)assert.ok(Number.isInteger(index)&&spec.frames[index]);}
  }
});
