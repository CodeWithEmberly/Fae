// Headless balance test. usage: node tools/bot.js [years] [seed]
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Math, JSON, Object, Array, Float32Array, Uint8Array };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['js/data', 'js/state', 'js/sim', 'js/people', 'js/council', 'tools/botcore']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f + '.js'), 'utf8'), ctx);
const FS = ctx.FS, years = +process.argv[2] || 60, seed = +process.argv[3] || 12345;
const S = FS.newGame(seed);
console.log(FS.botPlay(S, years * 12, { report: 60 }).join('\n'));
