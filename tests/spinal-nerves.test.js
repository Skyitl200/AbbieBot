import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { LAB_SETS, LAB_CATEGORIES, labQuestions, labModelImage, labCategoryMessage, labModelsMessage } from '../src/services/study/labModels.js';
import { matchesLabAnswer } from '../src/services/study/answerMatching.js';

const manifest = JSON.parse(readFileSync(new URL('../study-data/lab-models/spinal-nerves.json', import.meta.url)));
const asset = file => readFileSync(new URL(`../study-assets/lab-models/${file}`, import.meta.url));
const hash = data => createHash('sha256').update(data).digest('hex');

test('Nervous System menu exposes the spinal nerves set in both answer modes', () => {
  assert.ok(LAB_CATEGORIES.some(category => category.id === 'nervous'));
  assert.ok(labCategoryMessage('u').components[0].toJSON().components[0].options.some(option => option.value === 'nervous'));
  assert.ok(labModelsMessage('u', 'nervous').components[0].toJSON().components[0].options.some(option => option.value === 'spinal-nerves'));
  const set = LAB_SETS.find(set => set.id === 'spinal-nerves');
  assert.equal(set.models.length, 17);
  assert.equal(new Set(set.models.map(model => model.id)).size, 17);
  for (const mode of ['multiple_choice', 'typed']) {
    const questions = labQuestions('spinal-nerves', mode);
    assert.equal(questions.length, 17);
    for (const q of questions) {
      assert.ok(labModelImage(q));
      if (mode === 'multiple_choice') {
        assert.equal(q.options.length, 4);
        assert.equal(new Set(q.options).size, 4);
        assert.equal(q.options[q.correct[0]], q.modelName);
      } else {
        assert.equal(q.type, 'fill_blank');
        assert.ok(matchesLabAnswer(q.modelName, q.answers, q.competingAnswers));
      }
    }
  }
});

test('typed grading keeps adjacent nerves and plexuses distinct and accepts peroneal alias', () => {
  const qs = labQuestions('spinal-nerves', 'typed');
  const find = text => qs.find(q => q.modelName.startsWith(text));
  for (const [target, wrong] of [['Median nerve', 'radial nerve'], ['Ulnar nerve', 'median nerve'], ['Lumbar plexus', 'sacral plexus'], ['Cervical plexus', 'cervical nerves']]) {
    const q = find(target);
    assert.equal(matchesLabAnswer(wrong, q.answers, q.competingAnswers), false);
  }
  const fibular = find('Common fibular');
  assert.ok(matchesLabAnswer('common peroneal nerve', fibular.answers, fibular.competingAnswers));
  assert.match(find('Phrenic').question, /side of the neck/);
  assert.match(find('Femoral').question, /lumbar plexus origin/);
  assert.ok(manifest.models.every(model => model.reference?.startsWith('User supplied individual')));
  assert.match(manifest.models.find(model => model.name === 'Cervical plexus').questions[0].explanation, /usual core is C1–C4/);
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
