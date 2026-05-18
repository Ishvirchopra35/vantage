// Vantage Auto-fill content script
// IMPORTANT: Never call form.submit() or click Submit/Apply buttons.

(function () {
  'use strict';

  // Guard against duplicate injection
  if (window.__vantageFillLoaded) return;
  window.__vantageFillLoaded = true;

  // ── Setters ──────────────────────────────────────────────────────────────────

  function setInput(el, value) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function setTextarea(el, value) {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // ── Shadow DOM walker ─────────────────────────────────────────────────────────

  function queryShadow(root, selector) {
    const results = [];
    function walk(node) {
      try {
        node.querySelectorAll(selector).forEach(el => results.push(el));
        node.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) walk(el.shadowRoot);
        });
      } catch (_) {}
    }
    walk(root);
    return results;
  }

  // ── Field detection ───────────────────────────────────────────────────────────

  // Returns the effective label for an element by checking multiple sources
  function getFieldLabel(el) {
    const parts = [];

    // placeholder
    if (el.placeholder) parts.push(el.placeholder);

    // aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) parts.push(ariaLabel);

    // name / id
    if (el.name) parts.push(el.name);
    if (el.id) parts.push(el.id);

    // <label for="..."> or wrapping <label>
    if (el.id) {
      const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelEl) parts.push(labelEl.textContent);
    }
    const parentLabel = el.closest('label');
    if (parentLabel) parts.push(parentLabel.textContent);

    // aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      labelledBy.split(' ').forEach(id => {
        const refEl = document.getElementById(id);
        if (refEl) parts.push(refEl.textContent);
      });
    }

    return parts.join(' ').toLowerCase();
  }

  // Field matchers — ordered by specificity (most specific first)
  const INPUT_MATCHERS = [
    { key: 'firstName',   patterns: [/\bfirst.?name\b/i, /\bgiven.?name\b/i, /\bprenom\b/i] },
    { key: 'lastName',    patterns: [/\blast.?name\b/i, /\bsurname\b/i, /\bfamily.?name\b/i] },
    { key: 'fullName',    patterns: [/\bfull.?name\b/i, /\byour.?name\b/i, /^name$/i, /\bcandidate.?name\b/i] },
    { key: 'email',       patterns: [/\bemail\b/i, /\be-mail\b/i] },
    { key: 'phone',       patterns: [/\bphone\b/i, /\bmobile\b/i, /\btelephone\b/i, /\btel\b/i, /\bcell\b/i] },
    { key: 'linkedin',    patterns: [/\blinkedin\b/i] },
  ];

  const TEXTAREA_MATCHERS = [
    { key: 'coverLetter', patterns: [/\bcover.?letter\b/i, /\bcovering.?letter\b/i, /\bmotivation.?letter\b/i] },
  ];

  function matchKey(label, matchers) {
    for (const { key, patterns } of matchers) {
      if (patterns.some(p => p.test(label))) return key;
    }
    return null;
  }

  // ── Type-based fallbacks ──────────────────────────────────────────────────────

  function keyForInputType(el) {
    if (el.type === 'email') return 'email';
    if (el.type === 'tel') return 'phone';
    return null;
  }

  // ── Main fill function ────────────────────────────────────────────────────────

  function fillForm(kit) {
    let filled = 0;

    // Full-name split helper — only use fullName if firstName/lastName not available
    const names = { firstName: kit.firstName, lastName: kit.lastName, fullName: kit.fullName };
    const values = {
      firstName: kit.firstName || '',
      lastName: kit.lastName || '',
      fullName: kit.fullName || '',
      email: kit.email || '',
      phone: kit.phone || '',
      linkedin: kit.linkedin || '',
      coverLetter: kit.coverLetter || '',
      ...(kit.answers || {}),
    };

    // Collect all inputs (including shadow DOM)
    const inputs = queryShadow(document, 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])');
    const textareas = queryShadow(document, 'textarea');

    const filled_keys = new Set();

    for (const el of inputs) {
      if (!el.offsetParent && el.offsetWidth === 0 && el.offsetHeight === 0) continue; // hidden
      if (el.disabled || el.readOnly) continue;

      const label = getFieldLabel(el);
      let key = matchKey(label, INPUT_MATCHERS) || keyForInputType(el);

      // For plain "name" fields with no first/last distinction, use fullName
      if (!key && /\bname\b/i.test(label)) key = 'fullName';

      if (!key) continue;

      const value = values[key];
      if (!value) continue;

      // Don't overwrite already-filled fields unless they have a placeholder value
      if (el.value && el.value !== el.placeholder) continue;

      setInput(el, value);
      filled_keys.add(key);
      filled++;
    }

    for (const el of textareas) {
      if (!el.offsetParent && el.offsetWidth === 0 && el.offsetHeight === 0) continue;
      if (el.disabled || el.readOnly) continue;

      const label = getFieldLabel(el);
      const key = matchKey(label, TEXTAREA_MATCHERS);
      if (!key) continue;

      const value = values[key];
      if (!value) continue;

      if (el.value && el.value !== el.placeholder) continue;

      setTextarea(el, value);
      filled_keys.add(key);
      filled++;
    }

    // Best-effort: fill application question textareas by matching question text
    if (kit.answers && Object.keys(kit.answers).length > 0) {
      for (const el of textareas) {
        if (el.disabled || el.readOnly) continue;
        if (el.value) continue;

        const label = getFieldLabel(el);
        for (const [question, answer] of Object.entries(kit.answers)) {
          if (!answer) continue;
          // Match if >50% of the question words appear in the label
          const words = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const hits = words.filter(w => label.includes(w)).length;
          if (words.length > 0 && hits / words.length >= 0.5) {
            setTextarea(el, answer);
            filled++;
            break;
          }
        }
      }
    }

    return filled;
  }

  // ── Message listener ──────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'VANTAGE_FILL') return false;

    try {
      const filled = fillForm(message.kit);
      sendResponse({ filled });
    } catch (e) {
      sendResponse({ filled: 0, error: String(e) });
    }

    return true; // keep channel open
  });
})();
