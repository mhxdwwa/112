/**
 * Unit tests for pet-world core logic
 * Run with: node --test tests/core.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHTML, generateStageCurve, getActivePet, getGrowablePet,
  isPetStarved, updatePetLevel, changeStudentCoins, _hasFedToday,
  createStudent, PET_CONFIG,
} from './helpers.mjs';

// ===== escapeHTML =====
describe('escapeHTML', () => {
  it('escapes < and >', () => {
    assert.equal(escapeHTML('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes quotes', () => {
    assert.equal(escapeHTML('"hello" & \'world\''), '&quot;hello&quot; &amp; &#39;world&#39;');
  });

  it('handles null/undefined', () => {
    assert.equal(escapeHTML(null), '');
    assert.equal(escapeHTML(undefined), '');
  });

  it('handles numbers', () => {
    assert.equal(escapeHTML(42), '42');
  });

  it('passes through safe strings', () => {
    assert.equal(escapeHTML('hello world'), 'hello world');
  });
});

// ===== generateStageCurve =====
describe('generateStageCurve', () => {
  it('returns 9 stages', () => {
    const curve = generateStageCurve();
    assert.equal(curve.length, 9);
  });

  it('starts at 0 growth for stage 1', () => {
    const curve = generateStageCurve();
    assert.equal(curve[0].growthRequired, 0);
    assert.equal(curve[0].stageName, '神秘宠物蛋');
  });

  it('ends at 2600 growth for stage 9', () => {
    const curve = generateStageCurve();
    assert.equal(curve[8].growthRequired, 2600);
    assert.equal(curve[8].stageName, '万物之神');
  });

  it('stages are monotonically increasing', () => {
    const curve = generateStageCurve();
    for (let i = 1; i < curve.length; i++) {
      assert.ok(curve[i].growthRequired > curve[i-1].growthRequired,
        `Stage ${i+1} growth (${curve[i].growthRequired}) > stage ${i} growth (${curve[i-1].growthRequired})`);
    }
  });
});

// ===== getActivePet =====
describe('getActivePet', () => {
  it('returns active pet by activePetId', () => {
    const s = createStudent({ activePetId: 2, pets: [
      { id: 1, name: '小猫' },
      { id: 2, name: '小狗' },
    ]});
    const pet = getActivePet(s);
    assert.equal(pet.id, 2);
  });

  it('falls back to first pet if activePetId missing', () => {
    const s = createStudent({ activePetId: null });
    const pet = getActivePet(s);
    assert.equal(pet.id, 'p1');
  });

  it('returns null for no pets', () => {
    const s = createStudent({ pets: [] });
    assert.equal(getActivePet(s), null);
  });

  it('falls back if activePetId points to nonexistent pet', () => {
    const s = createStudent({ activePetId: 999 });
    const pet = getActivePet(s);
    assert.equal(pet.id, 'p1');
  });
});

// ===== getGrowablePet =====
describe('getGrowablePet', () => {
  it('returns active pet if alive and not max level', () => {
    const s = createStudent();
    const pet = getGrowablePet(s);
    assert.equal(pet.id, 'p1');
  });

  it('returns null if all pets are dead', () => {
    const s = createStudent({ pets: [
      { id: 'p1', name: '小猫', isDead: true, level: 3 },
    ]});
    assert.equal(getGrowablePet(s), null);
  });

  it('returns null if all pets are max level', () => {
    const s = createStudent({ pets: [
      { id: 'p1', name: '小猫', isDead: false, level: 9 },
    ]});
    assert.equal(getGrowablePet(s), null);
  });

  it('returns non-active alive pet if active is dead', () => {
    const s = createStudent({ activePetId: 1, pets: [
      { id: 1, name: '小猫', isDead: true, level: 3 },
      { id: 2, name: '小狗', isDead: false, level: 2 },
    ]});
    const pet = getGrowablePet(s);
    assert.equal(pet.id, 2);
  });
});

// ===== isPetStarved =====
describe('isPetStarved', () => {
  it('returns false for recently fed pet', () => {
    const pet = { lastFeedDate: new Date().toISOString() };
    assert.equal(isPetStarved(pet), false);
  });

  it('returns false for pet fed 69 days ago', () => {
    const d = new Date();
    d.setDate(d.getDate() - 69);
    const pet = { lastFeedDate: d.toISOString() };
    assert.equal(isPetStarved(pet), false);
  });

  it('returns true for pet fed 71 days ago (>1680h)', () => {
    const d = new Date();
    d.setDate(d.getDate() - 71);
    const pet = { lastFeedDate: d.toISOString() };
    assert.equal(isPetStarved(pet), true);
  });

  it('returns false if no lastFeedDate', () => {
    const pet = { lastFeedDate: null };
    assert.equal(isPetStarved(pet), false);
  });
});

// ===== updatePetLevel =====
describe('updatePetLevel', () => {
  it('levels up when growth exceeds threshold', () => {
    const s = createStudent();
    s.pets[0].growth = 35; // > 30 for stage 2
    const result = updatePetLevel(s, 'p1');
    assert.ok(result);
    assert.equal(s.pets[0].level, 2);
    assert.equal(result.isUpgrade, true);
  });

  it('returns false when no level change', () => {
    const s = createStudent();
    s.pets[0].growth = 10; // < 30 for stage 2
    const result = updatePetLevel(s, 'p1');
    assert.equal(result, false);
  });

  it('caps growth at max for level 9', () => {
    const s = createStudent();
    s.pets[0].growth = 3000; // > 2600 max
    updatePetLevel(s, 'p1');
    assert.equal(s.pets[0].level, 9);
    assert.equal(s.pets[0].growth, 2600);
  });

  it('handles negative growth', () => {
    const s = createStudent();
    s.pets[0].growth = -10;
    updatePetLevel(s, 'p1');
    assert.equal(s.pets[0].growth, 0);
    assert.equal(s.pets[0].level, 1);
  });

  it('multi-level upgrade works', () => {
    const s = createStudent();
    s.pets[0].growth = 500; // > 410 for stage 5
    const result = updatePetLevel(s, 'p1');
    assert.ok(result);
    assert.equal(s.pets[0].level, 5);
    assert.equal(result.oldLevel, 1);
    assert.equal(result.newLevel, 5);
  });
});

// ===== changeStudentCoins =====
describe('changeStudentCoins', () => {
  it('adds coins correctly', () => {
    const s = createStudent({ coins: 100 });
    const result = changeStudentCoins(s, 10, '打卡', '+10', 0, null);
    assert.equal(s.coins, 110);
    assert.equal(result.before, 100);
  });

  it('subtracts coins correctly', () => {
    const s = createStudent({ coins: 100 });
    changeStudentCoins(s, -30, '散步', '测试', 15, 'p1');
    assert.equal(s.coins, 70);
  });

  it('clamps to 0 when overdrawn', () => {
    const s = createStudent({ coins: 20 });
    changeStudentCoins(s, -50, '旅游', '测试', 0, 'p1');
    assert.equal(s.coins, 0);
  });

  it('handles 0 coins', () => {
    const s = createStudent({ coins: 0 });
    changeStudentCoins(s, -10, '喂食', '测试', 0, 'p1');
    assert.equal(s.coins, 0);
  });

  it('handles undefined coins', () => {
    const s = { id: 's1', name: 'test', coins: undefined };
    changeStudentCoins(s, 10, 'test', 'test', 0, null);
    assert.equal(s.coins, 10);
  });
});

// ===== _hasFedToday =====
describe('_hasFedToday', () => {
  it('returns true for pet fed today', () => {
    const pet = { lastFeedDate: new Date().toISOString() };
    assert.equal(_hasFedToday(pet), true);
  });

  it('returns false for pet fed yesterday', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const pet = { lastFeedDate: d.toISOString() };
    assert.equal(_hasFedToday(pet), false);
  });

  it('returns false for pet never fed', () => {
    const pet = { lastFeedDate: null };
    assert.equal(_hasFedToday(pet), false);
  });
});

// ===== PET_CONFIG integrity =====
describe('PET_CONFIG', () => {
  it('has valid stage curves for all pets', () => {
    for (const [name, cfg] of Object.entries(PET_CONFIG)) {
      assert.ok(cfg.stages.length === 9, `${name} has 9 stages`);
      assert.ok(cfg.id, `${name} has an id`);
      assert.ok(cfg.emoji, `${name} has an emoji`);
    }
  });

  it('stage 1 requires 0 growth', () => {
    for (const [name, cfg] of Object.entries(PET_CONFIG)) {
      assert.equal(cfg.stages[0].growthRequired, 0, `${name} stage 1 = 0 growth`);
    }
  });
});
