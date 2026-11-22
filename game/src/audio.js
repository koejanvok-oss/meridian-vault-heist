// Sound, all synthesized with WebAudio: no audio files, no network. The
// context is created on the first user gesture (browsers block audio before
// one), every effect is a short oscillator or filtered-noise envelope, and
// the alarm siren is a looping oscillator that starts and stops with the
// lockdown. M toggles mute.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let siren = null;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime + when;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = vol;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  return {
    unlock() {
      if (ensure() && context.state === 'suspended') void context.resume();
    },
    toggleMute() {
      muted = !muted;
      if (siren) this.stopSiren();
      return muted;
    },
    get muted() {
      return muted;
    },
    click() {
      tone(660, 0.06, 'sine', 0.15);
    },
    footstep() {
      noise(0.05, 0.06, 500);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.2);
      tone(1318, 0.14, 'sine', 0.18, 0.07);
    },
    mainLoot() {
      tone(523, 0.12, 'triangle', 0.22);
      tone(659, 0.12, 'triangle', 0.22, 0.1);
      tone(784, 0.2, 'triangle', 0.24, 0.2);
      tone(1046, 0.3, 'sine', 0.2, 0.3);
    },
    spotted() {
      tone(220, 0.12, 'square', 0.12);
      tone(185, 0.18, 'square', 0.12, 0.1);
    },
    startSiren() {
      if (!ensure() || muted || siren) return;
      const osc = context.createOscillator();
      const gain = context.createGain();
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 620;
      lfo.type = 'sine';
      lfo.frequency.value = 0.9;
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      lfo.start();
      siren = { osc, lfo, gain };
    },
    stopSiren() {
      if (!siren) return;
      try {
        siren.gain.gain.setTargetAtTime(0, context.currentTime, 0.1);
        siren.osc.stop(context.currentTime + 0.4);
        siren.lfo.stop(context.currentTime + 0.4);
      } catch {
        // Already stopped.
      }
      siren = null;
    },
    smoke() {
      noise(0.5, 0.22, 900);
    },
    emp() {
      tone(1200, 0.35, 'square', 0.12, 0, 120);
      noise(0.25, 0.1, 3000, 0.05);
    },
    decoy() {
      tone(2093, 0.07, 'triangle', 0.18);
      tone(1568, 0.1, 'triangle', 0.14, 0.12);
      tone(2093, 0.06, 'triangle', 0.12, 0.24);
    },
    busted() {
      tone(392, 0.25, 'sawtooth', 0.16);
      tone(311, 0.3, 'sawtooth', 0.16, 0.2);
      tone(233, 0.5, 'sawtooth', 0.16, 0.4);
    },
    levelDone() {
      tone(659, 0.12, 'triangle', 0.2);
      tone(784, 0.12, 'triangle', 0.2, 0.1);
      tone(1046, 0.25, 'triangle', 0.22, 0.2);
    },
    win() {
      const notes = [523, 659, 784, 1046, 784, 1046, 1318];
      notes.forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.2, i * 0.13));
    },
  };
}
