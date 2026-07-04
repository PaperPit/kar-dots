// ============================================================
// КАР-точки — минимальный клиент Supabase (без внешних библиотек)
// Использует REST API: GoTrue (auth), PostgREST (база), Storage.
// ============================================================
(function () {
  'use strict';

  const LS_KEY = 'kar_session';

  function MiniSupabase(url, anonKey) {
    this.url = url.replace(/\/+$/, '');
    this.key = anonKey;
    this.session = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) this.session = JSON.parse(raw);
    } catch (e) { /* ignore */ }
  }

  MiniSupabase.prototype._saveSession = function (s) {
    this.session = s;
    if (s) localStorage.setItem(LS_KEY, JSON.stringify(s));
    else localStorage.removeItem(LS_KEY);
  };

  MiniSupabase.prototype._authHeaders = function () {
    const h = { apikey: this.key };
    h['Authorization'] = 'Bearer ' + (this.session ? this.session.access_token : this.key);
    return h;
  };

  // --- Auth -------------------------------------------------
  MiniSupabase.prototype.signUp = async function (email, password) {
    const r = await fetch(this.url + '/auth/v1/signup', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, { apikey: this.key }),
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw authError(data);
    // если подтверждение почты отключено, сессия приходит сразу
    if (data.access_token) { this._saveSession(withExpiry(data)); return { session: this.session, needConfirm: false }; }
    return { session: null, needConfirm: true };
  };

  MiniSupabase.prototype.signIn = async function (email, password) {
    const r = await fetch(this.url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: this.key },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw authError(data);
    this._saveSession(withExpiry(data));
    return this.session;
  };

  MiniSupabase.prototype.signOut = async function () {
    try {
      await fetch(this.url + '/auth/v1/logout', { method: 'POST', headers: this._authHeaders() });
    } catch (e) { /* offline — всё равно выходим */ }
    this._saveSession(null);
  };

  MiniSupabase.prototype.refresh = async function () {
    if (!this.session || !this.session.refresh_token) throw new Error('Нет сессии');
    const r = await fetch(this.url + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: this.key },
      body: JSON.stringify({ refresh_token: this.session.refresh_token }),
    });
    const data = await r.json();
    if (!r.ok) { this._saveSession(null); throw authError(data); }
    this._saveSession(withExpiry(data));
    return this.session;
  };

  MiniSupabase.prototype.ensureFresh = async function () {
    if (!this.session) return null;
    // обновляем за 2 минуты до истечения
    if (this.session.expires_at_ms && Date.now() > this.session.expires_at_ms - 2 * 60 * 1000) {
      try { await this.refresh(); } catch (e) { return null; }
    }
    return this.session;
  };

  MiniSupabase.prototype.userId = function () {
    return this.session && this.session.user ? this.session.user.id : null;
  };

  // --- База (PostgREST) ------------------------------------
  // select('cards', 'folder_id=eq.xxx&order=created_at')
  MiniSupabase.prototype.select = async function (table, query) {
    await this.ensureFresh();
    const r = await fetch(this.url + '/rest/v1/' + table + (query ? '?' + query : ''), {
      headers: this._authHeaders(),
    });
    return handle(r);
  };

  MiniSupabase.prototype.insert = async function (table, row) {
    await this.ensureFresh();
    const r = await fetch(this.url + '/rest/v1/' + table, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=representation' }, this._authHeaders()),
      body: JSON.stringify(row),
    });
    const rows = await handle(r);
    return Array.isArray(rows) ? rows[0] : rows;
  };

  MiniSupabase.prototype.upsert = async function (table, row) {
    await this.ensureFresh();
    const r = await fetch(this.url + '/rest/v1/' + table, {
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        Prefer: 'return=representation,resolution=merge-duplicates',
      }, this._authHeaders()),
      body: JSON.stringify(row),
    });
    const rows = await handle(r);
    return Array.isArray(rows) ? rows[0] : rows;
  };

  MiniSupabase.prototype.update = async function (table, filter, patch) {
    await this.ensureFresh();
    const r = await fetch(this.url + '/rest/v1/' + table + '?' + filter, {
      method: 'PATCH',
      headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=representation' }, this._authHeaders()),
      body: JSON.stringify(patch),
    });
    return handle(r);
  };

  MiniSupabase.prototype.remove = async function (table, filter) {
    await this.ensureFresh();
    const r = await fetch(this.url + '/rest/v1/' + table + '?' + filter, {
      method: 'DELETE',
      headers: this._authHeaders(),
    });
    if (!r.ok) return handle(r);
    return true;
  };

  // --- Storage ----------------------------------------------
  MiniSupabase.prototype.uploadFile = async function (bucket, path, blob, contentType) {
    await this.ensureFresh();
    const r = await fetch(this.url + '/storage/v1/object/' + bucket + '/' + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': contentType || 'application/octet-stream', 'x-upsert': 'true' }, this._authHeaders()),
      body: blob,
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.message || data.error || 'Не удалось загрузить файл (' + r.status + ')');
    }
    return this.url + '/storage/v1/object/public/' + bucket + '/' + path;
  };

  MiniSupabase.prototype.deleteFile = async function (bucket, path) {
    await this.ensureFresh();
    try {
      await fetch(this.url + '/storage/v1/object/' + bucket + '/' + path, {
        method: 'DELETE',
        headers: this._authHeaders(),
      });
    } catch (e) { /* некритично */ }
  };

  // --- helpers ----------------------------------------------
  async function handle(r) {
    if (r.ok) {
      if (r.status === 204) return true;
      return r.json();
    }
    const data = await r.json().catch(() => ({}));
    const msg = data.message || data.error_description || data.error || ('Ошибка запроса (' + r.status + ')');
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }

  function withExpiry(data) {
    data.expires_at_ms = Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600 * 1000);
    return data;
  }

  function authError(data) {
    let msg = data.msg || data.error_description || data.message || data.error || 'Ошибка авторизации';
    const map = {
      'Invalid login credentials': 'Неверная почта или пароль',
      'User already registered': 'Такой пользователь уже зарегистрирован',
      'Email not confirmed': 'Почта не подтверждена — проверьте ящик',
      'Password should be at least 6 characters': 'Пароль должен быть не короче 6 символов',
      'Signup requires a valid password': 'Введите корректный пароль',
      'Unable to validate email address: invalid format': 'Некорректный адрес почты',
    };
    return new Error(map[msg] || msg);
  }

  window.MiniSupabase = MiniSupabase;
})();
