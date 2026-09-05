/**
 * POST /api/pet/insert — 领养新宠物 / 恢复宠物（upsert）
 * v149: 支持传入 id 字段进行 upsert（用于撤销删除宠物时恢复）
 */
import { jsonResponse, handleOptions, checkEnv, sbInsert, sbUpdate, sbRequest } from '../../_utils.js';

// 阶段升级所需成长值（与客户端 generateStageCurve 保持一致）
const STAGE_GROWTH = [
  { stage: 1, growthRequired: 0 },
  { stage: 2, growthRequired: 30 },
  { stage: 3, growthRequired: 90 },
  { stage: 4, growthRequired: 210 },
  { stage: 5, growthRequired: 410 },
  { stage: 6, growthRequired: 740 },
  { stage: 7, growthRequired: 1200 },
  { stage: 8, growthRequired: 1800 },
  { stage: 9, growthRequired: 2600 },
];

// v159: 服务端根据成长值计算等级（安全兜底）
function calcLevelFromGrowth(growth) {
  let level = 1;
  for (let i = STAGE_GROWTH.length - 1; i >= 0; i--) {
    if (growth >= STAGE_GROWTH[i].growthRequired) {
      level = STAGE_GROWTH[i].stage;
      break;
    }
  }
  return level;
}

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

    // v159: 服务端根据成长值重算等级
    if (payload.growth) {
      payload.level = calcLevelFromGrowth(payload.growth);
    }

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

  // v159: 服务端根据成长值重算等级
  if (payload.growth) {
    payload.level = calcLevelFromGrowth(payload.growth);
  }

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
