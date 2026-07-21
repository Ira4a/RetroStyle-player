 /* ==========================================================================
       2. JAVASCRIPT LOGIC (Copy this block into script.js if using separate files)
       ========================================================================== */

    // Playlist State (Starts with built-in procedural synth tracks guarantee zero CORS issues!)
    let playlist = [
      { title: "SYNTHWAVE 84 (BUILT-IN SYNTH)", url: "synth:wave84", type: "SYNTH" },
      { title: "NEON DRIFT (BUILT-IN SYNTH)", url: "synth:neondrift", type: "SYNTH" }
    ];
    let currentTrackIndex = 0;
    let visualizerStyle = 'bars';

    // Web Audio API Pipeline
    let audioCtx = null;
    let analyser = null;
    let dataArray = [];
    let mediaSource = null;
    let synthInterval = null;
    let currentSynthOsc = null;
    let synthStartTime = 0;
    let synthElapsedTime = 0;

    const audio = document.getElementById('main-audio');
    const btnPlay = document.getElementById('btn-play');
    const btnPause = document.getElementById('btn-pause');
    const btnStop = document.getElementById('btn-stop');
    const spindleL = document.getElementById('spindle-l');
    const spindleR = document.getElementById('spindle-r');
    const displayTime = document.getElementById('display-time');
    const statusText = document.getElementById('status-text');
    const displayTitle = document.getElementById('display-title');
    const vuLeft = document.getElementById('vu-left');
    const editColor = document.getElementById('edit-color');
    const playerDeck = document.getElementById('player-deck');
    const playlistContainer = document.getElementById('playlist-container');
    const localFileInput = document.getElementById('local-file-input');
    const trackTitleInput = document.getElementById('track-title-input');
    const trackUrlInput = document.getElementById('track-url-input');
    const addUrlBtn = document.getElementById('add-url-btn');
    const addSynthBtn = document.getElementById('add-synth-btn');

    // Visualizer Canvas Setup
    const canvas = document.getElementById('visualizer-canvas');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function initAudioContext() {
      if (audioCtx) return;
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Connect standard audio tag to Web Audio pipeline
      try {
        mediaSource = audioCtx.createMediaElementSource(audio);
        mediaSource.connect(analyser);
        analyser.connect(audioCtx.destination);
      } catch(e) {
        console.warn("MediaElementSource attached");
      }
    }

    // Canvas Animation Loop
    function renderVisuals() {
      requestAnimationFrame(renderVisuals);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isPlaying = (playlist[currentTrackIndex]?.type === 'SYNTH' && currentSynthOsc) || (!audio.paused);
      const accentColor = getComputedStyle(playerDeck).getPropertyValue('--led-color').trim();

      if (analyser && isPlaying) {
        if (visualizerStyle === 'sine') {
          analyser.getByteTimeDomainData(dataArray);
        } else {
          analyser.getByteFrequencyData(dataArray);
        }
      } else {
        if (dataArray.length > 0) dataArray.fill(visualizerStyle === 'sine' ? 128 : 0);
      }

      if (!dataArray.length) return;

      // 1. Retro Frequency Bars
      if (visualizerStyle === 'bars') {
        const barWidth = (canvas.width / dataArray.length) * 1.6;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
          let barHeight = (dataArray[i] / 255) * (canvas.height * 0.42);
          ctx.fillStyle = accentColor;
          ctx.globalAlpha = 0.15;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 4, barHeight);
          x += barWidth;
        }
      } 
      // 2. Sine Wave Oscilloscope
      else if (visualizerStyle === 'sine') {
        ctx.lineWidth = 3;
        ctx.strokeStyle = accentColor;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        const sliceWidth = canvas.width / dataArray.length;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * (canvas.height / 2);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      } 
      // 3. Cyber Pulse Radial Energy
      else if (visualizerStyle === 'pulse') {
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const pulseRadius = (avg / 255) * (canvas.width * 0.22) + 90;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, pulseRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = accentColor;
        ctx.globalAlpha = 0.12;
        ctx.lineWidth = 20;
        ctx.stroke();
      }
    }
    renderVisuals();

    // Procedural Synth Sound Generator (100% Offline & CORS Safe)
    function playSynthTrack(preset) {
      stopSynthTrack();
      initAudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.15;
      masterGain.connect(analyser);
      analyser.connect(audioCtx.destination);

      const notes = preset === 'synth:wave84' 
        ? [110, 130.81, 146.83, 164.81, 196, 220, 246.94]
        : [130.81, 155.56, 174.61, 196, 233.08, 261.63];

      let noteIdx = 0;
      synthStartTime = Date.now() - (synthElapsedTime * 1000);

      synthInterval = setInterval(() => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const noteGain = audioCtx.createGain();
        
        osc.type = preset === 'synth:wave84' ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(notes[noteIdx % notes.length], audioCtx.currentTime);
        noteIdx++;

        noteGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }, 250);

      currentSynthOsc = masterGain;
    }

    function stopSynthTrack() {
      if (synthInterval) {
        clearInterval(synthInterval);
        synthInterval = null;
      }
      if (currentSynthOsc) {
        currentSynthOsc.disconnect();
        currentSynthOsc = null;
      }
    }

    // Hardware UI State Updates
    function updateDeckUX(state) {
      statusText.innerText = state.toUpperCase();
      if (state === 'play') {
        spindleL.classList.add('spinning');
        spindleR.classList.add('spinning');
      } else {
        spindleL.classList.remove('spinning');
        spindleR.classList.remove('spinning');
        if (state === 'stop') {
          displayTime.innerText = "00:00";
          vuLeft.style.width = "0%";
          synthElapsedTime = 0;
        }
      }
    }

    // Time & VU Meter updates
    setInterval(() => {
      const track = playlist[currentTrackIndex];
      if (!track) return;

      if (track.type === 'SYNTH' && currentSynthOsc) {
        synthElapsedTime = (Date.now() - synthStartTime) / 1000;
        displayTime.innerText = formatTime(synthElapsedTime);

        // VU Bar jump logic
        if (analyser) {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < 15; i++) sum += dataArray[i];
          const level = (sum / 15) / 255 * 100 * 1.2;
          vuLeft.style.width = `${Math.min(level, 100)}%`;
        }
      } else if (track.type !== 'SYNTH' && !audio.paused) {
        displayTime.innerText = formatTime(audio.currentTime);

        if (analyser) {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < 15; i++) sum += dataArray[i];
          const level = (sum / 15) / 255 * 100 * 1.2;
          vuLeft.style.width = `${Math.min(level, 100)}%`;
        }
      }
    }, 100);

    function formatTime(seconds) {
      if (isNaN(seconds)) return "00:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Controls Action Listeners
    btnPlay.addEventListener('click', () => {
      initAudioContext();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

      const track = playlist[currentTrackIndex];
      if (!track) return;

      if (track.type === 'SYNTH') {
        audio.pause();
        playSynthTrack(track.url);
        updateDeckUX('play');
      } else {
        stopSynthTrack();
        audio.play().then(() => {
          updateDeckUX('play');
        }).catch(err => {
          console.warn("Playback error or CORS block:", err);
          updateDeckUX('play');
        });
      }
    });

    btnPause.addEventListener('click', () => {
      const track = playlist[currentTrackIndex];
      if (track && track.type === 'SYNTH') {
        stopSynthTrack();
      } else {
        audio.pause();
      }
      updateDeckUX('pause');
    });

    btnStop.addEventListener('click', () => {
      stopSynthTrack();
      audio.pause();
      audio.currentTime = 0;
      updateDeckUX('stop');
    });

    audio.addEventListener('ended', () => {
      updateDeckUX('stop');
    });

    // Playlist Manager
    function renderPlaylist() {
      playlistContainer.innerHTML = '';
      playlist.forEach((track, index) => {
        const div = document.createElement('div');
        div.className = `playlist-item ${index === currentTrackIndex ? 'active-track' : ''}`;
        div.innerHTML = `
          <span>${index + 1}. ${track.title}</span>
          <span class="track-type-badge">${track.type}</span>
        `;
        
        div.addEventListener('click', () => {
          loadTrack(index);
          btnPlay.click();
        });
        
        playlistContainer.appendChild(div);
      });
    }

    function loadTrack(index) {
      if (index < 0 || index >= playlist.length) return;
      currentTrackIndex = index;
      const track = playlist[index];

      stopSynthTrack();
      audio.pause();
      audio.currentTime = 0;
      synthElapsedTime = 0;

      if (track.type !== 'SYNTH') {
        audio.src = track.url;
      }
      
      displayTitle.innerText = track.title.toUpperCase();
      renderPlaylist();
    }

    // Local MP3 File Handler
    localFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const objectUrl = URL.createObjectURL(file);
        const title = file.name.replace(/\.[^/.]+$/, "");
        
        playlist.push({
          title: title.toUpperCase(),
          url: objectUrl,
          type: "LOCAL FILE"
        });
        
        renderPlaylist();
        loadTrack(playlist.length - 1);
        btnPlay.click();
      }
    });

    // Custom URL Input Handler
    addUrlBtn.addEventListener('click', () => {
      const title = trackTitleInput.value.trim() || "EXTERNAL TRACK";
      let url = trackUrlInput.value.trim();

      if (url) {
        if (url.startsWith('http://')) url = url.replace('http://', 'https://');
        
        playlist.push({
          title: title.toUpperCase(),
          url: url,
          type: "URL"
        });
        
        trackTitleInput.value = '';
        trackUrlInput.value = '';
        renderPlaylist();
        loadTrack(playlist.length - 1);
      }
    });

    // Add Procedural Synth Preset Handler
    addSynthBtn.addEventListener('click', () => {
      const synthCount = playlist.filter(t => t.type === 'SYNTH').length + 1;
      playlist.push({
        title: `RETRO SYNTH WAVE #${synthCount}`,
        url: synthCount % 2 === 0 ? 'synth:neondrift' : 'synth:wave84',
        type: "SYNTH"
      });
      renderPlaylist();
    });

    // Accent Color Picker Handler
    editColor.addEventListener('input', () => {
      playerDeck.style.setProperty('--led-color', editColor.value);
    });

    // Wave Mode Selectors
    document.querySelectorAll('.wave-opt-btn').forEach(btn => {
      buttonEventListener(btn);
    });

    function buttonEventListener(button) {
      button.addEventListener('click', (e) => {
        document.querySelectorAll('.wave-opt-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        visualizerStyle = e.target.getAttribute('data-style');
      });
    }

    // Boot Up
    renderPlaylist();
    loadTrack(0);
