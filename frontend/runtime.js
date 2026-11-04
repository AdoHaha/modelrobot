import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
window.THREE = { ...THREE, TrackballControls };
window.App = window.App || {};
window.App.stlLoader = new STLLoader();
import { LocalRobots } from './local-robots.js';
window.App.localRobots = new LocalRobots(window.App.stlLoader);
