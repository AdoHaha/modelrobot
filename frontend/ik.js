import { Matrix4, Vector3 } from 'three';

const supported = new Set(['revolute', 'continuous', 'prismatic']);
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const wrap = n => Math.atan2(Math.sin(n), Math.cos(n));

// Return distal-to-proximal joints, stopping at a branching rigid assembly.
// Counting branches after collapsing fixed joints keeps decorative fixed links
// from cutting off an otherwise serial arm.
export function limbChain(joints, linkName) {
  const parents = new Map();
  for (const joint of joints) for (const name of [joint.get('parent').link, joint.get('child').link]) parents.set(name, name);
  const root = name => {
    const visited = new Set();
    while (parents.has(name) && parents.get(name) !== name) {
      if (visited.has(name)) throw new Error('IK requires a tree of joints.');
      visited.add(name); name = parents.get(name);
    }
    return name;
  };
  for (const joint of joints) if (joint.type === 'fixed') parents.set(root(joint.get('child').link), root(joint.get('parent').link));
  const incoming = new Map(), outgoing = new Map();
  for (const joint of joints) {
    if (joint.type === 'fixed') continue;
    const parent = root(joint.get('parent').link), child = root(joint.get('child').link);
    if (incoming.has(child)) throw new Error('IK requires one parent per link.');
    incoming.set(child, { joint, parent });
    outgoing.set(parent, (outgoing.get(parent) || 0) + 1);
  }
  const chain = [], visited = new Set();
  let assembly = root(linkName);
  while (incoming.has(assembly)) {
    if (visited.has(assembly)) throw new Error('IK requires a tree of joints.');
    visited.add(assembly);
    const { joint, parent } = incoming.get(assembly);
    if (!supported.has(joint.type)) throw new Error('IK does not support ' + joint.type + ' joints.');
    if (!joint.axis?.lengthSq() || !joint.axis.toArray().every(Number.isFinite)) throw new Error('IK needs a valid joint axis.');
    if (joint.type !== 'continuous' && (![joint.lower, joint.upper].every(Number.isFinite) || joint.lower > joint.upper)) throw new Error('IK needs valid joint limits.');
    chain.push(joint);
    if (outgoing.get(parent) > 1) break;
    assembly = parent;
  }
  return chain;
}

// Axis-constrained CCD works directly with URDF scalar joints; the Three.js
// bone CCD solver instead expects a SkinnedMesh and quaternion-controlled bones.
export class IKSolver {
  constructor({ chain, object, localPoint, root, scale }) {
    this.chain = chain; this.object = object; this.localPoint = localPoint.clone(); this.root = root;
    this.scale = Math.max(scale, 1e-6); this.tolerance = Math.max(1e-6, this.scale * .001);
    this.point = new Vector3(); this.origin = new Vector3(); this.axis = new Vector3();
    this.toPoint = new Vector3(); this.toTarget = new Vector3(); this.cross = new Vector3(); this.frame = new Matrix4();
    this.target = new Vector3(Infinity, Infinity, Infinity); this.seed = 0; this.stalled = false;
  }
  position() { return this.point.copy(this.localPoint).applyMatrix4(this.object.matrixWorld); }
  values() { return this.chain.map(joint => joint.theta); }
  restore(values) {
    this.chain.forEach((joint, i) => joint.movejoint(values[i]));
    this.root.updateMatrixWorld(true);
  }
  set(joint, value) {
    joint.movejoint(joint.type === 'continuous' ? wrap(value) : clamp(value, joint.lower, joint.upper));
    this.root.updateMatrixWorld(true);
  }
  sweep(target, angularStep = .25) {
    for (const joint of this.chain) {
      this.frame.multiplyMatrices(joint.parentobject3d.matrixWorld, joint.basicMatrix);
      this.origin.setFromMatrixPosition(this.frame);
      this.axis.copy(joint.axis).transformDirection(this.frame);
      this.toPoint.copy(this.position()).sub(this.origin);
      this.toTarget.copy(target).sub(this.origin);
      let delta;
      if (joint.type === 'prismatic') {
        delta = this.toTarget.sub(this.toPoint).dot(this.axis);
        delta = clamp(delta, -this.scale * .04, this.scale * .04);
      } else {
        this.toPoint.addScaledVector(this.axis, -this.toPoint.dot(this.axis));
        this.toTarget.addScaledVector(this.axis, -this.toTarget.dot(this.axis));
        if (this.toPoint.lengthSq() < 1e-20 || this.toTarget.lengthSq() < 1e-20) continue;
        delta = Math.atan2(this.cross.crossVectors(this.toPoint, this.toTarget).dot(this.axis), this.toPoint.dot(this.toTarget));
        delta = clamp(delta, -angularStep, angularStep);
      }
      if (Math.abs(delta) > 1e-12) this.set(joint, joint.theta + delta);
    }
  }
  step(target, { iterations = 20, budgetMs = 4 } = {}) {
    if (this.target.distanceToSquared(target) > 1e-20) {
      this.target.copy(target); this.stalled = false; this.seed = 0; this.needsSeed = false;
    }
    this.root.updateMatrixWorld(true);
    let error = this.position().distanceTo(target), bestError = error, best = this.values();
    const initialError = error, epsilon = this.scale * 1e-8;
    if (this.stalled || error <= this.tolerance) return { error, reached: error <= this.tolerance, stalled: this.stalled };
    const start = performance.now();
    if (!this.needsSeed) for (let i = 0; i < iterations; i++) {
      const previous = error;
      this.sweep(target);
      error = this.position().distanceTo(target);
      if (error < bestError) { bestError = error; best = this.values(); }
      if (error <= this.tolerance || performance.now() - start >= budgetMs || error >= previous - epsilon) break;
    }
    this.restore(best);
    // A straight arm can be stationary under CCD despite an inward target.
    // Try one small deterministic seed per frame, keeping it only if a few
    // complete sweeps improve the original error. Never leave a worse pose.
    if (bestError > this.tolerance && initialError - bestError < epsilon) {
      this.needsSeed = true;
      if (performance.now() - start < budgetMs && this.chain.length) {
        const joint = this.chain[Math.floor(this.seed / 2) % this.chain.length];
        const direction = this.seed % 2 ? -1 : 1;
        const round = Math.floor(this.seed / (this.chain.length * 2));
        const offset = joint.type === 'prismatic' ? this.scale * [.03, .1, .3][round] : [.12, .5, 1][round];
        this.seed++;
        this.set(joint, joint.theta + direction * offset);
        for (let i = 0; i < 4; i++) {
          this.sweep(target, Math.PI);
          error = this.position().distanceTo(target);
          if (error < bestError) { bestError = error; best = this.values(); }
          if (error <= this.tolerance || performance.now() - start >= budgetMs) break;
        }
        if (this.seed >= this.chain.length * 6 && initialError - bestError < epsilon) this.stalled = true;
      }
    }
    if (initialError - bestError >= epsilon) { this.seed = 0; this.needsSeed = false; }
    this.restore(best);
    return { error: bestError, reached: bestError <= this.tolerance, stalled: this.stalled };
  }
}
