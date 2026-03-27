/* ================================================
   TIMER ENGINE — ZenFlow
   Manages countdown, mode cycling, session tracking
   ================================================ */

const TimerEngine = (() => {
  'use strict';

  // ---- Constants ----
  const MODES = {
    focus: { label: 'Focus Session',    duration: 25 * 60, cssClass: '' },
    short: { label: 'Short Break',      duration: 5  * 60, cssClass: 'mode-short' },
    long:  { label: 'Long Break',       duration: 15 * 60, cssClass: 'mode-long' },
  };

  const SESSIONS_BEFORE_LONG = 4;
  const CIRCUMFERENCE = 2 * Math.PI * 108; // ≈ 678.58

  // ---- State ----
  let state = {
    mode: 'focus',
    timeLeft: MODES.focus.duration,
    totalDuration: MODES.focus.duration,
    isRunning: false,
    sessionCount: 0,      // completed focus sessions
    cycleCount: 0,        // full 4-session cycles completed
    activeSoundId: null,
  };

  let _intervalId = null;
  let _onTickCb = null;
  let _onCompleteCb = null;
  let _onModeChangeCb = null;

  // ---- Public API ----
  function init(callbacks = {}) {
    _onTickCb = callbacks.onTick || (() => {});
    _onCompleteCb = callbacks.onComplete || (() => {});
    _onModeChangeCb = callbacks.onModeChange || (() => {});
    _onTickCb(state); // initial render
  }

  function start() {
    if (state.isRunning) return;
    AudioEngine.initContext();
    state.isRunning = true;

    // Play soundscape only during focus
    if (state.mode === 'focus' && state.activeSoundId) {
      AudioEngine.resumeSoundscape();
    }

    _intervalId = setInterval(() => {
      if (!state.isRunning) return;
      state.timeLeft = Math.max(0, state.timeLeft - 1);
      _onTickCb({ ...state });

      if (state.timeLeft === 0) {
        _handleComplete();
      }
    }, 1000);
  }

  function pause() {
    if (!state.isRunning) return;
    state.isRunning = false;
    clearInterval(_intervalId);
    _intervalId = null;

    // Pause soundscape on pause
    if (state.mode === 'focus') {
      AudioEngine.pauseSoundscape(800);
    }
    _onTickCb({ ...state });
  }

  function toggle() {
    if (state.isRunning) pause();
    else start();
  }

  function reset() {
    pause();
    state.timeLeft = MODES[state.mode].duration;
    state.totalDuration = MODES[state.mode].duration;
    state.isRunning = false;
    AudioEngine.pauseSoundscape(600);
    _onTickCb({ ...state });
  }

  function setMode(mode) {
    if (!MODES[mode]) return;
    pause();
    AudioEngine.pauseSoundscape(600);
    state.mode = mode;
    state.timeLeft = MODES[mode].duration;
    state.totalDuration = MODES[mode].duration;
    state.isRunning = false;
    _onModeChangeCb({ ...state });
    _onTickCb({ ...state });
  }

  function skip() {
    pause();
    _handleComplete(true);
  }

  function setSoundscape(id) {
    state.activeSoundId = id;
    if (state.isRunning && state.mode === 'focus') {
      AudioEngine.playSoundscape(id);
    }
  }

  function clearSoundscape() {
    state.activeSoundId = null;
    AudioEngine.stopSoundscape();
  }

  function getState() { return { ...state }; }

  // ---- Internal ----
  function _handleComplete(skipped = false) {
    clearInterval(_intervalId);
    _intervalId = null;
    state.isRunning = false;
    AudioEngine.pauseSoundscape(400);

    if (!skipped) {
      AudioEngine.ringBell();
    }

    // Advance session
    if (state.mode === 'focus') {
      state.sessionCount++;
    }

    // Determine next mode
    const nextMode = _getNextMode();
    _onCompleteCb({ ...state, completedMode: state.mode, nextMode, skipped });

    // Auto-advance mode
    state.mode = nextMode;
    state.timeLeft = MODES[nextMode].duration;
    state.totalDuration = MODES[nextMode].duration;

    if (state.mode === 'focus' && state.sessionCount >= SESSIONS_BEFORE_LONG) {
      // Reset after a long break would have been triggered
    }

    _onModeChangeCb({ ...state });
    _onTickCb({ ...state });
  }

  function _getNextMode() {
    if (state.mode === 'focus') {
      // After N focus sessions, take a long break
      if ((state.sessionCount + 1) % SESSIONS_BEFORE_LONG === 0) {
        return 'long';
      }
      return 'short';
    }
    // After any break, back to focus
    return 'focus';
  }

  // ---- Progress helpers ----
  function getProgress() {
    if (state.totalDuration === 0) return 0;
    return 1 - (state.timeLeft / state.totalDuration);
  }

  function getRingOffset() {
    return CIRCUMFERENCE * (1 - getProgress());
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return {
      minutes: String(m).padStart(2, '0'),
      seconds: String(s).padStart(2, '0'),
    };
  }

  function getModeLabel() {
    return MODES[state.mode]?.label || '';
  }

  function getModeClass() {
    return {
      focus: '',
      short: 'mode-short',
      long: 'mode-long',
    }[state.mode] || '';
  }

  return {
    init,
    start,
    pause,
    toggle,
    reset,
    skip,
    setMode,
    setSoundscape,
    clearSoundscape,
    getState,
    getProgress,
    getRingOffset,
    formatTime,
    getModeLabel,
    getModeClass,
    MODES,
    CIRCUMFERENCE,
  };
})();

window.TimerEngine = TimerEngine;
