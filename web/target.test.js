import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newTarget, validateCase, parseCase } from './target.js';
import {fuelApplicability} from './target.js';
const reference = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url))).cases[0];
test('all presets copy with explicit unknowns and H/D/T modes round-trip without predictions',()=>{
  const presets=JSON.parse(readFileSync(new URL('./cases.json',import.meta.url))).cases;
  assert.equal(presets.length,6);
  for(const p of presets){const c=newTarget(p);validateCase(c);const round=parseCase(JSON.stringify(c));assert.equal(round.results,null);assert.deepEqual(round.target.fuel,c.target.fuel);assert.ok(round.provenance.fields);}
  const h=newTarget(presets.find(c=>c.caseId==='iter-h'));assert.match(fuelApplicability(h.target.fuel),/尚未支持/);assert.equal(h.target.goals.Q.value,null);
  h.target.fuel.H=.5;assert.throws(()=>validateCase(h));
  const arc=newTarget(presets.find(c=>c.caseId==='arc-2015'));assert.equal(arc.target.state.Te.value,14);assert.equal(arc.target.state.Ti.value,14);assert.equal(arc.target.state.Ti.kind,'model_assumption');
  const custom=newTarget();validateCase(custom);assert.equal(custom.target.state.ne.kind,'platform_example');
});

test('reference copy preserves source and separates targets from solver results', () => {
  const original = JSON.stringify(reference), copy = newTarget(reference);
  validateCase(copy);
  assert.equal(copy.target.goals.Q.value, reference.results.Q_absorbed);
  assert.equal(copy.results, null);
  assert.deepEqual(copy.physical, {});
  copy.geometry.a = .6;
  assert.equal(JSON.stringify(reference), original);
});

test('JSON round trip preserves averaging and removes untrusted solver outputs', () => {
  const c = newTarget(reference);
  c.target.state.ne.average = 'line';
  c.results = {P_fusion_MW:999};
  const loaded = parseCase(JSON.stringify(c));
  assert.equal(loaded.target.state.ne.average, 'line');
  assert.equal(loaded.results, null);
  assert.throws(() => parseCase('{broken'));
});

test('invalid fuel, units, ranges, profile and geometry fail before persistence', () => {
  for (const change of [
    c => c.target.fuel.T = .9,
    c => c.target.state.ne.unit = 'cm^-3',
    c => c.target.state.Te.value = 0,
    c => {c.target.goals.Q.min=20;c.target.goals.Q.max=10;},
    c => {c.target.state.Ti.average='profile';c.target.state.Ti.profile='';},
    c => c.geometry.a = 5,
    c => c.target.design.a.role = 'optimize',
  ]) { const c=newTarget(reference);change(c);assert.throws(()=>validateCase(c)); }
});

test('fixed inputs, explicit hard constraints and bounded design variables remain distinct', () => {
  const c=newTarget(reference);
  c.target.design.a={...c.target.design.a,role:'optimize',min:.3,max:.8};
  c.target.hardConstraints=[{quantity:'Pfusion',domain:'engineering',unit:'MW',definition:'用户指定功率硬上限',min:null,max:140}];
  validateCase(c);
  assert.equal(c.target.fixedInputs.B0.value,12.2);
  assert.equal(c.target.goals.Pfusion.value,140);
  assert.equal(c.results,null);
});
