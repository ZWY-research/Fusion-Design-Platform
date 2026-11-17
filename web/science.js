// Static, curated evidence only. This module never calls a physics solver.
import data from './cases.json';
export const cases = data.cases;
let plotlyPromise;
export const loadPlotly = () => plotlyPromise ??= import('plotly.js-basic-dist-min').then(m => m.default);
let generation = 0;
const cleanup = [];
export async function showScience(caseId,candidate=null) {
  const version = ++generation, current = candidate??cases.find(c => c.caseId === caseId);
  cleanup.splice(0).forEach(fn => fn());
  const host = document.getElementById('science-data');
  host.replaceChildren();
  document.querySelector('.metrics').hidden = !!current;
  document.querySelector('.result-note').hidden = !!current;
  document.getElementById('science-status').textContent = current ? current.resultKind : '未接入物理求解器';
  if (!current) return;
  const text = (tag, value, parent = host) => { const el = document.createElement(tag); el.textContent = value; parent.append(el); return el; };
  if(current.candidate_id){showCandidate(current,host,text);return;}
  text('h3', current.label);
  text('p', `${current.resultKind}。ne=${(current.physical.ne/1e20).toFixed(4)} ×10²⁰ m⁻³；Te=${current.physical.Te.toFixed(4)} keV；B₀=${current.physical.B0} T；Ip=${current.physical.Ip} MA；H98=${current.physical.H98}；${current.physical.fuel}。`);
  const values = current.results;
  text('p', `Pfusion=${values.P_fusion_MW.toFixed(3)} MW；Qabs=${values.Q_absorbed.toFixed(3)}；Qlaunch=${values.Q_launched == null ? '未给出（不换算文献值）' : values.Q_launched.toFixed(3)}；τE=${values.tau_E_s.toFixed(5)} s。`);
  text('p', 'Qabs=Pfusion/(Pohm+RFabs)；Qlaunch=Pfusion/(Pohm+RFlaunch)。两套参考工况不能混用。');
  text('p', current.validation); text('p', current.constraints);
  text('p', `几何来源：${current.geometrySource}。线圈与真空室仍为通用示意。缺失：${current.missing.join('；')}。`);
  const sources = text('p', '来源：');
  for (const id of current.sourceIds) { const s = data.sources[id]; const a = document.createElement('a'); a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = `${s.title ?? 'cfspopcon'} ${s.version ?? ''} ↗ `; sources.append(a); }
  text('p', '独立公开资料研究，与 MIT/CFS 无隶属或官方背书关系。本地静态证据展示；未执行在线计算，未复现完整工程装置。');
  if (caseId !== 'sparc-prd') { text('p', 'V2 历史运行空间数据不足，暂不绘制 POPCON；不以当前 PRD 替代。'); return; }
  text('h3', '网格敏感性 · 不同最优节点，不是固定点误差');
  const grid = text('div', ''); grid.className = 'science-plot'; grid.setAttribute('aria-label', '真实计算网格敏感性图');
  text('p', '来源：Phase 2 physics_validation.json / experiment_B；相同模型及范围，非嵌套网格。连线仅辅助阅读，未证明收敛。');
  text('h3', 'POPCON 采样 · 原始 40×30（无插值）');
  const pop = text('div', ''); pop.className = 'science-plot'; pop.setAttribute('aria-label', 'POPCON 原始节点和完整约束筛选图');
  text('p', '来源：原始 official_grid.csv（1200 节点）；灰点未通过完整 PRD 筛选，彩点通过筛选并显示 Qlaunch。仅为该模型筛选，不是物理可行性证明。');
  const layout = {paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{color:'#b7cbd9',size:11},margin:{l:65,r:55,t:25,b:70},legend:{orientation:'h',y:-.22},xaxis:{gridcolor:'#304353'},yaxis:{gridcolor:'#304353'},autosize:true};
  try {
    const Plotly = await loadPlotly(); if (version !== generation) return;
    const rows = data.gridSensitivity, x = rows.map(r => r.shape.join('×'));
    await Plotly.newPlot(grid, [
      {x,y:rows.map(r=>r.selected.P_fusion_MW),name:'Pfusion / MW',type:'scatter',mode:'lines+markers',line:{color:'#bca47c'}},
      ...['Q_absorbed','Q_launched'].map((k,i)=>({x,y:rows.map(r=>r.selected[k]),name:k==='Q_absorbed'?'Qabs / 1':'Qlaunch / 1',yaxis:'y2',type:'scatter',mode:'lines+markers',line:{color:i?'#66cbb5':'#7fa9db'}}))
    ],{...layout,width:grid.clientWidth,xaxis:{title:{text:'扫描网格 / 节点数'}},yaxis:{title:{text:'Pfusion / MW'},gridcolor:'#304353'},yaxis2:{title:{text:'Q / 无量纲'},overlaying:'y',side:'right'}},{responsive:true,displaylogo:false});
    if (version !== generation) { Plotly.purge(grid); return; }
    const allowed = data.popcon.points.filter(p=>p[4]), excluded = data.popcon.points.filter(p=>!p[4]);
    await Plotly.newPlot(pop,[
      {x:excluded.map(p=>p[1]),y:excluded.map(p=>p[0]),type:'scatter',mode:'markers',name:'未通过筛选',marker:{size:3,color:'#536578'},hovertemplate:'Te=%{x:.3f} keV<br>ne=%{y:.3f} ×10²⁰ m⁻³<br>未通过完整筛选<extra></extra>'},
      {x:allowed.map(p=>p[1]),y:allowed.map(p=>p[0]),customdata:allowed.map(p=>[p[2],p[3]]),type:'scatter',mode:'markers',name:'通过筛选',marker:{size:7,color:allowed.map(p=>p[3]),colorscale:'Viridis',showscale:true,colorbar:{title:{text:'Qlaunch / 1'},thickness:10}},hovertemplate:'Te=%{x:.3f} keV<br>ne=%{y:.3f} ×10²⁰ m⁻³<br>Pfusion=%{customdata[0]:.3f} MW<br>Qlaunch=%{customdata[1]:.3f}<extra></extra>'}
    ],{...layout,width:pop.clientWidth,xaxis:{title:{text:'体积平均 Te / keV'},gridcolor:'#304353'},yaxis:{title:{text:'体积平均 ne / 10²⁰ m⁻³'},gridcolor:'#304353'}},{responsive:true,displaylogo:false});
    if (version !== generation) { Plotly.purge(grid); Plotly.purge(pop); return; }
    for (const el of [grid,pop]) {
      const observer = new ResizeObserver(() => { if (el.isConnected && el.clientWidth) Plotly.relayout(el,{width:el.clientWidth}); });
      observer.observe(el); cleanup.push(() => { observer.disconnect(); Plotly.purge(el); });
    }
  } catch { if (version === generation) text('p', '图表加载失败；上方来源与数值仍可查阅。'); }
}

function showCandidate(c,host,text){
  const r=c.candidateEvidence;
  text('h3',c.label);text('p',`${r.candidate_id} · 模型 ${r.model_branch} / adapter ${r.model_version} · ${r.solver_status} · ${c.resultKind}`);
  if(r.classification!=='model_pass')text('p','本点未通过模型筛选。下列为原始模型估算，不能解释为可运行性能或可实现增益。');
  text('p',`输入体积平均 ne=${(c.physical.ne/1e20).toFixed(4)} ×10²⁰ m⁻³；Te=${c.physical.Te.toFixed(5)} / Ti=${c.physical.Ti.toFixed(5)} keV；BT=${c.physical.B0} T；Ip=${c.physical.Ip} MA。κsep=${c.geometry.kappa}，δsep=${c.geometry.delta}。`);
  const metrics=text('div','');metrics.className='candidate-metrics';metrics.id='candidate-metrics';
  const keys={P_fusion_MW:'聚变功率',Q_absorbed:'Qabs',Q_launched:'Qlaunch',P_RF_absorbed_MW:'吸收 RF',P_RF_launched_MW:'发射 RF',P_ohmic_MW:'欧姆加热',P_alpha_deposited_MW:'Alpha 沉积',P_radiation_MW:'芯部辐射',P_SOL_MW:'分离面输运功率',W_thermal_MJ:'热储能',tau_E_s:'所选定义 τE',plasma_volume_m3:'等离子体体积'};
  const fmt=v=>v==null?'未计算':Number(v).toPrecision(7);
  for(const [key,label]of Object.entries(keys)){const q=r.results[key];const card=text('article','',metrics);card.dataset.quantity=key;text('span',label,card);text('strong',`${fmt(q?.value)} ${q?.unit??''}`,card);text('p',q?.definition??'未计算',card);}
  text('p','Qabs=Pf/(Pohm+RFabs)，Qlaunch=Pf/(Pohm+RFlaunch)。RFlaunch 不是墙插功率。τE 的密度/功率口径依明确分支，不混用 PRD 与 V2。');
  text('h3','逐项约束与裕量 · 仅所选模型的数值筛选');
  const wrap=text('div','');wrap.className='table-scroll';const table=text('table','',wrap);table.id='candidate-constraints';
  const header=text('tr','',table);for(const s of ['约束 / 状态','计算值 / 单位','下限 / 上限','下侧 / 上侧裕量','模型与适用条件'])text('th',s,header);
  for(const q of r.constraints){const tr=text('tr','',table);tr.dataset.constraint=q.name;tr.dataset.passed=String(q.passed);
    for(const value of [`${q.name} · ${q.passed===true?'通过':q.passed===false?'不通过':'未评价'}`,`${fmt(q.value)} ${q.unit}`,`${q.min==null?'无':fmt(q.min)} / ${q.max==null?'无':fmt(q.max)}`,`${q.margins.lower==null?'—':fmt(q.margins.lower)} / ${q.margins.upper==null?'—':fmt(q.margins.upper)}`,`${q.model}；${q.applicability}`])text('td',value,tr);}
  const details=text('details','');text('summary','模型假设、未验证项及数据来源',details);
  for(const note of [...r.model.assumptions,...r.limitations])text('p',note,details);
  text('p',`模型：${JSON.stringify(r.model.settings)}`,details);
  text('p',`未验证：${r.unverified.join('；')}。${c.validation}`,details);
  text('p',`证据：${r.studyEvidence.source} / SHA-256 ${r.studyEvidence.searchSha256}；原始输入 SHA-256 ${r.evidence.inputSha256}；候选完整计算 SHA-256 ${r.evidence.forwardResultSha256}；cfspopcon ${r.studyEvidence.cfspopconVersion}。公开节选可核验，不含完整本地计算环境。`,details);
  for(const source of r.sources){const a=text('a',`${source.title} ↗ `,details);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';}
}
