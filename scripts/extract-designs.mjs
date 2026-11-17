// Export reviewed scalar operating-point results, never atomic data or local paths.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const source=path.resolve(process.argv[2]??''),output=process.argv[3];
if(!process.argv[2]||!output)throw Error('Usage: node scripts/extract-designs.mjs <search.json> <output.json>');
const bytes=fs.readFileSync(source),study=JSON.parse(bytes),root=path.dirname(source);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const canonical=value=>JSON.stringify(value);
const candidates=study.candidates.map(row=>{
  const file=path.resolve(root,row.forward_result_path);
  if(path.relative(root,file).startsWith('..'))throw Error('Unexpected result location');
  const raw=fs.readFileSync(file),result=JSON.parse(raw);
  assert.equal(hash(raw),row.forward_result_sha256);
  assert.deepEqual(result.originalInput,row.case);
  assert.deepEqual(result.results,row.results);assert.deepEqual(result.constraints,row.constraints);
  assert.deepEqual(row.case.target.models,study.plan.branches[row.model_branch]);
  for(const key of ['state','fuel','fixedInputs','hardConstraints','goals'])assert.deepEqual(row.case.target[key],study.plan.referenceInput.target[key]);
  return {candidate_id:row.candidate_id,geometry_id:row.geometry_id,model_branch:row.model_branch,model_version:row.model_version,
    sample_stage:row.sample_stage,geometry:row.case.geometry,classification:row.classification,solver_status:row.solver_status,
    results:row.results,constraints:row.constraints,unverified:row.unverified,engineeringFeasible:null,
    evidence:{inputSha256:result.reproducibility.inputSha256,forwardResultSha256:row.forward_result_sha256},
    validation:row.numerical_validation};
});
const first=study.candidates[0].case;
const template={schemaVersion:1,caseId:'custom',configuration:'tokamak',geometry:study.plan.referenceInput.geometry,
  label:'二维候选目标输入',units:study.plan.referenceInput.units,engineeringGeometry:'schematic',physical:{},results:null,
  sourceIds:['cfspopcon'],target:structuredClone(first.target)};
delete template.target.models;
const models=Object.fromEntries(Object.entries(study.plan.branches).map(([branch,settings])=>{
  const row=study.candidates.find(r=>r.model_branch===branch),r=JSON.parse(fs.readFileSync(path.resolve(root,row.forward_result_path)));
  return [branch,{settings,version:r.models.version,assumptions:r.reproducibility.assumptions}];
}));
const data={schemaVersion:1,study_id:study.study_id,caseTemplate:template,models,candidates,
  sampling:{axes:study.plan.axes,aspect_ratio_limits:study.plan.aspect_ratio_limits,coarse_geometry_count:25,total_geometry_count:31,
    description:'参考附近 ±5% 的 5×5 粗网格与 6 个局部中点；两分支逐点求解。仅离散模型筛选，无连续精确边界。'},
  summary:study.summary,
  evidence:{source:'Research node 02 / search.json',searchSha256:hash(bytes),forwardSourceSha256:study.provenance.forward_source_sha256,
    cfspopconVersion:'9.0.1',cfspopconCommit:'0ebfb43c614c71b0c6946209b826cfc19da6a0e8',
    verification:JSON.parse(fs.readFileSync(path.join(root,'verification.json'),'utf8'))},
  sources:[{title:'cfspopcon 9.0.1',url:'https://github.com/cfs-energy/cfspopcon/tree/0ebfb43c614c71b0c6946209b826cfc19da6a0e8'},
    {title:'SPARC 2020 Physics Basis（独立文献参照，尚未完整复现）',url:'https://doi.org/10.1017/S0022377820001257'}],
  limitations:['固定体积平均 ne/Te/Ti 与模型处方，不固定逐半径绝对剖面','A：PRD 均值乘积储能/体积密度代理/总损失 H98；B：01C 解析 D 形/归一化剖面/常平均电荷准中性/中心弦/总损失 H98',
    '目标 Pf/Q 不作为未声明的硬约束；本次无 140 MW 聚变功率上限','模型筛选通过不代表磁平衡、输运、MHD、工程或实验验证；未执行网页在线求解',
    '公开数据为自行计算的全局工况指标，不含 OPEN-ADAS 原始表、处理后原子数组或完整剖面；独立研究，无 MIT/CFS 背书']};
const text=canonical(data)+'\n';
if(/(?:["\s][A-Z]:[\\/]|BEGIN .*PRIVATE KEY|gh[pousr]_[A-Za-z0-9]{20,}|radas_dir|site-packages)/i.test(text))throw Error('Private material in public projection');
fs.writeFileSync(output,text);
console.log(`${candidates.length} verified candidates exported; ${Buffer.byteLength(text)} bytes; source ${data.evidence.searchSha256}`);
