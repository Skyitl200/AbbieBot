import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { LAB_SETS, LAB_CATEGORIES, labModelsMessage } from '../src/services/study/labModels.js';

const manifest = JSON.parse(readFileSync(new URL('../study-data/lab-models/spinal-nerves.json', import.meta.url)));
const asset = file => readFileSync(new URL(`../study-assets/lab-models/${file}`, import.meta.url));
const hash = data => createHash('sha256').update(data).digest('hex');

test('removed spinal nerves and plexuses set is absent from the lab menu', () => {
  assert.ok(LAB_CATEGORIES.some(category => category.id === 'nervous'));
  assert.equal(labModelsMessage('u', 'nervous').components[0].toJSON().components[0].options.some(option => option.value === 'spinal-nerves'), false);
  assert.equal(LAB_SETS.some(set => set.id === 'spinal-nerves'), false);
});

test('every card preserves original photo pixels outside the recorded overlay', () => {
  assert.equal(hash(asset(manifest.sourceImageFile)), manifest.sourceImageSha256);
  assert.equal(hash(asset(manifest.originalUploadFile)), manifest.originalUploadSha256);
  const original = PNG.sync.read(asset(manifest.sourceImageFile));
  assert.equal(original.width, 362);
  assert.equal(original.height, 1024);
  function near(x, y, vertices) {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const [ax, ay] = vertices[j], [bx, by] = vertices[i];
      if ((ay > y) !== (by > y) && x < (bx-ax)*(y-ay)/(by-ay)+ax) inside = !inside;
      const dx=bx-ax, dy=by-ay;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
      if (Math.hypot(x-ax-t*dx,y-ay-t*dy)<=1.5) return true;
    }
    return inside;
  }
  for (const model of manifest.models) {
    const raw = asset(model.expectedImageFile);
    assert.equal(hash(raw), model.imageSha256);
    const image = PNG.sync.read(raw);
    const view=model.view;
    const scale=view?.scale || 1;
    const left=view?.crop[0] || 0, top=view?.crop[1] || 0;
    assert.equal(image.width, view ? (view.crop[2]-left)*scale : original.width);
    assert.equal(image.height, view ? (view.crop[3]-top)*scale : original.height);
    let changed=0;
    for (let pixel=0;pixel<image.width*image.height;pixel++) {
      const i=pixel*4;
      const ox=Math.floor((pixel%image.width)/scale)+left;
      const oy=Math.floor(Math.floor(pixel/image.width)/scale)+top;
      const oi=(oy*original.width+ox)*4;
      if (image.data[i]!==original.data[oi] || image.data[i+1]!==original.data[oi+1] || image.data[i+2]!==original.data[oi+2]) {
        changed++;
        assert.ok((model.annotation.overlayPolygons || [model.annotation.overlayPolygon]).some(p=>near(ox,oy,p)), model.id);
        const rgb=[...image.data.subarray(i,i+3)].join(',');
        assert.ok(['0,0,0','0,229,255'].includes(rgb));
      }
    }
    assert.ok(changed>0 && changed<image.width*image.height*(view ? .1 : .02));
  }
});
