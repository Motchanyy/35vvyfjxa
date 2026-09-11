// public/widget.js — LOADER (iframe-версія) v11
(function (window, document) {

  console.log('Growth contour system');

  const scriptTag = document.currentScript;
  const SITE_ID = scriptTag && scriptTag.getAttribute('data-site-id');
  const SERVER_URL = new URL(scriptTag.src).origin;
  const APP_ORIGIN = SERVER_URL;

  if (!SITE_ID) { console.warn('[LiveChat] no data-site-id'); return; }

  let PRODUCT_CARD = false;
  let BRAND_COLOR = '#007fff';

  fetch(SERVER_URL + '/chat/config?siteId=' + encodeURIComponent(SITE_ID), { method: 'GET', credentials: 'omit' })
    .then(r => r.json())
    .then(cfg => {
      if (cfg && cfg.allowed) {
        PRODUCT_CARD = !!cfg.productCard;
        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(cfg.brandColor || '')) BRAND_COLOR = cfg.brandColor;
        initLoader();
      } else console.warn('[LiveChat] domain not allowed');
    })
    .catch(() => { });

  function initLoader() {
    const D = 16, BTN = 52;

    // ── Дочірні кнопки MFB-меню (розкриваються над MFB-кнопкою +/× при наведенні) ──
    // Це окремі канали — НЕ чат. Чат викликає ліва кнопка.
    // Кожен елемент: { label, href АБО onClick, bg, svg }. Порожній масив = без дочірніх кнопок.
    const EXTRA_BUTTONS = [
      { label: 'Подзвонити', href: 'tel:+380000000000', bg: '#4caf50',
        svg: '<svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.7 21 3 13.3 3 3.9 3 3.4 3.4 3 4 3h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .7-.2 1l-2.3 2.2z"/></svg>' },
      { label: 'Telegram', href: 'https://t.me/your_username', bg: '#29b6f6',
        svg: '<svg viewBox="0 0 24 24"><path d="M9.8 15.6 9.6 19c.4 0 .6-.2.8-.4l1.9-1.8 3.9 2.9c.7.4 1.2.2 1.4-.7l2.6-12c.2-1-.3-1.5-1-1.2L3.5 10.2c-1 .4-1 .9-.2 1.2l4.2 1.3L17 6.6c.5-.3.9-.1.6.2l-7.8 8.8z"/></svg>' },
      { label: 'Email', href: 'mailto:hello@example.com', bg: '#f4511e',
        svg: '<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>' },
    ];

    const style = document.createElement('style');
    style.textContent = `
      /* Док із двома кнопками в ряд: [чат] [MFB-тогл] */
      #lc-dock { position: fixed; right: ${D}px; bottom: ${D}px; z-index: 2147483001;
                 display: flex; align-items: flex-end; gap: 15px; }

      /* Кнопки чату та закриття (у доці, у потоці) */
      .lc-fab { position: relative; width: ${BTN}px; height: ${BTN}px; color: #fff;
                background: ${BRAND_COLOR}; border: 0; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                box-shadow: 0 0 4px rgba(0,0,0,.14), 0 4px 8px rgba(0,0,0,.28);
                transition: transform .15s ease; }
      .lc-fab:hover { transform: scale(1.06); }
      .lc-fab svg { width: 24px; height: 24px; fill: #fff; }
      #lc-close { display: none; }  /* показуємо замість кнопки чату при відкритті */

      #lc-badge { position: absolute; top: -2px; right: -2px; background: #e5342b; color: #fff;
                  min-width: 18px; height: 18px; font: 11px/18px 'Lato',sans-serif;
                  text-align: center; padding: 0 4px; display: none; }

      #lc-panel { position: fixed; bottom: ${2 * D + BTN}px; right: ${D}px;
                  width: 377px; height: 520px; max-height: calc(100vh - ${2 * D + BTN + 24}px);
                  border: 0; box-shadow: 5px 5px 25px 0 rgba(46,61,73,.2);
                  background: #fff; z-index: 99999999999;
                  opacity: 0; transform: translateY(16px);
                  visibility: hidden; pointer-events: none;
                  transition: opacity .25s ease, transform .25s ease, visibility 0s linear .25s; }
      #lc-panel.open { opacity: 1; transform: translateY(0);
                  visibility: visible; pointer-events: auto;
                  transition: opacity .25s ease, transform .25s ease, visibility 0s linear 0s; }

      #lc-panel.max { top: 0; right: 0; bottom: 0; width: 377px; height: 100%;
                      max-height: none; border-radius: 0; transform: translateX(16px); }
      #lc-panel.max.open { transform: translateX(0); }

      @media (max-width: 480px) {
        #lc-panel, #lc-panel.max { top: 0; right: 0; bottom: 0; left: 0;
          width: 100%; height: 100%; max-height: none; border-radius: 0;
          transform: translateY(16px); }
        #lc-panel.open, #lc-panel.max.open { transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);

    // ── Стилі MFB-кнопки (+/×) та її дочірніх кнопок ──
    // Наведення на .mfb-component__wrap → іконка +/× перемикається, дочірні кнопки
    // спливають угору. Зсув calc(var(--i) * -64px) — працює для будь-якої кількості.
    const styleMfb = document.createElement('style');
    styleMfb.textContent = `
      .mfb-component__wrap { position: relative; display: inline-flex; }
      .mfb-component__wrap.lc-busy { pointer-events: none; }   /* поки чат відкритий — меню не спливає */

      .mfb-component__button--main { position: relative; width: ${BTN}px; height: ${BTN}px;
        border: 0; padding: 0; margin: 0; background: ${BRAND_COLOR}; color: #fff; cursor: pointer;
        z-index: 20; display: flex; align-items: center; justify-content: center; text-decoration: none;
        box-shadow: 0 0 4px rgba(0,0,0,.14), 0 4px 8px rgba(0,0,0,.28);
        transition: transform .15s ease; }
      .mfb-component__button--main:hover { transform: scale(1.06); }

      .mfb-component__main-icon--resting, .mfb-component__main-icon--active {
        position: absolute; top: 50%; left: 50%; width: 24px; height: 24px; margin: -12px 0 0 -12px;
        fill: #fff; transition: opacity .2s ease, transform .2s ease; }
      .mfb-component__main-icon--active { opacity: 0; transform: rotate(-90deg); }
      .mfb-component__wrap:hover .mfb-component__main-icon--resting { opacity: 0; transform: rotate(90deg); }
      .mfb-component__wrap:hover .mfb-component__main-icon--active { opacity: 1; transform: rotate(0); }

      .mfb-component__list { list-style: none; margin: 0; padding: 0;
        position: absolute; left: 0; bottom: 0; width: ${BTN}px; }
      .mfb-component__list > li { position: absolute; left: 0; bottom: 0; width: ${BTN}px;
        padding: 8px 0; margin: -8px 0;                        /* зона наведення без розривів */
        opacity: 0; transform: translateY(0) scale(0);
        transition: transform .3s cubic-bezier(.4,0,.2,1), opacity .3s; }
      .mfb-component__wrap:hover .mfb-component__list > li { opacity: 1;
        transform: translateY(calc(var(--i) * -64px)) scale(1);
        transition-delay: calc(var(--i) * .04s); }

      .mfb-component__button--child { position: relative; display: flex; align-items: center;
        justify-content: center; width: ${BTN}px; height: ${BTN}px; color: #fff; border: 0;
        cursor: pointer; text-decoration: none;
        box-shadow: 0 0 4px rgba(0,0,0,.14), 0 4px 8px rgba(0,0,0,.28);
        transition: transform .15s ease; }
      .mfb-component__button--child:hover { transform: scale(1.06); }
      .mfb-component__button--child svg { width: 24px; height: 24px; fill: #fff; }
      .mfb-component__button--child[data-label]::after { content: attr(data-label);
        position: absolute; right: ${BTN + 12}px; top: 50%; transform: translateY(-50%);
        white-space: nowrap; background: rgba(0,0,0,.72); color: #fff;
        font: 12px/1 'Lato', sans-serif; padding: 6px 9px; border-radius: 4px;
        opacity: 0; transition: opacity .2s; pointer-events: none; }
      .mfb-component__wrap:hover .mfb-component__button--child[data-label]:hover::after { opacity: 1; }
    `;
    document.head.appendChild(styleMfb);

    // Кнопка виклику чату (ліва)
    const openBtn = document.createElement('button');
    openBtn.id = 'lc-open'; openBtn.className = 'lc-fab'; openBtn.setAttribute('aria-label', 'Чат');
    openBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
      <span id="lc-badge"></span>`;

    // Кнопка закриття — на місці кнопки чату при відкритті
    const closeBtn = document.createElement('button');
    closeBtn.id = 'lc-close'; closeBtn.className = 'lc-fab'; closeBtn.setAttribute('aria-label', 'Закрити');
    closeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"/></svg>`;

    // MFB-кнопка (+/×) з дочірніми кнопками (права)
    const mfbWrap = document.createElement('div');
    mfbWrap.className = 'mfb-component__wrap';
    const mainBtn = document.createElement('a');
    mainBtn.href = '#';
    mainBtn.className = 'mfb-component__button--main';
    mainBtn.setAttribute('data-mfb-toggle', 'hover');
    mainBtn.setAttribute('aria-label', 'Контакти');
    mainBtn.innerHTML = `
      <svg class="mfb-component__main-icon--resting" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
      <svg class="mfb-component__main-icon--active" viewBox="0 0 24 24"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"/></svg>`;
    mainBtn.addEventListener('click', (e) => e.preventDefault());   // це тогл меню, не перехід
    mfbWrap.appendChild(mainBtn);

    const mfbList = document.createElement('ul');
    mfbList.className = 'mfb-component__list';
    EXTRA_BUTTONS.forEach((b, i) => {
      const li = document.createElement('li');
      li.style.setProperty('--i', i + 1);                 // 1,2,3... → зсув calc(var(--i) * -64px)
      const isLink = !!b.href;
      const el = document.createElement(isLink ? 'a' : 'button');
      el.className = 'mfb-component__button--child';
      if (isLink) { el.href = b.href; el.target = '_blank'; el.rel = 'noopener'; }
      if (b.label) el.setAttribute('data-label', b.label);
      el.setAttribute('aria-label', b.label || 'Кнопка');
      el.style.background = b.bg || BRAND_COLOR;
      el.innerHTML = b.svg || '';
      if (typeof b.onClick === 'function') el.addEventListener('click', b.onClick);
      li.appendChild(el);
      mfbList.appendChild(li);
    });
    mfbWrap.appendChild(mfbList);

    // Док: дві кнопки в ряд ([чат/закрити] зліва, [MFB +/×] справа)
    const dock = document.createElement('div');
    dock.id = 'lc-dock';
    dock.appendChild(openBtn);
    dock.appendChild(closeBtn);
    dock.appendChild(mfbWrap);
    document.body.appendChild(dock);

    // iframe
    const panel = document.createElement('iframe');
    panel.id = 'lc-panel';
    panel.setAttribute('title', 'Live chat');
    panel.setAttribute('referrerpolicy', 'origin-when-cross-origin');
    panel.setAttribute('allow', 'autoplay');
    panel.src = SERVER_URL + '/chat/frame.html?siteId=' + encodeURIComponent(SITE_ID)
      + '&page=' + encodeURIComponent(location.href);
    document.body.appendChild(panel);

    const badge = document.getElementById('lc-badge');
    let isOpen = false, maximized = false;

    function post(type) { if (panel.contentWindow) panel.contentWindow.postMessage({ type }, APP_ORIGIN); }
    function setBadge(n) {
      if (n > 0) { badge.textContent = n > 99 ? '99+' : String(n); badge.style.display = 'block'; }
      else { badge.style.display = 'none'; }
    }
    function showOpen() { openBtn.style.display = 'flex'; closeBtn.style.display = 'none'; }
    function showClose() { openBtn.style.display = 'none'; closeBtn.style.display = 'flex'; }

    function open() {
      panel.classList.add('open'); isOpen = true; setBadge(0); post('lc:open');
      showClose();
      mfbWrap.classList.add('lc-busy');        // поки чат відкритий — MFB-меню не спливає
    }

    function close() {
      panel.classList.remove('open'); isOpen = false; post('lc:close');
      showOpen();
      mfbWrap.classList.remove('lc-busy');      // чат закрито — меню знову активне
      // .max знімаємо ПІСЛЯ анімації зникнення, щоб не було стрибка розміру
      if (maximized) {
        maximized = false;
        setTimeout(() => { if (!isOpen) panel.classList.remove('max'); }, 260);
      }
    }

    function maximize() { panel.classList.add('max'); maximized = true; post('lc:maximized'); }
    function restore() { panel.classList.remove('max'); maximized = false; post('lc:restored'); }

    openBtn.onclick = open;
    closeBtn.onclick = close;

    // при першій взаємодії зі сторінкою будимо аудіо в iframe
    function wakeAudio() {
      if (panel.contentWindow) panel.contentWindow.postMessage({ type: 'lc:wake-audio' }, APP_ORIGIN);
    }
    ['click', 'keydown', 'touchstart'].forEach(ev =>
      document.addEventListener(ev, wakeAudio, { once: true })
    );

    // ─── Картка товару (JSON-LD) ───
    function pickProductNode(json) {
      // json може бути обʼєктом, масивом або мати @graph — шукаємо перший Product
      const nodes = [];
      const push = (x) => { if (x && typeof x === 'object') nodes.push(x); };
      if (Array.isArray(json)) json.forEach(push);
      else { push(json); if (Array.isArray(json['@graph'])) json['@graph'].forEach(push); }
      return nodes.find(n => {
        const t = n['@type'];
        return t === 'Product' || (Array.isArray(t) && t.includes('Product'));
      }) || null;
    }

    function normAvailability(a) {
      const s = String(a || '').toLowerCase();
      if (s.includes('instock') || s.includes('in_stock')) return 'in';
      if (s.includes('outofstock') || s.includes('soldout')) return 'out';
      if (s.includes('preorder')) return 'preorder';
      if (s.includes('backorder')) return 'backorder';
      return '';
    }

    function firstImage(img) {
      if (!img) return '';
      if (typeof img === 'string') return img;
      if (Array.isArray(img)) {
        const f = img[0];
        return typeof f === 'string' ? f : (f && f.url) || '';
      }
      if (typeof img === 'object') return img.url || '';
      return '';
    }

    // Повноекранний перегляд фото — малюємо в сторінці-господарі (поза iframe)
    let lightboxEl = null;
    function openLightbox(url) {
      if (!url) return;
      if (!lightboxEl) {
        lightboxEl = document.createElement('div');
        lightboxEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);' +
          'display:flex;align-items:center;justify-content:center;z-index:2147483647;cursor:zoom-out';
        const img = document.createElement('img');
        img.style.cssText = 'max-width:92%;max-height:92%;border-radius:4px;box-shadow:0 10px 40px rgba(0,0,0,.5)';
        lightboxEl.appendChild(img);
        lightboxEl.addEventListener('click', () => { lightboxEl.style.display = 'none'; });
        document.body.appendChild(lightboxEl);
      }
      lightboxEl.querySelector('img').src = url;
      lightboxEl.style.display = 'flex';
    }

    // закриття по Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightboxEl && lightboxEl.style.display === 'flex') {
        lightboxEl.style.display = 'none';
      }
    });

    function readProduct() {
      try {
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        let node = null;
        for (const s of scripts) {
          let json;
          try { json = JSON.parse(s.textContent); } catch (e) { continue; }
          node = pickProductNode(json);
          if (node) break;
        }
        if (!node) return null;

        // offers буває обʼєктом або масивом
        let offer = node.offers;
        if (Array.isArray(offer)) offer = offer[0] || {};
        offer = offer || {};

        const brand = node.brand && (typeof node.brand === 'string' ? node.brand : node.brand.name);

        const product = {
          name: node.name || '',
          url: offer.url || node.url || location.href,
          sku: node.sku || node.mpn || node.productID || '',
          image: firstImage(node.image),
          price: (offer.price != null ? String(offer.price) : ''),
          currency: offer.priceCurrency || '',
          availability: normAvailability(offer.availability),
          inventory: (offer.inventoryLevel != null ? String(offer.inventoryLevel) : ''),
          brand: brand || '',
        };
        // якщо немає навіть назви — вважаємо, що товару нема
        if (!product.name) return null;
        return product;
      } catch (e) { return null; }
    }

    let lastProductKey = '';
    function sendProduct() {
      if (!PRODUCT_CARD) return;
      const p = readProduct();
      const key = p ? (p.url + '|' + p.sku + '|' + p.price) : '';
      if (key === lastProductKey) return;   // нічого не змінилось — не шлемо повторно
      lastProductKey = key;
      if (panel.contentWindow) {
        panel.contentWindow.postMessage({ type: 'lc:product', product: p }, APP_ORIGIN);
      }
    }

    window.addEventListener('message', (e) => {
      if (e.origin !== APP_ORIGIN) return;
      if (e.source !== panel.contentWindow) return;
      const d = e.data || {};
      if (d.type === 'lc:unread') { if (!isOpen) setBadge(d.count | 0); }
      else if (d.type === 'lc:ready') {
        if (isOpen) post('lc:open');
        // повідомляємо iframe реальний тип пристрою (за шириною ВІКНА, не iframe)
        if (panel.contentWindow) panel.contentWindow.postMessage({ type: 'lc:device', mobile: window.matchMedia('(max-width: 768px)').matches }, APP_ORIGIN);
        sendProduct();
      }
      else if (d.type === 'lc:request-open') { if (!isOpen) open(); }
      else if (d.type === 'lc:request-close') { close(); }
      else if (d.type === 'lc:request-maximize') { maximize(); }
      else if (d.type === 'lc:request-restore') { restore(); }
      else if (d.type === 'lc:lightbox') { openLightbox(d.url); }
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) close(); });

    // Перше читання (даємо сторінці домалювати JSON-LD) + реакція на SPA-навігацію
    setTimeout(sendProduct, 1500);

    (function watchUrl() {
      let lastHref = location.href;
      const check = () => {
        if (location.href !== lastHref) {
          lastHref = location.href;
          lastProductKey = '';            // URL змінився — дозволяємо надіслати новий товар
          setTimeout(sendProduct, 800);   // чекаємо, поки SPA підставить нову розмітку
        }
      };
      // перехоплюємо pushState/replaceState + popstate
      ['pushState', 'replaceState'].forEach(fn => {
        const orig = history[fn];
        history[fn] = function () { const r = orig.apply(this, arguments); check(); return r; };
      });
      window.addEventListener('popstate', check);
    })();
  }

})(window, document);
