/**
 * POST /api/student/buy-item — 商店购买原子操作
 * 
 * 调用 Supabase RPC 函数 buy_item，在一个事务内完成：
 * 1. 锁定学生行（FOR UPDATE）
 * 2. 校验余额、是否已拥有
 * 3. 原子更新 coins + shop_items
 * 4. 返回最终状态
 * 
 * 然后在 Cloudflare 端追加操作日志到 classes.operation_logs_json
 * （与 coins.js / coins-and-pet.js 保持一致的日志写入模式）
 * 
 * Body: {
 *   studentId: number,
 *   classId: number,
 *   itemId: string,
 *   price: number,
 *   studentName: string,
 *   itemName: string
 * }
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle, sbUpdate, genId } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { studentId, classId, itemId, price, studentName, itemName } = body;

  if (!studentId || !classId || !itemId || price === undefined) {
    return jsonResponse({ error: 'Missing required parameters' }, 400);
  }

  try {
    // 调用 Supabase RPC 函数（原子操作：锁行 → 校验 → 扣金币 + 加道具）
    const rpcUrl = `${env.SUPABASE_URL}/rest/v1/rpc/buy_item`;
    const rpcRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_student_id: studentId,
        p_class_id: classId,
        p_item_id: itemId,
        p_price: price,
        p_student_name: studentName || ''
      })
    });

    if (!rpcRes.ok) {
      const errText = await rpcRes.text().catch(() => 'RPC call failed');
      console.error('[buy-item] RPC failed:', rpcRes.status, errText);
      let userError = 'RPC调用失败';
      try {
        const errJson = JSON.parse(errText);
        userError = errJson.message || errJson.hint || errText;
      } catch(_) {
        userError = errText.slice(0, 200);
      }
      return jsonResponse({ error: 'Server error', details: userError, rpcStatus: rpcRes.status }, 500);
    }

    const result = await rpcRes.json();
    
    // v207: Supabase RPC 可能返回数组（当函数返回 SETOF 时）
    const data = Array.isArray(result) ? result[0] : result;

    if (data.ok === false || data.ok === 'false') {
      // 校验失败（余额不足、已拥有、学生不存在）
      return jsonResponse(data, 200);
    }

    // === v210: 追加操作日志到 classes.operation_logs_json ===
    // 与 coins.js / coins-and-pet.js 保持一致的日志写入模式
    var coinsAfter = data.coinsAfter !== undefined ? data.coinsAfter : null;
    var logId = null;

    if (classId) {
      var snapshot = { coinsAfter: coinsAfter };
      var log = {
        id: genId(),
        timestamp: new Date().toISOString(),
        classId: classId,
        studentId: studentId,
        studentName: studentName || '',
        actionType: '商店购买',
        details: '购买「' + (itemName || itemId) + '」',
        coinDelta: -(price || 0),
        expDelta: 0,
        petId: null,
        extra: { shopItemId: itemId },
        snapshot: snapshot,
        reverted: false,
      };

      // 读取现有日志
      var logsR = await sbSelectSingle(env, 'classes', 'id=eq.' + classId + '&select=operation_logs_json');
      var existingLogs = [];
      if (logsR.data && logsR.data.length > 0 && logsR.data[0].operation_logs_json) {
        var _raw = logsR.data[0].operation_logs_json;
        existingLogs = typeof _raw === 'string' ? JSON.parse(_raw) : (_raw || []);
      }
      existingLogs.unshift(log);
      if (existingLogs.length > 3000) existingLogs = existingLogs.slice(0, 3000);

      var logWriteR = await sbUpdate(env, 'classes', { operation_logs_json: JSON.stringify(existingLogs) }, 'id=eq.' + classId);
      if (logWriteR.error) {
        console.error('[buy-item] Failed to write log:', logWriteR.error);
        // 日志写入失败不影响购买结果，但记录警告
      } else {
        logId = log.id;
      }
    }

    // 成功：返回最终状态
    return jsonResponse({
      ok: true,
      coinsAfter: coinsAfter,
      shopItems: data.shopItems,
      logId: logId
    });

  } catch (err) {
    console.error('[buy-item] Unexpected error:', err);
    return jsonResponse({ error: err.message || 'Unexpected error' }, 500);
  }
};
