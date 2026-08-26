#!/usr/bin/env node
/**
 * Build script: minify all JS and CSS files using terser
 * Usage: node build.js
 * Output: dist/ directory with minified files
 */
import { minify } from 'terser';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, 'dist');

// Files to minify
const JS_FILES = [
  'app.js', 'dal.js', 'auth-check.js', 'quiz.js', 'quiz-bank.js',
  'pig-run.js', 'match3.js', 'happy-run.js', 'login.js',
];

const JS_MODULE_DIR = 'js';

// Reserved function names (called from HTML onclick handlers)
const RESERVED = [
  'selectClass', 'createClass', 'deleteClass', 'importFromTxt',
  'openStudentModal', 'closeModal', 'modalFeed', 'modalPlay',
  'modalWalk', 'modalShopping', 'modalTravel', 'modalRevive',
  'modalDailyCheckin', 'modalApplyAction', 'modalAdoptNew',
  'switchPage', 'renderPKPage', 'renderJianghuPage', 'renderClassPKPage',
  'renderClassList', 'renderHomePetGrid', 'renderClassTopThree',
  'showModal', 'showNotification', 'saveClassData',
  'selectPKPlayer', 'resetPKSelection', 'startPKBattle',
  'handlePKTabClick', 'acceptPKChallenge', 'declinePKChallenge',
  'switchPKSubTab', 'selectClassPKStudent', 'startClassPKBattle',
  'selectJianghuStudent', 'startJianghuAdventure', 'confirmJianghuStart',
  'closeJianghuGame', 'selectPetForAdopt', 'confirmAdoptPet',
  'changeStudentCoins', 'recordAction', 'restoreClass',
  'showDeletedClassesModal', 'permanentDeleteClass',
  'hideSelectedClasses', 'showSelectedClasses',
  'clearPetData', 'showDeletePetModal', 'confirmDeletePet',
  'restoreDeletedPet', 'showResetPasswordModal',
  'showChangePetModal', 'selectPetForChange', 'confirmChangePet',
  'showClassDataManagerModal', 'showHideClassModal',
  'classDailyCheckin', 'classAllFeed', 'clearClassPKQuestions',
  'randomSelectStudents', 'submitDualAnswer', 'judgeDualAnswer',
  'setDualColor', 'toggleDualErase', 'clearDualCanvas',
  'showClassPKRobotBattle', 'closeClassPKModal',
  'selectPKOpponent', 'sendPKChallenge', 'showStudentPKChallengeModal',
  'selectStudentPKOpponentAndSend', 'probePKMonsterImages',
  'probeJhBossImages', 'probeMonsterImages', 'probeClassPKRobotImages',
];

const terserOptions = {
  compress: {
    drop_console: false,
    passes: 2,
    pure_getters: true,
  },
  mangle: {
    reserved: RESERVED,
    properties: false,
  },
  format: {
    comments: false,
  },
};

async function minifyFile(inputPath, outputPath) {
  const code = readFileSync(inputPath, 'utf-8');
  const result = await minify(code, terserOptions);
  writeFileSync(outputPath, result.code, 'utf-8');
  const origSize = statSync(inputPath).size;
  const minSize = Buffer.byteLength(result.code, 'utf-8');
  const ratio = ((1 - minSize / origSize) * 100).toFixed(1);
  return { origSize, minSize, ratio };
}

async function main() {
  // Clean and create dist directory
  mkdirSync(DIST, { recursive: true });
  mkdirSync(join(DIST, 'js'), { recursive: true });

  console.log('🔨 Building pet-world...\n');

  const results = [];

  // Minify root JS files
  for (const file of JS_FILES) {
    const inputPath = resolve(__dirname, file);
    const outputPath = join(DIST, file);
    try {
      const { origSize, minSize, ratio } = await minifyFile(inputPath, outputPath);
      results.push({ file, origSize, minSize, ratio });
      console.log(`  ✓ ${file}: ${(origSize/1024).toFixed(1)}KB → ${(minSize/1024).toFixed(1)}KB (-${ratio}%)`);
    } catch (e) {
      console.error(`  ✗ ${file}: ${e.message}`);
    }
  }

  // Minify js/ module files
  const jsFiles = readdirSync(resolve(__dirname, JS_MODULE_DIR))
    .filter(f => f.endsWith('.js'));
  for (const file of jsFiles) {
    const inputPath = resolve(__dirname, JS_MODULE_DIR, file);
    const outputPath = join(DIST, 'js', file);
    try {
      const { origSize, minSize, ratio } = await minifyFile(inputPath, outputPath);
      results.push({ file: `js/${file}`, origSize, minSize, ratio });
      console.log(`  ✓ js/${file}: ${(origSize/1024).toFixed(1)}KB → ${(minSize/1024).toFixed(1)}KB (-${ratio}%)`);
    } catch (e) {
      console.error(`  ✗ js/${file}: ${e.message}`);
    }
  }

  // Copy CSS (could add cssnano later)
  const cssFile = 'style.css';
  copyFileSync(resolve(__dirname, cssFile), join(DIST, cssFile));
  console.log(`  ✓ ${cssFile}: copied`);

  // Copy HTML files
  for (const html of ['index.html', 'login.html', 'happy-run-game.html', 'pdf-viewer.html', 'qr-scan.html', 'qr-verify.html']) {
    const src = resolve(__dirname, html);
    try {
      copyFileSync(src, join(DIST, html));
    } catch (e) { /* skip if not exists */ }
  }
  console.log('  ✓ HTML files: copied');

  // Copy image directories
  for (const dir of ['战斗兽宠文件夹', '战斗机器人']) {
    try {
      const srcDir = resolve(__dirname, dir);
      const distDir = join(DIST, dir);
      mkdirSync(distDir, { recursive: true });
      const files = readdirSync(srcDir);
      for (const f of files) {
        copyFileSync(join(srcDir, f), join(distDir, f));
      }
    } catch (e) { /* skip */ }
  }

  // Copy root images
  for (const img of ['小猪.png', '小猪.webp']) {
    try {
      copyFileSync(resolve(__dirname, img), join(DIST, img));
    } catch (e) { /* skip */ }
  }

  // Summary
  const totalOrig = results.reduce((s, r) => s + r.origSize, 0);
  const totalMin = results.reduce((s, r) => s + r.minSize, 0);
  console.log(`\n📊 Total JS: ${(totalOrig/1024).toFixed(1)}KB → ${(totalMin/1024).toFixed(1)}KB (-${((1-totalMin/totalOrig)*100).toFixed(1)}%)`);
  console.log(`📁 Output: dist/`);
}

main().catch(console.error);
