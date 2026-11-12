import { mimicHomePositions } from './mimic.js';

// URDF and mesh bytes stay on this device. IndexedDB supports large binary STL files.
export class LocalRobots {
  constructor(loader) {
    this.loader = loader;
    this.assets = new Map();
    this.geometries = new Map();
    this.records = [];
    this.messages = [];
    this.pendingSave = Promise.resolve();
    this.document = { id: null };
    this.openingDocument = true;
  }
  normalize(path) {
    try { path = decodeURIComponent(path); } catch (_) { /* Literal filenames are valid. */ }
    return path.replace(/\\/g, '/').replace(/^(package|file):\/\//, '').replace(/^\.\//, '').replace(/^\/+/, '');
  }
  resolve(path) {
    const key = this.normalize(path);
    if (this.assets.has(key)) return key;
    const matches = [...this.assets.keys()].filter(name => name.endsWith('/' + key) || key.endsWith('/' + name));
    if (matches.length === 1) return matches[0];
    const basename = key.split('/').pop();
    const basenames = [...this.assets.keys()].filter(name => name.split('/').pop() === basename);
    return basenames.length === 1 ? basenames[0] : null;
  }
  meshGeometry(path) {
    const key = this.resolve(path);
    if (!/\.stl$/i.test(path)) throw new Error('Unsupported mesh: ' + path + ' (select an STL file).');
    if (!key) throw new Error('Missing or ambiguous STL: ' + path + '. Select its file or containing folder.');
    if (!this.geometries.has(key)) this.geometries.set(key, this.parse(this.assets.get(key)));
    return this.geometries.get(key);
  }
  mesh(description, material) {
    let geometry;
    try { geometry = this.meshGeometry(description.filename || ''); }
    catch (error) { this.messages.push(error.message); return new THREE.Object3D(); }
    const mesh = new THREE.Mesh(geometry, material);
    const scale = description.scale ? description.scale.trim().split(/\s+/).map(Number) : [1, 1, 1];
    if (scale.length !== 3 || !scale.every(Number.isFinite)) throw new Error('Invalid mesh scale: ' + description.scale);
    mesh.scale.set(...scale);
    return mesh;
  }
  parse(bytes) {
    const geometry = this.loader.parse(bytes);
    const values = geometry.getAttribute('position');
    if (!values || !values.count || values.count % 3 || !values.array.every(Number.isFinite)) {
      geometry.dispose();
      throw new Error('STL contains no valid triangles.');
    }
    return geometry;
  }
  status(message, error = false, params = {}) {
    const el = document.getElementById('local-status');
    App.i18n.setText(el, message, params);
    el.classList.toggle('text-danger', error);
    const badge = document.getElementById('mesh-badge');
    badge.hidden = !this.messages.length;
    App.i18n.setAttr(badge, 'title', '{warnings}', { warnings: this.messages.slice() });
  }
  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('mymodelrobot-local', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('robots', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other MyModelRobot tabs to enable storage.'));
    });
  }
  async transaction(mode, action) {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('robots', mode);
      const request = action(tx.objectStore('robots'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Browser storage unavailable.'));
    });
  }
  async refresh(selected) {
    this.records = await this.transaction('readonly', store => store.getAll());
    const select = document.getElementById('local-library');
    select.replaceChildren(new Option('Choose a saved robot', ''));
    App.i18n.setText(select.options[0], 'Choose a saved robot');
    this.records.sort((a, b) => b.updated - a.updated).forEach(record => select.add(new Option(record.name, record.id)));
    select.value = selected || '';
  }
  async init(form) {
    this.form = form;
    this.db = this.openDB();
    // Attach a rejection handler immediately, even before the first save.
    this.db.catch(() => {});
    const on = (id, event, fn) => document.getElementById(id).addEventListener(event, () => Promise.resolve().then(fn).catch(error => this.status(error.message, true)));
    on('robotcsv', 'input', () => this.saveAnimation());
    on('local-files', 'change', () => this.importFiles(document.getElementById('local-files')));
    on('local-folder', 'change', () => this.importFiles(document.getElementById('local-folder')));
    on('local-save', 'click', () => { if (this.currentXml) this.loaded(this.currentXml); });
    on('local-copy', 'click', async () => {
      await this.pendingSave;
      if (!this.currentXml) return;
      this.document = { id: crypto.randomUUID() };
      const name = document.getElementById('local-name');
      name.value = App.i18n.t('{name} copy', { name: name.value || this.validate(this.currentXml).documentElement.getAttribute('name') || 'Robot' });
      this.loaded(this.currentXml);
    });
    on('local-open', 'click', async () => {
      if (!App.workspace.canReplaceDraft()) return;
      await this.pendingSave;
      const id = document.getElementById('local-library').value;
      const record = await this.transaction('readonly', store => store.get(id));
      if (!record) return;
      this.document = { id: record.id };
      this.openingDocument = true;
      this.clearAssets();
      record.assets.forEach(asset => this.assets.set(asset.name, asset.bytes));
      document.getElementById('local-name').value = record.name;
      this.currentXml = record.urdf;
      App.animform.stop();
      document.getElementById('robotcsv').value = record.csv || '';
      this.showURDF(record.urdf);
      App.animform.loadCSVfromForm();
    });
    on('local-delete', 'click', async () => {
      await this.pendingSave;
      const id = document.getElementById('local-library').value;
      if (!id) return;
      await this.transaction('readwrite', store => store.delete(id));
      await this.refresh();
      this.status('Removed from this browser.');
    });
    try {
      await this.refresh();
      this.status('Robots you load are saved automatically in this browser.');
    } catch (error) {
      this.status('Browser saving unavailable: ' + error.message + ' You can still load local files.', true);
    }
  }
  startDocument() {
    this.openingDocument = true;
    this.document = { id: null };
    this.currentXml = null;
    App.animform.stop();
    App.animform.prepareArraysfromCSV('');
    document.getElementById('robotcsv').value = '';
    document.getElementById('local-name').value = '';
  }
  clearAssets() {
    this.assets.clear();
    // Geometry disposal is handled when the current scene is replaced.
    this.geometries.clear();
  }
  showURDF(urdf) {
    this.form.myCodeMirror.setValue(urdf);
    this.form.resetNload();
    App.workspace.select('urdf');
  }
  async importFiles(input) {
    const files = [...input.files];
    input.value = '';
    const urdfs = files.filter(file => /\.(urdf|xml)$/i.test(file.name));
    if (urdfs.length > 1) throw new Error('Select one URDF at a time, together with any STL files.');
    const incoming = [];
    for (const file of files.filter(file => /\.stl$/i.test(file.name))) {
      const bytes = await file.arrayBuffer();
      try { this.parse(bytes).dispose(); } catch (error) { throw new Error(file.name + ': ' + error.message); }
      incoming.push([this.normalize(file.webkitRelativePath || file.name), bytes]);
    }
    if (!urdfs.length && !incoming.length) throw new Error('Select a URDF/XML file or STL meshes.');
    const xml = urdfs.length ? await urdfs[0].text() : this.form.myCodeMirror.getValue();
    if (urdfs.length) {
      this.validate(xml);
      if (!App.workspace.canReplaceDraft()) return;
      this.startDocument();
    }
    for (const [name, bytes] of incoming) {
      this.assets.set(name, bytes);
      this.geometries.delete(name);
    }
    if (xml.trim()) this.showURDF(xml);
    else this.status(incoming.length + ' STL file(s) ready. Load or paste a URDF next.');
  }
  validate(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror') || doc.documentElement.tagName !== 'robot') throw new Error('Enter a valid URDF with a <robot> root.');
    const linkElements = [...doc.querySelectorAll('robot > link')];
    const links = new Set(linkElements.map(link => link.getAttribute('name')));
    if (links.size !== linkElements.length || links.has(null) || links.has('')) throw new Error('Links need unique, nonempty names.');
    const joints = new Map(), parents = new Map(), mimicDrivers = new Map();
    for (const joint of doc.querySelectorAll('robot > joint')) {
      const name = joint.getAttribute('name'), parent = joint.querySelector(':scope > parent')?.getAttribute('link'), child = joint.querySelector(':scope > child')?.getAttribute('link');
      if (!name || joints.has(name)) throw new Error('Joints need unique, nonempty names.');
      if (!links.has(parent) || !links.has(child)) throw new Error('Joint ' + name + ' must reference existing parent and child links.');
      if (parent === child || parents.has(child)) throw new Error('Joint ' + name + ' must give its child link exactly one parent.');
      joints.set(name, joint); parents.set(child, parent);
      const mimic = joint.querySelector(':scope > mimic');
      if (mimic) {
        const driver = mimic.getAttribute('joint');
        if (!driver) throw new Error('Mimic joint ' + name + ' needs a driving joint.');
        for (const attribute of ['multiplier', 'offset']) {
          if (mimic.hasAttribute(attribute) && (!mimic.getAttribute(attribute).trim() || !Number.isFinite(Number(mimic.getAttribute(attribute))))) throw new Error('Mimic joint ' + name + ' needs a finite ' + attribute + '.');
        }
        mimicDrivers.set(name, driver);
      }
    }
    for (const child of parents.keys()) {
      const seen = new Set(); let link = child;
      while (parents.has(link)) {
        if (seen.has(link)) throw new Error('URDF link joints must form a tree.');
        seen.add(link); link = parents.get(link);
      }
    }
    for (const [name, driver] of mimicDrivers) {
      if (!joints.has(driver)) throw new Error('Mimic joint ' + name + ' refers to missing driver ' + driver + '.');
      const jointType = joints.get(name).getAttribute('type'), driverType = joints.get(driver).getAttribute('type');
      const rotational = type => type === 'revolute' || type === 'continuous';
      if (!(rotational(jointType) && rotational(driverType)) && !(jointType === 'prismatic' && driverType === 'prismatic')) throw new Error('Mimic joint ' + name + ' and its driver need matching motion types.');
      const seen = new Set(); let current = name;
      while (mimicDrivers.has(current)) {
        if (seen.has(current)) throw new Error('Mimic joints must not form a dependency cycle.');
        seen.add(current); current = mimicDrivers.get(current);
      }
    }
    mimicHomePositions([...joints].map(([name, joint]) => {
      const type = joint.getAttribute('type'), limit = joint.querySelector(':scope > limit'), mimic = joint.querySelector(':scope > mimic');
      const bound = (attribute, fallback) => limit?.hasAttribute(attribute) ? Number(limit.getAttribute(attribute)) : fallback;
      const lower = bound('lower', -Math.PI), upper = bound('upper', Math.PI);
      if (type !== 'continuous' && type !== 'fixed' && (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper)) throw new Error('Joint ' + name + ' needs valid limits.');
      return { name, type, lower, upper, mimic: mimic ? { joint: mimic.getAttribute('joint'), multiplier: mimic.getAttribute('multiplier') ?? 1, offset: mimic.getAttribute('offset') ?? 0 } : null };
    }));
    for (const origin of doc.querySelectorAll('origin')) {
      for (const attribute of ['xyz', 'rpy']) {
        if (!origin.hasAttribute(attribute)) continue;
        const values = origin.getAttribute(attribute).trim().split(/\s+/).map(Number);
        if (values.length !== 3 || !values.every(Number.isFinite)) throw new Error('Origin ' + attribute + ' needs three numbers.');
      }
    }
    for (const mesh of doc.querySelectorAll('mesh[scale]')) {
      const scale = mesh.getAttribute('scale').trim().split(/\s+/).map(Number);
      if (scale.length !== 3 || !scale.every(Number.isFinite)) throw new Error('Mesh scale needs three numbers.');
    }
    return doc;
  }
  saveAnimation() {
    if (this.currentXml) this.loaded(this.currentXml);
  }
  loaded(xml) {
    const changedRobot = this.currentXml == null;
    const documentState = this.document;
    this.currentXml = xml;
    App.workspace.draftStatus();
    App.workspace.animationStatus();
    document.getElementById('preview-name').textContent = this.validate(xml).documentElement.getAttribute('name') || 'Robot preview';
    const csv = document.getElementById('robotcsv').value;
    const warnings = [...new Set(this.messages)];
    const nameInput = document.getElementById('local-name');
    const doc = this.validate(xml);
    const name = nameInput.value.trim() || doc.documentElement.getAttribute('name') || 'Robot';
    const references = [...doc.querySelectorAll('mesh')].map(mesh => this.resolve(mesh.getAttribute('filename') || '')).filter(Boolean);
    const assets = [...new Set(references)].map(key => ({ name: key, bytes: this.assets.get(key) }));
    this.pendingSave = this.pendingSave.catch(() => {}).then(async () => {
      const records = await this.transaction('readonly', store => store.getAll());
      const old = documentState.id ? records.find(record => record.id === documentState.id) : records.find(record => record.urdf === xml);
      const savedCsv = changedRobot && old ? (old.csv || csv) : csv;
      const savedName = changedRobot && old ? (old.name || name) : name;
      if (changedRobot && this.document === documentState && !nameInput.value.trim()) nameInput.value = savedName;
      if (changedRobot && savedCsv && this.currentXml === xml && document.getElementById('robotcsv').value === csv) {
        document.getElementById('robotcsv').value = savedCsv;
        App.animform.prepareArraysfromCSV(savedCsv);
        App.workspace.animationStatus();
      }
      const retained = new Map((old?.assets || []).map(asset => [asset.name, asset]));
      assets.forEach(asset => retained.set(asset.name, asset));
      const id = documentState.id || old?.id || crypto.randomUUID();
      documentState.id = id;
      const record = { id, name: savedName, urdf: xml, csv: savedCsv, assets: [...retained.values()], updated: Date.now() };
      await this.transaction('readwrite', store => store.put(record));
      await this.refresh(this.document.id);
      if (this.document !== documentState) return;
      if (warnings.length) this.status('{warnings} Robot saved; add missing files to complete it.', false, { warnings });
      else this.status('Saved “{name}” in this browser.', false, { name: record.name });
    }).catch(error => this.status('Robot loaded, but browser saving failed: ' + error.message, true));
  }
}
