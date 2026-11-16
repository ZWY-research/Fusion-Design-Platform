// Static, curated evidence only. This module never calls a physics solver.
import data from './cases.json';
export const cases = data.cases;
let plotlyPromise;
const plotly = () => plotlyPromise ??= import('plotly.js-basic-dist-min').then(m => m.default);
let generation = 0;
const cleanup = [];
export async function showScience(caseId) {
  const version = ++generation, current = cases.find(c => c.caseId === caseId);
  cleanup.splice(0).forEach(fn => fn());
  const host = document.getElementById('science-data');
  host.replaceChildren();
  document.querySelector('.metrics').hidden = !!current;
  document.querySelector('.result-note').hidden = !!current;
  document.getElementById('science-status').textContent = current ? current.resultKind : '未接入物理求解器';
  if (!current) return;
  const text = (tag, value, parent = host) => { const el = document.createElement(tag); el.textContent = value; parent.append(el); return el; };
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
    const Plotly = await plotly(); if (version !== generation) return;
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
