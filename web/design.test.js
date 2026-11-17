import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateCase,designData,geometryPairs,pairCategory} from './design.js';
import {validateCase,newTarget,invalidate,parseCase,isEditable} from './target.js';

test('reviewed dataset has 62 unique candidate links and 31 complete A/B pairs',()=>{
  assert.equal(designData.candidates.length,62);
  assert.equal(new Set(designData.candidates.map(r=>r.candidate_id)).size,62);
  const pairs=geometryPairs();assert.equal(pairs.length,31);
  for(const pair of pairs){assert.deepEqual(pair.A.geometry,pair.B.geometry);assert.notEqual(pair.A.candidate_id,pair.B.candidate_id);}
  const coarse=pairs.filter(p=>p.A.sample_stage==='coarse');
  assert.equal(coarse.length,25);
  assert.deepEqual(Object.fromEntries(['both','A','B','neither'].map(k=>[k,coarse.filter(p=>pairCategory(p)===k).length])),{both:11,A:4,B:8,neither:2});
  assert.equal(pairCategory({A:{classification:'model_pass'},B:{classification:'calculation_failed'}}),'unknown');
});

test('each selected case keeps exact branch metrics, geometry, constraints and evidence',()=>{
  for(const r of designData.candidates){const c=candidateCase(r.candidate_id);validateCase(c);
    assert.deepEqual(c.geometry,r.geometry);assert.equal(c.results.P_fusion_MW,r.results.P_fusion_MW.value);
    assert.equal(c.target.models.confinement,designData.models[r.model_branch].settings.confinement);
    assert.deepEqual(c.candidateEvidence.constraints,r.constraints);assert.match(r.evidence.forwardResultSha256,/^[a-f0-9]{64}$/);
    assert.equal(isEditable(c),false);assert.equal(c.candidate_id,r.candidate_id);
    for(const q of r.constraints){assert.equal(q.margins.upper,q.max==null?null:q.max-q.value);assert.equal(q.margins.lower,q.min==null?null:q.value-q.min);}
  }
  assert.throws(()=>candidateCase('invented'));
});

test('same geometry switches A/B without borrowing results; edits remove calculation identity',()=>{
  const pair=geometryPairs().find(p=>pairCategory(p)==='A');
  const a=candidateCase(pair.A.candidate_id),b=candidateCase(pair.B.candidate_id);
  assert.deepEqual(a.geometry,b.geometry);assert.notEqual(a.results.Q_launched,b.results.Q_launched);
  assert.notEqual(a.resultKind,b.resultKind);
  const copy=newTarget(b);validateCase(copy);
  assert.equal(copy.candidate_id,undefined);assert.equal(copy.candidateEvidence,undefined);assert.equal(copy.results,null);
  assert.deepEqual(copy.target.models,b.target.models);assert.deepEqual(copy.target.hardConstraints,b.target.hardConstraints);
  assert.equal(isEditable(copy),true);copy.geometry.R0+=.001;invalidate(copy);assert.equal(copy.results,null);
  const loaded=parseCase(JSON.stringify(b));assert.equal(loaded.results,null);assert.equal(loaded.candidate_id,undefined);
  assert.ok(b.candidateEvidence); // Source record remains read-only and intact.
});

test('generic RF/q-star/beta constraints round-trip and reject incompatible units',()=>{
  const c=newTarget(candidateCase(designData.candidates[0].candidate_id));
  const loaded=parseCase(JSON.stringify(c));
  assert.deepEqual(loaded.target.hardConstraints,c.target.hardConstraints);
  loaded.target.hardConstraints[0].unit='W';assert.throws(()=>validateCase(loaded));
});
