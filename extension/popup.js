// Update this to match your NEXT_PUBLIC_APP_URL — no trailing slash
const VANTAGE_URL = 'https://getvantageai.vercel.app';

let currentToken = null;
let currentTabUrl = '';
let filling = false;

async function init() {
  const stored = await chrome.storage.local.get('token');
  currentToken = stored.token ?? null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabUrl = tab?.url ?? '';
  } catch {
    currentTabUrl = '';
  }

  render();
}

function render() {
  const app = document.getElementById('app');
  if (!currentToken) {
    app.innerHTML = renderSetupView();
    document.getElementById('btn-save-token').addEventListener('click', handleSaveToken);
  } else {
    app.innerHTML = renderMainView();
    document.getElementById('btn-fill').addEventListener('click', handleFill);
    document.getElementById('btn-copy-token').addEventListener('click', handleCopyToken);
    document.getElementById('btn-disconnect').addEventListener('click', handleDisconnect);
  }
}

function renderSetupView() {
  return `
    <div>
      <div class="header">
        <span class="logo">Vantage</span>
        <span class="badge">Auto-fill</span>
      </div>

      <p class="field-label" style="margin-bottom: 14px; line-height: 1.6;">
        Connect your Vantage account to start auto-filling job applications.
      </p>

      <div class="section-label">Your token</div>
      <input id="token-input" type="password" placeholder="Paste token from your Vantage profile" />
      <p class="hint mt-8">
        Get your token at <a href="${VANTAGE_URL}/profile" target="_blank">Vantage → Profile</a> under "Browser Extension".
      </p>

      <div class="mt-12">
        <button id="btn-save-token" class="btn btn-primary">Connect</button>
      </div>

      <div id="setup-result"></div>
    </div>
  `;
}

function renderMainView() {
  const maskedToken = currentToken
    ? currentToken.slice(0, 8) + '••••••••••••••••••••' + currentToken.slice(-4)
    : '';

  const isAppPage = currentTabUrl.startsWith('http');

  return `
    <div>
      <div class="header">
        <span class="logo">Vantage</span>
        <span class="badge">Auto-fill</span>
      </div>

      <div class="status-row">
        <div class="dot dot-green"></div>
        <span class="status-text">Connected</span>
      </div>

      ${currentTabUrl ? `
        <div class="url-row">
          <div class="url-label">Current page</div>
          <div class="url-value">${escapeHtml(currentTabUrl)}</div>
        </div>
      ` : ''}

      <button id="btn-fill" class="btn btn-primary" ${!isAppPage ? 'disabled' : ''}>
        Fill form
      </button>

      <div id="fill-result"></div>

      <hr class="divider" />

      <div class="section-label">Token</div>
      <div class="token-row">
        <div class="token-display">${escapeHtml(maskedToken)}</div>
        <button id="btn-copy-token" class="icon-btn" title="Copy token">Copy</button>
      </div>

      <button id="btn-disconnect" class="btn btn-danger">Disconnect</button>
    </div>
  `;
}

async function handleSaveToken() {
  const input = document.getElementById('token-input');
  const token = input.value.trim();
  const resultEl = document.getElementById('setup-result');

  if (!token) {
    resultEl.innerHTML = '<div class="result-box result-error mt-8">Please paste your token.</div>';
    return;
  }

  const btn = document.getElementById('btn-save-token');
  btn.disabled = true;
  btn.textContent = 'Verifying...';
  resultEl.innerHTML = '';

  try {
    const res = await fetch(`${VANTAGE_URL}/api/extension/kit`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      resultEl.innerHTML = '<div class="result-box result-error mt-8">Invalid token. Check your Vantage profile.</div>';
      btn.disabled = false;
      btn.textContent = 'Connect';
      return;
    }

    await chrome.storage.local.set({ token });
    currentToken = token;
    render();
  } catch {
    resultEl.innerHTML = '<div class="result-box result-error mt-8">Could not reach Vantage. Check your connection.</div>';
    btn.disabled = false;
    btn.textContent = 'Connect';
  }
}

async function sendFill(tabId, kit) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'VANTAGE_FILL', kit });
  } catch {
    // Content script not running on this tab — inject it then retry
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return await chrome.tabs.sendMessage(tabId, { type: 'VANTAGE_FILL', kit });
  }
}

async function handleFill() {
  if (filling) return;
  filling = true;

  const btn = document.getElementById('btn-fill');
  const resultEl = document.getElementById('fill-result');
  btn.disabled = true;
  btn.textContent = 'Fetching your profile...';
  resultEl.innerHTML = '';

  try {
    const kitUrl = `${VANTAGE_URL}/api/extension/kit?url=${encodeURIComponent(currentTabUrl)}`;
    const res = await fetch(kitUrl, {
      headers: { Authorization: `Bearer ${currentToken}` },
    });

    if (res.status === 401) {
      resultEl.innerHTML = '<div class="result-box result-error mt-8">Token expired. Reconnect from your profile.</div>';
      return;
    }

    if (!res.ok) {
      resultEl.innerHTML = '<div class="result-box result-error mt-8">Failed to load profile data.</div>';
      return;
    }

    const { kit } = await res.json();

    btn.textContent = 'Filling form...';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    let response;
    try {
      response = await sendFill(tab.id, kit);
    } catch {
      resultEl.innerHTML = '<div class="result-box result-error mt-8">Could not reach page. Make sure you are on a job application form and try again.</div>';
      return;
    }

    const count = response?.filled ?? 0;
    if (count === 0) {
      resultEl.innerHTML = '<div class="result-box result-info mt-8">No matching fields found on this page.</div>';
    } else {
      resultEl.innerHTML = `<div class="result-box result-success mt-8">Filled ${count} field${count === 1 ? '' : 's'}. Review and submit.</div>`;
    }
  } catch {
    resultEl.innerHTML = '<div class="result-box result-error mt-8">Unexpected error. Try again.</div>';
  } finally {
    filling = false;
    btn.disabled = false;
    btn.textContent = 'Fill form';
  }
}

async function handleCopyToken() {
  try {
    await navigator.clipboard.writeText(currentToken);
    const btn = document.getElementById('btn-copy-token');
    const orig = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  } catch {
    // clipboard not available
  }
}

async function handleDisconnect() {
  await chrome.storage.local.remove('token');
  currentToken = null;
  render();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();
