/**
 * POST /api/pet/fix-levels — 批量修复宠物等级（根据成长值重算）
 * 
 * 用于修复历史 bug 导致的等级与成长值不匹配问题。
 * 遍历所有宠物，根据 growth 重新计算 level。
 */
import { jsonResponse, handleOptions, checkEnv, sbSelect, sbUpdate } from '../../_utils.js';

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

  // 查询所有宠物
  const petsR = await sbSelect(env, 'pets', 'id,growth,level');
  if (petsR.error) {
    return jsonResponse({ error: 'Failed to load pets', details: petsR.error }, 500);
  }

  const pets = petsR.data || [];
  let fixedCount = 0;
  const fixes = [];

  for (const pet of pets) {
    const growth = pet.growth || 0;
    const currentLevel = pet.level || 1;
    const correctLevel = calcLevelFromGrowth(growth);

    if (currentLevel !== correctLevel) {
      // 等级不匹配，需要修复
      const updateR = await sbUpdate(env, 'pets', { level: correctLevel }, `id=eq.${pet.id}`);
      if (!updateR.error) {
        fixedCount++;
        fixes.push({
          petId: pet.id,
          growth,
          oldLevel: currentLevel,
          newLevel: correctLevel
        });
      }
    }
  }

  return jsonResponse({
    ok: true,
    totalPets: pets.length,
    fixedCount,
    fixes
  });
};
