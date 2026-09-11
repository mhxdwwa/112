/**
 * POST /api/student/buy-item — 商店购买操作
 * 
 * 使用直接 REST API 调用（不依赖 Supabase RPC 函数）：
 * 1. 读取学生当前数据（coins, shop_items, equipped_items）
 * 2. 校验余额、是否已拥有
 * 3. 更新 coins + shop_items + equipped_items
 * 4. 追加操作日志到 operation_logs 表
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
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle, sbUpdate, sbRequest, genId } from '../../_utils.js';

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
    const sid = parseInt(studentId);
    const cid = parseInt(classId);
    const p = parseInt(price);

    // 1. 读取学生当前数据
    const stuR = await sbSelectSingle(
      env, 'students',
      `id=eq.${sid}&select=id,coins,shop_items,equipped_items`
    );
    if (stuR.error || !stuR.data || stuR.data.length === 0) {
      console.error('[buy-item] Student not found:', sid, stuR.error);
      return jsonResponse({ ok: false, error: 'Student not found' });
    }

    const stu = stuR.data[0];
    const currentCoins = stu.coins || 0;

    // 2. 解析 shop_items
    let shopItems = [];
    if (stu.shop_items) {
      if (typeof stu.shop_items === 'string') {
        try { shopItems = JSON.parse(stu.shop_items); } catch(_) { shopItems = []; }
      } else if (Array.isArray(stu.shop_items)) {
        shopItems = stu.shop_items;
      }
    }

    // 3. 校验：余额
    if (currentCoins < p) {
      return jsonResponse({
        ok: false,
        error: 'Insufficient balance',
        currentCoins: currentCoins,
        required: p
      });
    }

    // 4. 校验：已拥有
    if (shopItems.indexOf(itemId) !== -1) {
      return jsonResponse({ ok: false, error: 'Already owned' });
    }

    // 5. 添加道具
    shopItems.push(itemId);

    // 6. 自动佩戴
    let equippedItems = {};
    if (stu.equipped_items) {
      if (typeof stu.equipped_items === 'string') {
        try { equippedItems = JSON.parse(stu.equipped_items); } catch(_) { equippedItems = {}; }
      } else if (typeof stu.equipped_items === 'object') {
        equippedItems = stu.equipped_items;
      }
    }

    const category = getCategory(itemId);
    if (category && !equippedItems[category]) {
      equippedItems[category] = itemId;
    }

    // 7. 计算新金币
    const newCoins = currentCoins - p;

    // 8. 更新学生数据
    const updateR = await sbUpdate(env, 'students', {
      coins: newCoins,
      shop_items: JSON.stringify(shopItems),
      equipped_items: JSON.stringify(equippedItems)
    }, `id=eq.${sid}`);

    if (updateR.error) {
      console.error('[buy-item] Student update failed:', updateR.error);
      return jsonResponse({ ok: false, error: 'Update failed', details: updateR.error }, 500);
    }

    // 9. 追加操作日志到 operation_logs 表
    var logId = null;
    if (cid) {
      logId = genId();
      var row = {
        id: logId,
        class_id: cid,
        student_id: sid,
        student_name: studentName || '',
        action_type: '商店购买',
        details: '购买「' + (itemName || itemId) + '」',
        coin_delta: -p,
        exp_delta: 0,
        pet_id: null,
        snapshot: { coinsBefore: currentCoins, coinsAfter: newCoins },
        extra: { shopItemId: itemId },
        full_snapshot: null,
        reverted: false,
        created_at: new Date().toISOString()
      };

      var logWriteR = await sbRequest(env, 'POST', 'operation_logs', { body: [row] });
      if (logWriteR.error) {
        console.error('[buy-item] Log INSERT failed:', logWriteR.error);
      }
    }

    // 10. 返回成功
    return jsonResponse({
      ok: true,
      coinsAfter: newCoins,
      shopItems: shopItems,
      equippedItems: equippedItems,
      logId: logId
    });

  } catch (err) {
    console.error('[buy-item] Unexpected error:', err);
    return jsonResponse({ error: err.message || 'Unexpected error' }, 500);
  }
};

/**
 * 根据道具 ID 判断装备类别
 */
function getCategory(itemId) {
  if (itemId.indexOf('border_') === 0) return 'borders';
  if (itemId.indexOf('top_') === 0) return 'topAccessory';
  if (itemId.indexOf('base_') === 0) return 'baseEffect';
  if (itemId.indexOf('ptcl_') === 0) return 'particles';
  if (itemId.indexOf('title_') === 0) return 'titles';
  if (itemId.indexOf('scene_') === 0) return 'scenes';
  return null;
}
