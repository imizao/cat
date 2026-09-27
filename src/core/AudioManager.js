const AUDIO_KEY = 'moonpaw-audio-enabled';
const NOTE = 2 ** (1 / 12);

export class AudioManager {
  constructor(events) {
    this.events = events;
    this.enabled = this.readPreference();
    this.context = null;
    this.timer = null;
    this.nextNoteAt = 0;
    this.step = 0;
    this.mode = 'tower';

    events.on('ui:action', ({ action }) => action === 'sound' ? this.toggle() : this.unlock());
    events.on('skill:cast', ({ skillId, skill }) => this.skill(skillId, skill));
    events.on('combat:impact', ({ strong }) => this.impact(strong));
    events.on('player:heal', () => this.sparkle([0, 4, 7, 12], 0x1));
    events.on('player:shield', () => this.shield());
    events.on('target:selected', () => this.tick(720, .045));
    events.on('battle:start', () => { this.mode = 'battle'; this.step = 0; });
    events.on('battle:enemy-acting', ({ intent }) => this.enemy(intent));
    events.on('battle:end', () => { this.mode = 'tower'; this.fanfare(true); });
    events.on('battle:defeat', () => { this.mode = 'tower'; this.fanfare(false); });
    events.on('floor:enter', () => this.sparkle([0, 7, 12], .55));
    events.on('reward:selected', () => this.sparkle([0, 4, 7, 11], .7));
    document.addEventListener('visibilitychange', () => this.handleVisibility());
  }

  readPreference() {
    try { return localStorage.getItem(AUDIO_KEY) !== 'off'; }
    catch { return true; }
  }

  unlock() {
    if (!this.enabled) return;
    if (!this.context) this.createContext();
    if (!this.context) return;
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    this.startMusic();
  }

  handleVisibility() {
    if (!this.context) return;
    if (document.hidden) {
      this.context.suspend().catch(() => {});
      return;
    }
    if (this.enabled) {
      this.nextNoteAt = this.context.currentTime + .08;
      this.context.resume().catch(() => {});
    }
  }

  createContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.master.gain.value = .72;
    this.musicGain.gain.value = .19;
    this.sfxGain.gain.value = .42;
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.master.connect(this.context.destination);
  }

  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem(AUDIO_KEY, this.enabled ? 'on' : 'off'); } catch {}
    if (this.enabled) {
      this.unlock();
      this.tick(620, .08);
    } else {
      this.stopMusic();
      this.context?.suspend().catch(() => {});
    }
    this.events.emit('audio:state', { enabled: this.enabled });
  }

  startMusic() {
    if (!this.context || this.timer) return;
    this.nextNoteAt = this.context.currentTime + .06;
    this.timer = window.setInterval(() => this.scheduleMusic(), 180);
    this.scheduleMusic();
  }

  stopMusic() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
  }

  scheduleMusic() {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const secondsPerStep = 60 / (this.mode === 'battle' ? 98 : 78) / 2;
    while (this.nextNoteAt < this.context.currentTime + .55) {
      this.musicStep(this.step++, this.nextNoteAt, secondsPerStep);
      this.nextNoteAt += secondsPerStep;
    }
  }

  musicStep(step, time, duration) {
    const calm = [0, 7, 10, 14, 7, 3, 10, 7, 0, 7, 12, 15, 10, 7, 3, 7];
    const battle = [0, 7, 10, 7, 3, 10, 12, 7, 0, 7, 15, 12, 10, 7, 5, 3];
    const pattern = this.mode === 'battle' ? battle : calm;
    const root = this.mode === 'battle' ? 146.83 : 130.81;
    const index = step % pattern.length;
    if (index % 2 === 0 || this.mode === 'battle') {
      this.tone(root * NOTE ** pattern[index], time, duration * 1.65, this.musicGain, 'triangle', .085, 1500);
    }
    if (index % 8 === 0) {
      const bass = index === 0 ? root / 2 : root * NOTE ** 3 / 2;
      this.tone(bass, time, duration * 6.4, this.musicGain, 'sine', .12, 500);
    }
    if (this.mode === 'tower' && index % 4 === 2) {
      this.tone(root * 2 * NOTE ** pattern[index], time, duration * 2.2, this.musicGain, 'sine', .035, 2200);
    }
  }

  tone(frequency, time, duration, output, wave = 'sine', volume = .12, cutoff = 2200, slide = 0) {
    if (!this.context || !this.enabled) return;
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(Math.max(30, frequency), time);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), time + duration);
    filter.type = 'lowpass'; filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + Math.min(.025, duration * .2));
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(filter); filter.connect(gain); gain.connect(output);
    oscillator.start(time); oscillator.stop(time + duration + .03);
  }

  noise(duration = .12, volume = .12, cutoff = 1600) {
    if (!this.context || !this.enabled) return;
    const count = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, count, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < count; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / count);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = cutoff; filter.Q.value = .7;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, this.context.currentTime + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.sfxGain); source.start();
  }

  skill(skillId, skill) {
    this.unlock();
    if (!this.context) return;
    const now = this.context.currentTime;
    const selfOnly = skill.effects.every((effect) => effect.target === 'self');
    if (['moonPounce', 'inkClaw', 'scratchMark', 'tailTrick'].includes(skillId)) {
      this.tone(440, now, .18, this.sfxGain, 'sawtooth', .13, 1900, -250);
      this.noise(.15, .16, 2400);
    } else if (skillId === 'candyBonk') {
      this.tone(185, now, .22, this.sfxGain, 'square', .12, 900, -80);
    } else if (skillId === 'brightBell') {
      [0, .055, .11].forEach((delay, index) => this.tone(880 * NOTE ** (index * 4), now + delay, .32, this.sfxGain, 'sine', .09, 3200));
    } else if (selfOnly) {
      this.sparkle([0, 4, 7], .42);
    } else {
      this.tone(520, now, .24, this.sfxGain, 'triangle', .1, 2200, 180);
    }
  }

  impact(strong) {
    if (!this.context || !this.enabled) return;
    const now = this.context.currentTime;
    this.tone(strong ? 82 : 110, now, strong ? .2 : .13, this.sfxGain, 'sine', strong ? .25 : .18, 700, -35);
    this.noise(strong ? .18 : .1, strong ? .2 : .13, 900);
  }

  enemy(intent) {
    if (!this.context || !this.enabled) return;
    const now = this.context.currentTime;
    if (intent.type === 'attack') this.tone(210, now, .2, this.sfxGain, 'sawtooth', .1, 1200, -100);
    else this.tone(intent.type === 'shield' ? 330 : 260, now, .34, this.sfxGain, 'triangle', .08, 1700, 90);
  }

  shield() {
    if (!this.context || !this.enabled) return;
    const now = this.context.currentTime;
    this.tone(280, now, .35, this.sfxGain, 'sine', .11, 1500, 180);
    this.tone(560, now + .04, .42, this.sfxGain, 'triangle', .06, 2200, 120);
  }

  tick(frequency = 620, volume = .05) {
    if (!this.context || !this.enabled) return;
    this.tone(frequency, this.context.currentTime, .055, this.sfxGain, 'sine', volume, 2600);
  }

  sparkle(intervals, volume = .5) {
    if (!this.context || !this.enabled) return;
    const now = this.context.currentTime;
    intervals.forEach((interval, index) => this.tone(440 * NOTE ** interval, now + index * .055, .28, this.sfxGain, 'sine', .1 * volume, 3200));
  }

  fanfare(victory) {
    if (!this.context || !this.enabled) return;
    const notes = victory ? [0, 4, 7, 12] : [7, 3, 0, -5];
    const now = this.context.currentTime;
    notes.forEach((interval, index) => this.tone(330 * NOTE ** interval, now + index * .12, .48, this.sfxGain, victory ? 'triangle' : 'sine', .12, 2300));
  }
}
