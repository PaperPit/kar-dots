// ============================================================
// КАР-точки — минимальный клиент Supabase (без внешних библиотек)
// ============================================================

const LS_KEY = 'kar_session';

export class MiniSupabase {
  constructor(url, anonKey) {
    this.url = url.replace(/\/+$/, '');
    this.key = anonKey;
    this.session = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) this.session = JSON.parse(raw);
    } catch (e) { /* ignore */ }
  }

  _saveSession(s) {
    this.session = s;
    if (s) localStorage.setItem(LS_KEY, JSON.stringify(s));
    else localStorage.removeItem(LS_KEY);
  }

  _authHeaders() {
    const h = { apikey: this.key };
    h['Authorization'] = 'Bearer ' + (this.session ? this.session.access_token : this.key);
    return h;
  }

  async signUp(email, password) {
    const r = await fetch(this.url + '/auth/v1/signup', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, { apikey: this.key }),
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw authError(data);
    if (data.access_token) { this._saveSession(withExpiry(data)); return { session: this.session, needConfirm: false }; }
    return { session: null, needConfirm: true };
  }

  async signIn(email, password) {
    const r = await fetch(this.url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: this.key },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw authError(data);
    this._saveSession(withExpiry(data));
    return this.session;
  }

  async signOut() {
    try {
      await fetch(this.url + '/auth/v1/logout', { method: 'POST', headers: this._authHeaders() });
    } catch (e) { /* offline */ }
    this._saveSession(null);
  }

  async refresh() {
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
  }

  async ensureFresh() {
    if (!this.session) return null;
    if (this.session.expires_at_ms && Date.now() > this.session.expires_at_ms - 2 * 60 * 1000) {
      try { await this.refresh(); } catch (e) { return null; }
    }
    return this.session;
  }

  userId() {
    return this.session && this.session.user ? this.session.user.id : null;
  }

  async select(table, query) {
    await this.ensureFresh();
    const r = await fetch(this.url + '/rest/v1/' + table + (query ? '?' + query : ''), {
      headers: this._authHeaders(),
    });
    return handle(r);
  }

  async count(table, query) {
    await this.ensureFresh();
    const r = await fetch(this.url + '/rest/v1/' + table + '?' + query, {
      method: 'HEAD',
      headers: Object.assign({ Prefer: 'count=exact' }, this._authHeaders()),
    });
    if (!r.ok) return handle(r);
    const range = r.headers.get('content-range') || '';
    const m = range.match(/\/(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  }

  async insert(table, row) {
    await this.ensureFresh();
    const r = await fetch(this.url + '/rest/v1/' + table, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, this._authHeaders()),
      body: JSON.stringify(row),
    });
    const rows = await handle(r);
    return Array.isArray(rows) ? rows[0] : rows;
  }

  async upsert(table, row) {
    await this.ensureFresh();
    const r = await fetch(this.url + '/rest/v1/' + table, {
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=merge-duplicates',
      }, this._authHeaders()),
      body: JSON.stringify(row),
    });
    const rows = await handle(r);
    return Array.isArray(rows) ? rows[0] : rows;
  }

  async update(table, filter, patch) {
    await this.ensureFresh();
    const r = await fetch(this.url + '/rest/v1/' + table + '?' + filter, {
      method: 'PATCH',
      headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, this._authHeaders()),
      body: JSON.stringify(patch),
    });
    return handle(r);
  }

  async remove(table, filter) {
    await this.ensureFresh();
    const r = await fetch(this.url + '/rest/v1/' + table + '?' + filter, {
      method: 'DELETE',
      headers: this._authHeaders(),
    });
    if (!r.ok) return handle(r);
    return true;
  }

  async uploadFile(bucket, path, blob, contentType) {
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
  }

  async deleteFile(bucket, path) {
    await this.ensureFresh();
    try {
      await fetch(this.url + '/storage/v1/object/' + bucket + '/' + path, {
        method: 'DELETE',
        headers: this._authHeaders(),
      });
    } catch (e) { /* некритично */ }
  }
}

async function handle(r) {
  if (r.ok) {
    if (r.status === 204) return true;
    const text = await r.text();
    return text ? JSON.parse(text) : true;
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

export function isNetworkError(err) {
  if (!navigator.onLine) return true;
  if (err && err.name === 'TypeError') return true;
  const msg = String(err && err.message || '');
  return /failed to fetch|network|load failed/i.test(msg);
}
