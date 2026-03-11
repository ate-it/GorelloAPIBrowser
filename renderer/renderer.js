'use strict';

// ── State ─────────────────────────────────────────────────────
const state = {
  spec: null,
  activeEndpoint: null, // { path, method, op }
  paramInputs: {},      // inputEl refs keyed by param name
};

const BASE_URL = 'https://api.usw.gorelo.io';

// ── DOM refs ──────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const screens = {
  loading:  $('loading-screen'),
  error:    $('error-screen'),
  welcome:  $('welcome-screen'),
  detail:   $('endpoint-detail'),
};

// ── Show/hide screens ─────────────────────────────────────────
function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => {
    el.style.display = k === name ? '' : 'none';
  });
}

// ── Bootstrap ────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initTitleBar();
  initKeyModal();
  initApp();
  initUpdateBanner();

  $('retry-btn').addEventListener('click', loadSwagger);

  $('search').addEventListener('input', (e) => {
    filterNav(e.target.value.trim().toLowerCase());
  });

  $('toggle-token-vis').addEventListener('click', () => {
    const inp = $('auth-token');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  $('format-body-btn').addEventListener('click', () => {
    try {
      const parsed = JSON.parse($('body-editor').value);
      $('body-editor').value = JSON.stringify(parsed, null, 2);
    } catch { /* ignore */ }
  });

  $('try-btn').addEventListener('click', sendRequest);

  // Response tabs
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      $('response-body-tab').style.display    = tab === 'body'    ? '' : 'none';
      $('response-headers-tab').style.display = tab === 'headers' ? '' : 'none';
    });
  });
});

// ── Title bar controls ────────────────────────────────────────
function initTitleBar() {
  $('win-min').onclick   = () => window.electronAPI.win.minimize();
  $('win-max').onclick   = () => window.electronAPI.win.maximize();
  $('win-close').onclick = () => window.electronAPI.win.close();

  // Swap the maximise icon between □ and ❐ when the window state changes
  window.electronAPI.win.onMaximized((isMax) => {
    const svg = $('win-max').querySelector('svg');
    svg.innerHTML = isMax
      ? '<path d="M1 4h7v7H1z" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M3.5 4V2H10v7H8" stroke="currentColor" stroke-width="1.2" fill="none"/>'
      : '<rect x=".6" y=".6" width="8.8" height="8.8" rx=".8" stroke="currentColor" stroke-width="1.2" fill="none"/>';
  });
}

// ── Update banner ─────────────────────────────────────────────
function initUpdateBanner() {
  window.electronAPI.update.onAvailable(async ({ version, url }) => {
    const current = await window.electronAPI.appVersion();
    $('update-banner-text').innerHTML =
      `<strong>v${version}</strong> is available — you're on v${current}.`;
    $('update-banner').style.display = 'flex';

    $('update-view-btn').onclick    = () => window.electronAPI.update.openUrl(url);
    $('update-dismiss-btn').onclick = () => { $('update-banner').style.display = 'none'; };
  });
}

// ── API key management ────────────────────────────────────────
function setKeyStatusBar(hasKey) {
  const label = $('key-status-label');
  if (hasKey) {
    label.textContent = 'API key set';
    label.classList.add('has-key');
    $('key-change-btn').textContent = 'Change';
    $('key-remove-btn').style.display = '';
  } else {
    label.textContent = 'No API key';
    label.classList.remove('has-key');
    $('key-change-btn').textContent = 'Set key';
    $('key-remove-btn').style.display = 'none';
  }
}

function initKeyModal() {
  // Show/hide toggle
  $('key-modal-toggle').addEventListener('click', () => {
    const inp = $('key-modal-input');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // Confirm button
  $('key-modal-confirm').addEventListener('click', async () => {
    const key = $('key-modal-input').value.trim();
    const err = $('key-modal-error');
    if (!key) {
      err.textContent = 'Please enter an API key.';
      err.classList.add('visible');
      $('key-modal-input').focus();
      return;
    }
    err.classList.remove('visible');

    if ($('key-modal-remember').checked) {
      await window.electronAPI.key.save(key);
    }

    applyApiKey(key, $('key-modal-remember').checked);
    hideKeyModal();
  });

  // Skip button — just dismisses, does not clear anything
  $('key-modal-skip').addEventListener('click', () => {
    hideKeyModal();
  });

  // Enter key submits
  $('key-modal-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('key-modal-confirm').click();
  });

  // Sidebar change/set button
  $('key-change-btn').addEventListener('click', () => {
    $('key-modal-desc').textContent = 'Update your Gorelo API key. Optionally save it to this device.';
    showKeyModal();
  });

  // Sidebar remove button
  $('key-remove-btn').addEventListener('click', async () => {
    await window.electronAPI.key.clear();
    $('auth-token').value = '';
    setKeyStatusBar(false);
  });
}

function showKeyModal(clearInput = false) {
  if (clearInput) $('key-modal-input').value = '';
  $('key-modal-error').classList.remove('visible');
  $('key-modal-backdrop').style.display = 'flex';
  setTimeout(() => $('key-modal-input').focus(), 50);
}

function hideKeyModal() {
  $('key-modal-backdrop').style.display = 'none';
}

function applyApiKey(key, stored) {
  $('auth-token').value = key;
  setKeyStatusBar(true);
}

async function initApp() {
  // Try to load a stored key first
  const storedKey = await window.electronAPI.key.load();
  if (storedKey) {
    applyApiKey(storedKey, true);
  } else {
    setKeyStatusBar(false);
    // Show modal after a brief delay so the loading screen renders first
    setTimeout(() => showKeyModal(true), 300);
  }
  loadSwagger();
}

// ── Load swagger ──────────────────────────────────────────────
async function loadSwagger() {
  showScreen('loading');
  try {
    const spec = await window.electronAPI.fetchSwagger();
    state.spec = spec;
    buildNav(spec);
    showWelcome(spec);
  } catch (err) {
    $('error-msg').textContent = err.message;
    showScreen('error');
  }
}


// ── Welcome screen ────────────────────────────────────────────
function showWelcome(spec) {
  $('welcome-title').textContent = spec.info?.title || 'API Browser';
  $('welcome-desc').textContent  = spec.info?.description || 'Select an endpoint from the left panel to explore.';
  $('api-version').textContent   = `v${spec.info?.version || '1.0'}`;

  const paths    = Object.keys(spec.paths || {});
  let opCount    = 0;
  let tagSet     = new Set();
  paths.forEach((p) => {
    const methods = ['get','post','put','patch','delete','head','options'];
    methods.forEach((m) => {
      const op = spec.paths[p][m];
      if (op) {
        opCount++;
        (op.tags || ['Default']).forEach((t) => tagSet.add(t));
      }
    });
  });

  $('welcome-stats').innerHTML = `
    <div class="stat-item"><div class="stat-num">${paths.length}</div><div class="stat-label">Paths</div></div>
    <div class="stat-item"><div class="stat-num">${opCount}</div><div class="stat-label">Operations</div></div>
    <div class="stat-item"><div class="stat-num">${tagSet.size}</div><div class="stat-label">Groups</div></div>
  `;

  showScreen('welcome');
}

// ── Build sidebar nav ─────────────────────────────────────────
function buildNav(spec) {
  const METHODS = ['get','post','put','patch','delete','head','options'];
  const tagMap   = {};   // tag → [{ path, method, op }]

  Object.entries(spec.paths || {}).forEach(([path, pathObj]) => {
    METHODS.forEach((method) => {
      const op = pathObj[method];
      if (!op) return;
      const tags = op.tags?.length ? op.tags : ['General'];
      tags.forEach((tag) => {
        if (!tagMap[tag]) tagMap[tag] = [];
        tagMap[tag].push({ path, method, op });
      });
    });
  });

  const nav  = $('nav-tree');
  nav.innerHTML = '';

  Object.keys(tagMap).sort().forEach((tag) => {
    const endpoints = tagMap[tag];
    const group  = document.createElement('div');
    group.className = 'tag-group';

    const header = document.createElement('div');
    header.className = 'tag-header';
    header.innerHTML = `
      <span>${tag}</span>
      <span class="tag-count">${endpoints.length}</span>
      <svg class="tag-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
    `;
    header.addEventListener('click', () => group.classList.toggle('collapsed'));

    const list = document.createElement('div');
    list.className = 'tag-endpoints';

    endpoints.forEach(({ path, method, op }) => {
      const item = document.createElement('div');
      item.className = 'endpoint-item';
      item.dataset.path   = path;
      item.dataset.method = method;
      item.innerHTML = `
        <span class="method-pill pill-${method}">${method.toUpperCase()}</span>
        <span class="endpoint-path" title="${path}">${path}</span>
      `;
      item.addEventListener('click', () => {
        document.querySelectorAll('.endpoint-item.active').forEach((el) => el.classList.remove('active'));
        item.classList.add('active');
        showEndpoint(path, method, op);
      });
      list.appendChild(item);
    });

    group.appendChild(header);
    group.appendChild(list);
    nav.appendChild(group);
  });
}

// ── Filter nav ────────────────────────────────────────────────
function filterNav(query) {
  document.querySelectorAll('.tag-group').forEach((group) => {
    let anyVisible = false;
    group.querySelectorAll('.endpoint-item').forEach((item) => {
      const path   = item.dataset.path.toLowerCase();
      const method = item.dataset.method.toLowerCase();
      const match  = !query || path.includes(query) || method.includes(query);
      item.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });
    group.style.display = anyVisible ? '' : 'none';
    if (query && anyVisible) group.classList.remove('collapsed');
  });
}

// ── Show endpoint detail ──────────────────────────────────────
function showEndpoint(path, method, op) {
  state.activeEndpoint = { path, method, op };
  state.paramInputs    = {};

  $('endpoint-method-badge').textContent  = method.toUpperCase();
  $('endpoint-method-badge').className    = `badge-${method}`;
  $('endpoint-path-text').textContent     = path;
  $('endpoint-summary-text').textContent  = op.summary     || '';
  $('endpoint-desc-text').textContent     = op.description || '';

  buildParams(op.parameters || []);
  buildBodySection(op.requestBody);
  updateConstructedUrl();
  resetResponse();

  $('responses-content').innerHTML = buildResponseSchemas(op.responses || {});
  document.querySelectorAll('.schema-header').forEach((h) => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed'));
  });

  showScreen('detail');
}

// ── Build parameters table ────────────────────────────────────
function buildParams(params) {
  const section = $('params-section');
  const tbody   = $('params-tbody');
  tbody.innerHTML = '';

  if (!params.length) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';

  params.forEach((param) => {
    const schema = param.schema || {};
    const tr     = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="param-name">${param.name}</span></td>
      <td><span class="param-in in-${param.in}">${param.in}</span></td>
      <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">${schema.type || 'string'}</td>
      <td>${param.required ? '<span class="required-badge req-yes">Yes</span>' : '<span class="required-badge req-no">No</span>'}</td>
      <td style="color:var(--text-muted);font-size:11px">${param.description || ''}</td>
      <td><input class="param-input" data-param="${param.name}" data-in="${param.in}" placeholder="${schema.example ?? (schema.default ?? '')}" /></td>
    `;
    tbody.appendChild(tr);

    const input = tr.querySelector('.param-input');
    state.paramInputs[param.name] = input;
    input.addEventListener('input', updateConstructedUrl);
  });
}

// ── Build request body section ────────────────────────────────
function buildBodySection(requestBody) {
  const section = $('body-section');
  const editor  = $('body-editor');

  if (!requestBody) {
    section.style.display = 'none';
    editor.value = '';
    return;
  }

  section.style.display = '';

  const jsonContent = requestBody.content?.['application/json'];
  const schema      = jsonContent?.schema;

  if (schema) {
    const resolved = resolveSchema(schema);
    $('body-schema-view').innerHTML = `<pre style="margin:0;color:var(--text-secondary)">${syntaxHighlight(buildSchemaExample(resolved))}</pre>`;
    editor.value = JSON.stringify(buildSchemaExample(resolved), null, 2);
  } else {
    $('body-schema-view').innerHTML = '<span style="color:var(--text-muted)">No schema defined</span>';
    editor.value = '';
  }
}

// ── Construct URL preview ─────────────────────────────────────
function updateConstructedUrl() {
  if (!state.activeEndpoint) return;
  let { path, method } = state.activeEndpoint;

  Object.entries(state.paramInputs).forEach(([name, input]) => {
    if (input.dataset.in === 'path' && input.value) {
      path = path.replace(`{${name}}`, encodeURIComponent(input.value));
    }
  });

  const queryParts = [];
  Object.entries(state.paramInputs).forEach(([name, input]) => {
    if (input.dataset.in === 'query' && input.value) {
      queryParts.push(`${encodeURIComponent(name)}=${encodeURIComponent(input.value)}`);
    }
  });

  const qs  = queryParts.length ? '?' + queryParts.join('&') : '';
  const url = `${BASE_URL}${path}${qs}`;
  $('constructed-url').textContent = url;
}

// ── Send request ──────────────────────────────────────────────
async function sendRequest() {
  if (!state.activeEndpoint) return;

  let { path, method, op } = state.activeEndpoint;

  // Build final URL
  Object.entries(state.paramInputs).forEach(([name, input]) => {
    if (input.dataset.in === 'path') {
      path = path.replace(`{${name}}`, encodeURIComponent(input.value || `{${name}}`));
    }
  });

  const queryParts = [];
  Object.entries(state.paramInputs).forEach(([name, input]) => {
    if (input.dataset.in === 'query' && input.value) {
      queryParts.push(`${encodeURIComponent(name)}=${encodeURIComponent(input.value)}`);
    }
  });
  const qs  = queryParts.length ? '?' + queryParts.join('&') : '';
  const url = `${BASE_URL}${path}${qs}`;

  // Build headers
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  const token   = $('auth-token').value.trim();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Custom header params
  Object.entries(state.paramInputs).forEach(([name, input]) => {
    if (input.dataset.in === 'header' && input.value) {
      headers[name] = input.value;
    }
  });

  // Body
  let body = null;
  const bodySection = $('body-section');
  if (bodySection.style.display !== 'none') {
    const raw = $('body-editor').value.trim();
    if (raw) body = raw;
  }

  const btn = $('try-btn');
  btn.disabled = true;
  btn.classList.add('loading');
  btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Sending…';

  resetResponse();

  try {
    const result = await window.electronAPI.apiRequest({ method: method.toUpperCase(), url, headers, body });
    showResponse(result);
  } catch (err) {
    $('response-section').style.display = '';
    $('response-status-badge').textContent  = 'Error';
    $('response-status-badge').className    = 'status-4xx';
    $('response-body').textContent          = err.message;
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Send Request';
  }
}

// ── Show response ─────────────────────────────────────────────
function showResponse({ status, headers, body }) {
  const section = $('response-section');
  section.style.display = '';

  const badge = $('response-status-badge');
  badge.textContent = status;
  badge.className   = status >= 500 ? 'status-5xx' : status >= 400 ? 'status-4xx' : 'status-2xx';

  // Pretty-print body
  let display = body;
  try {
    const parsed = JSON.parse(body);
    display = JSON.stringify(parsed, null, 2);
    $('response-body').innerHTML = syntaxHighlight(display);
  } catch {
    $('response-body').textContent = display;
  }

  // Headers
  const headerLines = Object.entries(headers || {})
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');
  $('response-headers').textContent = headerLines;
}

function resetResponse() {
  $('response-section').style.display = 'none';
  $('response-body').textContent      = '';
  $('response-headers').textContent   = '';
}

// ── Build response schema blocks ──────────────────────────────
function buildResponseSchemas(responses) {
  if (!Object.keys(responses).length) return '<span style="color:var(--text-muted);font-size:12px">No response schemas defined.</span>';

  return Object.entries(responses).map(([statusCode, resp]) => {
    const desc        = resp.description || '';
    const jsonContent = resp.content?.['application/json'];
    const schema      = jsonContent?.schema;

    const cls = statusCode.startsWith('2') ? 'status-2xx' : statusCode.startsWith('4') ? 'status-4xx' : 'status-5xx';
    let schemaHtml = '';
    if (schema) {
      const resolved = resolveSchema(schema);
      const example  = buildSchemaExample(resolved);
      schemaHtml = `<div class="schema-body">${syntaxHighlight(JSON.stringify(example, null, 2))}</div>`;
    }

    return `
      <div class="schema-block ${!schema ? 'collapsed' : ''}">
        <div class="schema-header">
          <span class="schema-status ${cls}">${statusCode}</span>
          <span class="schema-desc">${escapeHtml(desc)}</span>
          ${schema ? '<svg class="schema-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>' : ''}
        </div>
        ${schemaHtml}
      </div>`;
  }).join('');
}

// ── Schema helpers ────────────────────────────────────────────
function resolveSchema(schema, depth = 0) {
  if (!schema || depth > 5) return schema;
  if (schema.$ref) {
    const refPath  = schema.$ref.replace('#/', '').split('/');
    let resolved   = state.spec;
    for (const part of refPath) resolved = resolved?.[part];
    return resolveSchema(resolved, depth + 1);
  }
  if (schema.allOf) return resolveSchema(mergeAllOf(schema.allOf), depth);
  if (schema.oneOf || schema.anyOf) return resolveSchema((schema.oneOf || schema.anyOf)[0], depth);
  return schema;
}

function mergeAllOf(allOf) {
  const merged = { type: 'object', properties: {}, required: [] };
  allOf.forEach((s) => {
    const r = resolveSchema(s);
    if (r?.properties) Object.assign(merged.properties, r.properties);
    if (r?.required)   merged.required.push(...r.required);
  });
  return merged;
}

function buildSchemaExample(schema, depth = 0) {
  if (!schema || depth > 5) return null;
  const s = resolveSchema(schema, depth);
  if (!s) return null;

  if (s.example !== undefined) return s.example;

  switch (s.type) {
    case 'object': {
      const obj = {};
      if (s.properties) {
        Object.entries(s.properties).forEach(([k, v]) => {
          obj[k] = buildSchemaExample(v, depth + 1);
        });
      }
      return obj;
    }
    case 'array':
      return [buildSchemaExample(s.items, depth + 1)];
    case 'string':
      if (s.format === 'date-time') return '2024-01-01T00:00:00Z';
      if (s.format === 'date')      return '2024-01-01';
      if (s.format === 'uuid')      return '00000000-0000-0000-0000-000000000000';
      if (s.enum?.length)           return s.enum[0];
      return s.default ?? 'string';
    case 'integer':
    case 'number':
      return s.default ?? 0;
    case 'boolean':
      return s.default ?? false;
    default:
      return null;
  }
}

// ── Syntax highlight ──────────────────────────────────────────
function syntaxHighlight(json) {
  if (typeof json !== 'string') json = JSON.stringify(json, null, 2);
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) return `<span class="json-key">${match}</span>`;
        return `<span class="json-string">${match}</span>`;
      }
      if (/true|false/.test(match)) return `<span class="json-bool">${match}</span>`;
      if (/null/.test(match))       return `<span class="json-null">${match}</span>`;
      return `<span class="json-number">${match}</span>`;
    });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
