/* ============================================================================
   Общий движок сайта: меню, липкая панель звонка, заявка в мессенджер,
   Яндекс.Метрика только по согласию. Без библиотек и сборки.

   Настройки — объект window.SITE в index.html:
     name       — название для текста заявки
     phone      — '+375291234567' (для звонка и SMS)
     channels   — { whatsapp: '375291234567', viber: '375291234567', telegram: 'username', sms: true }
                  Кнопки заявки берутся отсюда: чего нет в карточке бизнеса, того нет и на сайте.
     leadUrl    — адрес обработчика заявок (Telegram-бот). Пусто = заявка уходит в мессенджер.
     metrikaId  — номер счётчика Метрики. 0 = Метрика и баннер cookie выключены.
   ========================================================================== */

(function () {
  'use strict';

  /* ── Чистые функции (проверяются тестом engine-test.js) ─────────────── */

  // Текст заявки: только заполненные поля, в порядке формы.
  function buildMessage(siteName, fields) {
    var lines = ['Здравствуйте! Заявка с сайта «' + siteName + '».'];
    fields.forEach(function (f) {
      var v = String(f.value || '').trim();
      if (v) lines.push(f.label + ': ' + v);
    });
    return lines.join('\n');
  }

  function digits(s) { return String(s || '').replace(/\D/g, ''); }

  // Ссылка, которая открывает чат с готовым текстом. У Viber и Telegram
  // подстановка текста работает не везде, поэтому текст ещё и копируется.
  function channelUrl(kind, target, text) {
    var t = encodeURIComponent(text);
    switch (kind) {
      case 'whatsapp': return 'https://wa.me/' + digits(target) + '?text=' + t;
      case 'viber': return 'viber://chat?number=%2B' + digits(target) + '&draft=' + t;
      case 'telegram': return 'https://t.me/' + String(target).replace(/^@/, '') + '?text=' + t;
      case 'sms': return 'sms:+' + digits(target) + '?&body=' + t;
      default: return '';
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildMessage: buildMessage, channelUrl: channelUrl, digits: digits };
    return;
  }

  /* ── Браузер ────────────────────────────────────────────────────────── */

  var C = window.SITE || {};
  var CONSENT_KEY = 'cookie-consent';

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  function goal(name) {
    if (window.ym && C.metrikaId) window.ym(C.metrikaId, 'reachGoal', name);
  }

  function initMetrika() {
    if (!C.metrikaId || window.ym) return;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    window.ym(C.metrikaId, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }

  // Баннер показывается, только когда счётчик заведён: спрашивать согласие
  // на то, чего нет, незачем.
  function initCookies() {
    var banner = document.getElementById('cookie-banner');
    if (!banner || !C.metrikaId) return;
    var saved = store(CONSENT_KEY);
    if (saved === 'all') initMetrika();
    if (!saved) banner.hidden = false;
    banner.addEventListener('click', function (e) {
      var value = e.target.getAttribute('data-consent');
      if (!value) return;
      store(CONSENT_KEY, value);
      banner.hidden = true;
      if (value === 'all') initMetrika();
    });
  }

  function initMenu() {
    var btn = document.querySelector('[data-menu-toggle]');
    var nav = document.getElementById(btn && btn.getAttribute('aria-controls'));
    if (!btn || !nav) return;
    function set(open) {
      btn.setAttribute('aria-expanded', String(open));
      nav.setAttribute('data-open', String(open));
      document.documentElement.classList.toggle('menu-open', open);
    }
    btn.addEventListener('click', function () { set(btn.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  }

  // Шапка получает data-scrolled, когда страница прокручена: сайты сами решают, что с этим делать.
  function initHeader() {
    var h = document.querySelector('[data-header]');
    if (!h) return;
    var on = false;
    function check() {
      var now = window.scrollY > 24;
      if (now !== on) { on = now; h.setAttribute('data-scrolled', String(on)); }
    }
    window.addEventListener('scroll', check, { passive: true });
    check();
  }

  // Липкая панель нужна, только когда не видно ни кнопок первого экрана, ни формы.
  function initCallbar() {
    var bar = document.querySelector('[data-callbar]');
    var zones = document.querySelectorAll('[data-callbar-hide]');
    if (!bar) return;
    if (!zones.length || !('IntersectionObserver' in window)) { bar.setAttribute('data-show', 'true'); return; }
    var inView = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) inView.add(en.target); else inView.delete(en.target); });
      bar.setAttribute('data-show', String(inView.size === 0));
    });
    zones.forEach(function (z) { io.observe(z); });
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(function () {});
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* нечем помочь — текст всё равно в ссылке */ }
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  var NAMES = { whatsapp: 'WhatsApp', viber: 'Viber', telegram: 'Telegram', sms: 'SMS' };

  /* Заявка. Разметка формы:
     <form data-lead> … поля с data-label="Как подписать в заявке" …
       <button type="submit" data-send="whatsapp">…</button>  (кнопок может быть несколько)
       <p data-lead-status aria-live="polite"></p>
     </form>
     Поле с required проверяется браузером; телефон (type=tel) — ещё и по числу цифр. */
  function initLeadForms() {
    document.querySelectorAll('form[data-lead]').forEach(function (form) {
      var status = form.querySelector('[data-lead-status]');
      var lastSend = null;

      function say(state, msg) {
        if (!status) return;
        status.setAttribute('data-state', state);
        status.textContent = msg;
      }

      form.addEventListener('click', function (e) {
        var b = e.target.closest('[data-send]');
        if (b) lastSend = b.getAttribute('data-send');
      });

      form.addEventListener('input', function (e) { e.target.removeAttribute('aria-invalid'); });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var kind = (e.submitter && e.submitter.getAttribute('data-send')) || lastSend || 'post';

        var tel = form.querySelector('input[type=tel]');
        if (tel && (tel.required || tel.value.trim()) && digits(tel.value).length < 7) {
          tel.setAttribute('aria-invalid', 'true');
          tel.focus();
          return say('error', 'Проверьте номер телефона: в нём должно быть не меньше 7 цифр.');
        }

        var fields = [].map.call(form.querySelectorAll('[data-label]'), function (el) {
          var value = el.type === 'checkbox' ? (el.checked ? 'да' : '') : el.value;
          if (el.tagName === 'SELECT' && el.selectedIndex > -1 && el.options[el.selectedIndex].disabled) value = '';
          return { label: el.getAttribute('data-label'), value: value };
        });
        var text = buildMessage(C.name || document.title, fields);

        if (kind === 'post') return postLead(form, text, fields, say);

        var target = kind === 'sms' ? C.phone : (C.channels || {})[kind];
        var url = channelUrl(kind, target, text);
        if (!url) return say('error', 'Этот способ связи пока не подключён. Позвоните нам: ' + (C.phoneHuman || C.phone || '') + '.');

        // Открываем сразу, в том же клике: Safari блокирует окна, открытые после await.
        copy(text);
        goal('lead_' + kind);
        if (kind === 'whatsapp' || kind === 'telegram') window.open(url, '_blank', 'noopener');
        else window.location.href = url;
        say('ok', kind === 'whatsapp' || kind === 'sms'
          ? 'Открываем ' + NAMES[kind] + ': текст заявки уже в сообщении, осталось нажать «Отправить».'
          : 'Открываем ' + NAMES[kind] + '. Текст заявки скопирован: если он не появился в чате, вставьте его и отправьте.');
      });
    });
  }

  // Режим «заявка в Telegram-бот» — как у «Пралески». Включается адресом leadUrl.
  function postLead(form, text, fields, say) {
    if (!C.leadUrl) return say('error', 'Приём заявок через сайт пока не подключён. Позвоните нам: ' + (C.phoneHuman || C.phone || '') + '.');
    var btn = form.querySelector('[data-send="post"]');
    var label = btn && btn.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Отправляем…'; }
    var data = { site: C.name, text: text, page: location.href };
    fields.forEach(function (f) { data[f.label] = f.value; });
    fetch(C.leadUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { if (!r.ok) throw new Error('bad status'); form.reset(); say('ok', 'Заявка отправлена. Мы свяжемся с вами в рабочее время.'); goal('lead'); })
      .catch(function () { say('error', 'Заявка не отправилась. Позвоните нам: ' + (C.phoneHuman || C.phone || '') + '.'); })
      .finally(function () { if (btn) { btn.disabled = false; btn.textContent = label; } });
  }

  function initGoals() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var h = a.getAttribute('href');
      if (h.indexOf('tel:') === 0) goal('phone');
      else if (/wa\.me|viber:|t\.me/.test(h)) goal('messenger');
    });
  }

  function initYear() {
    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  // Если сайт открыли внутри чужого iframe — выходим из него (на GitHub Pages заголовки не выставить).
  if (window.self !== window.top) { try { window.top.location = window.self.location; } catch (e) { /* ничего */ } }

  function boot() {
    initMenu();
    initHeader();
    initCallbar();
    initLeadForms();
    initGoals();
    initCookies();
    initYear();
    document.dispatchEvent(new CustomEvent('site:ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
