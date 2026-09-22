import { cats } from '../data/cats.js';
import { skills } from '../data/skills.js';
import { relics } from '../data/relics.js';
import { AutoPlaySimulator, summarizeRuns } from '../simulation/AutoPlaySimulator.js';

export class SimulatorApp {
  constructor(root, logout) {
    this.root = root;
    this.logout = logout;
    this.render();
    this.bind();
  }

  render() {
    this.root.innerHTML = `
      <main class="console-shell">
        <header class="console-header">
          <div><span class="overline">MOONPAW INTERNAL / SIMULATION</span><h1>自动爬塔模拟器</h1></div>
          <button class="logout" data-action="logout">退出</button>
        </header>
        <div class="console-grid">
          <aside class="controls">
            <div class="section-label"><span>01</span><b>运行参数</b></div>
            <form data-controls>
              <label>模拟角色<select name="catId"><option value="all">全部角色</option>${cats.map((cat) => `<option value="${cat.id}">${cat.name}</option>`).join('')}</select></label>
              <label>每只猫运行次数<input name="runs" type="number" min="1" max="200" value="10" /></label>
              <label>最大测试层数<input name="maxFloor" type="number" min="10" max="10000" value="500" /></label>
              <label>基础世界种子<input name="seed" type="number" min="1" value="20260922" /></label>
              <label class="check"><input name="trace" type="checkbox" /><span>记录首轮详细轨迹</span></label>
              <button class="run" type="submit">开始批量模拟 <span>→</span></button>
            </form>
            <div class="policy-note"><b>代理策略</b><p>集火低生命目标；危险时优先治疗或护盾；奖励优先遗物、伤害强化与生存成长。</p></div>
          </aside>
          <section class="workspace">
            <div class="empty-state" data-empty><span>∿</span><h2>等待模拟</h2><p>结果不会写入正式游戏存档。</p></div>
            <div class="results is-hidden" data-results>
              <div class="progress-line"><i data-progress></i></div>
              <p class="status" data-status>准备运行</p>
              <div class="metrics" data-metrics></div>
              <div class="section-label"><span>02</span><b>角色表现</b></div>
              <div class="cat-summaries" data-cat-summaries></div>
              <div class="section-label"><span>03</span><b>单次运行</b></div>
              <div class="table-wrap"><table><thead><tr><th>#</th><th>角色</th><th>种子</th><th>到达</th><th>结局</th><th>最终构筑</th></tr></thead><tbody data-table></tbody></table></div>
              <div class="trace is-hidden" data-trace></div>
            </div>
          </section>
        </div>
      </main>`;
    this.refs = Object.fromEntries([...this.root.querySelectorAll('[data-controls], [data-empty], [data-results], [data-progress], [data-status], [data-metrics], [data-cat-summaries], [data-table], [data-trace]')].map((node) => [Object.keys(node.dataset)[0], node]));
  }

  bind() {
    this.root.querySelector('[data-action="logout"]').addEventListener('click', this.logout);
    this.refs.controls.addEventListener('submit', (event) => { event.preventDefault(); this.run(new FormData(this.refs.controls)); });
  }

  async run(form) {
    const selected = String(form.get('catId'));
    const selectedCats = selected === 'all' ? cats : cats.filter((cat) => cat.id === selected);
    const runsPerCat = Math.min(200, Math.max(1, Number(form.get('runs')) || 10));
    const maxFloor = Math.min(10000, Math.max(10, Number(form.get('maxFloor')) || 500));
    const baseSeed = Number(form.get('seed')) >>> 0;
    const trace = form.get('trace') === 'on';
    const total = selectedCats.length * runsPerCat;
    const results = [];
    const runButton = this.root.querySelector('.run');
    runButton.disabled = true;
    this.refs.empty.classList.add('is-hidden');
    this.refs.results.classList.remove('is-hidden');
    this.refs.metrics.innerHTML = '';
    this.refs.catSummaries.innerHTML = '';
    this.refs.table.innerHTML = '';
    this.refs.trace.classList.add('is-hidden');

    let completed = 0;
    for (let catIndex = 0; catIndex < selectedCats.length; catIndex++) {
      for (let runIndex = 0; runIndex < runsPerCat; runIndex++) {
        // Every cat uses the same seed series so balance comparisons are paired.
        const worldSeed = (baseSeed + Math.imul(runIndex + 1, 0x9e3779b1)) >>> 0;
        const simulator = new AutoPlaySimulator({ worldSeed, catId: selectedCats[catIndex].id, maxFloor, trace: trace && completed === 0 });
        results.push(simulator.run());
        completed++;
        this.refs.progress.style.width = `${completed / total * 100}%`;
        this.refs.status.textContent = `正在模拟 ${completed} / ${total}`;
        if (completed % 3 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    this.renderResults(results, maxFloor);
    runButton.disabled = false;
  }

  renderResults(results, maxFloor) {
    const summary = summarizeRuns(results);
    this.refs.status.textContent = `已完成 ${results.length} 次模拟 · 上限 ${maxFloor} 层`;
    this.refs.metrics.innerHTML = `
      <div><span>平均到达</span><b>${summary.average.toFixed(1)}<small>层</small></b></div>
      <div><span>中位数</span><b>${summary.median}<small>层</small></b></div>
      <div><span>最高到达</span><b>${summary.best}<small>层</small></b></div>
      <div><span>最低到达</span><b>${summary.worst}<small>层</small></b></div>
      <div><span>突破10层首领</span><b>${Math.round(summary.clear10Rate * 100)}<small>%</small></b></div>
      <div><span>触及上限</span><b>${Math.round(summary.capRate * 100)}<small>%</small></b></div>`;

    this.refs.catSummaries.innerHTML = cats.map((cat) => {
      const runs = results.filter((result) => result.catId === cat.id);
      if (!runs.length) return '';
      const data = summarizeRuns(runs);
      return `<div style="--cat:${cat.color}"><span>${cat.emoji}</span><p><b>${cat.name}</b><small>${runs.length} 次模拟</small></p><strong>${data.average.toFixed(1)}<small>平均层</small></strong><em>过首领 ${Math.round(data.clear10Rate * 100)}% · 最佳 ${data.best}</em></div>`;
    }).join('');

    this.refs.table.innerHTML = results.map((result, index) => {
      const upgrades = Object.entries(result.skillUpgrades).map(([id, value]) => `${skills[id]?.name || id}+${value}`).join('、') || '无强化';
      const relicNames = result.relics.map((id) => relics[id]?.name || id).join('、') || '无遗物';
      return `<tr><td>${index + 1}</td><td>${result.catName}</td><td>${result.worldSeed}</td><td><b>${result.reachedFloor}F</b></td><td>${result.stoppedReason === 'defeat' ? '战败' : '触及上限'}</td><td title="${relicNames} / ${upgrades}">${relicNames} · ${upgrades}</td></tr>`;
    }).join('');

    const traced = results.find((result) => result.trace.length);
    if (traced) {
      this.refs.trace.classList.remove('is-hidden');
      this.refs.trace.innerHTML = `<div class="section-label"><span>04</span><b>首轮轨迹</b></div><pre>${traced.trace.map((item) => `${String(item.floor).padStart(4, '0')}F  ${item.message}`).join('\n')}</pre>`;
    }
  }
}
