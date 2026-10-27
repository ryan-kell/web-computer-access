// Synthesized TV sounds using the Web Audio API — no audio files needed.
// Browsers only allow audio after the visitor interacts, so nothing is created
// until the power button (or a key) is pressed.

const Sound = (() => {
  const MODES = ['stereo', 'mono', 'mute'];
  let ctx, master, noiseBuffer, hiss;

  // null until the visitor picks a mode; the intro still plays sound before then.
  let mode = null;
  try {
    const saved = localStorage.getItem('sound');
    if (MODES.includes(saved)) mode = saved;
  } catch {}

  function init() {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.channelCountMode = 'explicit';
      master.connect(ctx.destination);

      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      applyMode();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  // Mono really is mono: the master bus downmixes to one channel.
  function applyMode() {
    if (!master) return;
    master.gain.value = mode === 'mute' ? 0 : 0.6;
    master.channelCount = mode === 'mono' ? 1 : 2;
  }

  function setMode(next) {
    if (!MODES.includes(next)) return false;
    mode = next;
    applyMode();
    try { localStorage.setItem('sound', next); } catch {}
    return true;
  }

  // Connect a source through its own gain and pan to the master bus.
  function route(node, pan = 0) {
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    node.connect(gain).connect(panner).connect(master);
    return gain.gain;
  }

  function noiseSource(type, freq) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    src.connect(filter);
    return { src, filter };
  }

  // Relay thunk followed by the "boing" hum of the degaussing coil.
  function powerOn() {
    init();
    const t = ctx.currentTime;

    const thunk = ctx.createOscillator();
    thunk.frequency.setValueAtTime(120, t);
    thunk.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const thunkGain = route(thunk);
    thunkGain.setValueAtTime(0.5, t);
    thunkGain.exponentialRampToValueAtTime(0.001, t + 0.25);
    thunk.start(t);
    thunk.stop(t + 0.3);

    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 60;
    const lowpass = ctx.createBiquadFilter();
    lowpass.frequency.value = 500;
    hum.connect(lowpass);
    const humGain = route(lowpass);
    humGain.setValueAtTime(0.001, t);
    humGain.exponentialRampToValueAtTime(0.25, t + 0.15);
    humGain.exponentialRampToValueAtTime(0.001, t + 2);
    hum.start(t);
    hum.stop(t + 2.1);
  }

  // Static hiss: two independent noise channels panned apart so it sounds wide in stereo.
  // Band-limited so it reads as TV static rather than a harsh high-frequency hiss.
  function setHiss(level, seconds) {
    if (!ctx) return;
    if (!hiss) {
      hiss = [-0.6, 0.6].map((pan) => {
        const { src, filter } = noiseSource('lowpass', 3500);
        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 300;
        filter.connect(highpass);
        src.loop = true;
        const gain = route(highpass, pan);
        gain.value = 0;
        src.start(0, Math.random() * 2);
        return { src, gain };
      });
    }
    const t = ctx.currentTime;
    for (const { gain } of hiss) {
      gain.cancelScheduledValues(t);
      gain.setValueAtTime(gain.value, t);
      gain.linearRampToValueAtTime(level, t + seconds);
    }
  }

  // Exponential decay sounds like a natural fade; it is effectively silent after `seconds`.
  function stopHiss(seconds = 0.3) {
    if (!hiss) return;
    const t = ctx.currentTime;
    for (const { src, gain } of hiss) {
      gain.cancelScheduledValues(t);
      gain.setValueAtTime(gain.value, t);
      gain.setTargetAtTime(0, t, seconds / 5);
      src.stop(t + seconds);
    }
    hiss = null;
  }

  function blip(freq = 1000) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const gain = route(osc);
    gain.setValueAtTime(0.06, t);
    gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Keyboard click for the terminal; panned randomly in stereo.
  function click() {
    if (mode !== 'stereo' && mode !== 'mono') return;
    init();
    const t = ctx.currentTime;
    const { src, filter } = noiseSource('bandpass', 2500 + Math.random() * 1500);
    const gain = route(filter, mode === 'stereo' ? Math.random() * 0.8 - 0.4 : 0);
    gain.setValueAtTime(0.25, t);
    gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    src.start(t, Math.random() * 1.9, 0.04);
  }

  return {
    MODES,
    powerOn,
    setHiss,
    stopHiss,
    blip,
    click,
    setMode,
    getMode: () => mode ?? 'mute',
  };
})();
