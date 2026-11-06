export class Workspace {
  init(form) {
    this.form = form;
    this.active = 'urdf';
    const tabs = [...document.querySelectorAll('[role=tab]')];
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => this.select(tab.dataset.panel));
      tab.addEventListener('keydown', event => {
        const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (offset) { event.preventDefault(); const next = tabs[(i + offset + tabs.length) % tabs.length]; this.select(next.dataset.panel); next.focus(); }
      });
    });
    document.getElementById('open-files').onclick = () => this.select('files');
    document.getElementById('wrap-lines').onchange = event => form.myCodeMirror.setOption('lineWrapping', event.target.checked);
    document.getElementById('editor-expand').onclick = event => {
      const expanded = document.body.classList.toggle('editor-focus');
      event.target.setAttribute('aria-pressed', expanded);
      event.target.textContent = expanded ? 'Restore size' : 'More space';
      requestAnimationFrame(() => form.myCodeMirror.refresh());
    };
    form.myCodeMirror.on('change', () => this.draftStatus());
    document.querySelectorAll('.example-open').forEach(button => button.onclick = async () => {
      try {
        const response = await fetch(button.dataset.url);
        if (!response.ok) throw new Error('Could not open example.');
        const xml = await response.text();
        if (!this.canReplaceDraft()) return;
        App.localRobots.startDocument();
        App.localRobots.showURDF(xml);
        this.select('urdf');
      } catch (error) { App.localRobots.status(error.message, true); }
    });
    document.getElementById('standard-view').onchange = event => { if (event.target.value) App.setStandardView(event.target.value); };
    document.querySelectorAll('[data-camera]').forEach(button => button.onclick = () => this.cameraAction(button.dataset.camera));
    document.getElementById('screenshot').onclick = () => form.showScreenshot();
    document.getElementById('screenshotplace').onclick = () => form.closeScreenshot();
    const canvas = window.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Robot preview. Drag to orbit, Shift-drag to pan, scroll to zoom. F fits the robot.');
    canvas.onpointerdown = () => canvas.focus({preventScroll:true});
    canvas.onkeydown = event => {
      const actions = {f:'fit', F:'fit', Home:'home', '+':'in', '=':'in', '-':'out'};
      if (actions[event.key]) { event.preventDefault(); this.cameraAction(actions[event.key]); }
    };
    document.getElementById('csv-template').onclick = () => {
      const joints = window.robotjointcollection.filter(joint => joint.type !== 'fixed');
      document.getElementById('robotcsv').value = 'time,' + joints.map(joint => joint.name).join(',') + '\n0,' + joints.map(joint => joint.theta).join(',') + '\n';
      App.animform.loadCSVfromForm();
    };
    document.getElementById('robotcsv').addEventListener('input', () => { App.animform.stop(); this.animationStatus(); });
    this.resizeDivider();
    this.animationStatus();
  }
  select(name) {
    this.active = name;
    document.querySelectorAll('[role=tab]').forEach(tab => { const selected = tab.dataset.panel === name; tab.setAttribute('aria-selected', selected); tab.tabIndex = selected ? 0 : -1; });
    document.querySelectorAll('.workspace-panel').forEach(panel => panel.hidden = panel.id !== 'panel-' + name);
    if (name === 'urdf') this.form.myCodeMirror.refresh();
  }
  draftStatus() {
    this.dirty = this.form.myCodeMirror.getValue() !== (App.localRobots.currentXml || '');
    document.getElementById('draft-status').textContent = this.dirty ? 'Unapplied changes' : 'Preview up to date';
    document.getElementById('draft-status').classList.toggle('dirty', this.dirty);
  }
  canReplaceDraft() { return !this.dirty || window.confirm('Replace the unapplied URDF edits? Apply changes first to keep them in this browser.'); }
  cameraAction(action) {
    if (action === 'fit') App.fitRobot();
    if (action === 'home') { App.setStandardView('iso'); App.fitRobot(); }
    if (action === 'in' || action === 'out') {
      const offset = App.camera.position.clone().sub(App.cameraControls.target);
      const distance = Math.max(App.cameraControls.minDistance, Math.min(App.cameraControls.maxDistance, offset.length() * (action === 'in' ? .8 : 1.25)));
      App.camera.position.copy(App.cameraControls.target).add(offset.setLength(distance)); App.cameraControls.update();
    }
  }
  animationStatus() {
    const text = document.getElementById('robotcsv').value.trim();
    let message = 'Paste CSV or insert the current pose to begin.';
    let valid = false;
    if (text && window.robotjointcollection) {
      const rows = CSVToArray(text);
      const timed = rows[0][0] === 'time';
      const names = rows[0].slice(timed ? 1 : 0);
      const unknown = names.filter(name => { const joint = robotjointcollection.findWhere({name}); return !joint || joint.type === 'fixed'; });
      valid = rows.length > 1 && names.length > 0 && new Set(names).size === names.length && !unknown.length && rows.slice(1).every(row => row.length === rows[0].length && row.every(value => value.trim() !== '' && Number.isFinite(Number(value))));
      if (timed && valid) valid = rows.slice(1).every(row => Number(row[0]) >= 0);
      message = unknown.length ? 'Unknown or fixed joints: ' + unknown.join(', ') : valid ? 'Ready to play · ' + (rows.length - 1) + ' poses · ' + names.length + ' joints · ' + (timed ? 'time in seconds' : '0.06 s per frame') : 'Check the CSV: use joint names and equal-length rows of numbers.';
    }
    const badge = document.getElementById('animation-badge');
    badge.hidden = !text || valid; badge.title = message;
    document.getElementById('csv-template').disabled = !window.robotjointcollection?.some(joint => joint.type !== 'fixed');
    this.csvValid = valid;
    document.getElementById('animation-status').textContent = message;
    ['playbutton','pausebutton','stopbutton','prevbutton','nextbutton'].forEach(id => document.getElementById(id).disabled = !valid);
    return valid;
  }
  resizeDivider() {
    const divider = document.getElementById('workspace-divider');
    const mobile = () => window.innerWidth < 760 && !(window.innerHeight <= 520 && window.innerWidth > window.innerHeight);
    const resize = (x, y) => {
      document.body.classList.remove('editor-focus');
      const expand = document.getElementById('editor-expand');
      expand.textContent = 'More space'; expand.setAttribute('aria-pressed', 'false');
      const value = mobile() ? Math.max(140, Math.min(innerHeight - 260, y - 52)) : Math.max(320, Math.min(innerWidth - 320, x));
      document.body.style.setProperty(mobile() ? '--preview-height' : '--workspace-width', value + 'px');
      divider.setAttribute('aria-valuenow', Math.round(value / (mobile() ? innerHeight : innerWidth) * 100));
      this.form.myCodeMirror.refresh();
    };
    divider.onpointerdown = event => { divider.setPointerCapture(event.pointerId); document.body.classList.add('resizing'); };
    divider.onpointermove = event => { if (divider.hasPointerCapture(event.pointerId)) resize(event.clientX, event.clientY); };
    divider.onpointerup = event => { divider.releasePointerCapture(event.pointerId); document.body.classList.remove('resizing'); };
    divider.onpointercancel = () => document.body.classList.remove('resizing');
    divider.onkeydown = event => {
      const delta = ['ArrowLeft','ArrowUp'].includes(event.key) ? -24 : ['ArrowRight','ArrowDown'].includes(event.key) ? 24 : 0;
      if (delta) { event.preventDefault(); const box = divider.getBoundingClientRect(); resize(box.left + delta, box.top + delta); }
    };
    const update = () => { divider.setAttribute('aria-orientation', mobile() ? 'horizontal' : 'vertical'); this.form.myCodeMirror.refresh(); };
    window.addEventListener('resize', update); update();
  }
}
