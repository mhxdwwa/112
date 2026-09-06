/**
 * POST /api/class/reset — 重置班级所有学生数据
 * v149: 新增端点，替代前端直接操作 Supabase 的 _supabaseClearPets
 * 
 * 重置内容：
 * - 删除所有宠物
 * - 金币恢复为 50
 * - 仙丹恢复为 0
 * - 清空装备特效
 * - 清空商店物品
 * - 重置所有游戏进度
 * - 删除自定义奖惩
 */
import { jsonResponse, handleOptions, checkEnv, sbSelectSingle, sbDelete, sbUpdate, sbSelect } from '../../_utils.js';

export const onRequestOptions = handleOptions;

const DEFAULT_QUIZ_STATE = JSON.stringify({
  lastQuizDate: '',
  todayCoins: 0,
  questionsToday: [],
  totalQuestions: 0,
  started: false,
  totalQuizCoins: 0,
  pigRunLevels: {},
  pigRunTotalScore: 0,
  pigRunTools: { remove: 1, shuffle: 1, rotate: 1 },
  match3Levels: {},
  match3TotalScore: 0,
  match3Tools: { shuffle: 1, undo: 1 },
  happyRunMaxLevel: 1,
  happyRunLevels: {},
  happyRunLevelBestCoins: {},
  happyRunTotalSilver: 0,
  happyRunSilverBalance: 0,
  happyRunPetGold: 0,
  happyRunOwnedChars: [0],
  happyRunBossKillBonus: {},
  happyRunTotalScore: 0
});

export const onRequestPost = async ({ request, env }) => {
  const envErr = checkEnv(env);
  if (envErr) return envErr;

  const body = await request.json();
  const classId = body.classId;

  if (!classId) {
    return jsonResponse({ error: 'Missing classId' }, 400);
  }

  // 获取该班级所有学生 ID
  const stuR = await sbSelect(env, 'students', 'id', `class_id=eq.${classId}`);
  if (stuR.error) {
    return jsonResponse({ error: 'Failed to query students', details: stuR.error }, 500);
  }

  const studentIds = (stuR.data || []).map(s => s.id);

  if (studentIds.length > 0) {
    const inFilter = `student_id=in.(${studentIds.join(',')})`;

    // 删除所有宠物
    const petDel = await sbDelete(env, 'pets', inFilter);
    if (petDel.error) {
      return jsonResponse({ error: 'Failed to delete pets', details: petDel.error }, 500);
    }

    // 重置所有学生数据
    // v185: 补全遗漏字段 — 冷却日期、PK次数、零食请求、活跃宠物ID
    const stuUpdate = await sbUpdate(env, 'students', {
      coins: 50,
      xiandan: 0,
      equipped_items: '{}',
      shop_items: '[]',
      quiz_state: DEFAULT_QUIZ_STATE,
      snack_requests: '[]',
      last_checkin_date: null,
      last_jianghu_date: null,
      last_pk_date: null,
      pk_count_today: 0,
      active_pet_id: null
    }, `class_id=eq.${classId}`);
    if (stuUpdate.error) {
      return jsonResponse({ error: 'Failed to reset students', details: stuUpdate.error }, 500);
    }
  }

  // 删除自定义奖惩
  await sbDelete(env, 'custom_actions', `class_id=eq.${classId}`);

  return jsonResponse({ ok: true, resetStudents: studentIds.length });
};
