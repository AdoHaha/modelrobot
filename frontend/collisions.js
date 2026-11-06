import { Box3, Matrix4, Euler, Vector3 } from 'three';
import { OBB } from 'three/addons/math/OBB.js';

const EPSILON = 1e-8;
const size = new Vector3();
const vector = (values, fallback) => {
  const result = values == null ? fallback : typeof values === 'string' ? values.trim().split(/\s+/).map(Number) : values;
  if (result.length !== 3 || !result.every(Number.isFinite)) throw new Error('Expected three finite numbers.');
  return result;
};
const positive = value => {
  const number = Number(value);
  if (!(number > 0) || !Number.isFinite(number)) throw new Error('Collision dimensions must be positive numbers.');
  return number;
};

// Bounds stay in collision-local coordinates. Scale the mesh bounds first so
// mirrored scales never produce negative OBB extents.
export function localCollisionBounds(shape, meshGeometry) {
  let box;
  if (shape.type === 'box') {
    const size = vector(shape.size, []).map(positive);
    box = new Box3().setFromCenterAndSize(new Vector3(), new Vector3(...size));
  } else if (shape.type === 'sphere') {
    const radius = positive(shape.radius);
    box = new Box3(new Vector3(-radius,-radius,-radius), new Vector3(radius,radius,radius));
  } else if (shape.type === 'cylinder') {
    const radius = positive(shape.radius), half = positive(shape.length) / 2;
    box = new Box3(new Vector3(-radius,-radius,-half), new Vector3(radius,radius,half));
  } else if (shape.type === 'mesh') {
    const geometry = meshGeometry?.(shape.filename);
    if (!geometry) throw new Error('Missing or unsupported collision mesh: ' + shape.filename);
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const scale = vector(shape.scale, [1,1,1]);
    if (scale.some(value => value === 0)) throw new Error('Collision mesh scale cannot be zero.');
    box = geometry.boundingBox.clone().applyMatrix4(new Matrix4().makeScale(...scale));
  } else {
    throw new Error('Unsupported collision geometry: ' + (shape.type || 'missing geometry'));
  }
  if (box.isEmpty() || ![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) throw new Error('Empty or invalid collision bounds.');
  return box;
}

export function createCollider(linkName, object, shape, meshGeometry) {
  const localBox = localCollisionBounds(shape, meshGeometry);
  const xyz = vector(shape.xyz, [0,0,0]), rpy = vector(shape.rpy, [0,0,0]);
  const origin = new Matrix4().makeRotationFromEuler(new Euler(...rpy, 'ZYX'));
  origin.setPosition(...xyz);
  return { linkName, object, localBox, origin, localOBB: new OBB().fromBox3(localBox), worldOBB: new OBB(), worldBox: new Box3(), matrix: new Matrix4() };
}

export class CollisionChecker {
  constructor({ meshGeometry, onStatus = () => {} } = {}) {
    this.meshGeometry = meshGeometry;
    this.onStatus = onStatus;
    this.enabled = false;
    this.shapes = [];
    this.candidates = [];
    this.links = new Map();
    this.linkObjects = new Set();
    this.roots = new Set();
    this.issues = [];
    this.pairs = [];
    this.highlighted = new Map();
    this.redMaterials = new Map();
    this.lastCheck = -Infinity;
    this.dirty = true;
  }
  clear() {
    this.restoreMaterials();
    for (const material of this.redMaterials.values()) material.dispose();
    this.redMaterials.clear();
    this.shapes = []; this.candidates = []; this.links = new Map(); this.linkObjects.clear(); this.roots.clear(); this.issues = []; this.pairs = [];
    this.markDirty(); this.report();
  }
  rebuild(xml, links, joints) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const objects = new Map(links.map(link => [link.get('name'), link.get('link')]));
    const shapes = [], issues = [];
    for (const link of doc.documentElement.children) {
      if (link.tagName !== 'link') continue;
      const name = link.getAttribute('name'), object = objects.get(name);
      if (!object) continue;
      for (const collision of link.children) {
        if (collision.tagName !== 'collision') continue;
        const geometry = [...collision.children].find(child => child.tagName === 'geometry')?.firstElementChild;
        const origin = [...collision.children].find(child => child.tagName === 'origin');
        const shape = { type: geometry?.tagName, xyz: origin?.getAttribute('xyz'), rpy: origin?.getAttribute('rpy') };
        if (geometry) for (const attribute of geometry.attributes) shape[attribute.name] = attribute.value;
        try { shapes.push(createCollider(name, object, shape, this.meshGeometry)); }
        catch (error) { issues.push(name + ': ' + error.message); }
      }
    }
    this.setModel(objects, joints.map(joint => ({ type: joint.type, parent: joint.get('parent').link, child: joint.get('child').link })), shapes, issues);
    return issues;
  }
  setModel(links, joints, shapes, issues = []) {
    this.clear(); this.links = links; this.linkObjects = new Set(links.values());
    this.roots = new Set([...links.values()].map(object => { while (object.parent) object = object.parent; return object; }));
    this.shapes = shapes; this.issues = issues;
    const parents = new Map([...links.keys()].map(name => [name,name]));
    const root = name => {
      let parent = parents.get(name);
      while (parent !== parents.get(parent)) parent = parents.get(parent);
      return parent;
    };
    for (const joint of joints) if (joint.type === 'fixed') parents.set(root(joint.child), root(joint.parent));
    const neighbors = new Map();
    for (const joint of joints) {
      const a = root(joint.parent), b = root(joint.child);
      if (!neighbors.has(a)) neighbors.set(a,new Set());
      if (!neighbors.has(b)) neighbors.set(b,new Set());
      neighbors.get(a).add(b); neighbors.get(b).add(a);
    }
    for (let i=0;i<shapes.length;i++) for (let j=i+1;j<shapes.length;j++) {
      const a = root(shapes[i].linkName), b = root(shapes[j].linkName);
      if (a !== b && !neighbors.get(a)?.has(b)) this.candidates.push([shapes[i],shapes[j]]);
    }
    this.markDirty(); this.report();
  }
  markDirty() { this.dirty = true; }
  setEnabled(enabled) {
    this.enabled = Boolean(enabled); this.markDirty();
    if (!this.enabled) { this.restoreMaterials(); this.pairs = []; this.report(); }
    else this.update(performance.now(), true);
  }
  update(now = performance.now(), force = false) {
    if (!this.enabled || !this.dirty || (!force && now - this.lastCheck < 50)) return false;
    this.dirty = false; this.lastCheck = now;
    // URDF joints assign matrices directly; force ancestor and descendant updates
    // before an immediate checkbox/demo check as well as during animation.
    for (const root of this.roots) root.updateMatrixWorld(true);
    for (const shape of this.shapes) {
      shape.matrix.multiplyMatrices(shape.object.matrixWorld, shape.origin);
      shape.worldOBB.copy(shape.localOBB).applyMatrix4(shape.matrix);
      // OBB.applyMatrix4 translates its center but does not rotate an offset center.
      shape.worldOBB.center.copy(shape.localOBB.center).applyMatrix4(shape.matrix);
      shape.worldBox.copy(shape.localBox).applyMatrix4(shape.matrix);
      shape.worldBox.expandByScalar(Math.max(1e-10,shape.worldBox.getSize(size).length()*EPSILON));
    }
    const pairs = new Map(), colliding = new Set();
    for (const [a,b] of this.candidates) {
      if (!a.worldBox.intersectsBox(b.worldBox) || !a.worldOBB.intersectsOBB(b.worldOBB, EPSILON)) continue;
      const names = [a.linkName,b.linkName].sort();
      pairs.set(JSON.stringify(names), names); colliding.add(a.linkName); colliding.add(b.linkName);
    }
    this.pairs = [...pairs.values()];
    this.restoreMaterials();
    for (const name of colliding) this.links.get(name).traverse(mesh => {
      if (!mesh.isMesh || !mesh.material) return;
      const original = mesh.material;
      const red = material => {
        if (!this.redMaterials.has(material)) {
          const clone = material.clone();
          if (clone.color) clone.color.setHex(0xff2424);
          if (clone.emissive) clone.emissive.setHex(0x330000);
          this.redMaterials.set(material,clone);
        }
        return this.redMaterials.get(material);
      };
      // Only this link's own visuals, not descendant links in the URDF tree.
      let owner = mesh;
      while (owner && !this.linkObjects.has(owner)) owner = owner.parent;
      if (owner !== this.links.get(name)) return;
      this.highlighted.set(mesh,original);
      mesh.material = Array.isArray(original) ? original.map(red) : red(original);
    });
    this.report(); return true;
  }
  restoreMaterials() {
    for (const [mesh,material] of this.highlighted) mesh.material = material;
    this.highlighted.clear();
  }
  report() {
    let text = !this.enabled ? 'Collision check off' : !this.shapes.length ? (this.issues.length ? 'No collision shapes could be checked' : 'No collision shapes in this URDF') : this.pairs.length ? this.pairs.length + ' possible collision' + (this.pairs.length === 1 ? '' : 's') + ': ' + this.pairs.map(pair => pair.join(' ↔ ')).join('; ') : 'No overlaps · ' + this.shapes.length + ' collision shapes';
    if (this.enabled && this.issues.length) text += ' · Incomplete: ' + this.issues.length + ' skipped';
    this.onStatus({ text, pairs: this.pairs, issues: this.issues, enabled: this.enabled, shapes: this.shapes.length });
  }
}
