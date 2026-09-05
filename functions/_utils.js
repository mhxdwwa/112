/**
 * 宠物世界 API — 共享工具模块
 * 
 * 被所有 functions/api/ 下的路由文件引用。
 * 包含 Supabase 操作封装、CORS 处理、通用函数。
 */

// --- CORS ---
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export function corsResponse(response) {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}

export function jsonResponse(data, status = 200) {
  return corsResponse(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

export function handleOptions() {
  return new Response(null, { headers: CORS_HEADERS });
}

// --- Supabase REST API Helper ---

function sbHeaders(env) {
  return {
    'apikey': env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

export async function sbRequest(env, method, table, { query = '', body = null } = {}) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}${query ? '?' + query : ''}`;
  const opts = { method, headers: sbHeaders(env) };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => null);
  if (!res.ok && res.status !== 406) {
    return { error: { message: `Supabase ${method} ${table} failed (${res.status})`, details: data }, data: null };
  }
  return { error: null, data };
}

export async function sbSelect(env, table, columns, filter) {
  return sbRequest(env, 'GET', table, { query: `select=${columns}&${filter}` });
}

export async function sbSelectSingle(env, table, filter) {
  return sbRequest(env, 'GET', table, { query: filter });
}

export async function sbUpdate(env, table, body, filter) {
  return sbRequest(env, 'PATCH', table, { query: filter, body });
}

export async function sbInsert(env, table, body) {
  return sbRequest(env, 'POST', table, { body });
}

export async function sbDelete(env, table, filter) {
  return sbRequest(env, 'DELETE', table, { query: filter });
}

// --- 操作日志辅助 ---
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- 环境变量检查 ---
export function checkEnv(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return jsonResponse({ error: 'Server not configured: missing SUPABASE_URL or SUPABASE_SERVICE_KEY' }, 500);
  }
  return null;
}
