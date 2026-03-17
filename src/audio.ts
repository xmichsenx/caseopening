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
