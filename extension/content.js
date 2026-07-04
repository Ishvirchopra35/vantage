// Vantage Auto-fill content script
// IMPORTANT: Never call form.submit() or click Submit/Apply buttons.
//
// Fill philosophy: NEVER invent data. If the kit doesn't have it, the field
// stays blank. Tier 1 fills factual fields directly from the kit. Tier 2
// extracts only genuinely open-ended questions for the AI. Demographics,
// pronouns, and "how did you hear" are handled deterministically, never by AI.

(function () {
  'use strict';

  if (window.__vantageFillLoaded) return;
  window.__vantageFillLoaded = true;

  const DEBUG = true; // section-fill diagnostics - set false for release
  function log(...args) {
    if (DEBUG) console.log('[Vantage]', ...args);
  }

  // -- Utilities ----------------------------------------------------------------

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (min, max) => min + Math.random() * (max - min);

  // Elements we already filled this session - never double-fill or double-count.
  const filledEls = new WeakSet();

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

  function isFillable(el) {
    if (!el || el.disabled || el.readOnly) return false;
    if (el.type === 'hidden') return false;
    return !!(el.offsetParent || el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function hasExistingValue(el) {
    return !!(el.value && el.value !== el.placeholder);
  }

  // -- Platform detection -------------------------------------------------------

  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes('myworkdayjobs.com') || host.includes('workday.com')) return 'workday';
    if (host.includes('greenhouse')) return 'greenhouse';
    if (host.includes('lever.co')) return 'lever';
    if (document.querySelector('[data-automation-id]')) return 'workday';
    return 'generic';
  }

  // -- Value setters ------------------------------------------------------------

  // nativeSetter pattern: direct .value= is silently ignored by React's fiber
  // reconciler, so we go through the prototype setter then dispatch events.
  function nativeSetValue(el, value) {
    const proto = el.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Workday detects and breaks on synthetic events - type character by
  // character via execCommand with human-like delays instead.
  // Returns true only if the value verifiably landed in the element.
  async function workdayTypeValue(el, value) {
    el.click();
    el.focus();
    await sleep(300);

    // Workday re-renders on interaction - a detached or unfocused element means
    // execCommand would type into the void (or the previously focused field)
    if (!el.isConnected) {
      log('typeValue: element detached before typing -', describe(el));
      return false;
    }
    if (document.activeElement !== el) {
      el.focus();
      await sleep(150);
    }
    if (document.activeElement !== el) {
      log('typeValue: could not focus', describe(el), '- active element is', describe(document.activeElement));
      return false;
    }

    el.select?.();
    document.execCommand('selectAll');
    document.execCommand('delete');
    await sleep(100);
    const text = String(value);
    if (text.length > 60) {
      // Long text (e.g. role descriptions): one insert - still a real input event,
      // and char-by-char typing would take minutes
      document.execCommand('insertText', false, text);
    } else {
      for (const char of text) {
        document.execCommand('insertText', false, char);
        await sleep(rand(20, 50));
      }
    }
    const landed = !!(el.value && el.value.trim());
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    await sleep(200);
    if (!landed) log('typeValue: value did not stick on', describe(el));
    return landed;
  }

  // Workday date spinners (role="spinbutton") build their value from keydown
  // events - text insertion corrupts them ("2024" becomes "0004"). Type each
  // digit as a real key event instead.
  function isWorkdaySpinner(el) {
    return el.getAttribute?.('role') === 'spinbutton' ||
      /dateSection(Month|Year)/i.test(el.getAttribute?.('data-automation-id') || '');
  }

  async function workdaySpinnerType(el, value) {
    el.click();
    el.focus();
    await sleep(150);
    if (document.activeElement !== el) {
      el.focus();
      await sleep(150);
    }
    if (document.activeElement !== el) {
      log('spinnerType: could not focus', describe(el));
      return false;
    }
    // Select any existing content (including corrupt values from earlier
    // attempts) so the typed digits replace it
    el.select?.();
    try { el.setSelectionRange?.(0, (el.value || '').length); } catch (_) { /* number-ish inputs */ }
    const digits = String(value).replace(/\D/g, '');
    for (const ch of digits) {
      const opts = { key: ch, code: `Digit${ch}`, keyCode: 48 + Number(ch), which: 48 + Number(ch), bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent('keydown', opts));
      el.dispatchEvent(new KeyboardEvent('keypress', opts));
      el.dispatchEvent(new KeyboardEvent('keyup', opts));
      await sleep(50);
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(150);
    const got = (el.value || '').replace(/\D/g, '');
    const landed = got === digits || got.endsWith(digits);
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    await sleep(150);
    if (!landed) log('spinnerType: expected digits', digits, 'but field shows', JSON.stringify(el.value), describe(el));
    return landed;
  }

  // Returns true only if the value was actually set (rule 15: count real fills).
  async function setTextValue(el, value, platform) {
    if (!value || !isFillable(el) || filledEls.has(el)) return false;
    // Spinners are exempt from the keep-existing-value rule: a previous fill
    // attempt can leave corrupt values ("0", "2000") that must be overwritten
    if (hasExistingValue(el) && !(platform === 'workday' && isWorkdaySpinner(el))) return false;
    if (platform === 'workday') {
      const landed = isWorkdaySpinner(el)
        ? await workdaySpinnerType(el, value)
        : await workdayTypeValue(el, value);
      await sleep(500); // Workday needs breathing room between fields
      if (!landed) return false; // don't count or mark fields that stayed empty
    } else {
      nativeSetValue(el, value);
    }
    filledEls.add(el);
    return true;
  }

  const selectNativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;

  // Native <select>: exact option-text match first, then containment.
  // Returns true only if an option was actually selected.
  function fillNativeSelect(el, value) {
    if (!value || el.disabled || filledEls.has(el)) return false;
    if (el.selectedIndex > 0) return false; // respect an existing selection
    const target = String(value).toLowerCase().trim();
    const options = Array.from(el.options).filter(o => !o.disabled && o.text.trim());
    const match =
      options.find(o => o.text.toLowerCase().trim() === target) ||
      options.find(o => o.text.toLowerCase().includes(target)) ||
      options.find(o => target.includes(o.text.toLowerCase().trim()) && o.text.trim().length > 2);
    if (!match) return false;
    if (selectNativeSetter) selectNativeSetter.call(el, match.value);
    else el.value = match.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    filledEls.add(el);
    return true;
  }

  function clickCheckbox(cb) {
    if (!cb || cb.checked || cb.disabled || filledEls.has(cb)) return false;
    // Click the wrapping label when present - Lever (and others) toggle via
    // CSS pseudo-elements on the label, not the input.
    const label = cb.closest('label');
    (label || cb).click();
    filledEls.add(cb);
    return true;
  }

  // React Select / custom combobox: focus, type, wait for menu, click option.
  // exactOnly=true refuses fuzzy matches (used for AI dropdown answers).
  async function fillCombobox(input, value, { exactOnly = false, waitMs = 400, firstOption = false } = {}) {
    if (!value || !isFillable(input) || filledEls.has(input)) return false;

    input.focus();
    input.click();
    await sleep(200);

    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (setter) setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: String(value)[0] }));

    await sleep(waitMs);

    const menu = document.querySelector('.select__menu, [role="listbox"]');
    if (!menu) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      input.blur();
      return false;
    }

    const options = Array.from(menu.querySelectorAll('[class*="option"], [role="option"]'));
    const target = String(value).toLowerCase().trim();
    let match = options.find(o => o.textContent?.toLowerCase().trim() === target);
    if (!match && firstOption) match = options[0];
    if (!match && !exactOnly) {
      match = options.find(o => o.textContent?.toLowerCase().trim().includes(target));
    }

    if (!match) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      input.blur();
      return false;
    }

    match.click();
    await sleep(300);
    filledEls.add(input);
    return true;
  }

  // -- Label resolution ---------------------------------------------------------

  // Human-readable label (original case) - used for AI question extraction.
  function getReadableLabel(el) {
    if (el.id) {
      const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      const text = labelEl?.textContent?.trim();
      if (text) return text;
    }

    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const texts = labelledBy.split(' ')
        .map(id => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean);
      if (texts.length) return texts.join(' ');
    }

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel?.trim()) return ariaLabel.trim();

    const parentLabel = el.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll('input, select, textarea').forEach(c => c.remove());
      const text = clone.textContent.trim();
      if (text) return text;
    }

    // Workday and similar: nearest labelled ancestor
    let node = el.parentElement;
    for (let i = 0; i < 4 && node; i++) {
      const label = node.querySelector('label, legend, [data-automation-id*="Label"], [class*="Label"]');
      const text = label?.textContent?.trim();
      if (text && text.length < 300) return text;
      node = node.parentElement;
    }

    return el.placeholder?.trim() || el.name?.trim() || '';
  }

  // Match-text sources in priority order (rule 11):
  // 1. name/id/data-automation-id  2. label text  3. placeholder  4. aria-label
  function getMatchSources(el) {
    const sources = [];

    const attrs = [el.name, el.id, el.getAttribute('data-automation-id')]
      .filter(Boolean).join(' ');
    if (attrs) sources.push(attrs);

    const labelParts = [];
    if (el.id) {
      const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelEl) labelParts.push(labelEl.textContent);
    }
    const parentLabel = el.closest('label');
    if (parentLabel) labelParts.push(parentLabel.textContent);
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      labelledBy.split(' ').forEach(id => {
        const refEl = document.getElementById(id);
        if (refEl) labelParts.push(refEl.textContent);
      });
    }
    const labelText = labelParts.join(' ').trim();
    if (labelText) sources.push(labelText);

    if (el.placeholder) sources.push(el.placeholder);

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) sources.push(ariaLabel);

    return sources.map(s => s.toLowerCase().replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  // -- Tier 1 field matching ----------------------------------------------------

  // Order matters: more specific keys first so "first name" never hits fullName,
  // and "linkedin profile url" never hits portfolio's "website" pattern.
  const TIER1_MATCHERS = [
    ['firstName',      /\bfirst[\s_-]?name\b|\bgiven[\s_-]?name\b|\bfname\b|^first$/],
    ['lastName',       /\blast[\s_-]?name\b|\bfamily[\s_-]?name\b|\bsurname\b|\blname\b|^last$/],
    ['email',          /e-?mail/],
    ['linkedin',       /linked[\s_-]?in/],
    ['github',         /git[\s_-]?hub/],
    ['phone',          /\bphone\b|\bmobile\b|\btelephone\b|\bcell\b|^tel$/],
    ['portfolio',      /\bportfolio\b|personal[\s_-]?(web[\s_-]?)?site|\byour[\s_-]?website\b|^website$|^url$/],
    ['fullName',       /\bfull[\s_-]?name\b|\byour[\s_-]?name\b|\bcandidate[\s_-]?name\b|\blegal[\s_-]?name\b|^name$/],
    ['city',           /\bcity\b/],
    ['location',       /current[\s_-]?location|where[\s_-]?do[\s_-]?you[\s_-]?(currently[\s_-]?)?live|^location$|\blocation\b/],
    ['currentCompany', /current[\s_-]?(company|employer)|\bemployer\b|^company$|^org$|^organization$/],
    ['currentTitle',   /current[\s_-]?(job[\s_-]?)?(title|role|position)|\bjob[\s_-]?title\b/],
  ];

  // Fields Tier 1 must never touch, no matter what else matched:
  // demographics, pronouns, referral source, URLs we don't have, legal questions.
  const TIER1_EXCLUDE = /gender|ethnic|race\b|hispanic|latino|veteran|disab|sexual[\s_-]?orientation|transgender|pronoun|how[\s_-]?did[\s_-]?you[\s_-]?hear|referral|hear[\s_-]?about|twitter|facebook|instagram|sponsor|authoriz|clearance|salary|compensation|cover[\s_-]?letter|resume|\bcv\b/;

  function matchTier1Key(el) {
    const sources = getMatchSources(el);
    if (sources.some(s => TIER1_EXCLUDE.test(s))) return null;
    for (const src of sources) {
      for (const [key, pattern] of TIER1_MATCHERS) {
        if (pattern.test(src)) return key;
      }
    }
    // Input-type fallback: these are unambiguous regardless of label
    if (el.type === 'email') return 'email';
    if (el.type === 'tel') return 'phone';
    return null;
  }

  function cityOf(location) {
    return (location || '').split(',')[0].trim();
  }

  function countryOf(location) {
    const parts = (location || '').split(',');
    return parts.length > 1 ? parts[parts.length - 1].trim() : '';
  }

  // Only values that actually exist in the kit. Missing → '' → field stays blank.
  function buildTier1Values(kit) {
    const exp0 = Array.isArray(kit.experience) ? kit.experience[0] : null;
    return {
      firstName: kit.firstName || '',
      lastName: kit.lastName || '',
      fullName: kit.fullName || '',
      email: kit.email || '',
      phone: kit.phone || '',
      linkedin: kit.linkedin || '',
      portfolio: kit.portfolio || '',
      github: kit.github || '',
      location: kit.location || '',
      city: cityOf(kit.location),
      currentCompany: exp0?.company || '',
      currentTitle: exp0?.title || '',
    };
  }

  // -- Deterministic label classification --------------------------------------

  const DEMOGRAPHIC_RE = /gender|ethnic|race\b|hispanic|latino|veteran|disab|sexual[\s_-]?orientation|transgender|pronoun|lgbtq|demographic/i;
  const HEAR_ABOUT_RE = /how[\s_-]?did[\s_-]?you[\s_-]?hear|how[\s_-]?did[\s_-]?you[\s_-]?(find|learn)[\s_-]?(out[\s_-]?)?about|hear[\s_-]?about[\s_-]?(us|this)|referral[\s_-]?source|\bsource\b.*\bapplication\b/i;
  const DECLINE_RE = /don'?t\s+wish|prefer\s+not|decline\s+to|rather\s+not/i;
  const UNTOUCHABLE_URL_RE = /twitter|facebook|instagram|\bx\.com\b/i;

  function isTier1Label(label) {
    const l = label.toLowerCase();
    return TIER1_MATCHERS.some(([, p]) => p.test(l));
  }

  // Anything here is never sent to the AI (rule 2: no factual data to AI).
  function isDeterministicLabel(label) {
    return isTier1Label(label) ||
      DEMOGRAPHIC_RE.test(label) ||
      HEAR_ABOUT_RE.test(label) ||
      UNTOUCHABLE_URL_RE.test(label);
  }

  // Open-ended = worth an AI answer. Short factual prompts are not.
  function looksOpenEnded(label) {
    return label.includes('?') || label.trim().split(/\s+/).length >= 5;
  }

  // -- Date helpers (rule 13: MM/YYYY) -----------------------------------------

  const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

  function toMonthYear(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    let m = s.match(/^(\d{4})[-/](\d{1,2})/);          // 2023-06
    if (m) return `${m[2].padStart(2, '0')}/${m[1]}`;
    m = s.match(/^(\d{1,2})[-/](\d{4})$/);             // 6/2023
    if (m) return `${m[1].padStart(2, '0')}/${m[2]}`;
    m = s.match(/^([a-z]+)\.?\s+(\d{4})$/i);           // June 2023
    if (m) {
      const idx = MONTHS.findIndex(mo => mo.startsWith(m[1].toLowerCase()));
      if (idx >= 0) return `${String(idx + 1).padStart(2, '0')}/${m[2]}`;
    }
    m = s.match(/^(\d{4})$/);                          // 2023
    if (m) return `01/${m[1]}`;
    return '';
  }

  // -- Tier 1: direct fill ------------------------------------------------------

  async function directFill(kit) {
    const platform = detectPlatform();
    const values = buildTier1Values(kit);
    let filled = 0;

    if (platform === 'workday') {
      websitesNeedManualAdd = false;
      filled += await workdayDirectFill(kit, values);
      return { filled, platform, websitesNeedManualAdd };
    }

    // Text inputs
    const inputs = queryShadow(document,
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="date"])'
    );
    for (const el of inputs) {
      if (!isFillable(el) || filledEls.has(el)) continue;
      if (el.getAttribute('role') === 'combobox') continue; // handled per-platform
      const key = matchTier1Key(el);
      if (!key) continue;
      if (await setTextValue(el, values[key], platform)) filled++;
    }

    // Cover letter and saved (user-approved) answers into textareas - this is
    // real user data from the kit, not AI generation.
    filled += fillSavedContent(kit);

    // "How did you hear about us" - deterministic, never AI (rule 3)
    filled += fillHearAboutUs();

    // Consent checkboxes + "how did you hear" checkboxes
    filled += fillCheckboxesPass(kit);

    // Country selects driven by kit.location
    if (values.location) {
      for (const el of queryShadow(document, 'select')) {
        const sources = getMatchSources(el).join(' ');
        if (/country/.test(sources) && !DEMOGRAPHIC_RE.test(sources)) {
          if (fillNativeSelect(el, countryOf(values.location) || values.location)) filled++;
        }
      }
    }

    // Best-effort work experience section (rule 4 + 13)
    filled += await fillExperienceSection(kit, platform);

    // Platform-specific extras
    if (platform === 'lever') filled += await leverDirectFill(kit, values);
    if (platform === 'greenhouse') filled += await greenhouseDirectFill(kit, values);

    return { filled, platform };
  }

  // Cover letter + saved application answers (from the Vantage app) → textareas
  function fillSavedContent(kit) {
    let filled = 0;
    const textareas = queryShadow(document, 'textarea');

    for (const el of textareas) {
      if (!isFillable(el) || filledEls.has(el) || hasExistingValue(el)) continue;
      const label = getReadableLabel(el);

      if (kit.coverLetter && /cover.?letter|covering.?letter|motivation.?letter/i.test(label)) {
        nativeSetValue(el, kit.coverLetter);
        filledEls.add(el);
        filled++;
        continue;
      }

      // Saved answers: fuzzy-match question text against the field label
      if (kit.answers) {
        for (const [question, answer] of Object.entries(kit.answers)) {
          if (!answer) continue;
          const words = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const hits = words.filter(w => label.toLowerCase().includes(w)).length;
          if (words.length > 0 && hits / words.length >= 0.5) {
            nativeSetValue(el, answer);
            filledEls.add(el);
            filled++;
            break;
          }
        }
      }
    }
    return filled;
  }

  // Rule 3: "How did you hear about us" → "Job Board" if available, else blank.
  function fillHearAboutUs() {
    let filled = 0;

    // Native selects
    for (const el of queryShadow(document, 'select')) {
      const sources = getMatchSources(el).join(' ');
      if (!HEAR_ABOUT_RE.test(sources)) continue;
      if (fillNativeSelect(el, 'Job Board')) filled++;
    }

    // Text inputs (rare, but some forms use free text)
    for (const el of queryShadow(document, 'input[type="text"], input:not([type])')) {
      if (!isFillable(el) || filledEls.has(el) || hasExistingValue(el)) continue;
      if (el.getAttribute('role') === 'combobox') continue;
      const sources = getMatchSources(el).join(' ');
      if (!HEAR_ABOUT_RE.test(sources)) continue;
      nativeSetValue(el, 'Job Board');
      filledEls.add(el);
      filled++;
    }

    return filled;
  }

  // Rule 8: consent → check; "currently work here" → from kit; demographics → skip.
  function fillCheckboxesPass(kit) {
    let filled = 0;
    const checkboxes = queryShadow(document, 'input[type="checkbox"]');

    for (const cb of checkboxes) {
      if (cb.disabled || cb.checked || filledEls.has(cb)) continue;

      const container = cb.closest('[class*="field"],[class*="question"],[class*="form-group"],[class*="checkbox"],li,label');
      const forLabel = cb.id ? document.querySelector(`label[for="${CSS.escape(cb.id)}"]`) : null;
      const labelText = (
        forLabel?.textContent ||
        container?.textContent ||
        cb.getAttribute('aria-label') ||
        ''
      ).toLowerCase().trim();

      if (!labelText) continue;

      // Never touch demographic or pronoun checkboxes (rules 7 + 8)
      if (DEMOGRAPHIC_RE.test(labelText)) continue;

      // "How did you hear" checkbox groups → only the Job Board option (rule 3)
      const groupText = (container?.parentElement?.textContent || '').toLowerCase();
      if (HEAR_ABOUT_RE.test(labelText) || HEAR_ABOUT_RE.test(groupText)) {
        const ownText = ((cb.value || '') + ' ' + (forLabel?.textContent || cb.closest('label')?.textContent || '')).toLowerCase();
        if (/\bjob\s*boards?\b/.test(ownText)) {
          if (clickCheckbox(cb)) filled++;
        }
        continue;
      }

      // Consent / privacy / acknowledgement → check (user consents by using the extension)
      if (/privacy|consent|terms|acknowledge|agree|contact me|future (job )?opportunities|can contact/i.test(labelText)) {
        if (clickCheckbox(cb)) filled++;
      }
    }

    return filled;
  }

  // Rule 4/13: best-effort work-experience section for standard forms.
  async function fillExperienceSection(kit, platform) {
    const exp = Array.isArray(kit.experience) ? kit.experience : [];
    if (!exp.length) return 0;
    const exp0 = exp[0];
    let filled = 0;

    // Start/end date inputs near work-experience context
    const dateInputs = queryShadow(document, 'input[type="text"], input[type="month"], input:not([type])');
    for (const el of dateInputs) {
      if (!isFillable(el) || filledEls.has(el) || hasExistingValue(el)) continue;
      const sources = getMatchSources(el).join(' ');
      const inExpContext = /experience|employment|work history|job/.test(
        (el.closest('fieldset, section, [class*="experience"], [class*="employment"]')?.textContent || '').toLowerCase()
      );
      if (!inExpContext) continue;

      if (/start[\s_-]?date|from[\s_-]?date|date[\s_-]?from/.test(sources)) {
        const v = el.type === 'month'
          ? toMonthYear(exp0.start_date).split('/').reverse().join('-')
          : toMonthYear(exp0.start_date);
        if (v && await setTextValue(el, v, platform)) filled++;
      } else if (/end[\s_-]?date|to[\s_-]?date|date[\s_-]?to/.test(sources)) {
        if (exp0.current) continue; // current role: start date only (rule 13)
        const v = el.type === 'month'
          ? toMonthYear(exp0.end_date).split('/').reverse().join('-')
          : toMonthYear(exp0.end_date);
        if (v && await setTextValue(el, v, platform)) filled++;
      }
    }

    // "I currently work here" - only when the kit says so
    if (exp0.current === true) {
      for (const cb of queryShadow(document, 'input[type="checkbox"]')) {
        if (cb.checked || cb.disabled) continue;
        const label = (cb.closest('label')?.textContent ||
          (cb.id && document.querySelector(`label[for="${CSS.escape(cb.id)}"]`)?.textContent) ||
          '').toLowerCase();
        if (/currently work here|current(ly)? (role|position|job)|i work here/.test(label)) {
          if (clickCheckbox(cb)) filled++;
        }
      }
    }

    return filled;
  }

  // -- Workday direct fill ------------------------------------------------------

  const WORKDAY_FIELD_MAP = [
    { key: 'firstName', selectors: ['[data-automation-id="legalNameSection_firstName"]', '[data-automation-id="firstName"]'], labels: ['first name', 'given name'] },
    { key: 'lastName',  selectors: ['[data-automation-id="legalNameSection_lastName"]', '[data-automation-id="lastName"]'], labels: ['last name', 'family name'] },
    { key: 'email',     selectors: ['[data-automation-id="email"]', 'input[type="email"]'], labels: ['email'] },
    { key: 'phone',     selectors: ['[data-automation-id="phone-number"]'], labels: ['phone number'] },
    { key: 'city',      selectors: ['[data-automation-id="addressSection_city"]'], labels: ['city'] },
    { key: 'linkedin',  selectors: ['input[data-automation-id*="linkedin" i]'], labels: ['linkedin'] },
  ];

  function findWorkdayInputByLabel(labelText) {
    const allLabels = document.querySelectorAll(
      '[data-automation-id*="formLabel" i], label, legend, [class*="css-"][class*="Label"]'
    );
    const target = labelText.toLowerCase();
    for (const label of allLabels) {
      const text = label.textContent?.toLowerCase() || '';
      if (!text.includes(target) || text.length > 200) continue;

      // Prefer the explicit for="" association - Workday labels are siblings
      // of their inputs, never ancestors, so closest()/descendant lookups miss.
      const forId = label.htmlFor || label.getAttribute('for');
      if (forId) {
        const el = document.getElementById(forId);
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return el;
      }

      // Walk up to the formField container and search inside it
      let node = label.parentElement;
      for (let i = 0; i < 4 && node; i++) {
        const input = node.querySelector('input:not([type="hidden"]), textarea');
        if (input) return input;
        node = node.parentElement;
      }
    }
    return null;
  }

  function closeWorkdayPopup(input) {
    for (const type of ['keydown', 'keyup']) {
      input.dispatchEvent(new KeyboardEvent(type, {
        key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true,
      }));
    }
    input.blur();
    document.body.click(); // Workday popups also close on outside click
  }

  async function fillWorkdayDropdown(labelText, optionText) {
    const input = findWorkdayInputByLabel(labelText);
    if (!input || filledEls.has(input)) return false;
    input.click();
    input.focus();
    await sleep(500);
    document.execCommand('insertText', false, optionText.substring(0, 3));

    // Options load from a search request - poll instead of a fixed wait
    let match = null;
    for (let attempt = 0; attempt < 6 && !match; attempt++) {
      await sleep(500);
      const options = document.querySelectorAll(
        '[data-automation-id="promptOption"], [data-automation-id="promptLeafNode"], [role="option"]'
      );
      match = Array.from(options).find(o =>
        o.textContent.trim().toLowerCase().includes(optionText.toLowerCase())
      );
    }

    if (!match) {
      closeWorkdayPopup(input);
      return false;
    }
    match.click();
    await sleep(300);
    filledEls.add(input);
    return true;
  }

  async function workdayDirectFill(kit, values) {
    let filled = 0;

    log('workday fill start - kit fields with data:',
      Object.entries(values).filter(([, v]) => v).map(([k]) => k).join(', '));

    for (const { key, selectors, labels } of WORKDAY_FIELD_MAP) {
      const value = values[key];
      if (!value) {
        log(`map.${key}: no kit value - skipped`);
        continue;
      }

      let input = null;
      for (const sel of selectors) {
        input = document.querySelector(sel);
        if (input) break;
      }
      if (!input) {
        for (const l of labels) {
          input = findWorkdayInputByLabel(l);
          if (input) break;
        }
      }
      if (!input || input.tagName !== 'INPUT' && input.tagName !== 'TEXTAREA') {
        log(`map.${key}: no matching element on page (selectors + label search)`);
        continue;
      }

      if (await fillField(`map.${key}`, input, value)) filled++;
    }

    // My Experience page: repeatable sections + skills + websites
    filled += await fillWorkdayExperience(kit);
    filled += await fillWorkdayEducation(kit);
    filled += await fillWorkdaySkills(kit);
    filled += await fillWorkdayWebsites(kit);

    // "How did you hear about us" prompt → Job Board only (rule 3)
    if (await fillWorkdayDropdown('how did you hear', 'Job Board')) filled++;

    return filled;
  }

  // -- Workday repeatable sections (My Experience page) -------------------------

  function describe(el) {
    if (!el) return '(null)';
    const aid = el.getAttribute?.('data-automation-id');
    return `<${(el.tagName || '?').toLowerCase()}${aid ? ` data-automation-id="${aid}"` : ''}${el.id ? ` id="${el.id}"` : ''}>`;
  }

  // What automation-ids ARE on the page - logged when a section lookup misses,
  // so the console shows what this tenant actually calls things.
  function automationIdsLike(re) {
    const ids = new Set();
    document.querySelectorAll('[data-automation-id]').forEach(el => {
      const v = el.getAttribute('data-automation-id');
      if (v && re.test(v)) ids.add(v);
    });
    return Array.from(ids).slice(0, 30);
  }

  // Logged fill: says exactly which element was targeted, what value was tried,
  // and why it was skipped or whether the value stuck.
  async function fillField(name, el, value, platform = 'workday') {
    if (!el) { log(name, ': element not found'); return false; }
    if (!value) { log(name, ': no kit value - left blank'); return false; }
    if (filledEls.has(el)) { log(name, ': already filled this run'); return false; }
    if (!isFillable(el)) { log(name, ': not fillable (hidden/disabled)', describe(el)); return false; }
    if (hasExistingValue(el)) {
      if (!isWorkdaySpinner(el)) { log(name, `: keeping existing value "${el.value}"`); return false; }
      log(name, `: overwriting spinner value "${el.value}"`);
    }
    const okFill = await setTextValue(el, value, platform);
    log(name, okFill
      ? `: filled "${value}" → ${describe(el)}`
      : `: FAILED "${value}" → ${describe(el)} (value after attempt: "${el.value}")`);
    return okFill;
  }

  function findWorkdaySectionEl(automationIds, headingRe) {
    for (const id of automationIds) {
      const el = document.querySelector(`[data-automation-id="${id}"]`);
      if (el) return el;
    }
    // Fallback: locate the section heading, then the smallest ancestor that
    // actually contains form fields. Stopping at the first ancestor with an Add
    // button returned the header ROW - which holds the button but none of the
    // panels, making every field count inside it read 0.
    for (const h of document.querySelectorAll('h1, h2, h3, h4, [role="heading"]')) {
      const text = (h.textContent || '').trim();
      if (!text || text.length > 60 || !headingRe.test(text)) continue;
      const container = h.closest('[data-automation-id*="section" i]');
      if (container) return container;
      let node = h.parentElement;
      let withAddButton = null;
      for (let i = 0; i < 5 && node && node !== document.body; i++) {
        if (node.matches?.('main, [role="main"]')) break; // page-level: too far
        if (node.querySelector('input:not([type="hidden"]), textarea, [contenteditable="true"]')) return node;
        if (!withAddButton && findAddButton(node)) withAddButton = node;
        node = node.parentElement;
      }
      // Section with no entries yet has no fields - return the Add-button
      // container so auto-add still works (counts re-resolve after each add)
      if (withAddButton) return withAddButton;
    }
    return null;
  }

  // Workday's React buttons often ignore bare element.click() - they want the
  // real pointer sequence, and off-screen elements may not respond at all.
  function simulateClick(el) {
    try { el.scrollIntoView({ block: 'center' }); } catch (_) { /* jsdom/old browsers */ }
    const opts = { bubbles: true, cancelable: true, composed: true, view: window };
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const Ev = type.startsWith('pointer') && typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
      el.dispatchEvent(new Ev(type, opts));
    }
  }

  function findAddButton(scope) {
    const direct = scope.querySelector('button[data-automation-id="add-button"], button[data-automation-id="Add"]');
    if (direct && !direct.disabled) return direct;
    const isAdd = b => !b.disabled && (
      /^add(\s+another)?$/i.test((b.textContent || '').trim()) ||
      /^add\b/i.test(b.getAttribute('aria-label') || '')
    );
    const inLight = Array.from(scope.querySelectorAll('button')).find(isAdd);
    if (inLight) return inLight;
    // Some tenants render section controls inside shadow roots
    return queryShadow(scope, 'button').find(isAdd) || null;
  }

  // Click Add/Add Another until the section has `needed` entries, waiting for
  // each new panel's fields to render before the next click. Takes a getter,
  // not the section element: Workday replaces the whole section node when a
  // panel is added, so a held reference goes stale after the first click and
  // every later click would hit a detached button.
  async function ensureWorkdayEntries(getSection, countFn, needed) {
    const count = countFn;
    let current = count();
    let guard = 0;
    while (current < needed && guard < needed + 2) {
      guard++;
      const section = getSection();
      if (!section) break;
      const btn = findAddButton(section);
      if (!btn) {
        log('ensureEntries: no Add button found in', describe(section));
        break;
      }
      log(`ensureEntries: clicking Add (have ${current}, need ${needed}) - button:`, (btn.outerHTML || '').slice(0, 250));
      simulateClick(btn);
      const before = current;
      for (let i = 0; i < 8 && count() <= before; i++) await sleep(500);
      current = count();

      if (current <= before) {
        // Fallback: some builds only respond to the plain click() path
        log('ensureEntries: pointer-sequence click had no effect - retrying with element.click()');
        const freshBtn = getSection() ? findAddButton(getSection()) : null;
        if (freshBtn) {
          freshBtn.click();
          for (let i = 0; i < 8 && count() <= before; i++) await sleep(500);
          current = count();
        }
      }
      if (current <= before) {
        log('ensureEntries: Add click had no effect - stopping. Button was:', (btn.outerHTML || '').slice(0, 300));
        break;
      }
      await sleep(300);
    }
    return current;
  }

  const FIELD_INPUT_SEL = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="file"]), textarea, [contenteditable="true"], [role="textbox"]';

  // Richer element description for the DOM diagnostics
  function describeField(el) {
    if (!el) return '(null)';
    const bits = [(el.tagName || '?').toLowerCase()];
    for (const attr of ['data-automation-id', 'id', 'name', 'type', 'placeholder', 'aria-label']) {
      const v = el.getAttribute?.(attr);
      if (v) bits.push(`${attr}="${v}"`);
    }
    return `<${bits.join(' ')}>`;
  }

  // Resolve inputs by their visible labels - for tenants whose panels carry no
  // standard data-automation-id values. for="" association first, then the
  // label's sibling field container, then a bounded ancestor walk.
  function inputsByLabelIn(scope, labelRe) {
    const found = [];
    const seen = new Set();
    for (const lab of scope.querySelectorAll('label, legend, [data-automation-id*="formLabel" i]')) {
      const text = (lab.textContent || '').trim();
      if (!text || text.length > 120 || !labelRe.test(text)) continue;

      let el = null;
      const forId = lab.htmlFor || lab.getAttribute('for');
      if (forId) {
        const target = document.getElementById(forId);
        if (target) {
          el = target.matches?.(FIELD_INPUT_SEL) ? target : target.querySelector?.(FIELD_INPUT_SEL);
        }
      }
      if (!el) {
        let sib = lab.nextElementSibling;
        for (let i = 0; i < 2 && sib && !el; i++) {
          el = sib.matches?.(FIELD_INPUT_SEL) ? sib : sib.querySelector?.(FIELD_INPUT_SEL);
          sib = sib.nextElementSibling;
        }
      }
      if (!el) {
        let node = lab.parentElement;
        for (let i = 0; i < 4 && node && node !== scope.parentElement && !el; i++) {
          if (node !== scope) el = node.querySelector(FIELD_INPUT_SEL);
          node = node.parentElement;
        }
      }
      if (el && !seen.has(el)) {
        seen.add(el);
        found.push(el);
      }
    }
    return found;
  }

  // One panel per anchor element: the anchor's role="group" wrapper when it
  // holds exactly one anchor, else the largest ancestor containing only it.
  function panelsFor(scope, anchors) {
    return anchors.map(a => {
      const group = a.closest('[role="group"]');
      if (group && anchors.filter(x => group.contains(x)).length === 1) return group;
      let panel = a.parentElement;
      let node = a.parentElement;
      while (node && node !== scope && node !== document.body) {
        if (anchors.filter(x => node.contains(x)).length > 1) break;
        panel = node;
        node = node.parentElement;
      }
      return panel;
    });
  }

  // Anchor discovery: standard automation-ids first, visible labels second -
  // some tenants render these panels without any data-automation-id at all.
  const loggedOnce = new Set();
  function logOnce(key, ...args) {
    if (loggedOnce.has(key)) return;
    loggedOnce.add(key);
    log(...args);
  }

  function experienceAnchors(scope) {
    const byId = Array.from(scope.querySelectorAll('input[data-automation-id="jobTitle"], input[data-automation-id*="jobtitle" i]'));
    if (byId.length) return byId;
    const byLabel = inputsByLabelIn(scope, /job\s*title/i);
    if (byLabel.length) logOnce('exp-label-anchors', 'experience: using label-based anchors - no jobTitle automation-id on this tenant');
    return byLabel;
  }

  function educationAnchors(scope) {
    const byId = Array.from(scope.querySelectorAll('input[data-automation-id="school"], input[data-automation-id="schoolName"], input[data-automation-id*="school" i]'));
    if (byId.length) return byId;
    const byLabel = inputsByLabelIn(scope, /school|university/i);
    if (byLabel.length) logOnce('edu-label-anchors', 'education: using label-based anchors - no school automation-id on this tenant');
    return byLabel;
  }

  const WD_MONTH = 'input[data-automation-id="dateSectionMonth-input"]';
  const WD_YEAR = 'input[data-automation-id="dateSectionYear-input"]';

  // Date field container: standard formField-startDate/endDate automation-ids,
  // else the container next to a matching visible label ("From" / "To").
  function dateContainerIn(panel, which, labelRe) {
    if (!panel) return null;
    const byId = panel.querySelector(`[data-automation-id="formField-${which}Date"]`);
    if (byId) return byId;
    for (const lab of panel.querySelectorAll('label, legend, [data-automation-id*="formLabel" i]')) {
      const text = (lab.textContent || '').trim();
      if (!text || text.length > 60 || !labelRe.test(text)) continue;
      let sib = lab.nextElementSibling;
      for (let i = 0; i < 2 && sib; i++) {
        if (sib.matches?.('input')) return sib.parentElement;
        if (sib.querySelector?.('input')) return sib;
        sib = sib.nextElementSibling;
      }
      let node = lab.parentElement;
      for (let i = 0; i < 3 && node && node !== panel.parentElement; i++) {
        if (node !== panel && node.querySelector('input')) return node;
        node = node.parentElement;
      }
    }
    return null;
  }

  // Fill a MM/YYYY date into whatever this tenant renders: month+year spinner
  // ids, two generic inputs (month, year), or a single combined input.
  async function fillWorkdayDateIn(name, panelFn, which, labelRe, mmYYYY) {
    if (!mmYYYY) return 0;
    const [mm, yyyy] = mmYYYY.split('/');
    let n = 0;

    let container = dateContainerIn(panelFn(), which, labelRe);
    if (container) {
      const month = container.querySelector(WD_MONTH);
      const year = container.querySelector(WD_YEAR);
      if (month || year) {
        if (await fillField(`${name}.${which}Month`, month, mm)) n++;
        container = dateContainerIn(panelFn(), which, labelRe) || container; // blur may re-render
        if (await fillField(`${name}.${which}Year`, container.querySelector(WD_YEAR) || year, yyyy)) n++;
        return n;
      }
      const inputs = Array.from(container.querySelectorAll('input')).filter(isFillable);
      if (inputs.length >= 2) {
        if (await fillField(`${name}.${which}Month`, inputs[0], mm)) n++;
        container = dateContainerIn(panelFn(), which, labelRe) || container;
        const fresh = Array.from(container.querySelectorAll('input')).filter(isFillable);
        if (await fillField(`${name}.${which}Year`, fresh[1] || inputs[1], yyyy)) n++;
      } else if (inputs.length === 1) {
        if (await fillField(`${name}.${which}Date`, inputs[0], mmYYYY)) n++;
      }
      return n;
    }

    // Last resort: positional spinners in the panel (start = first pair, end = second)
    const p = panelFn();
    if (!p) return 0;
    const idx = which === 'start' ? 0 : 1;
    if (await fillField(`${name}.${which}Month`, p.querySelectorAll(WD_MONTH)[idx], mm)) n++;
    if (await fillField(`${name}.${which}Year`, panelFn()?.querySelectorAll(WD_YEAR)[idx], yyyy)) n++;
    return n;
  }

  function findCurrentlyWorkHere(panel) {
    if (!panel) return null;
    const byId = panel.querySelector('input[data-automation-id="currentlyWorkHere"]');
    if (byId) return byId;
    for (const lab of panel.querySelectorAll('label, legend')) {
      if (!/currently\s+work/i.test(lab.textContent || '')) continue;
      const forId = lab.htmlFor || lab.getAttribute('for');
      const byFor = forId && document.getElementById(forId);
      if (byFor && byFor.type === 'checkbox') return byFor;
      const near = lab.querySelector('input[type="checkbox"]') ||
        (lab.nextElementSibling?.matches?.('input[type="checkbox"]') ? lab.nextElementSibling : null) ||
        lab.nextElementSibling?.querySelector?.('input[type="checkbox"]') ||
        lab.parentElement?.querySelector('input[type="checkbox"]');
      if (near) return near;
    }
    return panel.querySelector('input[type="checkbox"]');
  }

  // Workday re-renders panels after every blur, so element references captured
  // before a fill go stale - focus() on a detached node no-ops and typing lands
  // nowhere. Every field lookup below is therefore done fresh, at fill time.
  async function fillWorkdayExperience(kit) {
    const experience = (Array.isArray(kit.experience) ? kit.experience : []).slice(0, 5);
    if (!experience.length) {
      log('experience: no kit data - skipped');
      return 0;
    }

    const getSection = () => findWorkdaySectionEl(['workExperienceSection'], /work\s+experience/i);
    const getScope = () => getSection() || document;
    const anchors = () => experienceAnchors(getScope());

    const section = getSection();
    log('experience: section =', describe(section),
      '| job-title anchors =', anchors().length, '| kit entries =', experience.length);
    if (!section) log('experience: automation-ids on page matching /work|experience/:', automationIdsLike(/work|experience/i));

    if (section) await ensureWorkdayEntries(getSection, () => anchors().length, experience.length);

    const panelCount = panelsFor(getScope(), anchors()).length;
    if (!panelCount) {
      log('experience: 0 entry panels found - nothing filled.');
      if (section) log('experience: section outerHTML (first 15000 chars):', (section.outerHTML || '').slice(0, 15000));
      return 0;
    }

    // Dump the first panel so the tenant's real field structure is in the console
    const firstPanel = panelsFor(getScope(), anchors())[0];
    log('experience: fields in panel[0]:', Array.from(firstPanel.querySelectorAll(FIELD_INPUT_SEL)).map(describeField).join(' '));
    log('experience: panel[0] outerHTML (first 15000 chars):', (firstPanel.outerHTML || '').slice(0, 15000));

    let filled = 0;
    for (let i = 0; i < panelCount && i < experience.length; i++) {
      const exp = experience[i];
      const panel = () => panelsFor(getScope(), anchors())[i] || null;
      const fieldEl = (sel, labelRe) => {
        const p = panel();
        if (!p) return null;
        return p.querySelector(sel) || (labelRe ? inputsByLabelIn(p, labelRe)[0] || null : null);
      };

      if (await fillField(`experience[${i}].title`, anchors()[i] || null, exp.title)) filled++;
      if (await fillField(`experience[${i}].company`, fieldEl('input[data-automation-id="company"]', /^company\b/i), exp.company)) filled++;
      if (await fillField(`experience[${i}].location`, fieldEl('input[data-automation-id="location"]', /^location\b/i), exp.location)) filled++;

      // Dates before the "currently work here" toggle - checking it removes the To field
      filled += await fillWorkdayDateIn(`experience[${i}]`, panel, 'start', /^from\b/i, toMonthYear(exp.start_date));
      if (exp.current !== true) {
        filled += await fillWorkdayDateIn(`experience[${i}]`, panel, 'end', /^to\b/i, toMonthYear(exp.end_date));
      } else {
        const cb = findCurrentlyWorkHere(panel());
        if (clickCheckbox(cb)) {
          log(`experience[${i}].currentlyWorkHere: checked`);
          filled++;
          await sleep(300);
        }
      }

      const bullets = Array.isArray(exp.bullets) ? exp.bullets.filter(Boolean).join('\n') : '';
      if (bullets) {
        if (await fillField(`experience[${i}].description`, fieldEl('textarea[data-automation-id="description"], textarea', /description/i), bullets)) filled++;
      }
    }
    return filled;
  }

  // Prompt-style field (multiSelectContainer search input): the typed text
  // means nothing until a suggestion is clicked.
  function isWorkdayPrompt(el) {
    if (!el) return false;
    return !!el.closest('[data-automation-id*="multiselect" i], [data-automation-id="multiSelectContainer"]') ||
      (el.getAttribute?.('placeholder') || '').toLowerCase() === 'search' ||
      el.getAttribute?.('role') === 'combobox';
  }

  const WD_OPTION_SEL = '[data-automation-id="promptOption"], [data-automation-id="promptLeafNode"], [data-automation-id="multiSelectOption"], [role="option"]';

  // Activate a multiselect widget: Workday only opens the suggestion dropdown
  // if the multiSelectContainer itself is clicked before the input is focused.
  async function activatePromptInput(input) {
    const container = input.closest('[data-automation-id*="multiselect" i], [data-automation-id="multiSelectContainer"]');
    if (container) {
      simulateClick(container);
      await sleep(200);
    } else {
      input.click();
    }
    input.focus();
    await sleep(200);
    if (document.activeElement !== input) {
      input.focus();
      await sleep(150);
    }
    return document.activeElement === input;
  }

  // Type into a prompt input, wait for suggestions, click the match.
  // getInput is a getter - the input may be re-rendered while we work.
  async function fillWorkdayPrompt(name, getInput, text) {
    const input = getInput();
    if (!input || !text || filledEls.has(input)) return false;
    if (!(await activatePromptInput(input))) {
      log(name, ': could not focus prompt input', describe(input));
      return false;
    }
    document.execCommand('selectAll');
    document.execCommand('delete');
    // Character-by-character so Workday's search fires per keystroke
    for (const ch of String(text)) {
      document.execCommand('insertText', false, ch);
      await sleep(50);
    }

    let match = null;
    let noItems = false;
    let lastOptions = [];
    for (let i = 0; i < 8 && !match && !noItems; i++) {
      await sleep(i === 0 ? 800 : 400);
      lastOptions = Array.from(document.querySelectorAll(WD_OPTION_SEL));
      noItems = lastOptions.some(o => /^no\s+items\.?$/i.test(o.textContent.trim()));
      if (noItems) break;
      const t = text.toLowerCase();
      match = lastOptions.find(o => o.textContent.trim().toLowerCase() === t) ||
        lastOptions.find(o => o.textContent.trim().toLowerCase().includes(t)) ||
        lastOptions.find(o => t.includes(o.textContent.trim().toLowerCase()) && o.textContent.trim().length > 3);
    }

    if (!match) {
      log(name, `: no suggestion matched "${text}" -`,
        noItems ? 'dropdown said "No Items."' : `${lastOptions.length} options shown`);
      document.execCommand('selectAll');
      document.execCommand('delete');
      closeWorkdayPopup(getInput() || input);
      return false;
    }
    log(name, `: selecting "${match.textContent.trim()}" for "${text}"`);
    match.click();
    await sleep(400);
    filledEls.add(input);
    const fresh = getInput();
    if (fresh) filledEls.add(fresh);
    return true;
  }

  async function fillWorkdayEducation(kit) {
    const education = (Array.isArray(kit.education) ? kit.education : []).slice(0, 3);
    if (!education.length) {
      log('education: no kit data - skipped');
      return 0;
    }

    const getSection = () => findWorkdaySectionEl(['educationSection'], /education/i);
    const getScope = () => getSection() || document;
    const anchors = () => educationAnchors(getScope());

    const section = getSection();
    log('education: section =', describe(section),
      '| school anchors =', anchors().length, '| kit entries =', education.length);
    if (!section) log('education: automation-ids on page matching /edu|school/:', automationIdsLike(/edu|school/i));

    if (section) await ensureWorkdayEntries(getSection, () => anchors().length, education.length);

    const panelCount = panelsFor(getScope(), anchors()).length;
    if (!panelCount) {
      log('education: 0 entry panels found - nothing filled.');
      if (section) log('education: section outerHTML (first 15000 chars):', (section.outerHTML || '').slice(0, 15000));
      return 0;
    }

    const firstPanel = panelsFor(getScope(), anchors())[0];
    log('education: fields in panel[0]:', Array.from(firstPanel.querySelectorAll(FIELD_INPUT_SEL)).map(describeField).join(' '));
    log('education: panel[0] outerHTML (first 15000 chars):', (firstPanel.outerHTML || '').slice(0, 15000));

    let filled = 0;
    // Reverse order: selecting a prompt-style school consumes its search input,
    // which would shift anchor indices for the panels after it.
    for (let i = Math.min(panelCount, education.length) - 1; i >= 0; i--) {
      const edu = education[i];
      const panel = () => panelsFor(getScope(), anchors())[i] || null;

      // Graduation year first - panel resolution needs the school anchor alive
      if (edu.graduation_year) {
        const years = panel()?.querySelectorAll(WD_YEAR) || [];
        let target = years[years.length - 1] || null;
        if (!target) {
          const container = dateContainerIn(panel(), 'end', /\bto\b|graduat/i);
          const inputs = container ? Array.from(container.querySelectorAll('input')).filter(isFillable) : [];
          target = inputs[inputs.length - 1] || null;
        }
        if (await fillField(`education[${i}].gradYear`, target, String(edu.graduation_year))) filled++;
      }

      // School: plain text input on some tenants, a multiselect search prompt
      // (type → suggestions → click) on others
      const schoolEl = anchors()[i] || null;
      if (isWorkdayPrompt(schoolEl)) {
        if (await fillWorkdayPrompt(`education[${i}].school`, () => educationAnchors(getScope())[i] || null, edu.school)) filled++;
      } else {
        if (await fillField(`education[${i}].school`, schoolEl, edu.school)) filled++;
      }
      // Degree (button-listbox) / field of study (prompt): no kit data - left
      // blank on purpose; the panel[0] dump shows their identifiers
    }
    return filled;
  }

  // Skills is a tag/autocomplete input: typing alone registers nothing - the
  // suggestion must be clicked, and the tag must appear before moving on.
  // Skills the tenant's list doesn't offer are skipped, never invented.
  async function fillWorkdaySkills(kit) {
    const skills = (Array.isArray(kit.skills) ? kit.skills : []).filter(Boolean).slice(0, 15);
    if (!skills.length) {
      log('skills: no kit data - skipped');
      return 0;
    }

    const getSection = () => findWorkdaySectionEl(['skillsSection', 'formField-skills'], /^skills\b/i);
    let section = getSection();
    log('skills: section =', describe(section), '| kit skills =', skills.join(', '));
    if (!section) {
      log('skills: automation-ids on page matching /skill/:', automationIdsLike(/skill/i));
      return 0;
    }

    let filled = 0;
    let consecutiveMisses = 0;
    for (const skill of skills) {
      section = getSection();
      if (!section) break;
      const hasTag = () => (getSection()?.textContent || '').toLowerCase().includes(skill.toLowerCase());

      if (hasTag()) {
        log(`skills: "${skill}" already added - skipped`);
        continue;
      }

      // Re-query the search input every time - Workday re-renders the
      // multiselect after each tag is added, detaching the old input
      const input = section.querySelector('input[type="text"], input:not([type])');
      if (!input || !isFillable(input)) {
        log('skills: search input not found or not fillable -', describe(input));
        break;
      }

      // Activate the multiselect (container click first), then type - Workday
      // never opens the dropdown for an input that wasn't activated
      if (!(await activatePromptInput(input))) {
        log(`skills: could not focus search input for "${skill}" - skipped`);
        continue;
      }
      document.execCommand('selectAll');
      document.execCommand('delete');
      // Partial query: some tenant taxonomies only match on prefixes - type the
      // first 3 characters and match the full skill against the suggestions
      const query = skill.length > 3 ? skill.slice(0, 3) : skill;
      for (const ch of query) {
        document.execCommand('insertText', false, ch);
        await sleep(50);
      }

      // Wait for the suggestion dropdown, then click the match. Workday shows a
      // literal "No Items." row when its taxonomy has no match - treat that as
      // a definitive miss instead of polling out the full timeout.
      let match = null;
      let lastOptions = [];
      let noItems = false;
      for (let i = 0; i < 8 && !match && !noItems; i++) {
        await sleep(i === 0 ? 800 : 400);
        lastOptions = Array.from(document.querySelectorAll(WD_OPTION_SEL));
        noItems = lastOptions.some(o => /^no\s+items\.?$/i.test(o.textContent.trim()));
        if (noItems) break;
        match = lastOptions.find(o => o.textContent.trim().toLowerCase() === skill.toLowerCase()) ||
          lastOptions.find(o => o.textContent.trim().toLowerCase().includes(skill.toLowerCase()));
      }

      if (!match) {
        consecutiveMisses++;
        log(`skills: no suggestion for "${skill}" - skipped.`,
          noItems ? 'Dropdown said "No Items."'
            : lastOptions.length
              ? `Suggestions shown: ${lastOptions.slice(0, 5).map(o => `"${o.textContent.trim()}"`).join(', ')}`
              : 'No suggestion dropdown appeared.');
        document.execCommand('selectAll');
        document.execCommand('delete');
        if (filled === 0 && consecutiveMisses >= 3) {
          log('skills: field restricted - first 3 skills got no usable suggestions even with partial queries. The tenant uses a restricted list; manual entry required. Skipping remaining skills.');
          break;
        }
        continue;
      }
      consecutiveMisses = 0;

      const optionText = match.textContent.trim().toLowerCase();
      log(`skills: clicking suggestion "${match.textContent.trim()}" for "${skill}"`);
      match.click();

      // Confirm it registered as a tag before typing the next skill - the tag
      // may render as the tenant's option text rather than the kit's wording
      let registered = false;
      for (let i = 0; i < 8 && !registered; i++) {
        await sleep(300);
        const sectionText = (getSection()?.textContent || '').toLowerCase();
        registered = hasTag() || (optionText && sectionText.includes(optionText));
      }
      log(`skills: "${skill}"`, registered ? 'added as tag' : 'suggestion click did NOT register as a tag');
      if (registered) filled++;
    }

    const searchInput = getSection()?.querySelector('input');
    if (searchInput) closeWorkdayPopup(searchInput);
    return filled;
  }

  // Websites 1..N: one URL per slot, in kit order linkedin → portfolio → github.
  // LinkedIn is excluded when the page has a dedicated LinkedIn field (e.g.
  // socialNetworkAccounts--linkedInAccount) - that field already handles it.
  // Inputs are re-queried before every fill - Workday re-renders slots on blur.
  // Set when slots are missing so the popup can tell the user to click Add.
  let websitesNeedManualAdd = false;

  async function fillWorkdayWebsites(kit) {
    const urls = [];
    if (kit.linkedin) {
      if (document.querySelector('input[data-automation-id*="linkedin" i]')) {
        log('websites: LinkedIn handled by its dedicated field - not adding it to website slots');
      } else {
        urls.push(kit.linkedin);
      }
    }
    if (kit.portfolio) urls.push(kit.portfolio);
    if (kit.github) urls.push(kit.github);
    if (!urls.length) {
      log('websites: no urls in kit - skipped');
      return 0;
    }

    const getSection = () => findWorkdaySectionEl(['websiteSection'], /^websites?\b/i);
    const anchor = 'input[data-automation-id="website"], input[data-automation-id*="website" i]';

    const section = getSection();
    log('websites: section =', describe(section),
      '| url slots =', (section || document).querySelectorAll(anchor).length,
      '| kit urls =', urls.join(', '));
    if (!section) {
      log('websites: automation-ids on page matching /website|url|social/:', automationIdsLike(/website|url|social/i));
      return 0;
    }

    // No programmatic Add here - this tenant's Websites Add button ignores
    // synthetic clicks. Fill the slots the user pre-added, like the other
    // pre-expanded sections.
    const slotCount = section.querySelectorAll(anchor).length;
    if (!slotCount) {
      log('websites: no URL slots found - click Add on the Websites section manually, then re-run the fill');
      websitesNeedManualAdd = true;
      return 0;
    }
    log(`websites: ${slotCount} existing slot(s) for ${urls.length} url(s) - filling without auto-add`);

    const slotInputs = () => Array.from((getSection() || document).querySelectorAll(anchor));

    let filled = 0;
    let slot = 0;
    for (const url of urls) {
      // Skip URLs already present in any slot (e.g. from a previous run)
      const existing = slotInputs().map(el => (el.value || '').trim().toLowerCase()).filter(Boolean);
      if (existing.some(v => v.includes(url.toLowerCase()) || url.toLowerCase().includes(v))) {
        log(`websites: "${url}" already present on the page - skipped`);
        continue;
      }

      // Fresh lookup: advance to the next empty slot
      let target = null;
      const inputs = slotInputs();
      for (; slot < inputs.length; slot++) {
        const el = inputs[slot];
        if (isFillable(el) && !filledEls.has(el) && !hasExistingValue(el)) {
          target = el;
          break;
        }
      }
      if (!target) {
        websitesNeedManualAdd = true;
        log(`websites: no empty slot left for "${url}" (${inputs.length} slots total) - click Add manually and re-run for the rest`);
        break;
      }
      if (await fillField(`websites[slot ${slot + 1}]`, target, url)) filled++;
      slot++;
    }
    return filled;
  }

  // -- Lever direct fill --------------------------------------------------------

  async function leverDirectFill(kit, values) {
    let filled = 0;

    const targets = [
      ['input[name="name"]', values.fullName],
      ['input[name="org"]', values.currentCompany],
      ['input[name="urls[LinkedIn]"]', values.linkedin],
      ['input[name="urls[GitHub]"], input[name="urls[Github]"]', values.github],
      ['input[name="urls[Portfolio]"]', values.portfolio],
      // urls[Twitter], urls[Other] → intentionally never filled (rule 9)
      ['#location-input', values.location],
    ];
    for (const [sel, value] of targets) {
      const el = document.querySelector(sel);
      if (el && await setTextValue(el, value, 'lever')) filled++;
    }

    // Country select uses ISO codes as values - match by country name text
    const locationSelect = document.querySelector('select.candidate-location, select[data-qa="candidate-location-select"]');
    if (locationSelect && values.location) {
      if (fillNativeSelect(locationSelect, countryOf(values.location) || values.location)) filled++;
    }

    // Pronouns: only if explicitly set in the kit (rule 7 - never default)
    if (kit.pronouns) {
      const pronounCb = document.querySelector(`input[name="pronouns"][value="${CSS.escape(kit.pronouns)}"]`);
      if (pronounCb && clickCheckbox(pronounCb)) filled++;
    }

    return filled;
  }

  // Lever demographic survey (#countrySurvey) appears after location fills.
  // Rule 8: demographics stay blank - we only pick explicit decline options.
  async function fillLeverSurveyIfVisible() {
    await sleep(800);
    const survey = document.getElementById('countrySurvey');
    if (!survey || survey.classList.contains('hidden')) return 0;

    let filled = 0;
    const groups = new Map();
    for (const radio of survey.querySelectorAll('input[type="radio"]')) {
      if (!groups.has(radio.name)) groups.set(radio.name, []);
      groups.get(radio.name).push(radio);
    }

    for (const radios of groups.values()) {
      if (radios.some(r => r.checked)) continue;
      const decline = radios.find(r =>
        DECLINE_RE.test(r.value || '') ||
        DECLINE_RE.test(r.closest('label')?.textContent || '')
      );
      if (decline) {
        decline.closest('label')?.click();
        filled++;
        await sleep(100);
      }
    }

    return filled;
  }

  // -- Greenhouse direct fill ---------------------------------------------------

  async function greenhouseDirectFill(kit, values) {
    let filled = 0;

    // Location autocomplete - seeded with the user's real city, first result
    const locationInput = document.getElementById('candidate-location');
    if (locationInput && values.city && !filledEls.has(locationInput)) {
      if (await fillCombobox(locationInput, values.city, { waitMs: 1200, firstOption: true })) filled++;
    }

    // Demographic React Selects → "I don't wish to answer" (rule 10, Greenhouse)
    for (const input of document.querySelectorAll('input[role="combobox"]')) {
      if (filledEls.has(input)) continue;
      const label = getReadableLabel(input);
      if (!DEMOGRAPHIC_RE.test(label)) continue;
      if (await fillCombobox(input, "I don't wish to answer", { waitMs: 400 })) filled++;
    }

    // Demographic native selects, same default
    for (const el of queryShadow(document, 'select')) {
      const sources = getMatchSources(el).join(' ');
      if (!DEMOGRAPHIC_RE.test(sources)) continue;
      if (fillNativeSelect(el, "I don't wish to answer") || fillNativeSelect(el, 'Decline To Self Identify')) filled++;
    }

    return filled;
  }

  // Greenhouse embeds question options in window.__remixContext - extract them
  // so the AI picks from exact option text instead of free-styling.
  function getGreenhouseQuestionOptions() {
    try {
      const scriptEl = Array.from(document.querySelectorAll('script')).find(s =>
        s.textContent.includes('__remixContext')
      );
      if (!scriptEl) return {};

      const match = scriptEl.textContent.match(/window\.__remixContext\s*=\s*(\{.+\});?\s*<\/script>/s)
        || scriptEl.textContent.match(/window\.__remixContext\s*=\s*(\{[\s\S]+\})/);
      if (!match) return {};

      const ctx = JSON.parse(match[1]);
      const jobPost = ctx?.state?.loaderData?.['routes/$url_token_.jobs_.$job_post_id']?.jobPost;
      if (!jobPost) return {};

      const optionMap = {};
      for (const q of jobPost.questions || []) {
        for (const field of q.fields || []) {
          if (field.values?.length) {
            optionMap[field.name] = {
              label: q.label,
              options: field.values.map(v => v.label),
            };
          }
        }
      }
      return optionMap;
    } catch (_) {
      return {};
    }
  }

  // -- Tier 2: question extraction (AI-worthy fields only) ---------------------

  function extractQuestions() {
    const platform = detectPlatform();
    if (platform === 'workday') return extractWorkdayQuestions();

    const questions = [];
    const seen = new Set();
    const push = q => {
      if (q.label && q.label.length > 2 && !seen.has(q.label)) {
        seen.add(q.label);
        questions.push(q);
      }
    };

    const ghOptions = platform === 'greenhouse' ? getGreenhouseQuestionOptions() : {};

    // Open-ended textareas
    for (const el of queryShadow(document, 'textarea')) {
      if (!isFillable(el) || filledEls.has(el) || hasExistingValue(el)) continue;
      const label = getReadableLabel(el);
      if (!label || isDeterministicLabel(label)) continue;
      push({ label, kind: 'textarea' });
    }

    // Text inputs that read like actual questions (not factual short fields)
    for (const el of queryShadow(document, 'input[type="text"], input:not([type])')) {
      if (!isFillable(el) || filledEls.has(el) || hasExistingValue(el)) continue;
      if (el.getAttribute('role') === 'combobox') continue;
      const label = getReadableLabel(el);
      if (!label || isDeterministicLabel(label) || !looksOpenEnded(label)) continue;
      push({ label, kind: 'text' });
    }

    // Native selects with concrete options (authorization, custom questions…)
    for (const el of queryShadow(document, 'select')) {
      if (!isFillable(el) || filledEls.has(el) || el.selectedIndex > 0) continue;
      const label = getReadableLabel(el);
      if (!label || isDeterministicLabel(label)) continue;
      const options = Array.from(el.options)
        .filter(o => !o.disabled && o.text.trim() && o.value)
        .map(o => o.text.trim())
        .slice(0, 40);
      if (options.length) push({ label, kind: 'select', options });
    }

    // React Select comboboxes (Greenhouse custom questions)
    for (const input of document.querySelectorAll('input[role="combobox"]')) {
      if (!isFillable(input) || filledEls.has(input)) continue;
      if (input.id === 'candidate-location' || input.id === 'country') continue;
      const label = getReadableLabel(input);
      if (!label || label.length <= 2 || isDeterministicLabel(label)) continue;
      if (/phone|country/i.test(label)) continue;

      const optionData = ghOptions[input.id];
      if (optionData?.options?.length) {
        push({ label, kind: 'combobox', options: optionData.options });
      } else {
        push({ label, kind: 'combobox' });
      }
    }

    return questions;
  }

  function extractWorkdayQuestions() {
    const questions = [];
    const seen = new Set();
    for (const input of document.querySelectorAll('textarea, input[type="text"]')) {
      if (!isFillable(input) || filledEls.has(input) || hasExistingValue(input)) continue;
      const label = getReadableLabel(input);
      if (!label || isDeterministicLabel(label) || seen.has(label)) continue;
      if (input.tagName === 'INPUT' && !looksOpenEnded(label)) continue;
      seen.add(label);
      questions.push({ label, kind: input.tagName === 'TEXTAREA' ? 'textarea' : 'text' });
    }
    return questions;
  }

  // -- Applying AI answers ------------------------------------------------------

  function labelsMatch(a, b) {
    const clean = s => String(s).toLowerCase().replace(/[*✱]/g, '').replace(/\s+/g, ' ').trim();
    const x = clean(a);
    const y = clean(b);
    if (!x || !y) return false;
    if (x === y) return true;
    if (x.length >= 15 && y.length >= 15 && (x.includes(y.slice(0, 30)) || y.includes(x.slice(0, 30)))) return true;
    return false;
  }

  function isUsableAnswer(answer) {
    if (answer === null || answer === undefined) return false;
    const s = String(answer).trim();
    return s !== '' && s.toLowerCase() !== 'null' && s.toUpperCase() !== 'SKIP';
  }

  async function applyAnswers(fields) {
    const platform = detectPlatform();
    let filled = 0;

    for (const field of fields || []) {
      const { label: targetLabel, answer } = field;
      if (!isUsableAnswer(answer)) continue;
      // Defense in depth: never let an AI answer land in a factual/demographic field
      if (isDeterministicLabel(targetLabel)) continue;

      let applied = false;

      // Textareas + open text inputs
      const textEls = queryShadow(document, 'textarea, input[type="text"], input:not([type])');
      for (const el of textEls) {
        if (!isFillable(el) || filledEls.has(el) || hasExistingValue(el)) continue;
        if (el.getAttribute('role') === 'combobox') continue;
        if (!labelsMatch(getReadableLabel(el), targetLabel)) continue;
        if (await setTextValue(el, String(answer), platform)) {
          filled++;
          applied = true;
        }
        break;
      }
      if (applied) continue;

      // Native selects - answer must resolve to a real option
      for (const el of queryShadow(document, 'select')) {
        if (!isFillable(el) || filledEls.has(el)) continue;
        if (!labelsMatch(getReadableLabel(el), targetLabel)) continue;
        if (fillNativeSelect(el, String(answer))) {
          filled++;
          applied = true;
        }
        break;
      }
      if (applied) continue;

      // React Select comboboxes - exact option match only for AI answers
      for (const input of document.querySelectorAll('input[role="combobox"]')) {
        if (!isFillable(input) || filledEls.has(input)) continue;
        if (/phone|country/i.test(getReadableLabel(input))) continue;
        if (!labelsMatch(getReadableLabel(input), targetLabel)) continue;
        if (await fillCombobox(input, String(answer), { exactOnly: false, waitMs: 400 })) filled++;
        break;
      }
    }

    // Lever demographic survey appears after location fill - decline-only pass
    if (platform === 'lever') filled += await fillLeverSurveyIfVisible();

    return { filled };
  }

  // -- Message listener ---------------------------------------------------------

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'DIRECT_FILL') {
      directFill(message.kit || {})
        .then(result => sendResponse(result))
        .catch(e => sendResponse({ filled: 0, platform: detectPlatform(), error: String(e) }));
      return true;
    }

    if (message.type === 'EXTRACT_QUESTIONS') {
      try {
        sendResponse(extractQuestions());
      } catch (_) {
        sendResponse([]);
      }
      return true;
    }

    if (message.type === 'FILL_ANSWERS') {
      applyAnswers(message.fields || [])
        .then(result => sendResponse(result))
        .catch(e => sendResponse({ filled: 0, error: String(e) }));
      return true;
    }

    return false;
  });
})();
