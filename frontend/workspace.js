import { appendPose } from './csv-poses.js';

export class Workspace {
  init(form) {
    this.form = form;
    this.active = 'urdf';
    const help = document.getElementById('help-dialog');
    const helpButton = document.getElementById('help-button');
    helpButton.onclick = () => help.showModal();
    help.addEventListener('close', () => helpButton.focus());
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
      App.i18n.setText(event.target, expanded ? 'Restore size' : 'More space');
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
        if (button.dataset.collisionDemo) {
          const pose = {left_shoulder_forward_joint:1.35,left_shoulder_up_joint:.4,left_elbow_joint:1.55,left_wrist_joint:-.5};
          for (const [name,value] of Object.entries(pose)) App.robotjointmanipall.changejointval(name,value);
          document.getElementById('collision-enabled').checked = true;
          App.collisions.setEnabled(true);
        }
      } catch (error) { App.localRobots.status(error.message, true); }
    });
    document.getElementById('collision-enabled').onchange = event => App.collisions.setEnabled(event.target.checked);
    document.getElementById('standard-view').onchange = event => { if (event.target.value) App.setStandardView(event.target.value); };
    document.querySelectorAll('[data-camera]').forEach(button => button.onclick = () => this.cameraAction(button.dataset.camera));
    document.getElementById('screenshot').onclick = () => form.showScreenshot();
    document.getElementById('screenshotplace').onclick = () => form.closeScreenshot();
    const canvas = window.renderer.domElement;
    canvas.tabIndex = 0;
    App.i18n.setAttr(canvas, 'aria-label', 'Robot preview. Drag to orbit, Shift-drag to pan, scroll to zoom. F fits the robot.');
    canvas.onpointerdown = () => canvas.focus({preventScroll:true});
    canvas.onkeydown = event => {
      const actions = {f:'fit', F:'fit', Home:'home', '+':'in', '=':'in', '-':'out'};
      if (actions[event.key]) { event.preventDefault(); this.cameraAction(actions[event.key]); }
    };
    document.getElementById('csv-template').onclick = () => this.appendCurrentPose();
    document.getElementById('robotcsv').addEventListener('input', () => { App.animform.stop(); this.animationStatus(); });
    this.initJointPanel();
    this.resizeDivider();
    this.animationStatus();
    App.poseTool.init(canvas);
  }
  select(name) {
    if (name === 'joints' && this.active !== 'joints') this.jointsReturnPanel = this.active;
    this.active = name;
    document.querySelectorAll('[role=tab]').forEach(tab => { const selected = tab.dataset.panel === name; tab.setAttribute('aria-selected', selected); tab.tabIndex = selected ? 0 : -1; });
    document.querySelectorAll('.workspace-panel').forEach(panel => panel.hidden = panel.id !== 'panel-' + name);
    if (name === 'urdf') this.form.myCodeMirror.refresh();
  }
  connectJointSlider(controller, joint) {
    const legacySlider = controller.domElement.querySelector('.slider');
    if (!legacySlider) return;
    const slider = document.createElement('input');
    slider.type = 'range'; slider.className = 'joint-slider';
    slider.min = joint.lower; slider.max = joint.upper; slider.step = 'any';
    slider.setAttribute('aria-label', joint.name);
    legacySlider.replaceWith(slider);
    const update = controller.updateDisplay.bind(controller);
    controller.updateDisplay = () => {
      const result = update();
      slider.value = controller.getValue();
      slider.setAttribute('aria-valuenow', controller.getValue());
      return result;
    };
    slider.addEventListener('input', () => controller.setValue(Number(slider.value)));
    slider.addEventListener('keydown', event => {
      const step = event.shiftKey ? .1 : .01;
      const values = {ArrowLeft:controller.getValue()-step, ArrowDown:controller.getValue()-step, ArrowRight:controller.getValue()+step, ArrowUp:controller.getValue()+step, Home:joint.lower, End:joint.upper};
      if (!(event.key in values)) return;
      event.preventDefault(); controller.setValue(values[event.key]);
    });
    controller.domElement.querySelectorAll('input[type=text]').forEach(input => {
      input.setAttribute('inputmode', 'decimal'); App.i18n.setAttr(input, 'aria-label', '{name} value', { name: joint.name });
    });
    controller.updateDisplay();
  }
  initJointPanel() {
    const floating = document.getElementById('floating-joints');
    const handle = document.getElementById('joint-panel-handle');
    const host = document.getElementById('joint-controls');
    const detach = document.getElementById('joints-detach');
    const note = document.getElementById('joint-detached-note');
    const constrain = () => {
      if (floating.hidden) return;
      const box = floating.getBoundingClientRect();
      const compact = innerWidth < 760 || matchMedia('(pointer: coarse)').matches;
      const width = Math.min(box.width, compact ? 250 : innerWidth - 16);
      const height = Math.min(box.height, compact ? Math.min(280, innerHeight * .45) : innerHeight - 68);
      const left = Math.max(8, Math.min(box.left, innerWidth - width - 8));
      const top = Math.max(60, Math.min(box.top, innerHeight - height - 8));
      if (Math.abs(box.width - width) > .5) floating.style.width = width + 'px';
      if (Math.abs(box.height - height) > .5) floating.style.height = height + 'px';
      floating.style.left = left + 'px'; floating.style.top = top + 'px';
    };
    const dock = () => {
      document.getElementById('panel-joints').append(host);
      floating.hidden = true; note.hidden = true; detach.hidden = false;
      App.i18n.setAttr(document.getElementById('tab-joints'), 'title', '');
      this.select('joints'); detach.focus();
    };
    detach.onclick = () => {
      const first = !floating.style.left;
      floating.hidden = false;
      document.getElementById('floating-joints-content').append(host);
      if (first) {
        const compact = innerWidth < 760 || matchMedia('(pointer: coarse)').matches;
        const width = compact ? Math.min(250, innerWidth - 24) : Math.min(400, innerWidth - 16);
        const height = compact ? Math.min(280, innerHeight * .45) : 400;
        floating.style.height = height + 'px';
        floating.style.width = width + 'px';
        floating.style.left = Math.max(8, innerWidth - width - 16) + 'px';
        floating.style.top = (compact ? Math.max(60, innerHeight - height - 16) : 80) + 'px';
      }
      note.hidden = false; detach.hidden = true;
      App.i18n.setAttr(document.getElementById('tab-joints'), 'title', 'Joint controls are detached');
      this.select(this.jointsReturnPanel || 'urdf'); constrain(); handle.focus({preventScroll:true});
    };
    document.getElementById('joints-dock').onclick = dock;
    document.getElementById('joints-dock-here').onclick = dock;
    document.getElementById('joints-show').onclick = () => handle.focus({preventScroll:true});
    let drag;
    handle.onpointerdown = event => {
      if (event.button !== 0 || event.target.closest('button')) return;
      const box = floating.getBoundingClientRect();
      drag = { x: event.clientX, y: event.clientY, left: box.left, top: box.top };
      handle.setPointerCapture(event.pointerId); handle.classList.add('dragging'); event.preventDefault();
    };
    handle.onpointermove = event => {
      if (!drag || !handle.hasPointerCapture(event.pointerId)) return;
      floating.style.left = drag.left + event.clientX - drag.x + 'px';
      floating.style.top = drag.top + event.clientY - drag.y + 'px'; constrain();
    };
    handle.onpointerup = event => {
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      drag = null; handle.classList.remove('dragging');
    };
    handle.onpointercancel = () => { drag = null; handle.classList.remove('dragging'); };
    handle.onkeydown = event => {
      if (event.target.closest('button')) return;
      const directions = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      if (!directions[event.key]) return;
      event.preventDefault();
      const box = floating.getBoundingClientRect(), delta = event.shiftKey ? 48 : 16;
      floating.style.left = box.left + directions[event.key][0] * delta + 'px';
      floating.style.top = box.top + directions[event.key][1] * delta + 'px'; constrain();
    };
    new ResizeObserver(constrain).observe(floating);
    window.addEventListener('resize', constrain);
  }
  draftStatus() {
    this.dirty = this.form.myCodeMirror.getValue() !== (App.localRobots.currentXml || '');
    App.i18n.setText(document.getElementById('draft-status'), this.dirty ? 'Unapplied changes' : 'Preview up to date');
    document.getElementById('draft-status').classList.toggle('dirty', this.dirty);
  }
  canReplaceDraft() { return !this.dirty || window.confirm(App.i18n.t('Replace the unapplied URDF edits? Apply changes first to keep them in this browser.')); }
  cameraAction(action) {
    App.poseTool.finish();
    if (action === 'fit') App.fitRobot();
    if (action === 'home') { App.setStandardView('iso'); App.fitRobot(); }
    if (action === 'in' || action === 'out') {
      const offset = App.camera.position.clone().sub(App.cameraControls.target);
      const distance = Math.max(App.cameraControls.minDistance, Math.min(App.cameraControls.maxDistance, offset.length() * (action === 'in' ? .8 : 1.25)));
      App.camera.position.copy(App.cameraControls.target).add(offset.setLength(distance)); App.cameraControls.update();
    }
  }
  appendCurrentPose() {
    App.poseTool.finish();
    const input = document.getElementById('robotcsv');
    const values = new Map(window.robotjointcollection.filter(joint => joint.type !== 'fixed').map(joint => [joint.name, joint.theta]));
    try {
      const csv = appendPose(input.value, values, CSVToArray, App.animform.deltaTime);
      input.value = csv;
      App.animform.loadCSVfromForm({ preserveText: true });
      App.animform.curframe = App.animform.poses.length - 1;
      App.animform.state = 'finished';
      App.animform.prettify();
      input.scrollTop = input.scrollHeight;
    } catch (error) {
      App.i18n.setText(document.getElementById('animation-status'), 'Cannot add a pose: {message}', { message: error.message });
      const badge = document.getElementById('animation-badge');
      badge.hidden = false; App.i18n.setAttr(badge, 'title', 'Cannot add a pose: {message}', { message: error.message });
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
    badge.hidden = !text || valid; App.i18n.setAttr(badge, 'title', message);
    document.getElementById('csv-template').disabled = !window.robotjointcollection?.some(joint => joint.type !== 'fixed');
    this.csvValid = valid;
    App.i18n.setText(document.getElementById('animation-status'), message);
    ['playbutton','pausebutton','stopbutton','prevbutton','nextbutton'].forEach(id => document.getElementById(id).disabled = !valid);
    return valid;
  }
  resizeDivider() {
    const divider = document.getElementById('workspace-divider');
    const mobile = () => window.innerWidth < 760 && !(window.innerHeight <= 520 && window.innerWidth > window.innerHeight);
    const resize = (x, y) => {
      document.body.classList.remove('editor-focus');
      const expand = document.getElementById('editor-expand');
      App.i18n.setText(expand, 'More space'); expand.setAttribute('aria-pressed', 'false');
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
