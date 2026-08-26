import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync } from 'fs';

// Collect all JS entry points for multi-file minification
const jsFiles = [
  'app.js',
  'dal.js',
  'auth-check.js',
  'quiz.js',
  'quiz-bank.js',
  'pig-run.js',
  'match3.js',
  'happy-run.js',
  'login.js',
];

// Add js/ module files
const jsModuleFiles = readdirSync('./js')
  .filter(f => f.endsWith('.js'))
  .map(f => `js/${f}`);

const allInputs = [...jsFiles, ...jsModuleFiles];

// Build rollup input config for multi-file minification
const input = {};
allInputs.forEach(f => {
  const name = f.replace(/\.js$/, '').replace(/\//g, '_');
  input[name] = resolve(__dirname, f);
});

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        passes: 2,
      },
      mangle: {
        reserved: [
          // Preserve global function names called from HTML onclick handlers
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
          'changeStudentCoins', 'recordAction',
        ],
      },
    },
    rollupOptions: {
      input,
      treeshake: false,
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        manualChunks: undefined,
      },
    },
    // Generate sourcemaps for debugging
    sourcemap: false,
  },
});
