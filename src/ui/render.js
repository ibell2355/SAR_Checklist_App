/**
 * Render functions for PSAR Team Lead Checklist.
 * Each function returns an HTML string for injection into #view-root.
 */

/* ===== Landing Page ===== */

export function renderLanding() {
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  return `
    <div class="landing">
      <div class="landing-brand">
        <img class="landing-logo" src="./assets/psar_logo.png" alt="Parkland Search & Rescue">
        <h1>PSAR Team Lead Checklist</h1>
        <p class="subtle">Field tools for Search & Rescue</p>
      </div>
      <div class="landing-actions">
        <button class="btn btn-accent btn-block" data-action="open-checklist" data-id="pre_departure">
          Pre-Departure Checklist
        </button>
        <button class="btn btn-block" data-action="open-checklist" data-id="segment">
          Segment Checklist
        </button>
      </div>
      <div class="landing-bottom">
        <div class="landing-meta">
          <img class="qr-code" src="./assets/SAR_Checklist_App_QR.png" alt="App QR Code" width="44" height="44" role="button" tabindex="0" data-action="show-qr">
          <button class="btn btn-sm" data-action="toggle-theme">${theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</button>
        </div>
        <p class="reminder-text">This tool does not replace required notebook documentation.</p>
      </div>
    </div>`;
}

/* ===== Checklist Page ===== */

export function renderChecklist(config, state) {
  if (!config) return '<div class="panel"><p>Error loading checklist configuration.</p></div>';

  const sections = config.sections;
  const allCb = getAllCheckboxIds(sections);
  const completed = allCb.filter(id => state.items[id]).length;

  let html = `
    <div class="checklist-header">
      <div class="checklist-title-area">
        <h2 class="checklist-title">${esc(config.title)}</h2>
        <span class="overall-progress badge">${completed}/${allCb.length}</span>
      </div>
      ${config.subtitle ? `<p class="subtle checklist-subtitle">${esc(config.subtitle)}</p>` : ''}
      <div class="row between align-center gap-sm checklist-controls">
        <div class="row gap-sm">
          <button class="btn btn-xs" data-action="back">&larr; Back</button>
          <button class="btn btn-xs" data-action="expand-all">Expand All</button>
          <button class="btn btn-xs" data-action="collapse-all">Collapse All</button>
        </div>
        <div id="connectivity-pill" class="connectivity-pill online">Online</div>
      </div>
    </div>`;

  for (const [sectionId, section] of Object.entries(sections)) {
    const isCollapsed = state.collapsedSections.includes(sectionId);
    const items = section.items || {};
    const cbIds = Object.entries(items).filter(([_, i]) => i.type === 'checkbox').map(([id]) => id);
    const sectionDone = cbIds.filter(id => state.items[id]).length;

    html += `
      <section class="checklist-section">
        <div class="section-header" data-action="toggle-section" data-section="${sectionId}">
          <h3>${esc(section.title)}</h3>
          <span class="section-progress badge-sm">${sectionDone}/${cbIds.length}</span>
          <span class="section-chevron${isCollapsed ? ' rotated' : ''}">&#9660;</span>
        </div>
        <div class="section-body${isCollapsed ? ' collapsed' : ''}" data-section-body="${sectionId}">`;

    for (const [itemId, item] of Object.entries(items)) {
      html += renderItem(itemId, item, state);
    }

    html += `
        </div>
      </section>`;
  }

  html += `
    <div class="checklist-footer">
      <button class="btn btn-accent btn-block" data-action="generate-report">Generate Report</button>
      <button class="btn btn-danger btn-sm" data-action="reset">Reset Checklist</button>
    </div>`;

  return html;
}

/* ---- Item renderers ---- */

function renderItem(id, item, state) {
  switch (item.type) {
    case 'checkbox': return renderCheckbox(id, item, state);
    case 'text':     return renderTextField(id, item, state);
    case 'team_list': return renderTeamList(id, item, state);
    default: return '';
  }
}

function renderCheckbox(id, item, state) {
  const checked = state.items[id] ? 'checked' : '';
  const cls = item.important ? ' important' : '';
  return `
    <label class="check-item${cls}">
      <input type="checkbox" data-item="${id}" ${checked}>
      <span class="check-label">${esc(item.label)}${item.helper ? `<span class="helper-text">${esc(item.helper)}</span>` : ''}</span>
    </label>`;
}

function renderTextField(id, item, state) {
  const value = state.fields[id] || '';
  return `
    <div class="field-item">
      <label class="field-label">${esc(item.label)}${item.helper ? `<span class="helper-text">${esc(item.helper)}</span>` : ''}</label>
      <input type="text" data-field="${id}" value="${escAttr(value)}" placeholder="${escAttr(item.placeholder || '')}">
    </div>`;
}

function renderTeamList(id, item, state) {
  const roles = item.roles || [];
  return `
    <div class="team-list-container">
      <label class="field-label">${esc(item.label)}${item.helper ? `<span class="helper-text">${esc(item.helper)}</span>` : ''}</label>
      <button class="btn btn-sm" data-action="add-member" style="margin-top:6px">+ Add Team Member</button>
      <div class="team-members-list">${renderTeamMembersInner(roles, state.teamMembers)}</div>
    </div>`;
}

/** Render just the inner team member entries (for partial updates). */
export function renderTeamMembersInner(roles, teamMembers) {
  let html = '';
  teamMembers.forEach((member, idx) => {
    html += `
      <div class="team-member-entry">
        <div class="team-member-top">
          <input type="text" class="member-name" data-member-name="${idx}" value="${escAttr(member.name)}" placeholder="Name">
          <button class="btn btn-xs btn-danger" data-action="remove-member" data-member="${idx}">&times;</button>
        </div>
        <div class="chip-row">`;
    roles.forEach(role => {
      const has = member.roles.includes(role);
      const label = role.charAt(0).toUpperCase() + role.slice(1);
      html += `
          <label class="chip">
            <input type="checkbox" data-member="${idx}" data-role="${role}" ${has ? 'checked' : ''}>
            <span>${label}</span>
          </label>`;
    });
    html += `
        </div>
      </div>`;
  });
  return html;
}

/* ===== Report Page ===== */

export function renderReport(config, state) {
  if (!config) return '<div class="panel"><p>Error loading configuration.</p></div>';

  const timestamp = state.startedAt
    ? new Date(state.startedAt).toLocaleString()
    : new Date().toLocaleString();

  let html = `
    <div class="report-page">
      <div class="report-header no-print">
        <button class="btn btn-sm" data-action="back-to-checklist">&larr; Back</button>
        <div class="row gap-sm">
          <button class="btn btn-sm" data-action="share">Share / Copy</button>
          <button class="btn btn-sm btn-accent" data-action="print">Print</button>
        </div>
      </div>
      <div class="report-content">
        <h1 class="report-title">${esc(config.title)}</h1>
        <p class="report-timestamp">${timestamp}</p>
        <p class="report-disclaimer">This checklist is a memory aid and does not replace required notebook documentation.</p>`;

  // Filled fields
  const filledFields = [];
  for (const section of Object.values(config.sections)) {
    for (const [id, item] of Object.entries(section.items || {})) {
      if (item.type === 'text' && item.report !== false && state.fields[id]) {
        filledFields.push({ label: item.label, value: state.fields[id] });
      }
    }
  }
  if (filledFields.length > 0) {
    html += '<div class="report-section"><h3>Details</h3><dl class="report-fields">';
    for (const f of filledFields) {
      html += `<dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd>`;
    }
    html += '</dl></div>';
  }

  // Team members
  const named = state.teamMembers.filter(m => m.name.trim());
  if (named.length > 0) {
    html += '<div class="report-section"><h3>Team Members</h3><ul class="report-team">';
    for (const m of named) {
      const roleStr = m.roles.length > 0
        ? ` &mdash; ${m.roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}`
        : '';
      html += `<li>${esc(m.name)}${roleStr}</li>`;
    }
    html += '</ul></div>';
  }

  // Completed items by section
  for (const [sectionId, section] of Object.entries(config.sections)) {
    const completedItems = Object.entries(section.items || {})
      .filter(([id, item]) => item.type === 'checkbox' && state.items[id]);
    if (completedItems.length === 0) continue;
    html += `<div class="report-section"><h3>${esc(section.title)}</h3><ul>`;
    for (const [id, item] of completedItems) {
      html += `<li>${esc(item.label)}</li>`;
    }
    html += '</ul></div>';
  }

  html += `
      </div>
    </div>`;
  return html;
}

/* ===== Under Construction ===== */

export function renderUnderConstruction() {
  return `
    <div class="under-construction">
      <button class="btn btn-sm" data-action="back">&larr; Back</button>
      <div class="uc-content">
        <div class="uc-icon">&#9881;</div>
        <h2>Segment Checklist</h2>
        <p class="subtle">Under Construction</p>
        <p>This checklist is being developed and will be available in a future update.</p>
      </div>
    </div>`;
}

/* ===== Plaintext Report (for share/copy) ===== */

export function buildReportText(config, state) {
  if (!config) return '';

  const timestamp = state.startedAt
    ? new Date(state.startedAt).toLocaleString()
    : new Date().toLocaleString();

  let text = `${config.title}\n${'='.repeat(config.title.length)}\n\n`;
  text += `Date: ${timestamp}\n`;

  // Fields
  for (const section of Object.values(config.sections)) {
    for (const [id, item] of Object.entries(section.items || {})) {
      if (item.type === 'text' && item.report !== false && state.fields[id]) {
        text += `${item.label}: ${state.fields[id]}\n`;
      }
    }
  }

  // Team members
  const named = state.teamMembers.filter(m => m.name.trim());
  if (named.length > 0) {
    text += '\nTeam Members:\n';
    for (const m of named) {
      const r = m.roles.length > 0
        ? ` (${m.roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')})`
        : '';
      text += `  - ${m.name}${r}\n`;
    }
  }

  text += '\n';

  // Completed items by section
  for (const [sectionId, section] of Object.entries(config.sections)) {
    const done = Object.entries(section.items || {})
      .filter(([id, item]) => item.type === 'checkbox' && state.items[id]);
    if (done.length === 0) continue;
    text += `${section.title}\n`;
    for (const [id, item] of done) {
      text += `  [x] ${item.label}\n`;
    }
    text += '\n';
  }

  text += '---\nThis checklist is a memory aid and does not replace required notebook documentation.\n';
  return text;
}

/* ===== Helpers ===== */

function getAllCheckboxIds(sections) {
  const ids = [];
  for (const section of Object.values(sections)) {
    for (const [id, item] of Object.entries(section.items || {})) {
      if (item.type === 'checkbox') ids.push(id);
    }
  }
  return ids;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
