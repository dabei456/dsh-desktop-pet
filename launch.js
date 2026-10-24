// 启动器：绕开环境里的 ELECTRON_RUN_AS_NODE=1（否则 electron.exe 会以 node 模式跑，app 是 undefined）
// 用法：node launch.js   [--restart]
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const dir = __dirname;
const exe = path.join(dir, 'node_modules', 'electron', 'dist', 'electron.exe');

if (!fs.existsSync(exe)) {
  console.error('找不到 electron.exe：' + exe);
  process.exit(1);
}

if (process.argv.includes('--restart')) {
  try {
    execSync('taskkill /F /IM electron.exe', { stdio: 'ignore' });
  } catch {}
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_NO_ATTACH_CONSOLE;

const out = fs.openSync(path.join(dir, 'pet.stdout.log'), 'a');
const err = fs.openSync(path.join(dir, 'pet.stderr.log'), 'a');

const child = spawn(exe, [dir, ...process.argv.slice(2).filter((a) => a !== '--restart')], {
  cwd: dir,
  env,
  detached: true,
  stdio: ['ignore', out, err],
});
child.unref();

console.log('launched pid=' + child.pid);
