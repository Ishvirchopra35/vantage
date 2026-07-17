// Must be the www host: the apex domain 308-redirects to www, and browsers
// strip the Authorization header on cross-origin redirects, so every API
// call through the apex arrives unauthenticated and fails with 401.
const VANTAGE_URL = 'https://www.vantage-ai.dev';

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

async function sendMessage(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return await chrome.tabs.sendMessage(tabId, message);
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
    // 1. Fetch the user kit (also validates the token)
    const kitUrl = `${VANTAGE_URL}/api/extension/kit?url=${encodeURIComponent(currentTabUrl)}`;
    const kitRes = await fetch(kitUrl, {
      headers: { Authorization: `Bearer ${currentToken}` },
    });

    if (kitRes.status === 401) {
      resultEl.innerHTML = '<div class="result-box result-error mt-8">Token expired. Reconnect from your profile.</div>';
      return;
    }
    if (!kitRes.ok) {
      resultEl.innerHTML = '<div class="result-box result-error mt-8">Failed to load your profile.</div>';
      return;
    }

    const kitData = await kitRes.json();
    // The API returns { kit } at the top level (ok() does not wrap in data)
    const userKit = kitData?.kit ?? kitData?.data?.kit ?? {};

    if (!userKit.fullName && !userKit.email && !userKit.phone) {
      resultEl.innerHTML = '<div class="result-box result-error mt-8">Your Vantage profile has no data to fill with. Add your details at Vantage → Profile.</div>';
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 2. Tier 1 - direct fill from kit data, no AI involved
    const isWorkday = currentTabUrl.includes('myworkdayjobs.com') || currentTabUrl.includes('workday.com');
    btn.textContent = isWorkday ? 'Filling your details (1-2 min on Workday, keep this open)...' : 'Filling your details...';

    let direct;
    try {
      direct = await sendMessage(tab.id, { type: 'DIRECT_FILL', kit: userKit });
    } catch {
      resultEl.innerHTML = '<div class="result-box result-error mt-8">Could not reach the page. Make sure you are on a job application form and try again.</div>';
      return;
    }

    let totalFilled = direct?.filled ?? 0;

    // 3. Tier 2 - extract only genuinely open-ended questions
    btn.textContent = 'Reading form questions...';
    let questions = [];
    try {
      questions = (await sendMessage(tab.id, { type: 'EXTRACT_QUESTIONS' })) || [];
    } catch {
      questions = [];
    }

    // 4. AI answers for open-ended questions only
    if (questions.length > 0) {
      btn.textContent = 'Writing answers...';

      const aiRes = await fetch(`${VANTAGE_URL}/api/extension/ai-fill`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questions, jobUrl: tab.url }),
      });

      if (aiRes.status === 401) {
        resultEl.innerHTML = '<div class="result-box result-error mt-8">Token expired. Reconnect from your profile.</div>';
        return;
      }

      if (aiRes.status === 429) {
        let message = "You've reached the auto-fill limit. Try again later.";
        try { const d = await aiRes.json(); if (d && d.error) message = d.error; } catch {}
        resultEl.innerHTML = `<div class="result-box result-error mt-8">${escapeHtml(message)}</div>`;
        return;
      }

      if (aiRes.ok) {
        const parsed = await aiRes.json();
        const fields = parsed?.data?.fields || parsed?.fields || [];

        if (fields.length > 0) {
          btn.textContent = isWorkday ? 'Filling answers (~30s)...' : 'Filling answers...';
          try {
            const applied = await sendMessage(tab.id, { type: 'FILL_ANSWERS', fields });
            totalFilled += applied?.filled ?? 0;
          } catch {
            // Direct fills already landed - report what we have
          }
        }
      }
      // If the AI call fails, Tier 1 fills still stand - report those.
    }

    // Known Workday limitation: the Websites "Add Another" button ignores
    // programmatic clicks, so missing URL slots need a manual click + re-run
    const websiteNote = direct?.websitesNeedManualAdd
      ? ' Note: manually click "Add Another" in the Websites section and re-run to fill your portfolio and GitHub URLs.'
      : '';

    if (totalFilled === 0 && direct?.error) {
      resultEl.innerHTML = '<div class="result-box result-error mt-8">Filling failed on this page: ' + escapeHtml(direct.error) + '</div>';
    } else if (totalFilled === 0) {
      resultEl.innerHTML = `<div class="result-box result-info mt-8">No fillable fields matched your profile. Fields without data in your profile are left blank on purpose.${websiteNote}</div>`;
    } else {
      resultEl.innerHTML = `<div class="result-box result-success mt-8">Fill complete: ${totalFilled} field${totalFilled === 1 ? '' : 's'}. Unknown fields were left blank - review before submitting.${websiteNote}</div>`;
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
