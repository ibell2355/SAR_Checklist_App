/**
 * PSAR Team Lead Checklist — Main application module
 *
 * Handles routing, state management, persistence, and event delegation.
 * Follows the same architectural patterns as the PSAR POD Calculator.
 */

import { loadChecklistConfig } from './model/configLoader.js';
import { getValue, setValue } from './storage/db.js';
import {
  renderLanding, renderChecklist, renderReport,
  renderUnderConstruction, renderTeamMembersInner, buildReportText
} from './ui/render.js';

/* ---- State ---- */

let config = null;
let state = defaultState();

function defaultState() {
  return {
    checklistId: 'pre_departure',
    startedAt: null,
    items: {},
    fields: {},
    teamMembers: [],
    collapsedSections: []
  };
}

/* ---- Persistence (debounced, IndexedDB with localStorage fallback) ---- */

let saveTimer = null;

function debounceSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await setValue('session', state);
  }, 250);
}

async function hydrate() {
  let saved = await getValue('session', null);

  // Legacy localStorage fallback
  if (!saved) {
    try {
      const raw = localStorage.getItem('sar-checklist-session');
      if (raw) {
        saved = JSON.parse(raw);
        localStorage.removeItem('sar-checklist-session');
      }
    } catch { /* ignore */ }
  }

  if (saved) {
    state = { ...defaultState(), ...saved };
    // Ensure arrays exist
    if (!Array.isArray(state.teamMembers)) state.teamMembers = [];
    if (!Array.isArray(state.collapsedSections)) state.collapsedSections = [];
  }
}

/* ---- Theme ---- */

function loadTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  route(); // re-render to update toggle button text
}

/* ---- Routing ---- */

function route() {
  const hash = location.hash || '#/';
  const viewRoot = document.getElementById('view-root');

  if (hash === '#/' || hash === '#') {
    viewRoot.innerHTML = renderLanding();
  } else if (hash === '#/checklist/segment') {
    viewRoot.innerHTML = renderUnderConstruction();
  } else if (hash.startsWith('#/checklist/')) {
    if (!state.startedAt) {
      state.startedAt = new Date().toISOString();
      debounceSave();
    }
    viewRoot.innerHTML = renderChecklist(config, state);
    updateConnectivity();
  } else if (hash === '#/report') {
    viewRoot.innerHTML = renderReport(config, state);
  } else {
    location.hash = '#/';
  }
}

/* ---- Event delegation ---- */

function handleClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  switch (action) {
    case 'open-checklist': {
      const id = btn.dataset.id;
      if (id === 'segment') {
        location.hash = '#/checklist/segment';
      } else {
        location.hash = `#/checklist/${id}`;
      }
      break;
    }
    case 'toggle-theme':
      toggleTheme();
      break;

    case 'show-qr':
      showQrOverlay();
      break;

    case 'back':
      location.hash = '#/';
      break;

    case 'back-to-checklist':
      location.hash = `#/checklist/${state.checklistId}`;
      break;

    case 'toggle-section': {
      const sectionId = btn.dataset.section;
      const idx = state.collapsedSections.indexOf(sectionId);
      if (idx >= 0) state.collapsedSections.splice(idx, 1);
      else state.collapsedSections.push(sectionId);
      const body = document.querySelector(`[data-section-body="${sectionId}"]`);
      const chevron = btn.querySelector('.section-chevron');
      if (body) body.classList.toggle('collapsed');
      if (chevron) chevron.classList.toggle('rotated');
      debounceSave();
      break;
    }
    case 'expand-all':
      state.collapsedSections = [];
      document.querySelectorAll('.section-body').forEach(el => el.classList.remove('collapsed'));
      document.querySelectorAll('.section-chevron').forEach(el => el.classList.remove('rotated'));
      debounceSave();
      break;

    case 'collapse-all':
      if (config) {
        state.collapsedSections = Object.keys(config.sections);
        document.querySelectorAll('.section-body').forEach(el => el.classList.add('collapsed'));
        document.querySelectorAll('.section-chevron').forEach(el => el.classList.add('rotated'));
        debounceSave();
      }
      break;

    case 'add-member':
      state.teamMembers.push({ name: '', roles: [] });
      rerenderTeamList();
      debounceSave();
      // Focus the new name input
      requestAnimationFrame(() => {
        const inputs = document.querySelectorAll('.member-name');
        const last = inputs[inputs.length - 1];
        if (last) last.focus();
      });
      break;

    case 'remove-member': {
      const mi = parseInt(btn.dataset.member);
      state.teamMembers.splice(mi, 1);
      rerenderTeamList();
      debounceSave();
      break;
    }
    case 'generate-report':
      location.hash = '#/report';
      break;

    case 'reset':
      if (confirm('Reset checklist? This will clear all progress.')) {
        state = defaultState();
        debounceSave();
        location.hash = '#/';
      }
      break;

    case 'print':
      window.print();
      break;

    case 'share':
      shareReport();
      break;
  }
}

function handleInput(e) {
  const el = e.target;

  if (el.dataset.field) {
    state.fields[el.dataset.field] = el.value;
    debounceSave();
  }

  if (el.dataset.memberName !== undefined) {
    const idx = parseInt(el.dataset.memberName);
    if (state.teamMembers[idx]) {
      state.teamMembers[idx].name = el.value;
      debounceSave();
    }
  }
}

function handleChange(e) {
  const el = e.target;

  // Checkbox items
  if (el.dataset.item && el.type === 'checkbox') {
    state.items[el.dataset.item] = el.checked;
    debounceSave();
    updateProgress();
  }

  // Role checkboxes on team members
  if (el.dataset.role !== undefined && el.dataset.member !== undefined) {
    const mi = parseInt(el.dataset.member);
    const role = el.dataset.role;
    const member = state.teamMembers[mi];
    if (!member) return;
    if (el.checked && !member.roles.includes(role)) {
      member.roles.push(role);
    } else if (!el.checked) {
      member.roles = member.roles.filter(r => r !== role);
    }
    debounceSave();
  }
}

/* ---- Partial DOM updates ---- */

function updateProgress() {
  if (!config) return;

  for (const [sectionId, section] of Object.entries(config.sections)) {
    const cbItems = Object.entries(section.items || {}).filter(([_, i]) => i.type === 'checkbox');
    const done = cbItems.filter(([id]) => state.items[id]).length;
    const badge = document.querySelector(`[data-section="${sectionId}"] .section-progress`);
    if (badge) badge.textContent = `${done}/${cbItems.length}`;
  }

  const allCb = [];
  for (const section of Object.values(config.sections)) {
    for (const [id, item] of Object.entries(section.items || {})) {
      if (item.type === 'checkbox') allCb.push(id);
    }
  }
  const totalDone = allCb.filter(id => state.items[id]).length;
  const overall = document.querySelector('.overall-progress');
  if (overall) overall.textContent = `${totalDone}/${allCb.length}`;
}

function rerenderTeamList() {
  const container = document.querySelector('.team-members-list');
  if (!container || !config) return;
  const roles = getTeamListRoles();
  container.innerHTML = renderTeamMembersInner(roles, state.teamMembers);
}

function getTeamListRoles() {
  for (const section of Object.values(config.sections)) {
    for (const [id, item] of Object.entries(section.items || {})) {
      if (item.type === 'team_list') return item.roles || [];
    }
  }
  return [];
}

/* ---- Share / Copy ---- */

async function shareReport() {
  const text = buildReportText(config, state);
  if (navigator.share) {
    try {
      await navigator.share({ title: config.title, text });
      return;
    } catch { /* user cancelled or not supported */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Report copied to clipboard');
  } catch {
    showToast('Unable to copy report');
  }
}

/* ---- Toast ---- */

function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), 1800);
}

/* ---- QR overlay ---- */

function showQrOverlay() {
  if (document.getElementById('qr-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'qr-overlay';
  overlay.innerHTML = '<img src="./assets/SAR_Checklist_App_QR.png" alt="QR Code">';
  document.body.appendChild(overlay);
  overlay.addEventListener('click', () => overlay.remove());
}

/* ---- Connectivity ---- */

function updateConnectivity() {
  const pill = document.getElementById('connectivity-pill');
  if (!pill) return;
  const online = navigator.onLine;
  pill.textContent = online ? 'Online' : 'Offline';
  pill.className = `connectivity-pill ${online ? 'online' : 'offline'}`;
}

/* ---- Service Worker ---- */

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./service-worker.js');
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloading) { reloading = true; location.reload(); }
    });
  } catch { /* SW not supported or registration failed */ }
}

/* ---- Init ---- */

async function init() {
  loadTheme();

  const [configResult, pkgInfo] = await Promise.all([
    loadChecklistConfig('pre_departure'),
    fetch('./package.json').then(r => r.json()).catch(() => ({ version: '?', buildDate: '' }))
  ]);

  if (configResult.ok) {
    config = configResult.config;
  }

  await hydrate();

  // Version stamp
  const stamp = document.getElementById('build-stamp');
  if (stamp) stamp.textContent = `v${pkgInfo.version} \u00b7 ${pkgInfo.buildDate}`;

  // Event delegation
  const viewRoot = document.getElementById('view-root');
  viewRoot.addEventListener('click', handleClick);
  viewRoot.addEventListener('input', handleInput);
  viewRoot.addEventListener('change', handleChange);

  // Routing
  window.addEventListener('hashchange', route);
  window.addEventListener('online', updateConnectivity);
  window.addEventListener('offline', updateConnectivity);

  route();
  registerSW();
}

init();
