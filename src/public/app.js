'use strict';

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401) {
    location.href = '/login';
    throw new Error('unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'request failed');
  return data;
}

const $ = (id) => document.getElementById(id);

async function refreshStatus() {
  const s = await api('/api/status');
  $('statusText').textContent = s.status;
  $('userText').textContent = s.user ? `${s.user.name || ''} (${s.user.id || ''})` : '-';

  const badge = $('botStatus');
  badge.textContent = s.status;
  badge.className = `badge ${s.status}`;

  const qr = $('qrWrap');
  qr.innerHTML = s.qrDataUrl ? `<img src="${s.qrDataUrl}" alt="QR" />` : '';

  $('stats').innerHTML = Object.entries(s.stats || {})
    .map(([k, v]) => `<li><span>${k.replace(/_/g, ' ')}</span><strong>${v}</strong></li>`)
    .join('');
}

async function refreshKeys() {
  const { keys } = await api('/api/keys');
  $('keysBody').innerHTML = keys
    .map(
      (k) => `
      <tr>
        <td>${escapeHtml(k.name)}</td>
        <td><code>${k.key}</code></td>
        <td>${k.rate_limit}/min</td>
        <td>
          <input type="checkbox" data-toggle-key="${k.id}" ${k.enabled ? 'checked' : ''} />
        </td>
        <td>${k.last_used_at || '-'}</td>
        <td><button class="ghost" data-del-key="${k.id}">Hapus</button></td>
      </tr>`,
    )
    .join('');
}

async function refreshRules() {
  const { rules } = await api('/api/autoreplies');
  $('rulesBody').innerHTML = rules
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.pattern)}</td>
        <td>${r.match_type}</td>
        <td>${escapeHtml(r.response)}</td>
        <td><input type="checkbox" data-toggle-rule="${r.id}" ${r.enabled ? 'checked' : ''} /></td>
        <td><button class="ghost" data-del-rule="${r.id}">Hapus</button></td>
      </tr>`,
    )
    .join('');
}

async function refreshLogs() {
  const { logs } = await api('/api/status/logs?limit=30');
  $('logsBody').innerHTML = logs
    .map(
      (l) => `
      <tr>
        <td>${l.created_at}</td>
        <td>${l.direction}</td>
        <td><code>${l.jid}</code></td>
        <td>${l.type || ''}</td>
        <td>${l.status}${l.error ? ` (${escapeHtml(l.error)})` : ''}</td>
        <td>${escapeHtml((l.message || '').slice(0, 80))}</td>
      </tr>`,
    )
    .join('');
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"]|'/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.matches('[data-del-key]')) {
    if (!confirm('Hapus API key ini?')) return;
    await api(`/api/keys/${t.dataset.delKey}`, { method: 'DELETE' });
    refreshKeys();
  }
  if (t.matches('[data-del-rule]')) {
    if (!confirm('Hapus auto-reply ini?')) return;
    await api(`/api/autoreplies/${t.dataset.delRule}`, { method: 'DELETE' });
    refreshRules();
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.matches('[data-toggle-key]')) {
    await api(`/api/keys/${t.dataset.toggleKey}/toggle`, {
      method: 'PATCH',
      body: { enabled: t.checked },
    });
  }
  if (t.matches('[data-toggle-rule]')) {
    await api(`/api/autoreplies/${t.dataset.toggleRule}/toggle`, {
      method: 'PATCH',
      body: { enabled: t.checked },
    });
  }
});

$('newKeyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  await api('/api/keys', { method: 'POST', body: data });
  e.target.reset();
  refreshKeys();
});

$('newRuleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  await api('/api/autoreplies', { method: 'POST', body: data });
  e.target.reset();
  refreshRules();
});

$('logoutBtn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  location.href = '/login';
});

$('logoutBotBtn').addEventListener('click', async () => {
  if (!confirm('Logout bot WhatsApp? Sesi akan dihapus dan perlu scan QR ulang.')) return;
  await api('/api/status/logout', { method: 'POST' });
  setTimeout(refreshStatus, 1000);
});

(async function init() {
  try {
    await api('/api/auth/me');
  } catch {
    return;
  }
  refreshStatus();
  refreshKeys();
  refreshRules();
  refreshLogs();
  setInterval(refreshStatus, 5000);
  setInterval(refreshLogs, 10000);
})();
