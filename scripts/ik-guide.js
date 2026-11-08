// A planar teaching model of the viewer's scalar, distal-to-proximal CCD update.
// The viewer additionally transforms spatial URDF axes and runs bounded batches.
const byId = id => document.getElementById(id);
const svg = byId('ccd-diagram'), angleInputs = [byId('angle-1'), byId('angle-2')];
const limits = byId('joint-limits'), scale = 120, base = { x: 220, y: 200 };
let language = 'en', angles = [.6, -1], target = { x: 1.1, y: .6 }, nextJoint = 1, steps = 0, timer = null, state = 'ready', activeJoint = null;
const text = {
  en: { title: 'Inverse kinematics in MyModelRobot: axis-constrained CCD', ready: 'Move the target or change the starting angles.', running: 'CCD is updating one joint at a time…', reached: 'The centre is within the target tolerance.', best: 'This run has stopped. A remaining gap can reflect reach, limits or a local stall.', next: 'Next joint: ', shoulder: 'shoulder q₁', elbow: 'elbow q₂', adjusted: 'Last update: ', diagram: 'Two-link CCD exercise. Click or drag to move the target. Arrow keys move it when the diagram is focused.' },
  pl: { title: 'Kinematyka odwrotna w MyModelRobot: CCD z uwzględnieniem osi', ready: 'Przesuń cel lub zmień kąty początkowe.', running: 'CCD zmienia po jednym przegubie…', reached: 'Środek jest w granicach tolerancji celu.', best: 'Obliczenia zakończone. Pozostała odległość może wynikać z zasięgu, ograniczeń lub lokalnego zastoju.', next: 'Następny przegub: ', shoulder: 'bark q₁', elbow: 'łokieć q₂', adjusted: 'Ostatnia zmiana: ', diagram: 'Ćwiczenie CCD dla dwóch segmentów. Kliknij lub przeciągnij, aby przesunąć cel. Po zaznaczeniu schematu użyj strzałek.' }
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const screen = p => ({ x: base.x + p.x * scale, y: base.y - p.y * scale });
function points() {
  const elbow = { x: Math.cos(angles[0]), y: Math.sin(angles[0]) }, q = angles[0] + angles[1];
  return { elbow, centre: { x: elbow.x + .4 * Math.cos(q), y: elbow.y + .4 * Math.sin(q) }, tip: { x: elbow.x + .8 * Math.cos(q), y: elbow.y + .8 * Math.sin(q) } };
}
function error() { const { centre } = points(); return Math.hypot(target.x - centre.x, target.y - centre.y); }
function stop() { clearInterval(timer); timer = null; }
function resetSearch() { stop(); steps = 0; nextJoint = 1; activeJoint = null; state = 'ready'; }
function setLine(id, from, to) {
  const line = byId(id); line.setAttribute('x1', from.x); line.setAttribute('y1', from.y); line.setAttribute('x2', to.x); line.setAttribute('y2', to.y);
}
function setPoint(id, point) { byId(id).setAttribute('cx', point.x); byId(id).setAttribute('cy', point.y); }
function render() {
  const p = points(), elbow = screen(p.elbow), centre = screen(p.centre), tip = screen(p.tip), goal = screen(target);
  setLine('upper-link', base, elbow); setLine('lower-link', elbow, tip); setLine('position-error', centre, goal);
  setPoint('elbow-joint', elbow); setPoint('actual-centre', centre); setPoint('requested-centre', goal);
  for (const [id, point] of [['elbow-label', elbow], ['centre-label', centre], ['target-label', goal]]) {
    byId(id).setAttribute('x', point.x + 14); byId(id).setAttribute('y', point.y - 13);
  }
  const pivot = activeJoint === 1 ? elbow : base;
  setLine('point-vector', pivot, centre); setLine('target-vector', pivot, goal);
  byId('point-vector').setAttribute('visibility', activeJoint == null ? 'hidden' : 'visible');
  byId('target-vector').setAttribute('visibility', activeJoint == null ? 'hidden' : 'visible');
  byId('base-joint').classList.toggle('active-joint', activeJoint === 0); byId('elbow-joint').classList.toggle('active-joint', activeJoint === 1);
  const format = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });
  angles.forEach((q, i) => {
    angleInputs[i].value = q * 180 / Math.PI;
    byId('angle-value-' + (i + 1)).textContent = format.format(q * 180 / Math.PI) + '° / ' + format.format(q) + ' rad';
  });
  byId('demo-error').textContent = format.format(error()); byId('demo-error').dataset.value = error(); byId('demo-steps').textContent = steps;
  byId('next-joint').textContent = text[language].next + text[language][nextJoint === 1 ? 'elbow' : 'shoulder'];
  byId('active-joint').textContent = activeJoint == null ? '' : text[language].adjusted + text[language][activeJoint === 1 ? 'elbow' : 'shoulder'];
  byId('demo-status').textContent = text[language][state]; svg.setAttribute('aria-label', text[language].diagram);
}
function jointUpdate() {
  const p = points(), pivot = nextJoint === 1 ? p.elbow : { x: 0, y: 0 };
  const ux = p.centre.x - pivot.x, uy = p.centre.y - pivot.y, vx = target.x - pivot.x, vy = target.y - pivot.y;
  const delta = clamp(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy), -.25, .25);
  activeJoint = nextJoint;
  let q = angles[nextJoint] + delta;
  if (limits.checked) { const limit = (nextJoint === 0 ? 120 : 140) * Math.PI / 180; q = clamp(q, -limit, limit); }
  else q = Math.atan2(Math.sin(q), Math.cos(q));
  angles[nextJoint] = q; nextJoint = 1 - nextJoint; steps++;
  state = error() <= .005 ? 'reached' : 'ready'; render();
}
function setLanguage(value, persist = false) {
  language = value === 'pl' ? 'pl' : 'en'; document.documentElement.lang = language; document.title = text[language].title;
  document.querySelectorAll('[data-lang]').forEach(node => { node.hidden = node.dataset.lang !== language; });
  byId('guide-language').value = language;
  if (persist) try { localStorage.setItem('mymodelrobot-language', language); } catch (_) { /* The lesson remains usable. */ }
  render();
}
angleInputs.forEach((input, index) => input.addEventListener('input', () => { resetSearch(); angles[index] = Number(input.value) * Math.PI / 180; render(); }));
limits.addEventListener('change', () => {
  resetSearch();
  angleInputs.forEach((input, index) => {
    const maximum = limits.checked ? (index === 0 ? 120 : 140) : 180;
    input.min = -maximum; input.max = maximum; angles[index] = clamp(angles[index], -maximum * Math.PI / 180, maximum * Math.PI / 180);
  }); render();
});
byId('step-ccd').onclick = () => { stop(); jointUpdate(); };
byId('solve-ccd').onclick = () => {
  stop(); let count = 0;
  if (error() <= .005) { state = 'reached'; render(); return; }
  state = 'running'; render();
  timer = setInterval(() => {
    jointUpdate(); count++;
    if (error() <= .005 || count >= 80) { stop(); state = error() <= .005 ? 'reached' : 'best'; }
    else state = 'running'; render();
  }, 35);
};
byId('reset-ccd').onclick = () => { resetSearch(); angles = [.6, -1]; target = { x: 1.1, y: .6 }; render(); };
byId('beyond-reach').onclick = () => { resetSearch(); target = { x: 2.2, y: 1 }; render(); };
function pointerTarget(event) {
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse());
  resetSearch(); target = { x: (clamp(point.x, 20, 620) - base.x) / scale, y: (base.y - clamp(point.y, 20, 380)) / scale }; render();
}
svg.addEventListener('pointerdown', event => { if (!event.isPrimary || event.button !== 0) return; svg.setPointerCapture(event.pointerId); svg.focus({ preventScroll: true }); pointerTarget(event); event.preventDefault(); });
svg.addEventListener('pointermove', event => { if (svg.hasPointerCapture(event.pointerId)) pointerTarget(event); });
svg.addEventListener('pointerup', event => { if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId); });
svg.addEventListener('keydown', event => {
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
  if (!direction) return; event.preventDefault(); resetSearch(); const step = event.shiftKey ? .2 : .05;
  target.x = clamp(target.x + direction[0] * step, -1.66, 3.33); target.y = clamp(target.y + direction[1] * step, -1.5, 1.5); render();
});
byId('guide-language').onchange = event => setLanguage(event.target.value, true);
let initial = 'en'; try { if (localStorage.getItem('mymodelrobot-language') === 'pl') initial = 'pl'; } catch (_) { /* Default English. */ }
const requested = new URLSearchParams(location.search).get('lang'); if (requested === 'pl' || requested === 'en') initial = requested;
setLanguage(initial);
window.addEventListener('pagehide', stop);
