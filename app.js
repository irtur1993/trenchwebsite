/* Trench demo store.
   Everything here runs in the browser. The bag and orders are kept in localStorage.
   No payment is taken and nothing is shipped. */
(function () {
  'use strict';

  var TAX_RATE = 0.08875; // New York City combined sales tax
  var PROMO_CODE = 'WELCOME10';
  var PROMO_RATE = 0.10;
  var MAX_QTY = 5;
  var SIZES = ['XS', 'S', 'M', 'L', 'XL'];

  var SHIPPING = {
    standard: { label: 'Standard delivery', note: 'Free, 2 to 4 business days', cost: 0 },
    sameday: { label: 'Same-day in Manhattan', note: '$25, order by 2 pm, arrives 6 to 9 pm', cost: 25 }
  };

  var PRODUCTS = [
    {
      id: 'hudson', name: 'Hudson', sub: 'The classic double-breasted trench', price: 390,
      color: 'Stone', length: '115 cm', fabric: 'Cotton gabardine', care: 'Dry clean only',
      desc: 'A double-breasted trench in stone cotton gabardine, with a belt, shoulder straps and two rows of buttons. It falls just below the knee.',
      tile: '#e9e2d4'
    },
    {
      id: 'chelsea', name: 'Chelsea', sub: 'The longest cut, in black', price: 460,
      color: 'Black', length: '120 cm', fabric: 'Wool blend', care: 'Dry clean only',
      desc: 'A wool-blend trench in black that falls well below the knee and keeps its shape all day. Belted, with a deep collar.',
      tile: '#e4e4e9'
    },
    {
      id: 'soho', name: 'Soho', sub: 'The rain coat in olive', price: 420,
      color: 'Olive', length: '118 cm', fabric: 'Water-repellent cotton twill', care: 'Dry clean only',
      desc: 'Water-repellent cotton twill in olive, with a belt and a collar that turns up against the wind. Made for wet days.',
      tile: '#e3e6d3'
    }
  ];

  /* ---------- helpers ---------- */

  var memory = {};

  function read(key, fallback) {
    try {
      var v = window.localStorage.getItem(key);
      if (v !== null) { return JSON.parse(v); }
    } catch (e) { /* storage unavailable */ }
    return key in memory ? memory[key] : fallback;
  }

  function write(key, val) {
    memory[key] = val;
    try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
  }

  function remove(key) {
    delete memory[key];
    try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  function price(n) { return '$' + n.toLocaleString('en-US'); }

  function product(id) {
    for (var i = 0; i < PRODUCTS.length; i++) { if (PRODUCTS[i].id === id) { return PRODUCTS[i]; } }
    return null;
  }

  function img(id, view) { return 'assets/products/' + id + '-' + view + '.svg'; }

  function addBusinessDays(date, n) {
    var d = new Date(date.getTime());
    while (n > 0) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) { n--; }
    }
    return d;
  }

  function fmtDate(d) {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  /* ---------- bag ---------- */

  function getBag() { return read('trench_bag', []); }

  function saveBag(bag) { write('trench_bag', bag); updateBadge(); }

  function bagCount() {
    return getBag().reduce(function (n, l) { return n + l.qty; }, 0);
  }

  function addToBag(id, size) {
    var bag = getBag();
    for (var i = 0; i < bag.length; i++) {
      if (bag[i].id === id && bag[i].size === size) {
        bag[i].qty = Math.min(MAX_QTY, bag[i].qty + 1);
        saveBag(bag);
        return;
      }
    }
    bag.push({ id: id, size: size, qty: 1 });
    saveBag(bag);
  }

  function setQty(id, size, qty) {
    var bag = getBag().map(function (l) {
      return (l.id === id && l.size === size) ? { id: id, size: size, qty: Math.min(MAX_QTY, qty) } : l;
    }).filter(function (l) { return l.qty > 0; });
    saveBag(bag);
  }

  function lines() {
    return getBag().map(function (l) {
      var p = product(l.id);
      return p ? { p: p, size: l.size, qty: l.qty, total: p.price * l.qty } : null;
    }).filter(Boolean);
  }

  function promoActive() { return read('trench_promo', '') === PROMO_CODE; }

  function totals(shipKey) {
    var subtotal = lines().reduce(function (n, l) { return n + l.total; }, 0);
    var discount = promoActive() ? round2(subtotal * PROMO_RATE) : 0;
    var shipping = SHIPPING[shipKey || 'standard'].cost;
    var tax = round2((subtotal - discount + shipping) * TAX_RATE);
    return {
      subtotal: subtotal, discount: discount, shipping: shipping, tax: tax,
      total: round2(subtotal - discount + shipping + tax)
    };
  }

  function summaryRows(t) {
    return '<dl class="sum-rows">' +
      '<div><dt>Subtotal</dt><dd>' + money(t.subtotal) + '</dd></div>' +
      (t.discount ? '<div><dt>Discount (' + PROMO_CODE + ')</dt><dd>-' + money(t.discount) + '</dd></div>' : '') +
      '<div><dt>Delivery</dt><dd>' + (t.shipping ? money(t.shipping) : 'Free') + '</dd></div>' +
      '<div><dt>Estimated tax</dt><dd>' + money(t.tax) + '</dd></div>' +
      '<div class="sum-total"><dt>Total</dt><dd>' + money(t.total) + '</dd></div>' +
      '</dl>';
  }

  /* ---------- shared header and footer ---------- */

  var MARK = '<svg class="mark" viewBox="0 0 24 32" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M7 3 L12 1.5 L17 3 L21 9 L23.5 31 L0.5 31 L3 9 Z"/><path d="M8.5 2.6 L12 18 L15.5 2.6"/><path d="M2.2 19.5 L21.8 19.5"/></svg>';

  var BAG_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>';

  function renderChrome() {
    var h = $('#site-header');
    if (h) {
      h.className = 'nav';
      h.innerHTML = '<div class="nav-inner">' +
        '<a class="brand" href="index.html" aria-label="Trench, home">' + MARK + '<span>Trench</span></a>' +
        '<nav class="nav-links" aria-label="Main">' +
        '<a href="index.html#coats">Coats</a><a href="index.html#details">Details</a><a href="index.html#delivery">Delivery</a></nav>' +
        '<a class="bag" href="cart.html" data-bag-link>' + BAG_ICON + '<span class="bag-count" data-bag-count hidden>0</span></a>' +
        '</div>';
    }
    var f = $('#site-footer');
    if (f) {
      f.className = 'footer';
      f.innerHTML = '<p>Trench, New York.</p>' +
        '<p>Demo store: no payment is taken and nothing is shipped.</p>';
    }
    updateBadge();
  }

  function updateBadge() {
    var n = bagCount();
    $$('[data-bag-count]').forEach(function (el) {
      el.textContent = n;
      el.hidden = n === 0;
    });
    $$('[data-bag-link]').forEach(function (el) {
      el.setAttribute('aria-label', n ? 'Bag, ' + n + (n === 1 ? ' item' : ' items') : 'Bag, empty');
    });
  }

  /* ---------- home ---------- */

  function initHome() {
    var root = $('#cards');
    if (!root) { return; }
    root.innerHTML = PRODUCTS.map(function (p) {
      var href = 'product.html?id=' + p.id;
      return '<article class="card">' +
        '<a class="card-media" href="' + href + '" style="background:' + p.tile + '" aria-label="View ' + esc(p.name) + '">' +
        '<img src="' + img(p.id, 'front') + '" alt="' + esc(p.name) + ' trench coat, front view" width="600" height="800" loading="lazy"></a>' +
        '<div class="card-body"><h3><a href="' + href + '">' + esc(p.name) + '</a></h3>' +
        '<p class="card-sub">' + esc(p.sub) + '</p>' +
        '<p class="card-text">' + esc(p.desc) + '</p>' +
        '<div class="card-foot"><a class="btn btn-price" href="' + href + '" aria-label="View ' + esc(p.name) + ', ' + price(p.price) + '">' + price(p.price) + '</a>' +
        '<span class="muted">Free delivery</span></div></div></article>';
    }).join('');
  }

  /* ---------- product page ---------- */

  function initProduct() {
    var root = $('#product-root');
    var id = new URLSearchParams(window.location.search).get('id');
    var p = product(id);
    if (!p) {
      root.innerHTML = '<div class="empty"><h1>We couldn\'t find that coat</h1><p>It may have been removed.</p><a class="btn" href="index.html#coats">See all coats</a></div>';
      return;
    }
    document.title = p.name + ' — Trench';

    var views = [['front', 'front view'], ['back', 'back view'], ['detail', 'close-up of buttons and belt']];
    root.innerHTML =
      '<div class="pdp">' +
      '<div class="gallery"><div class="gallery-main" style="background:' + p.tile + '">' +
      '<img id="main-img" src="' + img(p.id, 'front') + '" alt="' + esc(p.name) + ' trench coat, front view" width="600" height="800"></div>' +
      '<div class="thumbs" role="group" aria-label="Product views">' +
      views.map(function (v, i) {
        return '<button type="button" class="thumb" style="background:' + p.tile + '" data-view="' + v[0] + '" data-alt="' + esc(p.name) + ' trench coat, ' + v[1] + '" aria-pressed="' + (i === 0) + '" aria-label="Show ' + v[1] + '">' +
          '<img src="' + img(p.id, v[0]) + '" alt="" width="600" height="800"></button>';
      }).join('') + '</div></div>' +
      '<div class="pdp-info">' +
      '<h1>' + esc(p.name) + '</h1>' +
      '<p class="pdp-sub">' + esc(p.sub) + '</p>' +
      '<p class="pdp-price">' + price(p.price) + '</p>' +
      '<p class="pdp-desc">' + esc(p.desc) + '</p>' +
      '<fieldset class="sizes"><legend>Size</legend><div class="size-row">' +
      SIZES.map(function (s) {
        return '<input type="radio" name="size" id="size-' + s + '" value="' + s + '"><label for="size-' + s + '">' + s + '</label>';
      }).join('') + '</div></fieldset>' +
      '<p class="field-error" id="size-error" role="alert" hidden>Select a size.</p>' +
      '<button type="button" class="btn btn-block" id="add-btn">Add to bag</button>' +
      '<p class="pdp-status" id="pdp-status" role="status"></p>' +
      '<ul class="pdp-points"><li>Free delivery in Manhattan, Brooklyn and Queens</li><li>Return within 14 days</li></ul>' +
      '<dl class="facts compact">' +
      '<div><dt>Colour</dt><dd>' + esc(p.color) + '</dd></div>' +
      '<div><dt>Length</dt><dd>' + esc(p.length) + '</dd></div>' +
      '<div><dt>Fabric</dt><dd>' + esc(p.fabric) + '</dd></div>' +
      '<div><dt>Fit</dt><dd>Relaxed, with room for a sweater</dd></div>' +
      '<div><dt>Care</dt><dd>' + esc(p.care) + '</dd></div></dl>' +
      '</div></div>';

    var main = $('#main-img');
    $$('.thumb', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        main.src = img(p.id, btn.getAttribute('data-view'));
        main.alt = btn.getAttribute('data-alt');
        $$('.thumb', root).forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      });
    });

    var err = $('#size-error');
    var status = $('#pdp-status');
    $$('input[name="size"]', root).forEach(function (r) {
      r.addEventListener('change', function () { err.hidden = true; });
    });

    $('#add-btn').addEventListener('click', function () {
      var chosen = $('input[name="size"]:checked', root);
      if (!chosen) {
        err.hidden = false;
        $('#size-XS').focus();
        return;
      }
      addToBag(p.id, chosen.value);
      status.innerHTML = 'Added ' + esc(p.name) + ', size ' + esc(chosen.value) + ', to your bag. <a href="cart.html">View bag</a>';
    });
  }

  /* ---------- bag page ---------- */

  function initCart() {
    var root = $('#cart-root');

    function itemHtml(l) {
      var label = esc(l.p.name) + ', size ' + esc(l.size);
      return '<li class="cart-item" data-id="' + l.p.id + '" data-size="' + l.size + '">' +
        '<a class="cart-img" href="product.html?id=' + l.p.id + '" style="background:' + l.p.tile + '"><img src="' + img(l.p.id, 'front') + '" alt="' + esc(l.p.name) + ' trench coat" width="600" height="800"></a>' +
        '<div class="cart-info"><a class="cart-name" href="product.html?id=' + l.p.id + '">' + esc(l.p.name) + '</a>' +
        '<p class="muted">Size ' + esc(l.size) + ', ' + esc(l.p.color) + '</p>' +
        '<div class="qty"><button type="button" data-act="dec" aria-label="Decrease quantity of ' + label + '">&minus;</button>' +
        '<span aria-label="Quantity">' + l.qty + '</span>' +
        '<button type="button" data-act="inc" aria-label="Increase quantity of ' + label + '"' + (l.qty >= MAX_QTY ? ' disabled' : '') + '>+</button></div>' +
        '<button type="button" class="text-btn" data-act="remove" aria-label="Remove ' + label + '">Remove</button></div>' +
        '<p class="cart-price">' + money(l.total) + '</p></li>';
    }

    function render(msg) {
      var ls = lines();
      if (!ls.length) {
        root.innerHTML = '<div class="empty"><h2>Your bag is empty</h2><p>Add a coat to start your order.</p><a class="btn" href="index.html#coats">Shop coats</a></div>';
        return;
      }
      root.innerHTML = '<div class="cart-layout"><ul class="cart-list">' + ls.map(itemHtml).join('') + '</ul>' +
        '<aside class="summary" aria-label="Order summary"><h2>Summary</h2>' + summaryRows(totals('standard')) +
        '<form class="promo" id="promo-form" novalidate><label for="promo">Promo code</label>' +
        '<div class="promo-row"><input id="promo" name="promo" type="text" autocomplete="off" autocapitalize="characters" value="' + (promoActive() ? PROMO_CODE : '') + '">' +
        '<button type="submit" class="btn btn-light">Apply</button></div>' +
        '<p class="promo-msg' + (msg && msg.error ? ' is-error' : '') + '" id="promo-msg" role="status">' + (msg ? esc(msg.text) : (promoActive() ? PROMO_CODE + ' applied: 10% off.' : 'Demo code: ' + PROMO_CODE)) + '</p></form>' +
        '<a class="btn btn-block" href="checkout.html">Check out</a>' +
        '<p class="muted center">Delivery is free in Manhattan, Brooklyn and Queens.</p></aside></div>';
    }

    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) { return; }
      var li = btn.closest('.cart-item');
      var id = li.getAttribute('data-id');
      var size = li.getAttribute('data-size');
      var cur = getBag().filter(function (l) { return l.id === id && l.size === size; })[0];
      if (!cur) { return; }
      var act = btn.getAttribute('data-act');
      if (act === 'inc') { setQty(id, size, cur.qty + 1); }
      if (act === 'dec') { setQty(id, size, cur.qty - 1); }
      if (act === 'remove') { setQty(id, size, 0); }
      render();
    });

    root.addEventListener('submit', function (e) {
      if (e.target.id !== 'promo-form') { return; }
      e.preventDefault();
      var code = $('#promo').value.trim().toUpperCase();
      if (!code) {
        remove('trench_promo');
        render({ text: 'Enter a code.', error: true });
      } else if (code === PROMO_CODE) {
        write('trench_promo', PROMO_CODE);
        render({ text: PROMO_CODE + ' applied: 10% off.' });
      } else {
        remove('trench_promo');
        render({ text: 'That code isn\'t valid.', error: true });
      }
    });

    render();
  }

  /* ---------- checkout ---------- */

  function luhn(num) {
    var sum = 0, alt = false;
    for (var i = num.length - 1; i >= 0; i--) {
      var n = parseInt(num.charAt(i), 10);
      if (alt) { n *= 2; if (n > 9) { n -= 9; } }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  function field(id, label, opts) {
    opts = opts || {};
    var attrs = ' id="' + id + '" name="' + id + '"' +
      (opts.type ? ' type="' + opts.type + '"' : ' type="text"') +
      (opts.auto ? ' autocomplete="' + opts.auto + '"' : '') +
      (opts.mode ? ' inputmode="' + opts.mode + '"' : '') +
      (opts.max ? ' maxlength="' + opts.max + '"' : '') +
      (opts.placeholder ? ' placeholder="' + opts.placeholder + '"' : '') +
      ' aria-describedby="e-' + id + '"';
    return '<div class="field' + (opts.cls ? ' ' + opts.cls : '') + '"><label for="' + id + '">' + label + '</label>' +
      '<input' + attrs + '><p class="field-error" id="e-' + id + '" hidden></p></div>';
  }

  var DEMO = {
    email: 'alex.morgan@example.com', first: 'Alex', last: 'Morgan',
    address: '245 West 29th Street', apt: 'Apt 4B', city: 'New York', zip: '10001', phone: '(212) 555-0142',
    cardname: 'Alex Morgan', cardnum: '4242 4242 4242 4242', exp: '12 / 30', cvc: '123'
  };

  function initCheckout() {
    var root = $('#checkout-root');
    if (!lines().length) {
      root.innerHTML = '<div class="empty"><h2>Your bag is empty</h2><p>Add a coat before you check out.</p><a class="btn" href="index.html#coats">Shop coats</a></div>';
      return;
    }

    root.innerHTML =
      '<div class="demo-note" role="note"><strong>Demo checkout.</strong> No payment is taken and nothing is shipped. ' +
      '<button type="button" class="text-btn" id="fill-demo">Fill with test details</button></div>' +
      '<div class="checkout-layout">' +
      '<form id="checkout-form" novalidate>' +
      '<div class="form-error" id="form-error" role="alert" hidden></div>' +
      '<section class="block"><h2>Contact</h2>' + field('email', 'Email', { type: 'email', auto: 'email' }) + '</section>' +
      '<section class="block"><h2>Delivery address</h2><div class="grid-2">' +
      field('first', 'First name', { auto: 'given-name' }) + field('last', 'Last name', { auto: 'family-name' }) + '</div>' +
      field('address', 'Address', { auto: 'address-line1' }) +
      field('apt', 'Apartment, suite, floor (optional)', { auto: 'address-line2' }) +
      '<div class="grid-3"><div class="field"><label for="city">City</label><select id="city" name="city" autocomplete="address-level2">' +
      '<option value="New York">New York (Manhattan)</option><option value="Brooklyn">Brooklyn</option><option value="Queens">Queens</option></select></div>' +
      '<div class="field"><label for="state">State</label><select id="state" name="state" autocomplete="address-level1"><option>NY</option></select></div>' +
      field('zip', 'ZIP code', { auto: 'postal-code', mode: 'numeric', max: 5 }) + '</div>' +
      field('phone', 'Phone', { type: 'tel', auto: 'tel', mode: 'tel' }) + '</section>' +
      '<section class="block"><h2>Delivery method</h2><fieldset class="methods"><legend class="sr-only">Delivery method</legend>' +
      Object.keys(SHIPPING).map(function (k, i) {
        return '<label class="method"><input type="radio" name="ship" value="' + k + '"' + (i === 0 ? ' checked' : '') + '>' +
          '<span><strong>' + SHIPPING[k].label + '</strong><span class="muted">' + SHIPPING[k].note + '</span></span></label>';
      }).join('') + '</fieldset><p class="field-error" id="e-ship" hidden></p></section>' +
      '<section class="block"><h2>Payment</h2>' +
      field('cardname', 'Name on card', { auto: 'cc-name' }) +
      field('cardnum', 'Card number', { auto: 'cc-number', mode: 'numeric', max: 23, placeholder: '1234 1234 1234 1234' }) +
      '<div class="grid-2">' + field('exp', 'Expiry (MM / YY)', { auto: 'cc-exp', mode: 'numeric', max: 7, placeholder: 'MM / YY' }) +
      field('cvc', 'Security code', { auto: 'cc-csc', mode: 'numeric', max: 4 }) + '</div>' +
      '<p class="muted">Test card: 4242 4242 4242 4242, any future date, any 3 digits. Use 4000 0000 0000 0002 to see a declined card.</p></section>' +
      '<button type="submit" class="btn btn-block" id="place">Place order</button>' +
      '<p class="muted center"><a href="cart.html">Back to bag</a></p>' +
      '</form>' +
      '<aside class="summary" aria-label="Order summary"><h2>Your order</h2><ul class="mini-list" id="mini"></ul><div id="sum"></div></aside></div>';

    var form = $('#checkout-form');

    function shipKey() { return $('input[name="ship"]:checked', form).value; }

    function renderSummary() {
      $('#mini').innerHTML = lines().map(function (l) {
        return '<li><span class="mini-img" style="background:' + l.p.tile + '"><img src="' + img(l.p.id, 'front') + '" alt="" width="600" height="800"><span class="mini-qty">' + l.qty + '</span></span>' +
          '<span class="mini-name">' + esc(l.p.name) + '<span class="muted">Size ' + esc(l.size) + '</span></span><span>' + money(l.total) + '</span></li>';
      }).join('');
      $('#sum').innerHTML = summaryRows(totals(shipKey()));
    }

    function syncShipping() {
      var sameday = $('input[name="ship"][value="sameday"]', form);
      var manhattan = $('#city').value === 'New York';
      sameday.disabled = !manhattan;
      if (!manhattan && sameday.checked) { $('input[name="ship"][value="standard"]', form).checked = true; }
      var note = sameday.parentNode.querySelector('.muted');
      note.textContent = manhattan ? SHIPPING.sameday.note : 'Only available in Manhattan';
      renderSummary();
    }

    $$('input[name="ship"]', form).forEach(function (r) { r.addEventListener('change', renderSummary); });
    $('#city').addEventListener('change', syncShipping);
    syncShipping();

    /* input formatting */
    $('#cardnum').addEventListener('input', function (e) {
      var d = e.target.value.replace(/\D/g, '').slice(0, 19);
      e.target.value = d.replace(/(.{4})/g, '$1 ').trim();
    });
    $('#exp').addEventListener('input', function (e) {
      var d = e.target.value.replace(/\D/g, '').slice(0, 4);
      e.target.value = d.length > 2 ? d.slice(0, 2) + ' / ' + d.slice(2) : d;
    });
    $('#cvc').addEventListener('input', function (e) { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
    $('#zip').addEventListener('input', function (e) { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5); });

    /* demo data */
    $('#fill-demo').addEventListener('click', function () {
      Object.keys(DEMO).forEach(function (k) {
        var el = $('#' + k, form);
        if (el) { el.value = DEMO[k]; }
      });
      $$('.field-error', form).forEach(function (el) { el.hidden = true; });
      $$('[aria-invalid]', form).forEach(function (el) { el.removeAttribute('aria-invalid'); });
      $('#form-error').hidden = true;
      syncShipping();
    });

    function setError(id, msg) {
      var input = $('#' + id, form);
      var out = $('#e-' + id, form);
      if (!out) { return; }
      if (msg) {
        out.textContent = msg; out.hidden = false;
        if (input) { input.setAttribute('aria-invalid', 'true'); }
      } else {
        out.hidden = true;
        if (input) { input.removeAttribute('aria-invalid'); }
      }
    }

    function validate() {
      var v = {};
      ['email', 'first', 'last', 'address', 'apt', 'zip', 'phone', 'cardname', 'cardnum', 'exp', 'cvc'].forEach(function (k) {
        v[k] = $('#' + k, form).value.trim();
      });
      var errs = {};
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) { errs.email = 'Enter a valid email, like name@example.com.'; }
      if (!v.first) { errs.first = 'Enter your first name.'; }
      if (!v.last) { errs.last = 'Enter your last name.'; }
      if (!v.address) { errs.address = 'Enter your street address.'; }
      if (!/^\d{5}$/.test(v.zip)) { errs.zip = 'Enter a 5-digit ZIP code.'; }
      if (v.phone.replace(/\D/g, '').length < 10) { errs.phone = 'Enter a phone number with 10 digits.'; }
      if (!v.cardname) { errs.cardname = 'Enter the name on the card.'; }
      var digits = v.cardnum.replace(/\D/g, '');
      if (digits.length < 13 || !luhn(digits)) { errs.cardnum = 'Enter a valid card number.'; }
      var m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(v.exp);
      if (!m || +m[1] < 1 || +m[1] > 12) {
        errs.exp = 'Enter the expiry as MM / YY.';
      } else {
        var now = new Date();
        var expiry = new Date(2000 + (+m[2]), +m[1], 1);
        if (expiry <= new Date(now.getFullYear(), now.getMonth(), 1)) { errs.exp = 'This card has expired.'; }
      }
      if (!/^\d{3,4}$/.test(v.cvc)) { errs.cvc = 'Enter the 3 or 4 digit code.'; }
      return { v: v, errs: errs, digits: digits };
    }

    var ORDER = ['email', 'first', 'last', 'address', 'zip', 'phone', 'cardname', 'cardnum', 'exp', 'cvc'];

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var formError = $('#form-error');
      formError.hidden = true;
      var r = validate();
      ORDER.forEach(function (k) { setError(k, r.errs[k]); });
      var first = ORDER.filter(function (k) { return r.errs[k]; })[0];
      if (first) { $('#' + first, form).focus(); return; }

      var btn = $('#place');
      btn.disabled = true;
      btn.textContent = 'Placing order…';

      window.setTimeout(function () {
        if (r.digits === '4000000000000002') {
          btn.disabled = false;
          btn.textContent = 'Place order';
          formError.textContent = 'Your card was declined. Try a different card.';
          formError.hidden = false;
          formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
          $('#cardnum').focus();
          return;
        }
        var key = shipKey();
        var t = totals(key);
        var eta = key === 'sameday'
          ? (new Date().getHours() < 14 ? 'Today, 6 to 9 pm' : 'Tomorrow, 6 to 9 pm')
          : fmtDate(addBusinessDays(new Date(), 2)) + ' to ' + fmtDate(addBusinessDays(new Date(), 4));
        var order = {
          id: 'TR-' + (10000 + Math.floor(Math.random() * 89999)),
          placed: new Date().toISOString(),
          email: r.v.email,
          name: r.v.first + ' ' + r.v.last,
          address: r.v.address + (r.v.apt ? ', ' + r.v.apt : ''),
          city: $('#city').value, state: 'NY', zip: r.v.zip, phone: r.v.phone,
          method: SHIPPING[key].label, eta: eta,
          card: r.digits.slice(-4),
          items: lines().map(function (l) { return { id: l.p.id, name: l.p.name, size: l.size, qty: l.qty, total: l.total, color: l.p.color }; }),
          totals: t, promo: promoActive() ? PROMO_CODE : ''
        };
        var orders = read('trench_orders', []);
        orders.push(order);
        write('trench_orders', orders);
        write('trench_bag', []);
        remove('trench_promo');
        window.location.href = 'confirmation.html?order=' + encodeURIComponent(order.id);
      }, 1200);
    });
  }

  /* ---------- confirmation ---------- */

  function initConfirmation() {
    var root = $('#confirmation-root');
    var id = new URLSearchParams(window.location.search).get('order');
    var order = read('trench_orders', []).filter(function (o) { return o.id === id; })[0];
    if (!order) {
      root.innerHTML = '<div class="empty"><h1>We couldn\'t find that order</h1><p>Orders are saved in the browser you used to place them.</p><a class="btn" href="index.html#coats">Shop coats</a></div>';
      return;
    }
    document.title = 'Order ' + order.id + ' — Trench';
    root.innerHTML =
      '<div class="thanks"><div class="check" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
      '<h1>Thank you, ' + esc(order.name.split(' ')[0]) + '.</h1>' +
      '<p class="lead">Your order <strong>' + esc(order.id) + '</strong> is confirmed. We sent a confirmation to ' + esc(order.email) + '.</p>' +
      '<p class="muted">This is a demo order: no payment was taken and nothing will be shipped.</p></div>' +
      '<div class="confirm-grid">' +
      '<section class="block"><h2>Delivery</h2><p><strong>' + esc(order.method) + '</strong><br>' + esc(order.eta) + '</p>' +
      '<p class="muted">' + esc(order.name) + '<br>' + esc(order.address) + '<br>' + esc(order.city) + ', ' + order.state + ' ' + esc(order.zip) + '</p></section>' +
      '<section class="block"><h2>Payment</h2><p>Card ending in ' + esc(order.card) + '</p></section></div>' +
      '<section class="block"><h2>Items</h2><ul class="mini-list">' +
      order.items.map(function (i) {
        var p = product(i.id);
        return '<li><span class="mini-img" style="background:' + (p ? p.tile : '#eee') + '"><img src="' + img(i.id, 'front') + '" alt="" width="600" height="800"><span class="mini-qty">' + i.qty + '</span></span>' +
          '<span class="mini-name">' + esc(i.name) + '<span class="muted">Size ' + esc(i.size) + ', ' + esc(i.color) + '</span></span><span>' + money(i.total) + '</span></li>';
      }).join('') + '</ul>' + summaryRows(order.totals) + '</section>' +
      '<p class="center"><a class="btn" href="index.html#coats">Continue shopping</a></p>';
  }

  /* ---------- start ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    renderChrome();
    var page = document.body.getAttribute('data-page');
    if (page === 'home') { initHome(); }
    if (page === 'product') { initProduct(); }
    if (page === 'cart') { initCart(); }
    if (page === 'checkout') { initCheckout(); }
    if (page === 'confirmation') { initConfirmation(); }
  });
})();
