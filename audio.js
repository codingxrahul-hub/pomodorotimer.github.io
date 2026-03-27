/* ================================================
   AUDIO ENGINE — ZenFlow Soundscapes + Zen Bell
   Uses Web Audio API for bell, HTML5 Audio for loops
   ================================================ */

const AudioEngine = (() => {
  'use strict';

  // ---- Sound URLs (public CDN, royalty-free) ----
  const SOUNDS = {
    rain:   'https://assets.mixkit.co/active_storage/sfx/2515/2515.mp3',
    white:  'https://assets.mixkit.co/active_storage/sfx/2864/2864.mp3',
    forest: 'https://assets.mixkit.co/active_storage/sfx/2712/2712.mp3',
    bell:   'https://assets.mixkit.co/active_storage/sfx/2869/2869.mp3',
  };

  // Fallback inline bell via Web Audio API (works offline)
  let audioCtx = null;
  let activeSoundscape = null;   // currently playing <audio> element
  let activeSoundId = null;
  let audioPool = {};            // cache of created <audio> elements
  let masterVolume = 0.55;
  let bellVolume = 0.8;
  let isMuted = false;
  let fadeTimer = null;

  // ---- Init & unlock audio context on first interaction ----
  function initContext() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('[ZenFlow Audio] Web Audio API not available:', e);
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function getOrCreateAudio(id) {
    if (!audioPool[id]) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.loop = true;
      audio.volume = 0;
      audio.preload = 'auto';
      audio.src = SOUNDS[id];
      audioPool[id] = audio;
    }
    return audioPool[id];
  }

  // ---- Soundscape Control ----
  function playSoundscape(id, fadeMs = 1500) {
    initContext();
    if (isMuted) return;
    if (activeSoundId === id && activeSoundscape && !activeSoundscape.paused) return;

    // Stop current first
    if (activeSoundscape) _fadeOut(activeSoundscape, 600);

    const audio = getOrCreateAudio(id);
    activeSoundscape = audio;
    activeSoundId = id;

    audio.currentTime = Math.random() * 10; // start at random point for variety
    audio.play().catch(() => {
      // Autoplay restriction — will play on next user gesture
      console.info('[ZenFlow Audio] Soundscape will start after user interaction');
    });

    _fadeIn(audio, masterVolume, fadeMs);
  }

  function pauseSoundscape(fadeMs = 1000) {
    if (!activeSoundscape) return;
    _fadeOut(activeSoundscape, fadeMs, () => {
      activeSoundscape.pause();
      activeSoundId = null;
    });
  }

  function resumeSoundscape(fadeMs = 1200) {
    if (!activeSoundscape || !activeSoundId) return;
    initContext();
    if (isMuted) return;
    activeSoundscape.play().catch(() => {});
    _fadeIn(activeSoundscape, masterVolume, fadeMs);
  }

  function stopSoundscape(fadeMs = 800) {
    if (!activeSoundscape) return;
    _fadeOut(activeSoundscape, fadeMs, () => {
      activeSoundscape.pause();
      activeSoundscape.currentTime = 0;
    });
    activeSoundscape = null;
    activeSoundId = null;
  }

  // ---- Zen Bell ----
  function ringBell() {
    if (isMuted) return;
    initContext();

    // Try HTML5 bell first
    const bellAudio = new Audio(SOUNDS.bell);
    bellAudio.crossOrigin = 'anonymous';
    bellAudio.volume = bellVolume;
    bellAudio.play().catch(() => {
      // Fallback: synthesize bell with Web Audio API
      _synthesizeBell();
    });
  }

  function _synthesizeBell() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // Create a resonant bell tone using oscillators
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(440, now + 2);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now);
    osc2.frequency.exponentialRampToValueAtTime(660, now + 1.5);

    gain.gain.setValueAtTime(bellVolume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 3);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 3.5);
    osc2.stop(now + 3.5);
  }

  // ---- Soft click tick sound (UI feedback) ----
  function tick() {
    if (isMuted || !audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // ---- Volume Controls ----
  function setVolume(v) {
    masterVolume = Math.max(0, Math.min(1, v));
    if (activeSoundscape) activeSoundscape.volume = masterVolume;
  }

  function setMuted(val) {
    isMuted = val;
    if (val) pauseSoundscape(400);
    else resumeSoundscape(400);
  }

  function getCurrentSoundId() { return activeSoundId; }
  function isPlaying() { return activeSoundscape && !activeSoundscape.paused; }

  // ---- Fade Helpers ----
  function _fadeIn(audio, targetVol, ms) {
    clearInterval(fadeTimer);
    const steps = 30;
    const interval = ms / steps;
    let step = 0;
    audio.volume = 0;
    fadeTimer = setInterval(() => {
      step++;
      audio.volume = Math.min(targetVol, (step / steps) * targetVol);
      if (step >= steps) clearInterval(fadeTimer);
    }, interval);
  }

  function _fadeOut(audio, ms, onDone) {
    clearInterval(fadeTimer);
    const steps = 20;
    const interval = ms / steps;
    const startVol = audio.volume;
    let step = 0;
    fadeTimer = setInterval(() => {
      step++;
      audio.volume = Math.max(0, startVol * (1 - step / steps));
      if (step >= steps) {
        clearInterval(fadeTimer);
        if (onDone) onDone();
      }
    }, interval);
  }

  // ---- Public API ----
  return {
    playSoundscape,
    pauseSoundscape,
    resumeSoundscape,
    stopSoundscape,
    ringBell,
    tick,
    setVolume,
    setMuted,
    getCurrentSoundId,
    isPlaying,
    initContext,
  };
})();

window.AudioEngine = AudioEngine;
