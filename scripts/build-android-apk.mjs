#!/usr/bin/env node
/**
 * Build Kivo Android APK without requiring Windows symlink privileges (Developer Mode).
 *
 * Usage:
 *   node scripts/build-android-apk.mjs                 # arm64 debug APK
 *   node scripts/build-android-apk.mjs --release       # arm64 release APK
 *   node scripts/build-android-apk.mjs --target armv7  # 32-bit ARM APK
 *   node scripts/build-android-apk.mjs --target universal # arm64 + armv7 APK
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const TAURI_DIR = path.join(ROOT, 'src-tauri');
const ANDROID_DIR = path.join(TAURI_DIR, 'gen', 'android');
const MIN_SDK = 24;

const TARGETS = {
  aarch64: {
    rustTriple: 'aarch64-linux-android',
    abi: 'arm64-v8a',
    gradleArch: 'Arm64',
    clangPrefix: `aarch64-linux-android${MIN_SDK}`,
  },
  armv7: {
    rustTriple: 'armv7-linux-androideabi',
    abi: 'armeabi-v7a',
    gradleArch: 'Arm',
    clangPrefix: `armv7a-linux-androideabi${MIN_SDK}`,
  },
  x86_64: {
    rustTriple: 'x86_64-linux-android',
    abi: 'x86_64',
    gradleArch: 'X86_64',
    clangPrefix: `x86_64-linux-android${MIN_SDK}`,
  },
};

const args = process.argv.slice(2);
const isRelease = args.includes('--release');
const skipFrontend = args.includes('--skip-frontend');
const targetArgIdx = args.indexOf('--target');
const targetChoice = targetArgIdx !== -1 && args[targetArgIdx + 1] ? args[targetArgIdx + 1] : 'aarch64';

const selectedKeys =
  targetChoice === 'universal' ? ['aarch64', 'armv7'] : [targetChoice];

for (const key of selectedKeys) {
  if (!TARGETS[key]) {
    console.error(`Unknown --target "${key}". Use: aarch64, armv7, x86_64, or universal.`);
    process.exit(1);
  }
}

const isWin = process.platform === 'win32';
const javaHome = process.env.JAVA_HOME;
const ndkHome = process.env.NDK_HOME || process.env.ANDROID_NDK_HOME;

if (!ndkHome || !fs.existsSync(ndkHome)) {
  console.error('NDK_HOME is not set or does not exist. Set NDK_HOME to your Android NDK path.');
  process.exit(1);
}

const env = { ...process.env };
if (javaHome) {
  env.PATH = `${path.join(javaHome, 'bin')}${path.delimiter}${env.PATH || ''}`;
}

const hostTag = isWin ? 'windows-x86_64' : process.platform === 'darwin' ? 'darwin-x86_64' : 'linux-x86_64';
const ndkBin = path.join(ndkHome, 'toolchains', 'llvm', 'prebuilt', hostTag, 'bin');

function run(cmd, cmdArgs, options = {}) {
  console.log(`\n> ${cmd} ${cmdArgs.join(' ')}`);
  const res = spawnSync(cmd, cmdArgs, {
    stdio: 'inherit',
    shell: isWin,
    env,
    ...options,
  });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

if (!skipFrontend) {
  run('npm', ['run', 'build'], { cwd: ROOT });
}

const profile = isRelease ? 'release' : 'debug';
const profileCap = isRelease ? 'Release' : 'Debug';

for (const key of selectedKeys) {
  const t = TARGETS[key];
  const tripleUpper = t.rustTriple.replace(/-/g, '_').toUpperCase();
  const tripleUnderscore = t.rustTriple.replace(/-/g, '_');
  const ext = isWin ? '.cmd' : '';
  const exe = isWin ? '.exe' : '';

  const clang = path.join(ndkBin, `${t.clangPrefix}-clang${ext}`);
  const clangxx = path.join(ndkBin, `${t.clangPrefix}-clang++${ext}`);
  const ar = path.join(ndkBin, `llvm-ar${exe}`);

  env[`CARGO_TARGET_${tripleUpper}_LINKER`] = clang;
  env[`CC_${tripleUnderscore}`] = clang;
  env[`CXX_${tripleUnderscore}`] = clangxx;
  env[`AR_${tripleUnderscore}`] = ar;
  env[`CARGO_TARGET_${tripleUpper}_AR`] = ar;

  const cargoArgs = [
    'build',
    '--lib',
    '--manifest-path',
    path.join(TAURI_DIR, 'Cargo.toml'),
    '--target',
    t.rustTriple,
  ];
  if (isRelease) cargoArgs.push('--release');

  run('cargo', cargoArgs, { cwd: ROOT });

  const builtSo = path.join(TAURI_DIR, 'target', t.rustTriple, profile, 'libkivo_lib.so');
  const jniDir = path.join(ANDROID_DIR, 'app', 'src', 'main', 'jniLibs', t.abi);
  fs.mkdirSync(jniDir, { recursive: true });
  const destSo = path.join(jniDir, 'libkivo_lib.so');
  fs.copyFileSync(builtSo, destSo);
  console.log(`Copied ${builtSo} -> ${destSo}`);
}

const gradleWrapper = isWin ? 'gradlew.bat' : './gradlew';
const gradleTask =
  targetChoice === 'universal'
    ? `assembleUniversal${profileCap}`
    : `assemble${TARGETS[selectedKeys[0]].gradleArch}${profileCap}`;

const excludeTasks =
  targetChoice === 'universal'
    ? [
        '-x', `rustBuildUniversal${profileCap}`,
        '-x', `rustBuildArm64${profileCap}`,
        '-x', `rustBuildArm${profileCap}`,
        '-x', `rustBuildX86${profileCap}`,
        '-x', `rustBuildX86_64${profileCap}`,
      ]
    : ['-x', `rustBuild${TARGETS[selectedKeys[0]].gradleArch}${profileCap}`];

run(gradleWrapper, [gradleTask, ...excludeTasks], { cwd: ANDROID_DIR });

const apkRoot = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk');
console.log(`\nAndroid APK build complete! Output directory: ${apkRoot}`);
