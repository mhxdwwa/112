/**
 * POST /api/xq/logs — 学勤管家操作日志
 * 
 * Actions:
 * - get: 获取操作日志
 * 
 * 权限控制:
 * - 所有老师可以读取日志
 */
import { jsonResponse, handleOptions, checkEnv, sbSelect } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { action, limit, startDate, endDate } = body;

  // ===== GET: 获取日志 =====
  if (action === 'get') {
    const filters = [];
    
    if (startDate) filters.push(`created_at=gte.${startDate}`);
    if (endDate) filters.push(`created_at=lte.${endDate}T23:59:59`);
    
    let filter = filters.join('&');
    if (!filter) filter = '';
    filter += `&limit=${limit || 100}`;
    filter += '&order=created_at.desc';
    
    const result = await sbSelect(
      env,
      'xq_operation_logs',
      'id,teacher_id,teacher_name,action_type,target_class,details,record_count,created_at',
      filter
    );
    
    if (result.error) {
      return jsonResponse({ error: 'Failed to fetch logs', details: result.error }, 500);
    }
    
    return jsonResponse({ ok: true, logs: result.data || [] });
  }

  return jsonResponse({ error: 'Invalid action' }, 400);
};
