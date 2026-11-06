import { Box3, Box3Helper, BufferGeometry, Float32BufferAttribute, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Plane, Raycaster, SphereGeometry, Vector2, Vector3 } from 'three';
import { IKSolver, limbChain } from './ik.js';

export class PoseTool {
  constructor(app) {
    this.app = app; this.enabled = false; this.active = null;
    this.raycaster = new Raycaster(); this.pointer = new Vector2(); this.normal = new Vector3(); this.plane = new Plane();
  }
  init(canvas) {
    this.canvas = canvas;
    const byId = id => document.getElementById(id);
    this.button = byId('pose-toggle'); this.status = byId('pose-status'); this.actions = byId('pose-actions');
    this.button.onclick = () => this.setEnabled(!this.enabled);
    byId('pose-place').onclick = () => this.finish();
    byId('pose-cancel').onclick = () => this.finish(true);
    byId('pose-nearer').onclick = () => this.depth(-1);
    byId('pose-farther').onclick = () => this.depth(1);
    canvas.addEventListener('dblclick', event => {
      if (event.button !== 0 || event.sourceCapabilities?.firesTouchEvents) return;
      const hit = this.pick(event);
      if (!hit) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!this.enabled) this.setEnabled(true);
      this.finish(); this.begin(hit);
    }, true);
    canvas.addEventListener('pointerdown', event => {
      if (!this.enabled || event.button !== 0 || !event.isPrimary) return;
      if (this.active) {
        this.follow(event); this.update(); this.finish();
      } else {
        const hit = this.pick(event);
        if (!hit) return;
        if (!this.begin(hit)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
        if (event.pointerType === 'touch' || event.pointerType === 'pen') {
          this.touchId = event.pointerId; canvas.setPointerCapture(event.pointerId);
        }
      }
      event.preventDefault(); event.stopImmediatePropagation();
    }, true);
    canvas.addEventListener('pointermove', event => {
      if (!this.active || (this.touchId != null && event.pointerId !== this.touchId)) return;
      this.follow(event); event.preventDefault(); event.stopImmediatePropagation();
    }, true);
    canvas.addEventListener('pointerup', event => {
      if (this.touchId !== event.pointerId) return;
      this.follow(event); this.update(); this.finish();
      event.preventDefault(); event.stopImmediatePropagation();
    }, true);
    canvas.addEventListener('pointercancel', () => this.finish(true), true);
    canvas.addEventListener('wheel', event => {
      if (!this.active) return;
      event.preventDefault(); event.stopImmediatePropagation(); this.depth(Math.sign(event.deltaY));
    }, { capture: true, passive: false });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || (!this.active && !this.enabled)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (this.active) this.finish(true); else this.setEnabled(false);
    }, true);
    // Manual inputs take ownership before their original handlers change a pose.
    const handOver = event => {
      if (event.target.closest?.('#joint-controls, #robotcsv, #playbutton, #pausebutton, #stopbutton, #nextbutton, #prevbutton, #loadcsv, #csv-template, #addposition, #screenshot, #help-button')) this.finish();
    };
    document.addEventListener('pointerdown', handOver, true);
    document.addEventListener('keydown', handOver, true);
    this.report();
  }
  setEnabled(enabled) {
    this.finish(); this.enabled = Boolean(enabled);
    this.button.setAttribute('aria-pressed', this.enabled);
    this.canvas.classList.toggle('pose-mode', this.enabled);
    this.canvas.parentElement.classList.toggle('pose-mode', this.enabled); this.report();
  }
  meshes() {
    const owners = new Map(), links = new Set(window.robotlinkcollection?.map(link => link.get('link')) || []);
    window.robot?.traverse(mesh => {
      if (!mesh.isMesh) return;
      let link = mesh;
      while (link && !links.has(link)) link = link.parent;
      if (link) owners.set(mesh, link);
    });
    return owners;
  }
  pointerAt(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.app.camera);
  }
  pick(event) {
    if (!window.robot) return null;
    window.scene.updateMatrixWorld(true); this.pointerAt(event);
    const owners = this.meshes();
    const hit = this.raycaster.intersectObjects([...owners.keys()], false)[0];
    return hit ? { object: owners.get(hit.object), point: hit.point, owners } : null;
  }
  begin(hit) {
    let chain;
    try {
      chain = limbChain(window.robotjointcollection.models, hit.object.name);
      if (!chain.length) throw new Error('This segment has no movable ancestors. Choose an arm or another movable segment.');
    } catch (error) { this.report(error.message); return false; }
    this.app.animform.pause();
    window.scene.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(window.robot);
    const scale = Math.max(bounds.getSize(new Vector3()).length(), .001);
    const localPoint = hit.object.worldToLocal(hit.point.clone());
    const solver = new IKSolver({ chain, object: hit.object, localPoint, root: window.robot, scale });
    this.active = { solver, object: hit.object, target: hit.point.clone(), start: solver.values(), scale, meshes: [...hit.owners].filter(([, owner]) => owner === hit.object).map(([mesh]) => mesh) };
    this.app.camera.getWorldDirection(this.normal);
    this.plane.setFromNormalAndCoplanarPoint(this.normal, hit.point);
    this.app.cameraControls.enabled = false;
    this.canvas.parentElement.classList.add('pose-active');
    this.createHelpers(scale);
    this.canvas.focus({ preventScroll: true }); this.update(); return true;
  }
  createHelpers(scale) {
    this.helpers = new Group(); this.helpers.name = 'Pose target';
    this.marker = new Mesh(new SphereGeometry(scale * .008, 12, 8), new MeshBasicMaterial({ color: 0x007eac, depthTest: false }));
    this.marker.renderOrder = 11;
    this.outline = new Box3Helper(new Box3(), 0x007eac);
    this.line = new Line(new BufferGeometry().setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3)), new LineBasicMaterial({ color: 0x007eac, depthTest: false }));
    this.line.frustumCulled = false; this.line.renderOrder = 10;
    this.helpers.add(this.marker, this.line, this.outline); window.scene.add(this.helpers);
  }
  follow(event) {
    this.pointerAt(event);
    this.raycaster.ray.intersectPlane(this.plane, this.active.target);
  }
  depth(direction) {
    if (!this.active || !direction) return;
    const camera = this.app.camera, current = this.active.target.clone().sub(camera.position).dot(this.normal);
    const next = Math.max(camera.near * 2, Math.min(camera.far * .8, current + direction * this.active.scale * .04));
    const shifted = this.active.target.clone().addScaledVector(this.normal, next - current);
    this.plane.setFromNormalAndCoplanarPoint(this.normal, shifted);
    this.raycaster.setFromCamera(this.pointer, camera);
    this.raycaster.ray.intersectPlane(this.plane, this.active.target);
    this.update();
  }
  update() {
    if (!this.active) return;
    const { solver, target, meshes, object } = this.active;
    const result = solver.step(target);
    this.app.robotjointmanipall.jointsval();
    const point = solver.position();
    this.marker.position.copy(target);
    const positions = this.line.geometry.getAttribute('position'); positions.setXYZ(0, point.x, point.y, point.z); positions.setXYZ(1, target.x, target.y, target.z); positions.needsUpdate = true;
    this.outline.box.makeEmpty(); for (const mesh of meshes) this.outline.box.union(new Box3().setFromObject(mesh));
    this.report(object.name + ' · ' + (result.reached ? 'Target reached' : (result.stalled ? 'Best pose' : 'Solving')) + ' · ' + (result.error * 1000).toFixed(1) + ' mm from target');
  }
  finish(cancel = false) {
    if (!this.active) return;
    if (cancel) { this.active.solver.restore(this.active.start); this.app.robotjointmanipall.jointsval(); }
    this.active = null;
    if (this.touchId != null && this.canvas.hasPointerCapture(this.touchId)) this.canvas.releasePointerCapture(this.touchId);
    this.touchId = null;
    this.helpers.removeFromParent();
    this.helpers.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
    this.helpers = null; this.app.cameraControls.enabled = true; this.report();
    this.canvas.parentElement.classList.remove('pose-active');
  }
  report(message) {
    if (!this.status) return;
    this.status.hidden = !this.enabled;
    this.actions.hidden = !this.active;
    const text = message || 'Click a segment to pose it. Drag empty space to orbit. On touch: drag a segment, then release.';
    if (this.status.textContent !== text) this.status.textContent = text;
  }
}
