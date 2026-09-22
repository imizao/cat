const KEY = 'moonpaw-tower-save-v1';

export class SaveSystem {
  save(state) { localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() })); }
  load() {
    try { const data = JSON.parse(localStorage.getItem(KEY)); return data?.version === 1 ? data : null; }
    catch { return null; }
  }
  reset() { localStorage.removeItem(KEY); }
  hasSave() { return Boolean(this.load()); }
}
export { KEY as SAVE_KEY };
