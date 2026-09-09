/**
 * POST /api/student/buy-item — 商店购买原子操作
 * 
 * 调用 Supabase RPC 函数 buy_item，在一个事务内完成：
 * 1. 锁定学生行（FOR UPDATE）
 * 2. 校验余额、是否已拥有
 * 3. 原子更新 coins + shop_items
 * 4. 追加操作日志（同时锁 classes 行）
 * 5. 返回最终状态
 * 
 * Body: {
 *   studentId: number,
 *   classId: number,
 *   itemId: string,
 *   price: number,
 *   studentName: string
 * }
 */
import { jsonResponse, handleOptions, checkEnv } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const { studentId, classId, itemId, price, studentName } = body;

  if (!studentId || !classId || !itemId || price === undefined) {
    return jsonResponse({ error: 'Missing required parameters' }, 400);
  }

  try {
    // 调用 Supabase RPC 函数
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
      return jsonResponse({ error: 'Server error', details: errText }, 500);
    }

    const result = await rpcRes.json();
    
    // RPC 函数返回 JSONB，直接使用
    if (result.ok === false || result.ok === 'false') {
      // 校验失败（余额不足、已拥有、学生不存在）
      return jsonResponse(result, 200);
    }

    // 成功：返回最终状态
    return jsonResponse({
      ok: true,
      coinsAfter: result.coinsAfter,
      shopItems: result.shopItems
    });

  } catch (err) {
    console.error('[buy-item] Unexpected error:', err);
    return jsonResponse({ error: 'Unexpected error', details: err.message }, 500);
  }
};
