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

  window.Admin = { API, requireSession, renderBar, showMsg, escapeHtml, qs };
})();
