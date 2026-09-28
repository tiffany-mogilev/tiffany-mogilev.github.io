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

  // Вау-слой: сами анимации — в base.css, здесь только разметка целей и «магнитные» кнопки.
  function initWow() {
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
    var main = document.querySelector('main');
    if (main && window.CSS && CSS.supports('animation-timeline: view()')) {
      var cta = document.querySelector('.header__cta') || document.querySelector('.btn');
      var bar = document.createElement('div');
      bar.className = 'wow-progress';
      var color = cta && getComputedStyle(cta).backgroundColor;
      if (color && color !== 'rgba(0, 0, 0, 0)') bar.style.setProperty('--wow-accent', color);
      document.body.appendChild(bar);

      // Сначала всё читаем, потом всё пишем — иначе браузер пересчитывает раскладку на каждом шаге.
      var own = function (el) { return getComputedStyle(el).animationName !== 'none'; };
      var imgs = [].filter.call(main.querySelectorAll('section:not(.hero) img'), function (img) {
        return !own(img) && getComputedStyle(img).clipPath === 'none';
      });
      // Ряд однотипных блоков (карточки, пункты, отзывы): 3–12 детей с одним тегом и первым классом.
      var groups = [];
      main.querySelectorAll('section:not(.hero) *').forEach(function (box) {
        var kids = box.children;
        if (kids.length < 3 || kids.length > 12 || box instanceof SVGElement || box.closest('form')) return;
        var sig = kids[0].tagName + ' ' + (kids[0].classList[0] || '');
        if (getComputedStyle(kids[0]).display.indexOf('inline') === 0) return;
        for (var k = 0; k < kids.length; k++) {
          if (kids[k].tagName + ' ' + (kids[k].classList[0] || '') !== sig || own(kids[k])) return;
        }
        groups.push([].map.call(kids, function (el) { return [el, el.offsetTop]; }));
      });

      imgs.forEach(function (img) { img.classList.add('wow-img'); });
      groups.forEach(function (g) {
        var i = 0;
        g.forEach(function (p, k) {
          i = k && p[1] === g[k - 1][1] ? i + 1 : 0;
          p[0].classList.add('wow-item');
          p[0].style.setProperty('--i', Math.min(i, 3));
        });
      });
    }

    // Кнопка тянется за курсором. translate, а не transform, — :hover из site.css продолжает работать.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.querySelectorAll('.btn').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.translate = ((e.clientX - r.left - r.width / 2) * .2).toFixed(1) + 'px ' +
          ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + 'px';
      });
      b.addEventListener('pointerleave', function () {
        var from = b.style.translate;
        b.style.translate = '';
        if (from && b.animate) b.animate({ translate: [from, '0px 0px'] }, { duration: 450, easing: 'cubic-bezier(.2, .7, .1, 1)' });
      });
    });
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
    initWow();
    document.dispatchEvent(new CustomEvent('site:ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
