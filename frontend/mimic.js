// Find a valid startup value for every independent joint. Each descendant has
// q = factor * root_q + offset, even when several mimic joints are chained.
export function mimicHomePositions(joints) {
  const byName = new Map(joints.map(joint => [joint.name, joint]));
  const children = new Map(joints.map(joint => [joint.name, []]));
  for (const joint of joints) {
    if (joint.mimic) children.get(joint.mimic.joint)?.push(joint);
  }
  const home = new Map();
  for (const root of joints) {
    if (root.mimic) continue;
    let low = -Infinity, high = Infinity;
    const visit = (joint, factor, offset, seen) => {
      if (seen.has(joint.name)) throw new Error('Mimic joints must not form a dependency cycle.');
      seen.add(joint.name);
      const lower = joint.type === 'continuous' ? -Infinity : joint.type === 'fixed' ? 0 : joint.lower;
      const upper = joint.type === 'continuous' ? Infinity : joint.type === 'fixed' ? 0 : joint.upper;
      if (factor === 0) {
        if (offset < lower || offset > upper) throw new Error('Mimic joint limits have no feasible pose for ' + root.name + '.');
      } else {
        const a = (lower - offset) / factor, b = (upper - offset) / factor;
        low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b));
        if (low > high) throw new Error('Mimic joint limits have no feasible pose for ' + root.name + '.');
      }
      for (const child of children.get(joint.name) || []) {
        const childFactor = Number(child.mimic.multiplier ?? 1), childOffset = Number(child.mimic.offset ?? 0);
        const nextFactor = factor * childFactor, nextOffset = offset * childFactor + childOffset;
        if (!Number.isFinite(nextFactor) || !Number.isFinite(nextOffset)) throw new Error('Mimic joint ' + child.name + ' has non-finite composed values.');
        visit(child, nextFactor, nextOffset, seen);
      }
      seen.delete(joint.name);
    };
    visit(root, 1, 0, new Set());
    home.set(root.name, Math.max(low, Math.min(0, high)));
  }
  return home;
}
