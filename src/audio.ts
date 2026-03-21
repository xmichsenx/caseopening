const audioCtxRef = { current: null as AudioContext | null };

function getAudioContext(): AudioContext {
  if (!audioCtxRef.current) {
    audioCtxRef.current = new AudioContext();
  }
  return audioCtxRef.current;
}

/**
 * Play a sharp, percussive tick sound similar to CS2 case scrolling.
 * Uses a short burst of filtered noise for a metallic click feel.
 */
export function playTick(pitch: number = 1): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    const duration = 0.025;

    // Create a short noise burst via a buffer
    const bufferSize = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter for that metallic click character
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 3500 * pitch;
    bandpass.Q.value = 2.5;

    // Highpass to remove low rumble
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 1200;

    // Sharp envelope
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + duration);
  } catch {
    // Audio not available — silently ignore
  }
}

/**
 * Play a CS2-style win reveal sound — a bright metallic shimmer.
 */
export function playWinSound(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime;

    // Metallic shimmer: layered high-frequency tones with slight detune
    const frequencies = [2637, 3520, 4186]; // E7, A7, C8 — bright and sharp
    for (let i = 0; i < frequencies.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.value = frequencies[i];
      osc.detune.value = (Math.random() - 0.5) * 15;

      const startTime = now + i * 0.04;
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    }

    // Add a subtle noise tail for texture
    const noiseLen = Math.ceil(ctx.sampleRate * 0.15);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.15;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, now + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noiseSrc.connect(hp);
    hp.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noiseSrc.start(now + 0.05);
    noiseSrc.stop(now + 0.25);
  } catch {
    // Audio not available — silently ignore
  }
}

// ── Rocket sounds ────────────────────────────────────

/** Handle for a looping rocket engine sound so it can be stopped. */
export interface RocketEngineHandle {
  stop: () => void;
}

/**
 * Start a looping low-frequency rumble that simulates a rocket engine.
 * Returns a handle with a `stop()` method.
 */
export function playRocketEngine(): RocketEngineHandle {
  const noop: RocketEngineHandle = { stop: () => {} };
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;

    // ── Primary: broadband noise shaped into a jet-engine "whoosh" ──
    const noiseLen = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) nd[i] = Math.random() * 2 - 1;
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    noiseSrc.loop = true;

    // Bandpass around 2500 Hz for the "roar" — sounds like rushing air
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2500;
    bp.Q.value = 0.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.4;

    // ── Secondary: high-pitched turbine whine ──
    const whine = ctx.createOscillator();
    whine.type = "triangle";
    whine.frequency.value = 420;

    const whineLp = ctx.createBiquadFilter();
    whineLp.type = "lowpass";
    whineLp.frequency.value = 1200;

    const whineGain = ctx.createGain();
    whineGain.gain.value = 0.06;

    // Subtle vibrato on the whine for realism
    const vibrato = ctx.createOscillator();
    vibrato.type = "sine";
    vibrato.frequency.value = 4;
    const vibGain = ctx.createGain();
    vibGain.gain.value = 8;
    vibrato.connect(vibGain);
    vibGain.connect(whine.frequency);

    // ── Rumble sub-layer (subtle low-end body) ──
    const rumble = ctx.createOscillator();
    rumble.type = "sine";
    rumble.frequency.value = 120;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.08;

    // ── Master gain with fade-in ──
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.3, now + 0.25);

    // Wire up
    noiseSrc.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(master);

    whine.connect(whineLp);
    whineLp.connect(whineGain);
    whineGain.connect(master);

    rumble.connect(rumbleGain);
    rumbleGain.connect(master);

    master.connect(ctx.destination);

    noiseSrc.start(now);
    whine.start(now);
    vibrato.start(now);
    rumble.start(now);

    return {
      stop: () => {
        try {
          const t = ctx.currentTime;
          master.gain.linearRampToValueAtTime(0, t + 0.15);
          noiseSrc.stop(t + 0.2);
          whine.stop(t + 0.2);
          vibrato.stop(t + 0.2);
          rumble.stop(t + 0.2);
        } catch {
          /* already stopped */
        }
      },
    };
  } catch {
    return noop;
  }
}

/** Play an explosion / crash sound — low boom + crackle. */
export function playExplosion(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;

    // Low boom
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);

    // Crackle noise
    const len = Math.ceil(ctx.sampleRate * 0.3);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 800;
    bp.Q.value = 0.5;

    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.3, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    src.connect(bp);
    bp.connect(ng);
    ng.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.35);
  } catch {
    // Audio not available
  }
}

/** Play a brief cash-out / success chime — ascending tones. */
export function playCashOut(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;
    const notes = [523, 659, 784]; // C5, E5, G5 — major chord arpeggio

    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = notes[i];

      const gain = ctx.createGain();
      const start = now + i * 0.07;
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    }
  } catch {
    // Audio not available
  }
}
