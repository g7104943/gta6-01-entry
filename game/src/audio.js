// Sound, all synthesized with the Web Audio API — no audio files, no network.
// Engine hum, siren, gunshot, pickup blip and mission jingle. The context is
// created on the first user gesture; muted state survives in a flag the loop
// reads, and nothing here ever throws when audio is unavailable.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, volume, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
      gain.gain.setValueAtTime(volume || 0.2, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + dur + 0.02);
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  function noise(dur, volume, lowpass) {
    if (!ensure() || muted) return;
    try {
      const length = Math.max(1, Math.floor(context.sampleRate * dur));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      const gain = context.createGain();
      gain.gain.value = volume || 0.3;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // Audio is decoration.
    }
  }

  return {
    /** Call from any user gesture so the browser unlocks audio. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      noise(0.12, 0.5, 2600);
      tone(180, 0.08, 'square', 0.12, 60);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.22);
      setTimeout(() => tone(990, 0.14, 'sine', 0.22), 80);
    },
    cash() {
      tone(523, 0.1, 'triangle', 0.25);
      setTimeout(() => tone(659, 0.1, 'triangle', 0.25), 90);
      setTimeout(() => tone(784, 0.18, 'triangle', 0.25), 180);
    },
    crash() {
      noise(0.25, 0.4, 700);
    },
    bust() {
      tone(220, 0.5, 'sawtooth', 0.2, 110);
    },
    missionStart() {
      tone(392, 0.12, 'triangle', 0.25);
      setTimeout(() => tone(523, 0.2, 'triangle', 0.25), 110);
    },
    /** Engine hum follows the car's speed; call every frame with 0 when on foot. */
    engine(speed01, dt) {
      if (!ensure() || muted) return;
      try {
        if (!engineOsc) {
          engineOsc = context.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = context.createGain();
          engineGain.gain.value = 0;
          const filter = context.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 700;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        const target = speed01 > 0.02 ? 0.05 + speed01 * 0.06 : 0;
        engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
        engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, context.currentTime, 0.08);
      } catch {
        // Audio is decoration.
      }
    },
    /** Two-tone siren while any police car is near; call every frame. */
    siren(active, dt) {
      if (!ensure() || muted) return;
      try {
        if (!sirenOsc) {
          sirenOsc = context.createOscillator();
          sirenOsc.type = 'sine';
          sirenGain = context.createGain();
          sirenGain.gain.value = 0;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
        }
        sirenTimer += dt;
        const high = Math.floor(sirenTimer * 1.6) % 2 === 0;
        sirenOsc.frequency.setTargetAtTime(high ? 950 : 700, context.currentTime, 0.05);
        sirenGain.gain.setTargetAtTime(active ? 0.045 : 0, context.currentTime, 0.15);
      } catch {
        // Audio is decoration.
      }
    },
  };
}
