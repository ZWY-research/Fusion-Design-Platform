import data from './designs.json' with {type:'json'};
export const designData=data;
export const categoryLabels={both:'A、B 共同通过',A:'仅 A 通过',B:'仅 B 通过',neither:'两模型均未通过',unknown:'失败 / 不可判定'};
export const resultLabels={model_pass:'模型筛选通过',model_reject:'模型筛选不通过',model_not_applicable:'模型不适用',calculation_failed:'计算失败',invalid_input:'输入无效',undetermined:'不可判定'};
export function geometryPairs(source=data){
  const groups=new Map();
  for(const r of source.candidates){if(!groups.has(r.geometry_id))groups.set(r.geometry_id,{});groups.get(r.geometry_id)[r.model_branch]=r;}
  return [...groups.values()];
}
export function pairCategory(pair){
  if(!['model_pass','model_reject'].includes(pair.A?.classification)||!['model_pass','model_reject'].includes(pair.B?.classification))return 'unknown';
  return pair.A.classification==='model_pass'?(pair.B.classification==='model_pass'?'both':'A'):(pair.B.classification==='model_pass'?'B':'neither');
}
export function candidateCase(id,source=data){
  const row=source.candidates.find(r=>r.candidate_id===id);if(!row)throw Error('未知 candidate_id');
  const c=structuredClone(source.caseTemplate);c.geometry=structuredClone(row.geometry);
  c.target.models=structuredClone(source.models[row.model_branch].settings);
  c.candidate_id=id;c.geometry_id=row.geometry_id;c.label=`候选 ${row.model_branch} · R₀=${c.geometry.R0} m / a=${c.geometry.a} m`;
  c.results=Object.fromEntries(Object.entries(row.results).map(([k,q])=>[k,q.value]));
  c.physical={ne:c.target.state.ne.value,Te:c.target.state.Te.value,Ti:c.target.state.Ti.value,
    B0:c.target.fixedInputs.B0.value,Ip:c.target.fixedInputs.Ip.value,H98:c.target.models.parameters.confinement_time_scalar.value,fuel:'D/T'};
  c.candidateEvidence=structuredClone({...row,model:source.models[row.model_branch],sources:source.sources,studyEvidence:source.evidence,limitations:source.limitations});
  c.resultKind=`${resultLabels[row.classification]} · 高保真未验证`;
  c.validation='离线 0D/1D 模型计算；未求解磁平衡、输运、MHD 或工程，不是实验/工程可行性证明。';
  c.geometrySource='节点 02 实际离散候选；参数化几何及示意线圈/真空室，非工程模型';
  return c;
}

export function mountDesignWorkspace({onSelect,loadPlotly}){
  const host=document.getElementById('design-workspace');
  host.innerHTML=`<h3>R₀–a 二维设计空间</h3><p>真实离线采样：31 个几何、62 个候选。圆点为粗网格，菱形为局部中点；空白未验证，无连续精确边界。固定体积平均 ne/Te/Ti、BT/Ip、κ/δ、燃料及各模型处方。</p><div class="design-controls"><label>查看模型<select id="design-model"><option value="A">A · 冻结 PRD 默认模型</option><option value="B">B · 01C 显式物理闭合</option></select></label><label>选择候选（也可点击图中节点）<select id="design-candidate"></select></label></div><p id="design-selection" role="status">尚未选择候选；点击节点后更新三维与下方科学结果。</p><div id="design-plot" class="science-plot" aria-label="R0-a 真实离散设计空间"></div><p>颜色表示两模型的配对判定，当前模型决定点击后加载的结果。同几何切换 A/B 可分别查看，不混用指标。所有工程结构仍为示意。</p><button id="design-view" class="secondary">查看当前三维视窗 ↑</button>`;
  const model=document.getElementById('design-model'),select=document.getElementById('design-candidate'),plot=document.getElementById('design-plot');
  const pairs=geometryPairs();let selectedGeometry=null,selectedId=null,generation=0,Plotly;
  function options(){
    select.replaceChildren(new Option('— 选择实际计算候选 —',''));
    for(const pair of pairs){const r=pair[model.value];if(r)select.add(new Option(`R₀ ${r.geometry.R0} / a ${r.geometry.a} m · ${resultLabels[r.classification]}`,r.candidate_id));}
    select.value=selectedId??'';
  }
  async function draw(){
    const version=++generation;
    try{
      Plotly=await loadPlotly();if(version!==generation)return;
      const palette={both:'#64d4bd',A:'#e9bc72',B:'#8aaeea',neither:'#b0808c',unknown:'#91a0b2'};
      const traces=Object.entries(categoryLabels).map(([key,name])=>{
        const rows=pairs.filter(p=>pairCategory(p)===key).map(p=>p[model.value]).filter(Boolean);
        return {name,type:'scatter',mode:'markers',x:rows.map(r=>r.geometry.R0),y:rows.map(r=>r.geometry.a),customdata:rows.map(r=>r.candidate_id),
          text:rows.map(r=>`${r.candidate_id}<br>模型 ${r.model_branch} · ${resultLabels[r.classification]}<br>Pfusion=${r.results.P_fusion_MW?.value?.toFixed(3)??'未知'} MW · Qlaunch=${r.results.Q_launched?.value?.toFixed(3)??'未知'}<br>仅该模型估算；未通过点不代表可运行性能`),
          marker:{size:11,color:palette[key],symbol:rows.map(r=>r.sample_stage==='coarse'?'circle':'diamond'),line:{color:'#15212d',width:1}},
          hovertemplate:'R₀=%{x:.6f} m<br>a=%{y:.9f} m<br>%{text}<extra></extra>'};
      });
      const chosen=data.candidates.find(r=>r.candidate_id===selectedId);
      if(chosen)traces.push({type:'scatter',mode:'markers',name:'当前候选',showlegend:false,x:[chosen.geometry.R0],y:[chosen.geometry.a],customdata:[chosen.candidate_id],hoverinfo:'skip',marker:{size:20,symbol:'circle-open',color:'#ffffff',line:{width:2}}});
      await Plotly.react(plot,traces,{paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{color:'#b7cbd9',size:11},
        width:plot.clientWidth,margin:{l:65,r:18,t:20,b:115},legend:{orientation:'h',y:-.25},
        xaxis:{title:{text:'大半径 R₀ / m'},gridcolor:'#304353'},yaxis:{title:{text:'小半径 a / m'},gridcolor:'#304353'},uirevision:'design-space'},
        {responsive:true,displaylogo:false,scrollZoom:false});
      if(version!==generation)return;
      plot.removeAllListeners('plotly_click');plot.on('plotly_click',event=>{const id=event.points[0]?.customdata;if(id)choose(id);});
    }catch(error){if(version===generation)document.getElementById('design-selection').textContent='图表加载失败；仍可通过候选下拉框加载真实结果。';}
  }
  function choose(id){
    const c=candidateCase(id);selectedId=id;selectedGeometry=c.geometry_id;select.value=id;
    document.getElementById('design-selection').textContent=`${id} · 模型 ${c.candidateEvidence.model_branch} · ${c.resultKind}`;
    onSelect(c);draw();
  }
  select.addEventListener('change',()=>{if(select.value)choose(select.value);});
  model.addEventListener('change',()=>{
    const row=data.candidates.find(r=>r.geometry_id===selectedGeometry&&r.model_branch===model.value);selectedId=row?.candidate_id??null;options();
    if(row)choose(row.candidate_id);else draw();
  });
  document.getElementById('design-view').onclick=()=>document.getElementById('viewport').scrollIntoView({behavior:'smooth',block:'start'});
  const observer=new ResizeObserver(()=>{if(Plotly&&plot.isConnected&&plot.clientWidth)Plotly.relayout(plot,{width:plot.clientWidth});});observer.observe(plot);
  options();draw();
  return {clearSelection(){selectedId=selectedGeometry=null;select.value='';document.getElementById('design-selection').textContent='尚未选择候选；编辑工况不会沿用候选计算。';draw();},
    selectReference(){const row=data.candidates.find(r=>r.model_branch===model.value&&r.geometry.R0===data.caseTemplate.geometry.R0&&r.geometry.a===data.caseTemplate.geometry.a);choose(row.candidate_id);}};
}
