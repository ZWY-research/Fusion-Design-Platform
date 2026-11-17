import { defaultCase, validateGeometry } from './geometry.js';

export const quantities = {ne:['m^-3','电子密度'],Te:['keV','电子温度'],Ti:['keV','离子温度'],Pfusion:['MW','总聚变功率'],Q:['1','聚变增益'],duration:['s','目标持续运行时间'],B0:['T','轴上环向磁场'],Ip:['MA','等离子体电流'],R0:['m','大半径'],a:['m','小半径'],kappa:['1','分离面拉长比'],delta:['1','分离面三角形变'],RF_absorbed:['MW','吸收 RF 功率'],RF_launched:['MW','发射 RF 功率'],q_star:['1','q-star 形状代理'],beta:['1','环向热 beta']};
export const isEditable = c => c.caseId==='custom'&&!c.candidate_id;
const range = (value,unit,definition) => ({value,min:null,max:null,unit,definition});
export function fuelApplicability(f){return (f.H??0)===0&&(f.He3??0)===0&&(f.He4??0)===0&&f.D>0&&f.T>0?'D-T 输入；仍须完整模型条件，网页不求解':'尚未支持此燃料求解；不生成聚变功率或 Q';}
export function newTarget(source = defaultCase) {
  const c = structuredClone(source), p = c.physical ?? {};
  c.schemaVersion=1; c.caseId='custom'; c.label='自定义目标工况';
  c.provenance={copiedFrom:source.caseId,sourceIds:source.sourceIds??[],note:'复制输入及明确标记的性能目标；不复制求解输出。'};
  c.target={version:1,fuel:{D:.5,T:.5,unit:'1',definition:'主燃料粒子数分数，D+T=1；不代表杂质稀释'},state:Object.fromEntries(['ne','Te','Ti'].map(k=>[k,{...range(p[k]??(k==='Ti'?p.Te:null),quantities[k][0],quantities[k][1]),average:'volume',profile:''}])),
    goals:{Pfusion:range(source.results?.P_fusion_MW??null,'MW','总聚变功率目标，非计算输出'),Q:range(source.results?.Q_absorbed??null,'1','Pfusion/(Pohm+RFabs)'),duration:range(null,'s','目标持续运行时间，非能量约束时间')},
    fixedInputs:{B0:range(p.B0??null,'T','轴上环向磁场固定输入'),Ip:range(p.Ip??null,'MA','总等离子体电流固定输入')},hardConstraints:[],design:Object.fromEntries(['R0','a','kappa','delta'].map(k=>[k,{role:'fixed',min:null,max:null,unit:quantities[k][0],definition:quantities[k][1]}]))};
  if(source.target){c.target=structuredClone(source.target);c.provenance.copiedFromCandidate=source.candidate_id??null;}
  if(source.fuelPreset)c.target.fuel=structuredClone(source.fuelPreset);
  if(source.presetFields){for(const k of ['ne','Te','Ti'])c.target.state[k]=structuredClone(source.presetFields[k]);for(const k of ['B0','Ip'])c.target.fixedInputs[k]=structuredClone(source.presetFields[k]);}
  if(source.presetFields?.Pfusion)c.target.goals.Pfusion=structuredClone(source.presetFields.Pfusion);
  if(source===defaultCase){for(const k of ['ne','Te','Ti'])c.target.state[k]={...c.target.state[k],value:k==='ne'?1e20:10,kind:'platform_example',source:'平台示例值，非文献或求解结果'};for(const [k,value]of [['B0',5],['Ip',5]])c.target.fixedInputs[k]={...c.target.fixedInputs[k],value,kind:'platform_example',source:'平台示例值，非装置参考'};}
  c.provenance.fuel=structuredClone(c.target.fuel);c.target.solverApplicability=fuelApplicability(c.target.fuel);c.provenance.fields=structuredClone(source.presetFields??{});return invalidate(c);
}
export function invalidate(c) { c.results=null;c.physical={};delete c.constraints;delete c.candidate_id;delete c.geometry_id;delete c.candidateEvidence;c.resultKind='目标已编辑 · 计算结果尚未更新';c.validation='尚未求解；目标值、容许范围与几何不构成物理可行性验证。';return c; }
export function validateCase(c) {
  if(c?.schemaVersion!==1||c.caseId!=='custom'||!['tokamak','st','stellarator','spheromak','linear','frc','free'].includes(c.configuration)||!c.geometry||c.target?.version!==1) throw Error('不是支持的自定义工况 schemaVersion=1 / target.version=1。');
  {const e=validateGeometry(c.geometry);if(e)throw Error(e);}
  const t=c.target, f=t.fuel;
  const fractions=f&&Object.entries(f).filter(([k])=>['H','D','T','He3','He4'].includes(k)).map(([,v])=>v);
  if(f&&Object.entries(f).some(([k,v])=>typeof v==='number'&&!['H','D','T','He3','He4'].includes(k)))throw Error('未登记的离子组分');
  if(!f||f.unit!=='1'||!f.definition||!fractions.length||!fractions.every(v=>Number.isFinite(v)&&v>=0&&v<=1)||Math.abs(fractions.reduce((a,b)=>a+b,0)-1)>1e-8)throw Error('离子粒子数分数必须非负且合计为 1（H/D/T/He3/He4）。');
  const check=(r,k,required=false)=>{if(!r||r.unit!==quantities[k][0]||typeof r.definition!=='string'||!r.definition.trim())throw Error(`${k} 单位或定义不正确。`);for(const key of ['value','min','max'])if(r[key]!==null&&(!Number.isFinite(r[key])||(k!=='delta'&&r[key]<0)))throw Error(`${k} ${key} 必须是非负有限值或 null。`);if(required&&!(r.value>0))throw Error(`${k} 必须大于零。`);if(r.min!==null&&r.max!==null&&r.min>r.max)throw Error(`${k} 下限大于上限。`);if(r.value!==null&&((r.min!==null&&r.value<r.min)||(r.max!==null&&r.value>r.max)))throw Error(`${k} 值不在容许范围内。`);};
  for(const k of ['ne','Te','Ti']){const r=t.state?.[k];check(r,k,r?.value!==null);if(!['volume','line','axis','profile'].includes(r.average)||r.average==='profile'&&(typeof r.profile!=='string'||!r.profile.trim()))throw Error(`${k} 必须明确平均方式，剖面模式须填写定义。`);}
  for(const k of ['Pfusion','Q','duration'])check(t.goals?.[k],k);
  if(!['Pfusion/(Pohm+RFabs)','Pfusion/(Pohm+RFlaunch)'].includes(t.goals.Q.definition))throw Error('Q 必须明确吸收或发射加热口径。');
  for(const k of ['B0','Ip'])check(t.fixedInputs?.[k],k);
  if(!Array.isArray(t.hardConstraints))throw Error('硬约束必须是数组。');
  for(const r of t.hardConstraints){if(!quantities[r.quantity]||!['physical','engineering'].includes(r.domain))throw Error('硬约束需指定已定义 quantity 与 physical/engineering 类型。');check({...r,value:null},r.quantity);if(r.min===null&&r.max===null)throw Error('硬约束至少需一个界限。');}
  for(const k of ['R0','a','kappa','delta']){const r=t.design?.[k];check({...r,value:c.geometry[k]},k);if(!['fixed','optimize'].includes(r.role)||r.role==='optimize'&&(r.min===null||r.max===null||r.min>=r.max))throw Error(`${k} 优化变量须给出有效搜索上下限。`);}
  return c;
}
export function parseCase(text) { const c=JSON.parse(text);validateCase(c);return invalidate(c); }

export function mountTargetEditor({getCase,applyCase,markEdited}) {
  const host=document.getElementById('target-editor');
  host.innerHTML=`<legend>目标等离子体工况</legend><p class="note">输入为设计意图，非求解结果。空值为未知，不自动补作文献数据；平台示例值仅作起点。密度 m⁻³、温度 keV。</p><div class="target-actions"><button id="target-new">新建</button><button id="target-copy">复制当前案例</button></div><fieldset id="target-fields"><label>工况名称<input id="target-name" maxlength="80"></label><div class="target-pair"><label>H 分数<input id="fuel-H" type="number" step="any"></label><label>D 分数<input id="fuel-D" type="number" step="any"></label><label>T 分数<input id="fuel-T" type="number" step="any"></label></div><div id="target-rows"></div><label>Q 定义<select id="target-q"><option>Pfusion/(Pohm+RFabs)</option><option>Pfusion/(Pohm+RFlaunch)</option></select></label><details><summary>硬约束与设计变量</summary><p class="note">硬约束数组项：quantity（ne/Te/Ti/Pfusion/Q/duration/B0/Ip/R0/a/kappa/delta/RF_absorbed/RF_launched/q_star/beta）、domain（physical/engineering）、unit、definition、min/max（缺省界限填 null）。几何 design 中 role 为 fixed 或 optimize；优化须给出 min/max。仅声明，不执行搜索。</p><label>硬约束 JSON<textarea id="target-constraints" rows="5" spellcheck="false"></textarea></label><label>几何变量角色与范围 JSON<textarea id="target-design" rows="6" spellcheck="false"></textarea></label></details></fieldset><p id="target-message" role="status"></p><div class="target-actions"><button id="target-save">保存（单槽覆盖）</button><button id="target-load">加载本地</button><button id="target-export">导出 JSON</button><label class="file-button">导入 JSON<input id="target-import" type="file" accept=".json,application/json"></label></div>`;
  const $=id=>document.getElementById(id), fields=[];
  const secondary=document.createElement('details');secondary.innerHTML='<summary>性能目标与固定输入</summary>';
  for(const [group,keys] of [['state',['ne','Te','Ti']],['goals',['Pfusion','Q','duration']],['fixedInputs',['B0','Ip']]])for(const k of keys){
    const row=document.createElement('div');row.className='target-row';row.innerHTML=`<label>${quantities[k][1]} / ${quantities[k][0]}${group==='fixedInputs'?' · 固定输入':group==='goals'?' · 性能目标':' · 目标状态'}</label><div class="target-triple">${['value','min','max'].map((a,i)=>`<input id="target-${k}-${a}" type="number" step="any" aria-label="${k} ${a}" placeholder="${['目标/固定值','下限','上限'][i]}">`).join('')}</div>${group==='state'?`<select id="average-${k}" aria-label="${k} 平均定义"><option value="volume">体积平均</option><option value="line">线平均</option><option value="axis">中心值</option><option value="profile">剖面定义（待求解）</option></select><input id="profile-${k}" aria-label="${k} 剖面定义" placeholder="剖面公式、坐标与归一化定义">`:''}`;
    (group==='state'?$('target-rows'):secondary).append(row);fields.push([group,k]);
  }
  $('target-rows').append(secondary);
  const message=s=>$('target-message').textContent=s;
  function sync(){const c=getCase(),t=c.target,editable=isEditable(c);$('target-fields').disabled=!editable;$('target-fields').hidden=false;$('target-copy').disabled=editable;$('target-save').disabled=$('target-export').disabled=!editable; if(!t)return;message(fuelApplicability(t.fuel));
    $('target-name').value=c.label??'';for(const k of ['H','D','T'])$(`fuel-${k}`).value=t.fuel[k]??0;
    for(const [g,k]of fields){for(const a of ['value','min','max'])$(`target-${k}-${a}`).value=t[g][k][a]??'';if(g==='state'){$(`average-${k}`).value=t[g][k].average;$(`profile-${k}`).value=t[g][k].profile;}}
    $('target-q').value=t.goals.Q.definition;$('target-constraints').value=JSON.stringify(t.hardConstraints,null,2);$('target-design').value=JSON.stringify(t.design,null,2);
  }
  function collect(){if(!isEditable(getCase()))throw Error('请先复制为自定义工况。');const c=structuredClone(getCase()),t=c.target;c.label=$('target-name').value.trim()||'自定义目标工况';for(const k of ['H','D','T']){const next=$(`fuel-${k}`).value===''?null:Number($(`fuel-${k}`).value);if((t.fuel[k]??0)!==next)t.fuel.kind='user_input';t.fuel[k]=next;}t.solverApplicability=fuelApplicability(t.fuel);
    for(const [g,k] of fields){for(const a of ['value','min','max']){const s=$(`target-${k}-${a}`).value;const next=s===''?null:Number(s);if(a==='value'&&t[g][k][a]!==next){if(!Object.hasOwn(t[g][k],'referenceValue'))t[g][k].referenceValue=t[g][k][a];t[g][k].kind='user_input';}t[g][k][a]=next;}if(g==='state'){t[g][k].average=$(`average-${k}`).value;t[g][k].profile=$(`profile-${k}`).value;}}
    t.goals.Q.definition=$('target-q').value;t.hardConstraints=JSON.parse($('target-constraints').value);t.design=JSON.parse($('target-design').value);validateCase(c);return invalidate(c);
  }
  function action(fn){try{fn();}catch(e){message(e.message);}}
  $('target-fields').addEventListener('input',()=>{markEdited();action(()=>{const c=collect();applyCase(c,false);message('目标已编辑 · 尚未求解；保存前将再次校验。');});});
  $('target-new').onclick=()=>action(()=>{applyCase(newTarget());sync();message('已新建；请填写 ne、Te、Ti 后保存。');});
  $('target-copy').onclick=()=>action(()=>{applyCase(newTarget(getCase()));sync();message('已复制输入为自定义工况；参考值仅作显式目标，原始案例与计算输出未修改。');});
  $('target-save').onclick=()=>action(()=>{const c=collect();localStorage.setItem('fusion-design-platform:custom:v1',JSON.stringify(c));applyCase(c,false);message('已保存到当前浏览器/当前站点；清除浏览器数据会丢失，请导出备份。');});
  $('target-load').onclick=()=>action(()=>{const s=localStorage.getItem('fusion-design-platform:custom:v1');if(!s)throw Error('当前站点尚无本地工况。');applyCase(parseCase(s));sync();message('已加载本地工况；尚未求解。');});
  $('target-export').onclick=()=>action(()=>{const c=collect(),url=URL.createObjectURL(new Blob([JSON.stringify(c,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='fusion-target.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('已导出当前有效工况。');});
  $('target-import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1e6)throw Error('工况 JSON 超过 1 MB。');applyCase(parseCase(await file.text()));sync();message('已导入并校验；导入的结果字段已清除，尚未求解。');}catch(err){message(`导入失败：${err.message}`);}finally{e.target.value='';}};
  sync();return {sync};
}

