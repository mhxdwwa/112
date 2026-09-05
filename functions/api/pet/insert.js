/**
 * POST /api/pet/insert — 领养新宠物 / 恢复宠物（upsert）
 * v149: 支持传入 id 字段进行 upsert（用于撤销删除宠物时恢复）
 */
import { jsonResponse, handleOptions, checkEnv, sbInsert, sbUpdate, sbRequest } from '../../_utils.js';

export const onRequestOptions = handleOptions;

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();

  // v149: 如果传了 id，尝试 upsert（用于恢复被删除的宠物）
  if (body.id) {
    const payload = {
      id: body.id,
      student_id: body.student_id,
      name: body.name,
      nickname: body.nickname || '',
      level: body.level || 1,
      growth: body.growth || 0,
      coins: body.coins || 0,
      is_active: body.is_active || false,
      is_dead: body.is_dead || false,
      last_feed_date: body.last_feed_date || null,
      last_play_date: body.last_play_date || null,
      today_feed_count: body.today_feed_count || 0,
      today_play_count: body.today_play_count || 0,
      penalty_streak: body.penalty_streak || 0,
    };

    // 先尝试更新（宠物可能还在数据库中）
    const updateR = await sbUpdate(env, 'pets', payload, `id=eq.${body.id}`);
    if (updateR.data && updateR.data.length > 0) {
      // 更新成功，宠物已恢复
      if (body.is_active) {
        await sbUpdate(env, 'students', { active_pet_id: body.id }, `id=eq.${body.student_id}`);
      }
      return jsonResponse({ ok: true, pet: updateR.data[0] });
    }

    // 更新失败（宠物已被删除），尝试插入
    const insertR = await sbRequest(env, 'POST', 'pets', {
      query: '',
      body: { ...payload, id: body.id }
    });
    if (insertR.error) {
      // 如果插入也失败（可能 id 冲突），尝试不带 id 插入
      delete payload.id;
      const insertR2 = await sbInsert(env, 'pets', [payload]);
      if (insertR2.error) {
        return jsonResponse({ error: 'Failed to restore pet', details: insertR2.error }, 500);
      }
      const newPet = insertR2.data && insertR2.data[0];
      if (body.is_active && newPet) {
        await sbUpdate(env, 'students', { active_pet_id: newPet.id }, `id=eq.${body.student_id}`);
      }
      return jsonResponse({ ok: true, pet: newPet, newId: true });
    }
    const restoredPet = insertR.data && insertR.data[0];
    if (body.is_active && restoredPet) {
      await sbUpdate(env, 'students', { active_pet_id: restoredPet.id }, `id=eq.${body.student_id}`);
    }
    return jsonResponse({ ok: true, pet: restoredPet });
  }

  // 正常领养新宠物（不带 id，数据库自增）
  const payload = {
    student_id: body.student_id,
    name: body.name,
    nickname: body.nickname || '',
    level: body.level || 1,
    growth: body.growth || 0,
    coins: body.coins || 0,
    is_active: body.is_active || false,
    is_dead: false,
    last_feed_date: null,
    last_play_date: null,
    today_feed_count: 0,
    today_play_count: 0,
    penalty_streak: 0,
  };

  const insertR = await sbInsert(env, 'pets', [payload]);
  if (insertR.error) {
    return jsonResponse({ error: 'Failed to insert pet', details: insertR.error }, 500);
  }

  const newPet = insertR.data && insertR.data[0];
  if (newPet && body.is_active) {
    await sbUpdate(env, 'students', { active_pet_id: newPet.id }, `id=eq.${body.student_id}`);
  }

  return jsonResponse({ ok: true, pet: newPet });
};
