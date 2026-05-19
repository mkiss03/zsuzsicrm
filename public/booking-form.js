/**
 * ZsuzsiCRM Booking Form Integration
 * Drop-in script for utazofotos.com
 *
 * USAGE — add before </body>:
 *   <script>
 *     window.ZsuzsiCRMConfig = {
 *       apiUrl:        'https://YOUR-CRM-DOMAIN/api/booking-form',
 *       formSelector:  '#booking-form',     // CSS selector (default: auto-detect)
 *       fieldMap: {                          // override if your input names differ
 *         name:    'name',
 *         email:   'email',
 *         phone:   'phone',
 *         trip:    'trip',
 *         message: 'message',
 *       },
 *       honeypotName:    'website',          // name of the spam-trap field
 *       onSuccess:       null,               // optional callback(bookingCode)
 *       onError:         null,               // optional callback(type, detail)
 *       phoneNumber:     '+36 30 247 3323',  // shown in error message
 *     };
 *   </script>
 *   <script src="https://YOUR-CRM-DOMAIN/booking-form.js" defer></script>
 *
 * The script requires NO external libraries and is IE11-free (ES6+).
 */

(function () {
  'use strict';

  // ─── Configuration ──────────────────────────────────────────────────────────

  var cfg = Object.assign({
    apiUrl:       '',
    formSelector: null,
    fieldMap: {
      name:    ['name', 'nev', 'neve', 'full_name'],
      email:   ['email', 'e-mail', 'email_address'],
      phone:   ['phone', 'tel', 'telefon', 'phone_number'],
      trip:    ['trip', 'utazas', 'ut', 'selected_trip', 'trip_name'],
      message: ['message', 'msg', 'uzenet', 'megjegyzes', 'comment'],
    },
    honeypotName:  'website',
    phoneNumber:   '+36 30 247 3323',
    onSuccess:     null,
    onError:       null,
  }, window.ZsuzsiCRMConfig || {});

  // ─── Messages ────────────────────────────────────────────────────────────────

  var MSG = {
    success:   '✓ Foglalásod megérkezett! Hamarosan felvesszük veled a kapcsolatot.',
    error:     'Hiba történt. Kérlek hívj minket: ' + cfg.phoneNumber,
    rateLimit: 'Kérlek várj egy kicsit, majd próbáld újra.',
    required:  'Ez a mező kötelező',
    loading:   'Küldés…',
  };

  // ─── Utilities ───────────────────────────────────────────────────────────────

  /** Find an input inside a form by trying multiple possible name variants. */
  function findField(form, candidates) {
    if (typeof candidates === 'string') return form.querySelector('[name="' + candidates + '"]');
    for (var i = 0; i < candidates.length; i++) {
      var el = form.querySelector('[name="' + candidates[i] + '"]');
      if (el) return el;
    }
    return null;
  }

  /** Return the trimmed value of a form element (handles input + select + textarea). */
  function getValue(el) {
    if (!el) return '';
    return (el.value || '').trim();
  }

  /** Display an inline error under a field. */
  function showFieldError(el, message) {
    if (!el) return;
    el.classList.add('crm-field-error');

    // Remove stale error
    var existing = el.parentNode.querySelector('.crm-error-msg[data-crm]');
    if (existing) existing.remove();

    var err = document.createElement('span');
    err.className = 'crm-error-msg';
    err.setAttribute('data-crm', '1');
    err.setAttribute('role', 'alert');
    err.style.cssText = 'display:block;color:#dc2626;font-size:0.8em;margin-top:4px;';
    err.textContent = message;

    if (el.nextSibling) {
      el.parentNode.insertBefore(err, el.nextSibling);
    } else {
      el.parentNode.appendChild(err);
    }
  }

  /** Clear all field errors on a form. */
  function clearErrors(form) {
    form.querySelectorAll('.crm-field-error').forEach(function (el) {
      el.classList.remove('crm-field-error');
    });
    form.querySelectorAll('[data-crm]').forEach(function (el) {
      el.remove();
    });
  }

  /** Inject styles (idempotent). */
  function injectStyles() {
    if (document.getElementById('crm-styles')) return;
    var s = document.createElement('style');
    s.id = 'crm-styles';
    s.textContent = [
      '.crm-field-error { outline: 2px solid #dc2626 !important; border-color: #dc2626 !important; }',
      '.crm-success-box { display:flex; align-items:flex-start; gap:12px; padding:16px 20px;',
      '  background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;',
      '  color:#15803d; font-size:1rem; line-height:1.5; }',
      '.crm-success-icon { font-size:1.4em; flex-shrink:0; margin-top:1px; }',
      '.crm-alert-box { display:flex; align-items:flex-start; gap:12px; padding:12px 16px;',
      '  border-radius:6px; font-size:0.9rem; margin-top:12px; }',
      '.crm-alert-error { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; }',
      '.crm-alert-warning { background:#fffbeb; border:1px solid #fde68a; color:#92400e; }',
      '.crm-spinner { display:inline-block; width:14px; height:14px;',
      '  border:2px solid rgba(255,255,255,0.4); border-top-color:#fff;',
      '  border-radius:50%; animation:crm-spin 0.7s linear infinite; vertical-align:middle;',
      '  margin-right:6px; }',
      '@keyframes crm-spin { to { transform: rotate(360deg); } }',
      '.crm-hp { position:absolute; left:-9999px; width:1px; height:1px;',
      '  overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }',
    ].join('\n');
    document.head.appendChild(s);
  }

  /** Show a banner below the form. */
  function showBanner(form, html, variant) {
    var existing = form.parentNode.querySelector('.crm-alert-box[data-crm]');
    if (existing) existing.remove();

    var box = document.createElement('div');
    box.className = 'crm-alert-box crm-alert-' + (variant || 'error');
    box.setAttribute('data-crm', '1');
    box.setAttribute('role', 'alert');
    box.innerHTML = html;
    form.parentNode.insertBefore(box, form.nextSibling);
  }

  // ─── Honeypot insertion ───────────────────────────────────────────────────────

  function addHoneypot(form) {
    if (form.querySelector('[name="' + cfg.honeypotName + '"]')) return; // already added

    // Wrap in a visually-hidden container so assistive tech sees it as off-screen
    var wrap = document.createElement('div');
    wrap.className = 'crm-hp';
    wrap.setAttribute('aria-hidden', 'true');

    var label = document.createElement('label');
    label.htmlFor = 'crm_hp_field';
    label.textContent = 'Leave this blank';
    label.style.cssText = 'display:none;';

    var input = document.createElement('input');
    input.type = 'text';
    input.name = cfg.honeypotName;
    input.id   = 'crm_hp_field';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('tabindex',     '-1');
    input.setAttribute('aria-label',   'Do not fill this field');

    wrap.appendChild(label);
    wrap.appendChild(input);
    form.appendChild(wrap);
  }

  // ─── Form detection ───────────────────────────────────────────────────────────

  function detectForm() {
    // 1. Explicit config selector
    if (cfg.formSelector) return document.querySelector(cfg.formSelector);
    // 2. data-crm-form attribute
    var attr = document.querySelector('[data-crm-form]');
    if (attr) return attr;
    // 3. Common IDs/classes
    var selectors = ['#booking-form', '#foglalasform', '.booking-form', '.foglalasform', 'form[action*="booking"]'];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) return el;
    }
    // 4. Any form with all required field names
    var forms = document.querySelectorAll('form');
    for (var j = 0; j < forms.length; j++) {
      var fm = forms[j];
      if (findField(fm, cfg.fieldMap.email) && findField(fm, cfg.fieldMap.trip)) return fm;
    }
    return null;
  }

  // ─── Submission handler ───────────────────────────────────────────────────────

  function attachForm(form) {
    // Get API URL from config or form data attribute
    var apiUrl = cfg.apiUrl || form.dataset.crmApi || '';
    if (!apiUrl) {
      console.warn('[ZsuzsiCRM] apiUrl not configured. Set window.ZsuzsiCRMConfig.apiUrl');
      return;
    }

    injectStyles();
    addHoneypot(form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(form);

      // ── Collect fields ────────────────────────────────────────────────────
      var nameEl    = findField(form, cfg.fieldMap.name);
      var emailEl   = findField(form, cfg.fieldMap.email);
      var phoneEl   = findField(form, cfg.fieldMap.phone);
      var tripEl    = findField(form, cfg.fieldMap.trip);
      var messageEl = findField(form, cfg.fieldMap.message);
      var hpEl      = form.querySelector('[name="' + cfg.honeypotName + '"]');

      var nameVal    = getValue(nameEl);
      var emailVal   = getValue(emailEl);
      var phoneVal   = getValue(phoneEl);
      var tripVal    = getValue(tripEl);
      var messageVal = getValue(messageEl);
      var hpVal      = getValue(hpEl);

      // ── Client-side validation ────────────────────────────────────────────
      var hasError = false;
      if (!nameVal || nameVal.length < 2)  { showFieldError(nameEl,  'Legalább 2 karakter szükséges'); hasError = true; }
      if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) { showFieldError(emailEl, 'Érvényes email cím szükséges'); hasError = true; }
      if (!phoneVal || phoneVal.length < 6) { showFieldError(phoneEl, 'Érvényes telefonszám szükséges'); hasError = true; }
      if (!tripVal  || tripVal.length < 2)  { showFieldError(tripEl,  MSG.required); hasError = true; }
      if (hasError) return;

      // ── Loading state ──────────────────────────────────────────────────────
      var submitBtn  = form.querySelector('button[type="submit"], input[type="submit"]');
      var origHtml   = submitBtn ? submitBtn.innerHTML : null;
      var origDisabled = submitBtn ? submitBtn.disabled : false;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="crm-spinner"></span>' + MSG.loading;
      }

      // ── Fetch ────────────────────────────────────────────────────────────
      fetch(apiUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:     nameVal,
          email:    emailVal,
          phone:    phoneVal,
          trip:     tripVal,
          message:  messageVal,
          honeypot: hpVal,
        }),
      })
        .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
        .then(function (res) {
          if (submitBtn) {
            submitBtn.disabled = origDisabled;
            submitBtn.innerHTML = origHtml;
          }

          if (res.status === 200 && res.data.success) {
            // ── SUCCESS ────────────────────────────────────────────────────
            form.style.display = 'none';
            var box = document.createElement('div');
            box.className = 'crm-success-box';
            box.setAttribute('data-crm', '1');
            box.setAttribute('role', 'status');
            box.innerHTML = '<span class="crm-success-icon">✓</span><span>' + MSG.success + '</span>';
            form.parentNode.insertBefore(box, form);

            if (typeof cfg.onSuccess === 'function') {
              cfg.onSuccess(res.data.bookingCode || null);
            }

          } else if (res.status === 429) {
            // ── RATE LIMIT ─────────────────────────────────────────────────
            showBanner(form, '⏱ ' + MSG.rateLimit, 'warning');
            if (typeof cfg.onError === 'function') cfg.onError('rate_limit', res.data);

          } else if (res.status === 400 && res.data.errors) {
            // ── VALIDATION ERRORS ──────────────────────────────────────────
            (res.data.errors || []).forEach(function (err) {
              var fieldEl = findField(form, [err.field].concat(cfg.fieldMap[err.field] || []));
              if (fieldEl) showFieldError(fieldEl, err.message);
            });
            if (typeof cfg.onError === 'function') cfg.onError('validation', res.data.errors);

          } else {
            // ── GENERIC ERROR ──────────────────────────────────────────────
            showBanner(form, '⚠ ' + MSG.error, 'error');
            if (typeof cfg.onError === 'function') cfg.onError('server', res.data);
          }
        })
        .catch(function (networkErr) {
          // ── NETWORK ERROR ──────────────────────────────────────────────
          if (submitBtn) {
            submitBtn.disabled = origDisabled;
            submitBtn.innerHTML = origHtml;
          }
          showBanner(form, '⚠ ' + MSG.error, 'error');
          if (typeof cfg.onError === 'function') cfg.onError('network', networkErr);
        });
    });
  }

  // ─── Initialisation ───────────────────────────────────────────────────────────

  function init() {
    var form = detectForm();
    if (!form) {
      console.warn('[ZsuzsiCRM] No booking form found on this page. Set window.ZsuzsiCRMConfig.formSelector.');
      return;
    }
    attachForm(form);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
