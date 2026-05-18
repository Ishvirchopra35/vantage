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

  const selectNativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;

  function fillSelect(el, value) {
    const lowerVal = value.toLowerCase();
    const match = Array.from(el.options).find(o => {
      if (!o.text.trim() || o.disabled) return false;
      const optText = o.text.toLowerCase();
      const optValue = o.value.toLowerCase();
      const cleanText = optText.replace(/[^a-z]/g, '');
      return (
        optText.includes(lowerVal) ||
        optValue.includes(lowerVal) ||
        (cleanText.length > 0 && lowerVal.includes(cleanText))
      );
    });
    if (match) {
      if (selectNativeSetter) selectNativeSetter.call(el, match.value);
      else el.value = match.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return !!match;
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

  // ── Label helpers ─────────────────────────────────────────────────────────────

  // Returns a human-readable label for use in AI prompts (preserves original case).
  function getLabel(el) {
    if (el.id) {
      const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelEl) {
        const text = labelEl.textContent.trim();
        if (text) return text;
      }
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

    return el.placeholder?.trim() || el.name?.trim() || '';
  }

  // ── Field detection ───────────────────────────────────────────────────────────

  function getFieldLabel(el) {
    const parts = [];

    if (el.placeholder) parts.push(el.placeholder);

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) parts.push(ariaLabel);

    if (el.name) parts.push(el.name);
    if (el.id) parts.push(el.id);

    if (el.id) {
      const labelEl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (labelEl) parts.push(labelEl.textContent);
    }
    const parentLabel = el.closest('label');
    if (parentLabel) parts.push(parentLabel.textContent);

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
    { key: 'portfolio',   patterns: [/\bportfolio\b/i, /\bpersonal.?website\b/i, /\bpersonal.?site\b/i] },
    { key: 'github',      patterns: [/\bgithub\b/i, /\bgit.?hub\b/i] },
    { key: 'location',    patterns: [/\blocation\b/i, /\bwhere are you located\b/i, /\bcity\b/i] },
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

  // ── Dropdown value resolver ───────────────────────────────────────────────────

  function selectValueForLabel(label, kit) {
    if (/comfortable|compensation|pay range|salary range/i.test(label)) return 'Yes';
    if (/authorized to work|work authorization|legally authorized/i.test(label)) return 'Yes';
    if (/visa sponsorship|require sponsorship|need sponsorship/i.test(label)) return 'No';
    if (/non-compete|non-solicitation|confidentiality agreement/i.test(label)) return 'No';
    if (/how did you hear|how did you find|referral source/i.test(label)) return kit.referralSource || 'LinkedIn';
    return null;
  }

  // ── Main fill function ────────────────────────────────────────────────────────

  async function fillForm(kit) {
    console.log('[Vantage] fillForm called, kit keys:', Object.keys(kit));
    let filled = 0;

    const values = {
      firstName: kit.firstName || '',
      lastName: kit.lastName || '',
      fullName: kit.fullName || '',
      email: kit.email || '',
      phone: kit.phone || '',
      linkedin: kit.linkedin || '',
      portfolio: kit.portfolio || '',
      github: kit.github || '',
      location: kit.location || '',
      coverLetter: kit.coverLetter || '',
      ...(kit.answers || {}),
    };

    // ── Text inputs ───────────────────────────────────────────────────────────

    const inputs = queryShadow(document, 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])');

    for (const el of inputs) {
      if (!el.offsetParent && el.offsetWidth === 0 && el.offsetHeight === 0) continue;
      if (el.disabled || el.readOnly) continue;

      const label = getFieldLabel(el);
      let key = matchKey(label, INPUT_MATCHERS) || keyForInputType(el);

      if (!key && /\bname\b/i.test(label)) key = 'fullName';
      if (!key) continue;

      const value = values[key];
      if (!value) continue;

      if (el.value && el.value !== el.placeholder) continue;

      setInput(el, value);
      filled++;
    }

    // ── Select / dropdown fields ──────────────────────────────────────────────

    const selects = queryShadow(document, 'select');

    for (const el of selects) {
      if (el.disabled) continue;

      const label = getFieldLabel(el);
      const value = selectValueForLabel(label, kit);
      if (!value) continue;

      // Don't overwrite a user's existing selection (index 0 is usually the placeholder)
      if (el.selectedIndex > 0) continue;

      const matched = fillSelect(el, value);
      if (matched) filled++;
    }

    // ── Textareas ─────────────────────────────────────────────────────────────

    const textareas = queryShadow(document, 'textarea');

    for (const el of textareas) {
      if (!el.offsetParent && el.offsetWidth === 0 && el.offsetHeight === 0) continue;
      if (el.disabled || el.readOnly) continue;

      const label = getFieldLabel(el);
      const key = matchKey(label, TEXTAREA_MATCHERS);
      let value = key ? values[key] : null;

      if (!value && kit.applicationQuestions) {
        if (
          label.includes('excites you') ||
          label.includes('career goals') ||
          label.includes('why do you want') ||
          label.includes('why are you interested') ||
          label.includes('tell us about yourself') ||
          label.includes('what would you contribute') ||
          label.includes('long-term') ||
          label.includes('passion') ||
          label.includes('motivated')
        ) {
          value = kit.applicationQuestions.excited || kit.applicationQuestions.goals || '';
        }
      }

      if (!value) continue;

      if (el.value && el.value !== el.placeholder) continue;

      setTextarea(el, value);
      filled++;
    }

    // ── Application question textareas (fuzzy match) ──────────────────────────

    if (kit.answers && Object.keys(kit.answers).length > 0) {
      for (const el of textareas) {
        if (el.disabled || el.readOnly) continue;
        if (el.value) continue;

        const label = getFieldLabel(el);
        for (const [question, answer] of Object.entries(kit.answers)) {
          if (!answer) continue;
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

    // ── Checkboxes ────────────────────────────────────────────────────────────
    fillCheckboxes();

    // ── Lever-specific fields ─────────────────────────────────────────────────
    if (window.location.hostname.includes('lever.co')) {
      const leverResult = await fillLeverForm(kit);
      filled += leverResult.filled;
    }

    return { filled };
  }

  // ── Lever form fill ───────────────────────────────────────────────────────────

  async function fillLeverForm(kit) {
    let filled = 0;

    // Full name — Lever uses name="name"
    const nameInput = document.querySelector('input[name="name"]');
    if (nameInput && kit.fullName && !nameInput.value) {
      setInput(nameInput, kit.fullName);
      filled++;
    }

    // Email
    const emailInput = document.querySelector('input[type="email"]');
    if (emailInput && kit.email && !emailInput.value) {
      setInput(emailInput, kit.email);
      filled++;
    }

    // Phone
    const phoneInput = document.querySelector('input[type="tel"]');
    if (phoneInput && kit.phone && !phoneInput.value) {
      setInput(phoneInput, kit.phone);
      filled++;
    }

    // Location text input (city string)
    const locationTextInput = document.getElementById('location-input');
    if (locationTextInput && kit.location && !locationTextInput.value) {
      setInput(locationTextInput, kit.location);
      filled++;
    }

    // Location country select — extract country from "City, Country" strings
    const locationSelect = document.querySelector('select.candidate-location, select[data-qa="candidate-location-select"]');
    if (locationSelect && kit.location) {
      const country = kit.location.split(',').pop()?.trim() || kit.location;
      if (fillSelect(locationSelect, country)) filled++;
    }

    // LinkedIn
    const linkedinInput = document.querySelector('input[name="urls[LinkedIn]"]') ||
                          document.querySelector('input[placeholder*="linkedin" i]') ||
                          document.querySelector('input[name="linkedin"]');
    if (linkedinInput && kit.linkedin && !linkedinInput.value) {
      setInput(linkedinInput, kit.linkedin);
      filled++;
    }

    // Portfolio / website
    const portfolioInput = document.querySelector('input[name="urls[Portfolio]"]') ||
                           document.querySelector('input[name="urls[Other]"]');
    if (portfolioInput && kit.portfolio && !portfolioInput.value) {
      setInput(portfolioInput, kit.portfolio);
      filled++;
    }

    // Checkboxes — use .click() so React/DOM change events fire correctly
    // Consent to marketing contact
    const marketingCb = document.querySelector('input[name="consent[marketing]"]');
    if (marketingCb && !marketingCb.checked) marketingCb.click();

    // "Use name only" pronoun option
    const useNameOnlyCb = document.getElementById('useNameOnlyPronounsOption') ||
                          document.querySelector('input[name="pronouns"][value="Use name only"]');
    if (useNameOnlyCb && !useNameOnlyCb.checked) useNameOnlyCb.click();

    return { filled };
  }

  // ── Checkbox handler ─────────────────────────────────────────────────────────

  function fillCheckboxes() {
    const checkboxes = queryShadow(document.body, 'input[type="checkbox"]');
    for (const cb of checkboxes) {
      if (cb.disabled) continue;

      const container = cb.closest('[class*="field"],[class*="question"],[class*="form-group"],li,label');
      const forLabel = cb.id
        ? document.querySelector(`label[for="${CSS.escape(cb.id)}"]`)
        : null;
      const labelText = (
        container?.textContent ||
        forLabel?.textContent ||
        cb.getAttribute('aria-label') ||
        ''
      ).toLowerCase().trim();

      if (
        labelText.includes('contact me') ||
        labelText.includes('future job opportunities') ||
        labelText.includes('can contact')
      ) {
        if (!cb.checked) cb.click();
      } else if (labelText.includes('use name only')) {
        if (!cb.checked) cb.click();
      }
      // Skip pronoun checkboxes (he/him, she/her, they/them, etc.)
    }
  }

  // ── fill() helper ────────────────────────────────────────────────────────────

  function fill(el, value) {
    if (el.tagName === 'TEXTAREA') {
      setTextarea(el, value);
    } else {
      setInput(el, value);
    }
  }

  // ── Greenhouse option extraction ─────────────────────────────────────────────

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

      for (const dq of jobPost.demographic_questions?.questions || []) {
        optionMap[String(dq.id)] = {
          label: dq.name,
          options: dq.answer_options.map(o => o.name),
        };
      }

      return optionMap;
    } catch (e) {
      console.error('[Vantage] Failed to parse greenhouse options:', e);
      return {};
    }
  }

  // ── AI-driven question extraction ─────────────────────────────────────────────

  function extractFormQuestions() {
    const questions = [];
    const seen = new Set();

    const ghOptions = (window.location.hostname.includes('greenhouse') || window.location.hostname.includes('boards.greenhouse'))
      ? getGreenhouseQuestionOptions()
      : {};

    // Native inputs/textareas/selects — exclude combobox inputs (handled separately below)
    const inputs = queryShadow(document.body,
      'input:not([type=submit]):not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]):not([role=combobox]), textarea, select'
    );
    for (const el of inputs) {
      if (el.disabled || el.readOnly) continue;
      const label = getLabel(el);
      if (label && label.length > 2 && !seen.has(label)) {
        seen.add(label);
        questions.push({ label, tag: el.tagName, type: el.type || null });
      }
    }

    // React Select combobox inputs — resolve label via aria-labelledby, attach options when available
    const comboboxInputs = document.querySelectorAll('input[role="combobox"]');
    for (const input of comboboxInputs) {
      if (input.id === 'candidate-location' || input.id === 'country') continue;

      const labelId = input.getAttribute('aria-labelledby');
      const labelEl = labelId ? document.getElementById(labelId) : null;
      const label = (labelEl?.textContent || input.getAttribute('aria-label') || '').trim();
      const lowerLabel = label.toLowerCase();

      if (!label || label.length <= 2) continue;
      if (lowerLabel.includes('phone') || lowerLabel.includes('country')) continue;
      if (seen.has(label)) continue;
      seen.add(label);

      const optionData = ghOptions[input.id];
      if (optionData?.options?.length) {
        questions.push({ label, tag: 'SELECT_CUSTOM', type: 'dropdown', options: optionData.options, fieldId: input.id });
      } else {
        questions.push({ label, tag: 'SELECT_CUSTOM', type: 'select' });
      }
    }

    return questions;
  }

  // ── AI answer fill ────────────────────────────────────────────────────────────

  function labelsMatch(elLabel, targetLabel) {
    const clean = s => s.toLowerCase().replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    const a = clean(elLabel);
    const b = clean(targetLabel);
    if (a === b) return true;
    if (a.includes(b.substring(0, 30)) || b.includes(a.substring(0, 30))) return true;
    if (a.substring(0, 20) === b.substring(0, 20)) return true;
    return false;
  }

  async function fillLocationField(city) {
    const locationInput = document.getElementById('candidate-location');
    if (!locationInput || !city) return;

    locationInput.focus();
    locationInput.click();
    await new Promise(r => setTimeout(r, 200));

    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSetter) nativeSetter.call(locationInput, city);
    locationInput.dispatchEvent(new Event('input', { bubbles: true }));
    locationInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: city[0] }));

    // Wait for location search API to respond
    await new Promise(r => setTimeout(r, 1200));

    const menu = document.querySelector('.select__menu');
    if (menu) {
      const firstOption = menu.querySelector('[class*="option"]');
      if (firstOption) {
        firstOption.click();
        console.log('[Vantage] Location selected:', firstOption.textContent?.trim());
      }
    }
  }

  async function fillGreenhouseReactSelects(fields) {
    for (const { label: targetLabel, answer } of fields) {
      if (!answer || answer === 'null' || answer === null) continue;

      const allComboboxes = document.querySelectorAll('input[role="combobox"]');

      for (const input of allComboboxes) {
        const labelId = input.getAttribute('aria-labelledby');
        const labelEl = labelId ? document.getElementById(labelId) : null;
        const elLabel = (labelEl?.textContent || input.getAttribute('aria-label') || '').toLowerCase().trim();
        const cleanTarget = targetLabel.toLowerCase().replace(/\*/g, '').trim();

        if (elLabel.includes('country') || elLabel.includes('phone') || input.id === 'country') continue;

        const matches = elLabel.includes(cleanTarget.substring(0, 25)) ||
                        cleanTarget.includes(elLabel.substring(0, 25));
        if (!matches) continue;

        console.log('[Vantage] Filling React Select:', elLabel, '→', answer);

        input.focus();
        input.click();
        await new Promise(r => setTimeout(r, 200));

        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) nativeSetter.call(input, answer);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: answer[0] }));

        await new Promise(r => setTimeout(r, 400));

        const menu = document.querySelector('.select__menu');
        if (!menu) {
          console.log('[Vantage] No menu found for:', elLabel);
          input.blur();
          continue;
        }

        const options = menu.querySelectorAll('[class*="option"]');
        console.log('[Vantage] Options:', Array.from(options).map(o => o.textContent?.trim()));

        const match = Array.from(options).find(o =>
          o.textContent?.trim() === answer
        ) || Array.from(options).find(o =>
          o.textContent?.toLowerCase().trim().includes(answer.toLowerCase())
        );

        if (match) {
          match.click();
          console.log('[Vantage] Clicked:', match.textContent?.trim());
        } else {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }

        await new Promise(r => setTimeout(r, 300));
        break;
      }
    }
  }

  async function fillWithAIAnswers(fields) {
    let filled = 0;

    // ── Pass 1: native inputs, textareas, and <select> elements ──────────────
    for (const { label: targetLabel, answer } of fields) {
      if (!answer || answer === 'null') continue;

      const allInputs = queryShadow(document.body,
        'input:not([type=submit]):not([type=hidden]):not([type=file]):not([role=combobox]), textarea, select'
      );

      for (const el of allInputs) {
        if (el.disabled || el.readOnly) continue;
        const elLabel = getLabel(el);
        console.log('[Vantage] Trying to fill:', targetLabel, '| answer:', answer, '| el:', el?.tagName, el?.id || el?.name || '');
        if (!labelsMatch(elLabel, targetLabel)) continue;

        if (el.tagName === 'SELECT') {
          if (fillSelect(el, answer)) filled++;
        } else {
          fill(el, answer);
          filled++;
        }
        break;
      }
    }

    // ── Pass 2: Greenhouse location field ─────────────────────────────────────
    const locationField = fields.find(f => /\blocation\b|\bcity\b/i.test(f.label));
    if (locationField?.answer && locationField.answer !== 'null') {
      await fillLocationField(locationField.answer);
    }

    // ── Pass 3: Greenhouse React Select comboboxes ────────────────────────────
    await fillGreenhouseReactSelects(fields);

    // ── Pass 4: AI guidelines checkbox ────────────────────────────────────────
    const aiCheckbox = document.getElementById('question_64567494[]_651433054') ||
                       document.querySelector('input[name="question_64567494[]"]');
    if (aiCheckbox && !aiCheckbox.checked) aiCheckbox.click();

    return { filled };
  }

  // ── Message listener ──────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'VANTAGE_FILL') {
      fillForm(message.kit)
        .then(result => sendResponse(result))
        .catch(e => sendResponse({ filled: 0, error: String(e) }));
      return true;
    }

    if (message.type === 'EXTRACT_QUESTIONS') {
      try {
        sendResponse(extractFormQuestions());
      } catch (e) {
        sendResponse([]);
      }
      return true;
    }

    if (message.type === 'FILL_ANSWERS') {
      fillWithAIAnswers(message.fields || [])
        .then(result => sendResponse(result))
        .catch(e => sendResponse({ filled: 0, error: String(e) }));
      return true;
    }

    return false;
  });
})();
