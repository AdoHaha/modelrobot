import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
window.THREE = { ...THREE, OrbitControls };
window.App = window.App || {};
window.App.stlLoader = new STLLoader();
import { Workspace } from './workspace.js';
window.App.workspace = new Workspace();
import { LocalRobots } from './local-robots.js';
window.App.localRobots = new LocalRobots(window.App.stlLoader);
import { PoseTool } from './pose-tool.js';
window.App.poseTool = new PoseTool(window.App);

import { CollisionChecker } from './collisions.js';
window.App.collisions = new CollisionChecker({
  meshGeometry: path => window.App.localRobots.meshGeometry(path),
  onStatus: state => {
    const status = document.getElementById('collision-status');
    if (!status) return;
    status.hidden = !state.enabled;
    if (status.textContent !== state.text) status.textContent = state.text;
    status.title = 'Approximate rotated-box check. ' + state.issues.join(' ');
    status.classList.toggle('has-collision', state.pairs.length > 0);
    status.classList.toggle('incomplete', state.issues.length > 0);
  }
});
