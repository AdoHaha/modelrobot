// URDF and mesh bytes stay on this device. IndexedDB supports large binary STL files.
export class LocalRobots {
  constructor(loader) {
    this.loader = loader;
    this.assets = new Map();
    this.geometries = new Map();
    this.records = [];
    this.messages = [];
    this.pendingSave = Promise.resolve();
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
  mesh(description, material) {
    const path = description.filename || '';
    const key = this.resolve(path);
    if (!/\.stl$/i.test(path)) {
      this.messages.push('Unsupported mesh: ' + path + ' (select an STL file).');
      return new THREE.Object3D();
    }
    if (!key) {
      this.messages.push('Missing or ambiguous STL: ' + path + '. Select its file or containing folder.');
      return new THREE.Object3D();
    }
    if (!this.geometries.has(key)) this.geometries.set(key, this.parse(this.assets.get(key)));
    const mesh = new THREE.Mesh(this.geometries.get(key), material);
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
  status(message, error = false) {
    const el = document.getElementById('local-status');
    el.textContent = message;
    el.classList.toggle('text-danger', error);
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
    on('local-save', 'click', () => { form.resetNload(); });
    on('local-open', 'click', async () => {
      await this.pendingSave;
      const id = document.getElementById('local-library').value;
      const record = await this.transaction('readonly', store => store.get(id));
      if (!record) return;
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
  clearAssets() {
    this.assets.clear();
    // Geometry disposal is handled when the current scene is replaced.
    this.geometries.clear();
  }
  showURDF(urdf) {
    this.form.myCodeMirror.setValue(urdf);
    this.form.resetNload();
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
      document.getElementById('local-name').value = '';
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
    return doc;
  }
  saveAnimation() {
    if (this.currentXml) this.loaded(this.currentXml);
  }
  loaded(xml) {
    const changedRobot = this.currentXml !== xml;
    if (changedRobot) {
      this.currentXml = xml;
      document.getElementById('robotcsv').value = '';
      App.animform.stop();
      App.animform.prepareArraysfromCSV('');
    }
    const csv = document.getElementById('robotcsv').value;
    const warnings = [...new Set(this.messages)];
    const nameInput = document.getElementById('local-name');
    const doc = this.validate(xml);
    const name = nameInput.value.trim() || doc.documentElement.getAttribute('name') || 'Robot';
    const references = [...doc.querySelectorAll('mesh')].map(mesh => this.resolve(mesh.getAttribute('filename') || '')).filter(Boolean);
    const assets = [...new Set(references)].map(key => ({ name: key, bytes: this.assets.get(key) }));
    this.pendingSave = this.pendingSave.catch(() => {}).then(async () => {
      const records = await this.transaction('readonly', store => store.getAll());
      const old = records.find(record => record.urdf === xml);
      const savedCsv = changedRobot && old ? (old.csv || csv) : csv;
      if (changedRobot && savedCsv && this.currentXml === xml && document.getElementById('robotcsv').value === csv) {
        document.getElementById('robotcsv').value = savedCsv;
        App.animform.prepareArraysfromCSV(savedCsv);
      }
      const retained = new Map((old?.assets || []).map(asset => [asset.name, asset]));
      assets.forEach(asset => retained.set(asset.name, asset));
      const record = { id: old ? old.id : crypto.randomUUID(), name, urdf: xml, csv: savedCsv, assets: [...retained.values()], updated: Date.now() };
      await this.transaction('readwrite', store => store.put(record));
      await this.refresh(record.id);
      this.status(warnings.length ? warnings.join(' ') + ' Robot saved; add missing files to complete it.' : 'Saved “' + name + '” in this browser.');
    }).catch(error => this.status('Robot loaded, but browser saving failed: ' + error.message, true));
  }
}
