import { defineConfig } from 'vite';
import { resolve, join } from 'path';
import { readdirSync, mkdirSync, copyFileSync, statSync } from 'fs';

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

// Plugin to copy js/ subdirectories (e.g. three-modules/) to dist/
function copyJsSubdirs() {
  return {
    name: 'copy-js-subdirs',
    closeBundle() {
      function copyDirRecursive(src, dest) {
        mkdirSync(dest, { recursive: true });
        const entries = readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = join(src, entry.name);
          const destPath = join(dest, entry.name);
          if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
          } else {
            copyFileSync(srcPath, destPath);
          }
        }
      }
      const jsDir = resolve(__dirname, 'js');
      const distJsDir = resolve(__dirname, 'dist', 'js');
      const subDirs = readdirSync(jsDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);
      for (const subDir of subDirs) {
        copyDirRecursive(join(jsDir, subDir), join(distJsDir, subDir));
        console.log(`  ✓ js/${subDir}/: copied to dist`);
      }
    },
  };
}

export default defineConfig({
  plugins: [copyJsSubdirs()],
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
