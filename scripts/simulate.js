import { cats } from '../src/data/cats.js';
import { AutoPlaySimulator, summarizeRuns } from '../src/simulation/AutoPlaySimulator.js';

const options = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const [key, value = 'true'] = argument.replace(/^--/, '').split('=');
  return [key, value];
}));
const selectedCats = options.cat && options.cat !== 'all' ? cats.filter((cat) => cat.id === options.cat) : cats;
const runs = Math.max(1, Number(options.runs) || 10);
const maxFloor = Math.max(10, Number(options['max-floor']) || 500);
const baseSeed = Number(options.seed) || 20260922;
const trace = options.trace === 'true';
const results = [];

selectedCats.forEach((cat) => {
  for (let index = 0; index < runs; index++) {
    // Use the same seed series for each cat to make balance comparisons fair.
    const worldSeed = (baseSeed + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
    results.push(new AutoPlaySimulator({ worldSeed, catId: cat.id, maxFloor, trace: trace && results.length === 0 }).run());
  }
});

console.log(`\n月爪天塔自动模拟 · 每只猫 ${runs} 次 · 上限 ${maxFloor}F\n`);
selectedCats.forEach((cat) => {
  const own = results.filter((result) => result.catId === cat.id);
  const summary = summarizeRuns(own);
  console.log(`${cat.name.padEnd(4)} 平均 ${summary.average.toFixed(1).padStart(6)}F  中位 ${String(summary.median).padStart(5)}F  过10层 ${(summary.clear10Rate * 100).toFixed(1).padStart(5)}%  最佳 ${String(summary.best).padStart(5)}F`);
});
const total = summarizeRuns(results);
console.log(`\n总计 ${total.runs} 次 · 平均 ${total.average.toFixed(1)}F · 最佳 ${total.best}F · 触及上限 ${(total.capRate * 100).toFixed(0)}%\n`);
if (trace) results[0].trace.forEach((item) => console.log(`${String(item.floor).padStart(4, '0')}F  ${item.message}`));
