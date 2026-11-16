import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import { defaultCase, validateGeometry, buildDevice, disposeDevice } from './geometry.js';
import { cases, showScience } from './science.js';
import { newTarget, invalidate, mountTargetEditor } from './target.js';

const $ = id => document.getElementById(id);
let activeCase = newTarget(), device, cutaway = true;
const visibility = { plasma: true, vessel: true, tf: true, pf: true, cs: true };
const parameterSpecs = [['R0', '大半径 R₀', 1, 6, .05], ['a', '小半径 a', .2, 2, .02], ['kappa', '边界拉长比 κ', 1, 2.5, .05], ['delta', '边界三角形变 δ', -.6, .6, .02]];
for (const [key, label, min, max, step] of parameterSpecs) {
  const row = document.createElement('div');
  row.innerHTML = `<div class="param-head"><label for="${key}">${label}${['R0','a'].includes(key) ? ' / m' : ''}</label><input id="${key}" type="number" min="${min}" max="${max}" step="${step}"></div><input id="${key}-range" aria-label="${label}滑块" type="range" min="${min}" max="${max}" step="${step}">`;
  $('parameter-inputs').append(row);
  for (const id of [key, `${key}-range`]) $(id).addEventListener('input', e => {
    const proposed = { ...activeCase.geometry, [key]: e.target.value === '' ? NaN : Number(e.target.value) };
    const error = validateGeometry(proposed); $('validation').textContent = error;
    if (error) return;
    activeCase.geometry = proposed; invalidate(activeCase); syncInputs(); rebuild(); customCase=structuredClone(activeCase); markTargetEdited();
  });
  $(key).addEventListener('change', syncInputs);
}
for (const [id, title, color] of [['plasma', '等离子体边界', '#55d8c0'], ['vessel', '真空室', '#7f9cad'], ['tf', 'TF 环向场线圈', '#bb8760'], ['pf', 'PF 极向场线圈', '#b8a47b'], ['cs', 'CS 中心螺线管', '#a8b8c7']]) {
  const label = document.createElement('label'); label.innerHTML = `<input type="checkbox" id="layer-${id}" checked>${title}<span class="swatch" style="background:${color}"></span>`; $('layers').append(label);
  $(`layer-${id}`).addEventListener('change', e => { visibility[id] = e.target.checked; if (device) device.layers[id].visible = e.target.checked; render(); });
}
function syncInputs() { for (const [key,,, ,step] of parameterSpecs) { $(`${key}-range`).step = activeCase.caseId === 'custom' ? step : 'any'; $(key).value = activeCase.geometry[key]; $(`${key}-range`).value = activeCase.geometry[key]; } }
const viewport = $('viewport'), scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, .01, 300); camera.up.set(0, 0, 1);
let renderer, controls;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0); viewport.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '三维聚变装置，鼠标旋转缩放和平移');
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = false; controls.minDistance = 1; controls.maxDistance = 60;
  controls.addEventListener('change', render);
  scene.add(new THREE.HemisphereLight(0xe0f8ff, 0x26313c, 2.5));
  const key = new THREE.DirectionalLight(0xffffff, 3); key.position.set(5, -4, 9); scene.add(key);
  const rim = new THREE.DirectionalLight(0x69c8dd, 2); rim.position.set(-6, 4, 4); scene.add(rim);
  const grid = new THREE.PolarGridHelper(10, 16, 8, 80, 0x355565, 0x263f50); grid.rotation.x = Math.PI / 2; grid.position.z = -4; scene.add(grid);
  const axes = new THREE.AxesHelper(1); axes.position.set(0, 0, -3.99); scene.add(axes);
  new ResizeObserver(() => { const w = viewport.clientWidth, h = viewport.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); render(); }).observe(viewport);
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); $('view-status').textContent = '图形上下文丢失，请刷新页面'; });
} catch { $('unavailable').hidden = false; $('unavailable').textContent = '无法创建 WebGL 视窗，请启用浏览器硬件加速后重试。'; $('view-status').textContent = '三维视窗不可用'; }
function render() { renderer?.render(scene, camera); }
function rebuild() {
  if (!renderer) return;
  if (device) { scene.remove(device.root); disposeDevice(device.root); }
  device = buildDevice(activeCase.geometry, cutaway); scene.add(device.root);
  for (const id in visibility) device.layers[id].visible = visibility[id];
  render();
}
function setView(view = 'iso') {
  if (!controls) return;
  const p = activeCase.geometry, extent = Math.max(p.R0 + 1.4 * p.a, p.kappa * p.a * 1.5);
  const distance = extent * (camera.aspect < 1 ? 4.8 : 3.6);
  controls.target.set(0, 0, 0);
  camera.position.copy(new THREE.Vector3(...(view === 'front' ? [0, -1, 0] : view === 'top' ? [0, 0, 1] : [1, -1.6, 1.1])).normalize().multiplyScalar(distance));
  controls.update(); render();
}
function availability() {
  const available = $('configuration').value === 'tokamak';
  $('parameters').disabled = !available || activeCase.caseId !== 'custom'; $('layers').disabled = !available;
  if (device) device.root.visible = available;
  $('unavailable').hidden = available && !!renderer;
  if (!available) $('unavailable').textContent = $('configuration').value !== 'tokamak' ? '该装置构型尚未实现。请选择常规托卡马克继续。' : '该参考案例尚未接入。未加载 SPARC 工程几何或物理数据。';
  $('view-title').textContent = available ? (cases.find(c=>c.caseId===activeCase.caseId)?.label ?? '轴对称托卡马克') : '等待可用构型与案例';
  if (renderer) $('view-status').textContent = available ? '● 几何预览 · 未执行物理计算' : '尚未实现 / 未加载';
  $('case-note').textContent = activeCase.caseId === 'custom' ? '自定义几何；不沿用任何参考案例的计算结果。' : '有来源的分离面参数；线圈/真空室仍为示意。参考几何锁定，修改请切回自定义。';
  render();
}
let customCase = structuredClone(activeCase);
function markTargetEdited(){if(activeCase.caseId==='custom'){invalidate(activeCase);$('science-status').textContent='目标已编辑 · 计算结果尚未更新（尚未求解）';}}
function applyCustom(c,refresh=true){activeCase=c;customCase=structuredClone(c);$('case').value='custom';$('configuration').value=c.configuration;if(refresh){syncInputs();rebuild();availability();setView();showScience('custom');}markTargetEdited();}
$('configuration').addEventListener('change', () => { if(activeCase.caseId==='custom'){activeCase.configuration=$('configuration').value;customCase=structuredClone(invalidate(activeCase));} availability(); showScience($('configuration').value === 'tokamak' ? activeCase.caseId : 'custom'); markTargetEdited(); });
$('case').addEventListener('change', () => {
  if (activeCase.caseId === 'custom') customCase = structuredClone(activeCase);
  const selected = cases.find(c => c.caseId === $('case').value);
  activeCase = selected ? structuredClone(selected) : structuredClone(customCase);
  $('configuration').value=activeCase.configuration;
  $('validation').textContent = ''; syncInputs(); rebuild(); availability(); setView(); showScience(activeCase.caseId); targetEditor.sync(); markTargetEdited();
});
$('reset').addEventListener('click', () => { activeCase.geometry=structuredClone(defaultCase.geometry);invalidate(activeCase);customCase=structuredClone(activeCase);$('validation').textContent = ''; syncInputs(); rebuild();setView();markTargetEdited(); });
$('cutaway').addEventListener('click', e => { cutaway = !cutaway; e.currentTarget.setAttribute('aria-pressed', cutaway); rebuild(); availability(); });
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
const targetEditor=mountTargetEditor({getCase:()=>activeCase,applyCase:applyCustom,markEdited:markTargetEdited});
syncInputs(); rebuild(); setView(); availability();markTargetEdited();

