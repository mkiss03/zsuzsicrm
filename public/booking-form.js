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
    tripsApiUrl:  null,   // auto-derived from apiUrl if not set
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
    loadTrips:     true,  // set false to disable automatic trip list loading
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

  // ─── Trip list loader ──────────────────────────────────────────────────────────

  /**
   * Fetches the public trip list from the CRM and populates the trip field.
   * - If the trip field is a <select>, options are replaced (value = trip UUID).
   * - If the trip field is a text <input>, a <datalist> is added for autocomplete.
   * In both cases a hidden <input name="trip_id"> is added to carry the UUID.
   */
  function loadTrips(form, apiBaseUrl) {
    if (!cfg.loadTrips) return;

    var tripsUrl = cfg.tripsApiUrl ||
      apiBaseUrl.replace(/\/booking-form\/?$/, '') + '/trips/public';

    var tripEl = findField(form, cfg.fieldMap.trip);
    if (!tripEl) return;

    fetch(tripsUrl, { method: 'GET' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.success || !data.trips || !data.trips.length) return;

        // ── Add hidden trip_id carrier (idempotent) ──────────────────────
        var hiddenId = form.querySelector('input[name="trip_id"]');
        if (!hiddenId) {
          hiddenId = document.createElement('input');
          hiddenId.type = 'hidden';
          hiddenId.name = 'trip_id';
          form.appendChild(hiddenId);
        }

        if (tripEl.tagName === 'SELECT') {
          // ── SELECT: replace options with real trips ────────────────────
          var hasPlaceholder = tripEl.options.length > 0 && !tripEl.options[0].value;
          var placeholderText = hasPlaceholder ? tripEl.options[0].textContent : '\u2014 V\u00e1lassz utaz\u00e1st \u2014';
          tripEl.innerHTML = '';

          var ph = document.createElement('option');
          ph.value = '';
          ph.textContent = placeholderText;
          tripEl.appendChild(ph);

          data.trips.forEach(function (trip) {
            var opt = document.createElement('option');
            opt.value = trip.id;
            var d = trip.departure_date
              ? new Date(trip.departure_date).toLocaleDateString('hu-HU', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })
              : '';
            opt.textContent = trip.name + (d ? ' \u2013 ' + d : '') +
              (trip.status === 'full' ? ' (megtelt)' : '');
            if (trip.status === 'full') opt.disabled = true;
            tripEl.appendChild(opt);
          });

          // Sync hidden trip_id on change
          tripEl.addEventListener('change', function () {
            hiddenId.value = tripEl.value;
          });

        } else {
          // ── TEXT INPUT: add datalist for autocomplete ──────────────────
          var listId = 'crm-trips-list';
          var existing = document.getElementById(listId);
          if (existing) existing.remove();

          var datalist = document.createElement('datalist');
          datalist.id = listId;

          // Store trip data on the element for ID lookup at submit time
          tripEl._crmTrips = data.trips;

          data.trips.forEach(function (trip) {
            var opt = document.createElement('option');
            var d = trip.departure_date
              ? new Date(trip.departure_date).toLocaleDateString('hu-HU', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })
              : '';
            opt.value = trip.name + (d ? ' \u2013 ' + d : '');
            opt.setAttribute('data-trip-id', trip.id);
            datalist.appendChild(opt);
          });

          document.body.appendChild(datalist);
          tripEl.setAttribute('list', listId);
        }
      })
      .catch(function () {
        // Silent fail — form works without the trip list
      });
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
    loadTrips(form, apiUrl);

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
      var tripIdEl  = form.querySelector('input[name="trip_id"]');

      var nameVal    = getValue(nameEl);
      var emailVal   = getValue(emailEl);
      var phoneVal   = getValue(phoneEl);
      var messageVal = getValue(messageEl);
      var hpVal      = getValue(hpEl);

      // ── Resolve trip name + ID ────────────────────────────────────────────
      var tripVal   = '';
      var tripIdVal = '';

      if (tripEl && tripEl.tagName === 'SELECT') {
        // Value is the UUID; get human-readable name from selected option text
        tripIdVal = getValue(tripEl);
        var selOpt = tripEl.options[tripEl.selectedIndex];
        tripVal   = selOpt && tripIdVal ? selOpt.textContent : '';
      } else {
        tripVal = getValue(tripEl);
        // Try to resolve ID from datalist-backed text input
        if (tripEl && tripEl._crmTrips) {
          var matched = tripEl._crmTrips.find(function (t) {
            var d = t.departure_date
              ? new Date(t.departure_date).toLocaleDateString('hu-HU', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })
              : '';
            var label = t.name + (d ? ' \u2013 ' + d : '');
            return label.toLowerCase() === tripVal.toLowerCase() ||
                   t.name.toLowerCase() === tripVal.toLowerCase();
          });
          if (matched) tripIdVal = matched.id;
        }
        // Fall back to hidden input value if set
        if (!tripIdVal && tripIdEl) tripIdVal = getValue(tripIdEl);
      }

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
          trip_id:  tripIdVal || undefined,
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

          } else if (res.status === 409) {
            // ── CAPACITY FULL ──────────────────────────────────────────────
            var fullMsg = (res.data && res.data.message) || 'Ez az utazás sajnos már megtelt.';
            showBanner(form, '⚠ ' + fullMsg, 'error');
            if (typeof cfg.onError === 'function') cfg.onError('capacity_full', res.data);

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
