/* Xavier Haughton Studios — shared admin helpers */
(function () {
  const API = {
    async request(method, url, body, isForm) {
      const opts = { method, headers: {}, credentials: 'same-origin' };
      if (body !== undefined && body !== null) {
        if (isForm) {
          opts.body = body; // FormData
        } else {
          opts.headers['Content-Type'] = 'application/json';
          opts.body = JSON.stringify(body);
        }
      }
      const res = await fetch(url, opts);
      let data = null;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        data = await res.json().catch(() => null);
      }
      if (!res.ok) {
        const msg = (data && data.error) || `Request failed (${res.status})`;
        const err = new Error(msg);
        err.status = res.status;
        throw err;
      }
      return data;
    },
    get(url) { return this.request('GET', url); },
    post(url, body) { return this.request('POST', url, body); },
    put(url, body) { return this.request('PUT', url, body); },
    del(url) { return this.request('DELETE', url); },
    upload(url, formData) { return this.request('POST', url, formData, true); },
  };

  // Ensure the current user is authenticated; redirect to login if not.
  async function requireSession() {
    try {
      const me = await API.get('/api/me');
      if (!me || !me.authenticated) {
        window.location.href = '/admin/login.html';
        return null;
      }
      return me.user;
    } catch (e) {
      window.location.href = '/admin/login.html';
      return null;
    }
  }

  // Render the shared top bar into an element with id="adminBar".
  function renderBar(active, user) {
    const el = document.getElementById('adminBar');
    if (!el) return;
    el.innerHTML =
      '<a class="brand" href="/admin/dashboard.html">Xavier Haughton Studios</a>' +
      '<div class="bar-links">' +
      '<a href="/" target="_blank" rel="noopener">View Live Site ↗</a>' +
      linkTag('/admin/dashboard.html', 'Dashboard', active) +
      linkTag('/admin/hero-form.html', 'Hero', active) +
      linkTag('/admin/exhibition-form.html', 'Exhibitions', active) +
      linkTag('/admin/acquire-form.html', 'Acquire', active) +
      linkTag('/admin/series-form.html', 'Series', active) +
      linkTag('/admin/work-form.html', 'Work', active) +
      linkTag('/admin/writing-form.html', 'Writings', active) +
      linkTag('/admin/access-control.html', 'Access', active) +
      (user ? '<span class="who">' + escapeHtml(user.username) + '</span>' : '') +
      '<button class="btn-logout" id="logoutBtn">Log out</button>' +
      '</div>';
    const lo = document.getElementById('logoutBtn');
    if (lo) lo.addEventListener('click', async () => {
      await API.post('/api/logout').catch(() => {});
      window.location.href = '/admin/login.html';
    });

    // Insert a Back button just under the bar (skip on the dashboard itself).
    if (active !== 'dashboard' && !document.getElementById('adminBackRow')) {
      const row = document.createElement('div');
      row.id = 'adminBackRow';
      row.className = 'admin-back-row';
      row.innerHTML = '<button type="button" class="btn-back" id="adminBackBtn">← Back</button>';
      el.insertAdjacentElement('afterend', row);
      const back = document.getElementById('adminBackBtn');
      back.addEventListener('click', () => {
        // Go to the previous page if we came from within the app, else dashboard.
        if (document.referrer && document.referrer.indexOf(window.location.origin) === 0
            && document.referrer !== window.location.href) {
          history.back();
        } else {
          window.location.href = '/admin/dashboard.html';
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Reusable media manager: manages an array of {type,path,order,isHero} items
  // with upload (image or video), reorder, hero selection, and removal.
  // Renders into a container element; call getItems() to read the current list.
  //
  //   const mm = Admin.createMediaManager({
  //     slotsEl, fileInput, statusEl, max: 5, hero: true,
  //     accept: 'image+video', onError: (msg)=>showMsg(msg,'error')
  //   });
  //   mm.set(existingArray); mm.getItems();
  // ---------------------------------------------------------------------------
  function createMediaManager(opts) {
    const slotsEl = opts.slotsEl;
    const fileInput = opts.fileInput;
    const statusEl = opts.statusEl || null;
    const max = opts.max || 5;
    const useHero = opts.hero !== false;
    const onError = opts.onError || function () {};
    let items = [];

    function preview(item) {
      if (item.type === 'video') {
        return '<video src="' + escapeHtml(item.path) + '" muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;"></video>' +
          '<span class="media-badge">Video</span>';
      }
      return '<img src="' + escapeHtml(item.path) + '" alt="">';
    }

    function render() {
      items.sort((a, b) => a.order - b.order);
      items.forEach((it, i) => { it.order = i + 1; });
      if (useHero && items.length && !items.some((i) => i.isHero)) items[0].isHero = true;

      let html = '';
      for (let i = 0; i < max; i++) {
        const it = items[i];
        if (it) {
          html += '<div class="img-slot">' + preview(it) +
            '<div class="reorder">' +
            (i > 0 ? '<button type="button" data-act="up" data-i="' + i + '">↑</button>' : '') +
            (i < items.length - 1 ? '<button type="button" data-act="down" data-i="' + i + '">↓</button>' : '') +
            '</div>' +
            '<div class="slot-tools">' +
            (useHero ? '<label><input type="radio" name="mm-hero" data-i="' + i + '"' + (it.isHero ? ' checked' : '') + '> Hero</label>' : '<span></span>') +
            '<button type="button" data-act="remove" data-i="' + i + '">Remove</button>' +
            '</div></div>';
        } else {
          html += '<div class="img-slot"><div class="slot-empty">Empty slot</div></div>';
        }
      }
      slotsEl.innerHTML = html;

      slotsEl.querySelectorAll('[data-act]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = parseInt(btn.dataset.i, 10);
          const act = btn.dataset.act;
          if (act === 'remove') items.splice(i, 1);
          else if (act === 'up') swap(i, i - 1);
          else if (act === 'down') swap(i, i + 1);
          if (useHero && items.length && !items.some((x) => x.isHero)) items[0].isHero = true;
          render();
        });
      });
      if (useHero) {
        slotsEl.querySelectorAll('input[name="mm-hero"]').forEach((radio) => {
          radio.addEventListener('change', () => {
            const i = parseInt(radio.dataset.i, 10);
            items.forEach((it, idx) => { it.isHero = idx === i; });
          });
        });
      }
    }

    function swap(a, b) {
      if (b < 0 || b >= items.length) return;
      const t = items[a]; items[a] = items[b]; items[b] = t;
      items.forEach((it, i) => { it.order = i + 1; });
    }

    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (items.length >= max) {
          onError('You can add at most ' + max + ' media items.');
          e.target.value = '';
          return;
        }
        if (statusEl) statusEl.textContent = 'Uploading…';
        try {
          const fd = new FormData();
          fd.append('media', file);
          const res = await API.upload('/api/upload', fd);
          items.push({
            type: res.type || 'image',
            path: res.path,
            order: items.length + 1,
            isHero: useHero && items.length === 0,
          });
          if (useHero && !items.some((i) => i.isHero)) items[0].isHero = true;
          render();
          if (statusEl) statusEl.textContent = '';
        } catch (err) {
          if (statusEl) statusEl.textContent = '';
          onError(err.message);
        }
        e.target.value = '';
      });
    }

    return {
      set(arr) {
        items = (arr || []).map((it, i) => ({
          type: it.type === 'video' ? 'video' : 'image',
          path: it.path,
          order: it.order || i + 1,
          isHero: !!it.isHero,
        }));
        render();
      },
      getItems() {
        return items.map((it, i) => ({ type: it.type || 'image', path: it.path, order: i + 1, isHero: !!it.isHero }));
      },
      render,
      count() { return items.length; },
    };
  }

  function linkTag(href, label, active) {
    const cls = active === label.toLowerCase() ? ' class="active"' : '';
    return '<a href="' + href + '"' + cls + '>' + label + '</a>';
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // Show a message in an element with id="msg".
  function showMsg(text, type) {
    const el = document.getElementById('msg');
    if (!el) return;
    el.textContent = text;
    el.className = 'msg show ' + (type || 'error');
    if (type === 'success') {
      setTimeout(() => { el.className = 'msg'; }, 4000);
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  window.Admin = { API, requireSession, renderBar, showMsg, escapeHtml, qs, createMediaManager };
})();
