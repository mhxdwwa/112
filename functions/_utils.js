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

export async function sbRequest(env, method, table, { query = '', body = null, prefer = null } = {}) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}${query ? '?' + query : ''}`;
  const headers = sbHeaders(env);
  if (prefer) headers['Prefer'] = prefer;
  const opts = { method, headers };
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

// --- Supabase Storage 工具函数 ---

const STORAGE_BUCKET = 'homework-images';

/**
 * 从 Storage URL 中提取存储路径
 * URL 格式: {SUPABASE_URL}/storage/v1/object/public/homework-images/{path}
 * 返回: {path} 或 null
 */
export function extractStoragePath(url, supabaseUrl) {
  if (!url || typeof url !== 'string') return null;
  // 只处理 Storage URL（http/https 开头）
  if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
  
  const marker = '/storage/v1/object/public/' + STORAGE_BUCKET + '/';
  const idx = url.indexOf(marker);
  if (idx === -1) {
    // 也尝试非 public 路径
    const marker2 = '/storage/v1/object/' + STORAGE_BUCKET + '/';
    const idx2 = url.indexOf(marker2);
    if (idx2 === -1) return null;
    return url.substring(idx2 + marker2.length);
  }
  return url.substring(idx + marker.length);
}

/**
 * 从 Supabase Storage 删除单个文件
 * 返回 Promise<boolean>
 */
export async function deleteStorageFile(env, path) {
  if (!path) return false;
  try {
    const url = env.SUPABASE_URL + '/storage/v1/object/' + STORAGE_BUCKET + '/' + path;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_KEY,
      }
    });
    if (res.ok) {
      console.log('[Storage] 删除成功:', path);
      return true;
    } else {
      const errText = await res.text().catch(() => '');
      console.warn('[Storage] 删除失败:', path, res.status, errText);
      return false;
    }
  } catch (err) {
    console.warn('[Storage] 删除异常:', path, err.message);
    return false;
  }
}

/**
 * 批量删除 Storage 文件（从 URL 列表中提取路径并删除）
 * urls: 字符串数组，每个是 Storage URL 或 null
 * 返回 Promise<number> 成功删除的数量
 */
export async function deleteStorageFiles(env, urls) {
  let count = 0;
  for (const url of urls) {
    const path = extractStoragePath(url, env.SUPABASE_URL);
    if (path) {
      const ok = await deleteStorageFile(env, path);
      if (ok) count++;
    }
  }
  return count;
}
