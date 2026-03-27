/* ================================================
   APP.JS — ZenFlow Main Controller
   Connects UI ↔ TimerEngine ↔ AudioEngine
   ================================================ */

(function () {
  'use strict';

  // ---- DOM References ----
  const body            = document.body;
  const bgGradient      = document.querySelector('.bg-gradient');
  const orb1            = document.querySelector('.orb-1');
  const orb2            = document.querySelector('.orb-2');
  const orb3            = document.querySelector('.orb-3');

  // Header
  const dots            = document.querySelectorAll('.dot');
  const sessionNumEl    = document.getElementById('session-num');
  const sessionInfoEl   = document.getElementById('session-info');
  const sessionCountLbl = document.getElementById('session-count-label');
  const cycleCompleteLbl= document.getElementById('sessions-completed-label');

  // Tabs
  const tabs            = document.querySelectorAll('.tab');

  // Timer
  const timerCard       = document.getElementById('timer-card');
  const ringProgress    = document.getElementById('ring-progress');
  const ringGlow        = document.getElementById('ring-glow');
  const minutesEl       = document.getElementById('timer-minutes');
  const secondsEl       = document.getElementById('timer-seconds');
  const colonEl         = document.getElementById('timer-colon');
  const modeLabelEl     = document.getElementById('mode-label');

  // Controls
  const playBtn         = document.getElementById('play-btn');
  const iconPlay        = document.getElementById('icon-play');
  const iconPause       = document.getElementById('icon-pause');
  const resetBtn        = document.getElementById('reset-btn');
  const skipBtn         = document.getElementById('skip-btn');

  // Soundscape
  const soundBtns       = document.querySelectorAll('.sound-btn');

  // Notification
  const notifOverlay    = document.getElementById('notif-overlay');
  const notifTitle      = document.getElementById('notif-title');
  const notifSub        = document.getElementById('notif-sub');
  const notifOkBtn      = document.getElementById('notif-ok');



  // ---- Notification Messages ----
  const NOTIF_MESSAGES = {
    focus: {
      icon: '✨',
      title: (s) => `Session ${s} Complete!`,
      sub: 'Time for a well-earned break. You did great.',
      btnText: 'Start Break',
    },
    short: {
      icon: '🎯',
      title: () => 'Break Over!',
      sub: 'Ready to dive back in? Let\'s keep the momentum.',
      btnText: 'Start Focus',
    },
    long: {
      icon: '🌟',
      title: () => 'Long Break Complete!',
      sub: 'Fully recharged. Let\'s make this session count.',
      btnText: 'Start Focus',
    },
  };

  // ---- Render ----
  function renderTick(state) {
    const { minutes, seconds } = TimerEngine.formatTime(state.timeLeft);
    minutesEl.textContent = minutes;
    secondsEl.textContent = seconds;

    // Update page title
    document.title = `${minutes}:${seconds} — Focus`;

    // Ring progress
    const offset = TimerEngine.getRingOffset();
    ringProgress.style.strokeDashoffset = offset;
    ringGlow.style.strokeDashoffset = offset;

    // Colon blink
    colonEl.className = state.isRunning ? 'running' : 'stopped';

    // Play/Pause icon
    if (state.isRunning) {
      iconPlay.classList.add('hidden');
      iconPause.classList.remove('hidden');
      playBtn.classList.add('pulsing');
      timerCard.classList.add('running');
    } else {
      iconPlay.classList.remove('hidden');
      iconPause.classList.add('hidden');
      playBtn.classList.remove('pulsing');
      timerCard.classList.remove('running');
    }

    // Session dots
    const focusCount = state.sessionCount % 4;
    dots.forEach((dot, i) => {
      dot.classList.remove('active', 'done');
      if (i < focusCount) dot.classList.add('done');
      if (i === focusCount && state.mode === 'focus') dot.classList.add('active');
    });

    // Session label
    const displayNum = (state.sessionCount % 4) + 1;
    sessionNumEl.textContent = displayNum;
  }

  function renderModeChange(state) {
    // Body class for background theme
    body.classList.remove('mode-short', 'mode-long');
    const cls = TimerEngine.getModeClass();
    if (cls) body.classList.add(cls);

    // Mode label
    modeLabelEl.textContent = TimerEngine.getModeLabel();

    // Active tab
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === state.mode);
      tab.setAttribute('aria-selected', tab.dataset.mode === state.mode);
    });

    // Soundscape hint — disable buttons during breaks
    soundBtns.forEach(btn => {
      btn.style.opacity = state.mode === 'focus' ? '1' : '0.4';
      btn.style.pointerEvents = state.mode === 'focus' ? '' : 'none';
    });


  }

  function renderComplete(state) {
    const { completedMode, nextMode, skipped } = state;
    if (skipped) return; // no notification on skip

    const msg = NOTIF_MESSAGES[completedMode];
    if (!msg) return;

    // Populate notification
    document.getElementById('notif-icon').textContent = msg.icon;
    notifTitle.textContent = msg.title(state.sessionCount);
    notifSub.textContent = msg.sub;
    notifOkBtn.textContent = msg.btnText;

    // Ring flash animation
    ringProgress.classList.add('ring-complete-flash');
    setTimeout(() => ringProgress.classList.remove('ring-complete-flash'), 700);

    // Show notification after brief delay
    setTimeout(() => {
      notifOverlay.classList.remove('hidden');
    }, 500);
  }

  // ---- Init Timer Engine ----
  TimerEngine.init({
    onTick: renderTick,
    onModeChange: renderModeChange,
    onComplete: renderComplete,
  });

  // ---- Event Listeners ----

  // Play/Pause
  playBtn.addEventListener('click', () => {
    AudioEngine.initContext();
    TimerEngine.toggle();
  });

  // Reset
  resetBtn.addEventListener('click', () => {
    TimerEngine.reset();
  });

  // Skip
  skipBtn.addEventListener('click', () => {
    TimerEngine.skip();
  });

  // Mode Tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      TimerEngine.setMode(tab.dataset.mode);
    });
  });

  // Soundscape Buttons
  soundBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      AudioEngine.initContext();
      const id = btn.dataset.sound;
      const isActive = btn.getAttribute('aria-pressed') === 'true';

      // Toggle off if already active
      if (isActive) {
        btn.setAttribute('aria-pressed', 'false');
        btn.classList.remove('active');
        TimerEngine.clearSoundscape();
        return;
      }

      // Deactivate others
      soundBtns.forEach(b => {
        b.setAttribute('aria-pressed', 'false');
        b.classList.remove('active');
      });

      // Activate this
      btn.setAttribute('aria-pressed', 'true');
      btn.classList.add('active');
      TimerEngine.setSoundscape(id);
    });
  });

  // Notification OK button
  notifOkBtn.addEventListener('click', () => {
    notifOverlay.classList.add('hidden');
    // Auto-start next session after brief pause
    setTimeout(() => TimerEngine.start(), 300);
  });

  // Click backdrop to dismiss notification
  notifOverlay.addEventListener('click', (e) => {
    if (e.target === notifOverlay) {
      notifOverlay.classList.add('hidden');
    }
  });

  // ---- Keyboard Shortcuts ----
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        playBtn.click();
        break;
      case 'KeyR':
        if (!e.ctrlKey && !e.metaKey) resetBtn.click();
        break;
      case 'KeyS':
        skipBtn.click();
        break;
      case 'Digit1':
        tabs[0]?.click(); // Focus
        break;
      case 'Digit2':
        tabs[1]?.click(); // Short Break
        break;
      case 'Digit3':
        tabs[2]?.click(); // Long Break
        break;
      case 'Escape':
        notifOverlay.classList.add('hidden');
        break;
    }
  });

  // ---- Mouse parallax on background orbs ----
  let mouseX = 0, mouseY = 0;
  let ticking = false;

  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;

    if (!ticking) {
      requestAnimationFrame(() => {
        const px = mouseX * 18;
        const py = mouseY * 14;
        orb1.style.transform = `translate(${px * 0.6}px, ${py * 0.6}px)`;
        orb2.style.transform = `translate(${-px * 0.4}px, ${-py * 0.4}px)`;
        orb3.style.transform = `translate(${-50 + px * 0.2}%, ${-50 + py * 0.2}%)`;
        ticking = false;
      });
      ticking = true;
    }
  });

  // ---- Settings panel (toggle mute for now) ----
  let isMuted = false;
  document.getElementById('settings-btn').addEventListener('click', () => {
    isMuted = !isMuted;
    AudioEngine.setMuted(isMuted);
    const btn = document.getElementById('settings-btn');
    btn.title = isMuted ? 'Unmute sounds' : 'Settings';
    btn.style.color = isMuted ? 'rgba(255,100,100,0.7)' : '';
    btn.innerHTML = isMuted
      ? `<svg viewBox="0 0 20 20" fill="none" width="18" height="18">
           <path d="M2 5h3l4-3v12l-4-3H2V5z" fill="currentColor" opacity="0.5"/>
           <path d="M17 7l-4 4m0-4l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
         </svg>`
      : `<svg viewBox="0 0 20 20" fill="none" width="18" height="18">
           <path d="M2 5h3l4-3v12l-4-3H2V5z" fill="currentColor" opacity="0.7"/>
           <path d="M11 6a3 3 0 0 1 0 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
           <path d="M13 4a6 6 0 0 1 0 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.5"/>
         </svg>`;
  });

  // ---- Task Management ----
  const taskForm = document.getElementById('task-form');
  const taskInput = document.getElementById('task-input');
  const taskList = document.getElementById('task-list');

  let tasks = JSON.parse(localStorage.getItem('zenflow_tasks')) || [];

  function saveTasks() {
    localStorage.setItem('zenflow_tasks', JSON.stringify(tasks));
  }

  function renderTasks() {
    taskList.innerHTML = '';
    
    if (tasks.length === 0) {
      taskList.innerHTML = '<li style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 12px 0;">No tasks yet. Add one above!</li>';
      return;
    }

    tasks.forEach((task, index) => {
      const li = document.createElement('li');
      li.className = `task-item ${task.completed ? 'completed' : ''}`;
      
      li.innerHTML = `
        <input type="checkbox" class="task-checkbox" aria-label="Toggle task" ${task.completed ? 'checked' : ''} data-index="${index}">
        <span class="task-text">${task.text}</span>
        <button class="task-delete-btn" aria-label="Delete task" data-index="${index}">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      `;
      taskList.appendChild(li);
    });

    document.querySelectorAll('.task-checkbox').forEach(box => {
      box.addEventListener('change', (e) => {
        const idx = e.target.dataset.index;
        tasks[idx].completed = e.target.checked;
        saveTasks();
        renderTasks();
      });
    });

    document.querySelectorAll('.task-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = e.currentTarget.dataset.index;
        tasks.splice(idx, 1);
        saveTasks();
        renderTasks();
      });
    });
  }

  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    if (text) {
      tasks.push({ text, completed: false });
      taskInput.value = '';
      saveTasks();
      renderTasks();
    }
  });

  renderTasks();

  // ---- Initial render ----
  renderModeChange(TimerEngine.getState());
  renderTick(TimerEngine.getState());

  console.log('%c🧘 Focus loaded!', 'color: #a78bfa; font-size: 16px; font-weight: bold;');
  console.log('%cShortcuts: Space=Play/Pause  R=Reset  S=Skip  1/2/3=Modes', 'color: #67e8f9; font-size: 12px;');
})();
