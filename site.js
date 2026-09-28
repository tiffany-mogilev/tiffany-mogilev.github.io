/* Прайс Tiffany: вкладки по направлениям и поиск по названию услуги. */
(function () {
  'use strict';
  var list = document.getElementById('pricelist');
  var search = document.getElementById('price-search');
  var empty = document.getElementById('price-empty');
  var tabs = document.querySelectorAll('[data-tab]');
  if (!list) return;
  var tab = 'all';

  // «ё» и «е» считаем одной буквой: так ищут на телефоне.
  function norm(s) { return s.toLowerCase().replace(/ё/g, 'е').trim(); }

  function apply() {
    var q = norm(search.value);
    var shown = 0;
    list.querySelectorAll('.group').forEach(function (g) {
      var inTab = tab === 'all' || g.getAttribute('data-cat') === tab;
      var any = false;
      g.querySelectorAll('li').forEach(function (li) {
        var hit = inTab && (!q || norm(li.textContent).indexOf(q) > -1);
        li.hidden = !hit;
        if (hit) { any = true; shown++; }
      });
      g.hidden = !any;
    });
    empty.hidden = shown > 0;
  }

  function select(name) {
    tab = name;
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-tab') === name)); });
    apply();
  }

  tabs.forEach(function (t) { t.addEventListener('click', function () { select(t.getAttribute('data-tab')); }); });
  search.addEventListener('input', function () { if (search.value) select('all'); else apply(); });

  // Карточки направлений открывают нужную вкладку прайса.
  document.querySelectorAll('[data-open-tab]').forEach(function (a) {
    a.addEventListener('click', function () {
      search.value = '';
      select(a.getAttribute('data-open-tab'));
      var f = document.getElementById('f-dir');
      if (f) f.value = a.querySelector('h3').textContent;
    });
  });
})();
