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

  // ── Greenhouse second-pass dropdown fill ─────────────────────────────────────
  // Greenhouse labels often live in a parent container rather than a <label for="">
  // or aria-label on the select itself. This pass uses container-based detection.

  function fillGreenhouseDropdowns(kit) {
    let filled = 0;
    const allSelects = queryShadow(document.body, 'select');
    console.log('[Vantage] fillGreenhouseDropdowns: found', allSelects.length, 'select elements');

    for (const select of allSelects) {
      if (select.disabled) continue;
      // Already selected in first pass or by the user
      if (select.selectedIndex > 0) continue;

      // Walk up to the nearest field container and find its label element
      const container = select.closest(
        '.field, .form-field, [class*="question"], [class*="field"]'
      );
      const labelEl = container
        ? container.querySelector('label, .label, [class*="label"]')
        : null;

      // Build question text: container label → aria-label → aria-labelledby → name/id
      let questionText = (labelEl?.textContent || '').trim();
      if (!questionText) {
        questionText = (select.getAttribute('aria-label') || '').trim();
      }
      if (!questionText) {
        const lbId = select.getAttribute('aria-labelledby');
        if (lbId) {
          questionText = (document.getElementById(lbId)?.textContent || '').trim();
        }
      }
      if (!questionText && select.name) questionText = select.name;
      if (!questionText && select.id)   questionText = select.id;

      const lowerQuestion = questionText.toLowerCase();

      console.log('[Vantage] Select found:', select.name || select.id || '(unnamed)', '| Label detected:', lowerQuestion || '(none)');

      if (!lowerQuestion) continue;

      const value = selectValueForLabel(lowerQuestion, kit);
      if (!value) continue;

      const option = Array.from(select.options).find(o =>
        o.text.toLowerCase().includes(value.toLowerCase()) ||
        o.value.toLowerCase().includes(value.toLowerCase())
      );

      if (option) {
        if (selectNativeSetter) selectNativeSetter.call(select, option.value);
        else select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select.dispatchEvent(new Event('input', { bubbles: true }));
        filled++;
      }
    }

    return filled;
  }

  // ── Custom div-based dropdown handler (Greenhouse, Lever) ───────────────────

  async function fillCustomDropdowns(kit) {
    const dropdownTriggers = queryShadow(document.body,
      '[role="combobox"], [role="listbox"], [class*="select__control"], [class*="SelectInput"], [class*="dropdown-trigger"], [data-qa="select"]'
    );

    console.log('[Vantage] Custom dropdown triggers found:', dropdownTriggers.length, dropdownTriggers);

    for (const trigger of dropdownTriggers) {
      const container = trigger.closest('[class*="field"],[class*="question"],[class*="form-group"],[class*="application-question"]') || trigger.parentElement?.parentElement;

      // Skip phone/country dropdowns
      if (
        container?.querySelector('input[type="tel"]') ||
        trigger.className?.toLowerCase().includes('phone') ||
        trigger.className?.toLowerCase().includes('country') ||
        trigger.className?.toLowerCase().includes('flag') ||
        trigger.getAttribute('aria-label')?.toLowerCase().includes('phone') ||
        trigger.getAttribute('aria-label')?.toLowerCase().includes('country')
      ) {
        console.log('[Vantage] Skipping phone/country dropdown')
        continue
      }

      const labelEl = container?.querySelector('label, [class*="label"], legend');
      const questionText = (labelEl?.textContent || trigger.getAttribute('aria-label') || trigger.getAttribute('placeholder') || '').toLowerCase().trim();

      console.log('[Vantage] Dropdown question:', questionText);

      let targetValue = null;
      if (questionText.includes('authorized to work') || questionText.includes('work authorization')) targetValue = 'Yes';
      else if (questionText.includes('visa') || questionText.includes('sponsorship')) targetValue = 'No';
      else if (questionText.includes('non-compete') || questionText.includes('non-solicitation')) targetValue = 'No';
      else if (questionText.includes('comfortable') || questionText.includes('pay range') || questionText.includes('compensation')) targetValue = 'Yes';
      else if (questionText.includes('how did you hear') || questionText.includes('how did you find')) targetValue = 'LinkedIn';
      else if (questionText.includes('location') || questionText.includes('where are you')) targetValue = kit.location;

      if (!targetValue) continue;

      // Close any dropdown that may still be open from a previous iteration
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise(r => setTimeout(r, 150));

      trigger.click();
      trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      // Wait longer for the option list to render
      await new Promise(r => setTimeout(r, 500));

      // Find panel near the trigger, not globally
      const allPanels = document.querySelectorAll('[class*="select__menu"], [class*="dropdown-menu"], [role="listbox"], [class*="SelectMenu"], [class*="menu--open"]')
      const openPanel = Array.from(allPanels).find(p => {
        const triggerRect = trigger.getBoundingClientRect()
        const panelRect = p.getBoundingClientRect()
        return Math.abs(panelRect.top - triggerRect.bottom) < 200
      }) || allPanels[allPanels.length - 1]
      if (!openPanel) {
        console.log('[Vantage] No dropdown panel found after click');
        continue;
      }

      const options = queryShadow(openPanel, '[role="option"], [class*="select__option"], [class*="option"], li');
      console.log('[Vantage] Options in open panel:', options.length, options.map(o => o.textContent?.trim()).slice(0, 5));

      if (options.length > 50) {
        console.log('[Vantage] Too many options, likely country/state list, skipping')
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        await new Promise(r => setTimeout(r, 200))
        continue
      }

      const match = options.find(o =>
        o.textContent?.toLowerCase().includes(targetValue.toLowerCase())
      );

      if (match) {
        match.click();
        match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        console.log('[Vantage] Clicked option:', match.textContent?.trim());
        // Let the framework process the selection, then close
        await new Promise(r => setTimeout(r, 400));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      } else {
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }

      await new Promise(r => setTimeout(r, 200));
    }

    // Lever native-select second pass for location and similar fields
    const leverSelects = document.querySelectorAll('select');
    for (const sel of leverSelects) {
      const label = (sel.closest('[class*="field"]')?.querySelector('label')?.textContent || '').toLowerCase();
      if (!label.includes('location') && !label.includes('where')) continue;
      if (!kit.location) continue;

      const match = Array.from(sel.options).find(o =>
        o.value && o.text.toLowerCase().includes(kit.location.toLowerCase())
      );
      if (match) {
        sel.value = match.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[Vantage] Lever location select filled:', match.text);
      }
    }
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

    // ── Greenhouse second pass ────────────────────────────────────────────────
    filled += fillGreenhouseDropdowns(kit);

    // ── Checkboxes ────────────────────────────────────────────────────────────
    fillCheckboxes();

    // ── Custom div-based dropdowns (Greenhouse, Lever) ────────────────────────
    await fillCustomDropdowns(kit);

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

  // ── Message listener ──────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'VANTAGE_FILL') return false;

    fillForm(message.kit)
      .then(result => sendResponse(result))
      .catch(e => sendResponse({ filled: 0, error: String(e) }));

    return true;
  });
})();
