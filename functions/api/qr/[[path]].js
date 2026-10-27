/**
 * 扫码登录票据接口（无尽侠客等游戏共用）
 *
 *   POST /api/qr/new  {}                    → { ok, token, expires_at }
 *   POST /api/qr/get  { token }             → { ok, status: pending|verified|expired|gone, payload? }
 *   POST /api/qr/put  { token, payload }    → { ok } / { ok:false, reason }
 *   POST /api/qr/del  { token }             → { ok }
 *
 * 为什么放在自己域名下：教室 / 校园网络访问 supabase.co 经常不通，而 wscls.cn 能打开，
 * 所以票据的读写都经这里中转，由 Cloudflare（服务器侧）去连 Supabase，手机和教室都不直连国外。
 *
 * 票据存在现有的 qr_login_tokens 表里（不新建表）：
 *   token       本接口生成的票据（wjx 前缀 + 纯字母数字，与主站 qr_ 前缀区分）
 *   email       本接口把 payload（含 access_token）序列化后存这里，带 WJX1: 标记；
 *               主站扫码是按 token 精确查询的，不会读到本接口写入的记录
 *   status      pending / verified / expired
 *   expires_at  5 分钟有效
 */
import { jsonResponse, handleOptions, checkEnv, sbRequest } from '../../_utils.js';

const TTL_MS = 5 * 60 * 1000;
/* 票据只允许字母数字：手机端是用 /[?&]qr=([A-Za-z0-9]+)/ 从网址里取票的，
   带下划线会被截断（曾经因此报「二维码无效」），所以前缀和随机段都不带符号。 */
const TOKEN_PREFIX = 'wjx';
const PAYLOAD_MARK = 'WJX1:';

function nowIso() {
  return new Date().toISOString();
}

function makeToken() {
  const rnd = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).slice(2, 18);
  return TOKEN_PREFIX + Date.now().toString(36) + rnd;
}

function encodePayload(p) {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(p || {}));
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return PAYLOAD_MARK + btoa(bin);
  } catch (e) {
    return '';
  }
}

function decodePayload(v) {
  if (!v || typeof v !== 'string' || v.indexOf(PAYLOAD_MARK) !== 0) return null;
  try {
    const bin = atob(v.slice(PAYLOAD_MARK.length));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    return null;
  }
}

async function findByToken(env, token) {
  const query = 'select=token,email,status,expires_at,verified_at&token=eq.'
    + encodeURIComponent(token) + '&limit=1';
  const r = await sbRequest(env, 'GET', 'qr_login_tokens', { query });
  if (r.error) return { err: r.error };
  return { row: (r.data && r.data[0]) || null };
}

function isExpired(row) {
  if (!row || !row.expires_at) return true;
  const t = new Date(row.expires_at).getTime();
  return !(t > Date.now());
}

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env, params }) => {
  const notReady = checkEnv(env);
  if (notReady) return notReady;

  const raw = Array.isArray(params && params.path) ? params.path.join('/') : String((params && params.path) || '');
  const action = raw.replace(/^\/+|\/+$/g, '').split('/')[0];

  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  /* ---------- 生成二维码票据 ---------- */
  if (action === 'new') {
    // 顺手清掉一小时前的旧票据，避免表无限增长；失败不影响主流程
    try {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      await sbRequest(env, 'DELETE', 'qr_login_tokens', {
        query: 'expires_at=lt.' + encodeURIComponent(cutoff) + '&token=like.' + TOKEN_PREFIX + '*'
      });
    } catch (e) { /* ignore */ }

    const tk = makeToken();
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
    const ins = await sbRequest(env, 'POST', 'qr_login_tokens', {
      body: [{ token: tk, email: '', status: 'pending', expires_at: expiresAt }]
    });
    if (ins.error) {
      return jsonResponse({ ok: false, reason: 'server', detail: ins.error.message || '' }, 500);
    }
    return jsonResponse({ ok: true, token: tk, expires_at: expiresAt });
  }

  if (!token) return jsonResponse({ ok: false, reason: 'bad_token' }, 400);
  if (token.length > 120) return jsonResponse({ ok: false, reason: 'bad_token' }, 400);

  /* ---------- 电脑端轮询 ---------- */
  if (action === 'get') {
    const { row, err } = await findByToken(env, token);
    if (err) return jsonResponse({ ok: false, reason: 'server' }, 500);
    if (!row) return jsonResponse({ ok: true, status: 'gone' });
    if (row.status === 'verified') {
      const payload = decodePayload(row.email);
      // 无尽侠客这类游戏：payload 里带着 access_token（WJX1: 编码存）
      if (payload) return jsonResponse({ ok: true, status: 'verified', payload });
      // 主站 / 班级宠物这类：只确认了「是哪个账号」，邮箱原样存在 email 里
      if (row.email) {
        return jsonResponse({
          ok: true, status: 'verified', email: row.email,
          payload: { email: row.email }
        });
      }
      return jsonResponse({ ok: true, status: 'gone' });
    }
    if (row.status === 'expired' || isExpired(row)) {
      return jsonResponse({ ok: true, status: 'expired' });
    }
    return jsonResponse({ ok: true, status: 'pending' });
  }

  /* ---------- 手机端确认 ---------- */
  if (action === 'put') {
    const payload = body.payload || null;
    // 两种用法：带 access_token（游戏扫码登录）/ 只带 email（主站账号确认）
    if (!payload || (!payload.access_token && !payload.email)) {
      return jsonResponse({ ok: false, reason: 'bad_payload' }, 400);
    }
    const { row, err } = await findByToken(env, token);
    if (err) return jsonResponse({ ok: false, reason: 'server' }, 500);
    if (!row) return jsonResponse({ ok: false, reason: 'gone' });
    if (row.status === 'verified') return jsonResponse({ ok: false, reason: 'used' });
    if (row.status === 'expired' || isExpired(row)) {
      return jsonResponse({ ok: false, reason: 'expired' });
    }
    const stored = payload.access_token ? encodePayload(payload) : String(payload.email);
    // 带 status=eq.pending 条件，避免两个手机同时确认时互相覆盖
    const upd = await sbRequest(env, 'PATCH', 'qr_login_tokens', {
      query: 'token=eq.' + encodeURIComponent(token) + '&status=eq.pending',
      body: { email: stored, status: 'verified', verified_at: nowIso() }
    });
    if (upd.error) return jsonResponse({ ok: false, reason: 'server' }, 500);
    return jsonResponse({ ok: true });
  }

  /* ---------- 电脑端用票据换登录信息（教师账号由服务端查，浏览器不直连 Supabase） ---------- */
  if (action === 'login') {
    const { row, err } = await findByToken(env, token);
    if (err) return jsonResponse({ ok: false, reason: 'server' }, 500);
    if (!row) return jsonResponse({ ok: false, reason: 'gone' });
    if (row.status !== 'verified') return jsonResponse({ ok: false, reason: 'not_verified' });
    if (isExpired(row)) return jsonResponse({ ok: false, reason: 'expired' });

    const payload = decodePayload(row.email);
    const email = (payload && payload.email) ? String(payload.email) : String(row.email || '');
    if (!email) return jsonResponse({ ok: false, reason: 'no_email' });

    const t = await sbRequest(env, 'GET', 'teachers', {
      query: 'select=id,email&email=eq.' + encodeURIComponent(email) + '&limit=1'
    });
    if (t.error) return jsonResponse({ ok: false, reason: 'server' }, 500);
    const teacher = (t.data && t.data[0]) || null;
    if (!teacher) return jsonResponse({ ok: false, reason: 'no_teacher' });

    return jsonResponse({
      ok: true,
      teacher: { id: teacher.id, name: teacher.email || email, email: teacher.email || email }
    });
  }

  /* ---------- 用完即删 ---------- */
  if (action === 'del') {
    await sbRequest(env, 'DELETE', 'qr_login_tokens', {
      query: 'token=eq.' + encodeURIComponent(token)
    });
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false, reason: 'unknown_action' }, 404);
};
