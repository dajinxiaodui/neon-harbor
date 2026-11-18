// Sound, synthesized live with WebAudio: no audio files to ship, nothing to
// load over the network. The context is created on the first user gesture, so
// the page stays silent until the player starts. M toggles mute.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let sirenOsc = null;
  let sirenGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenPhase = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shot() { noise(0.14, 0.5, 2400); tone(160, 0.1, 'square', 0.18, 60); },
    enemyShot() { noise(0.12, 0.25, 1800); },
    hit() { tone(120, 0.15, 'sawtooth', 0.3, 60); },
    crash() { noise(0.25, 0.5, 900); tone(90, 0.25, 'sawtooth', 0.25, 40); },
    pickup() { tone(660, 0.09, 'sine', 0.3); tone(990, 0.12, 'sine', 0.3); },
    mission() {
      tone(523, 0.12, 'sine', 0.3);
      setTimeout(() => tone(659, 0.12, 'sine', 0.3), 110);
      setTimeout(() => tone(784, 0.22, 'sine', 0.3), 220);
    },
    busted() { tone(220, 0.5, 'sawtooth', 0.3, 110); },
    siren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'sine';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        sirenPhase = 0;
      } else if (!on && sirenOsc) {
        sirenOsc.stop();
        sirenOsc = null;
        sirenGain = null;
      }
    },
    sirenStep(dt) {
      if (!sirenOsc || muted) return;
      sirenPhase += dt;
      const f = 620 + 260 * Math.sin(sirenPhase * 4.4);
      sirenOsc.frequency.setValueAtTime(f, ctx.currentTime);
      sirenGain.gain.setValueAtTime(0.045, ctx.currentTime);
    },
    engine(speed, driving) {
      if (!ensure()) return;
      if (driving && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        engineOsc.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      } else if (!driving && engineOsc) {
        engineOsc.stop();
        engineOsc = null;
        engineGain = null;
      }
      if (engineOsc && !muted) {
        engineOsc.frequency.setValueAtTime(50 + Math.abs(speed) * 0.16, ctx.currentTime);
        engineGain.gain.setValueAtTime(0.05, ctx.currentTime);
      }
    },
  };
}
