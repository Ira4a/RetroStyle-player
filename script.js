   let playlist = [
      { title: "SYNTHWAVE 84 (BUILT-IN SYNTH)", url: "synth:wave84", type: "SYNTH" },
      { title: "NEON DRIFT (BUILT-IN SYNTH)", url: "synth:neondrift", type: "SYNTH" }
    ];
    let currentTrackIndex = 0;
    let visualizerStyle = 'bars';

    // Web Audio API
    let audioCtx = null;
    let analyser = null;
    let dataArray = [];
    let mediaSource = null;
    let mediaSourceConnected = false;
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

    // Visualizer Canvas
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
      
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        // Don't connect media source yet - do it on first play
        console.log('AudioContext initialized successfully');
      } catch(e) {
        console.error('Failed to create AudioContext:', e);
      }
    }

    function connectMediaSource() {
      if (!audioCtx || mediaSourceConnected) return;
      
      try {
        if (!mediaSource) {
          mediaSource = audioCtx.createMediaElementSource(audio);
        }
        mediaSource.connect(analyser);
        analyser.connect(audioCtx.destination);
        mediaSourceConnected = true;
        console.log('Media source connected to analyser');
      } catch(e) {
        console.warn('Could not connect media source:', e);
      }
    }

    // Canvas Animation Loop
    function renderVisuals() {
      requestAnimationFrame(renderVisuals);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentTrack = playlist[currentTrackIndex];
      const isSynthPlaying = currentTrack && currentTrack.type === 'SYNTH' && currentSynthOsc;
      const isAudioPlaying = !audio.paused && !audio.ended && audio.duration > 0;
      const isPlaying = isSynthPlaying || isAudioPlaying;
      
      const computedStyle = getComputedStyle(playerDeck);
      const accentColor = computedStyle.getPropertyValue('--led-color').trim() || '#ff007f';

      if (analyser && isPlaying) {
        if (visualizerStyle === 'sine') {
          analyser.getByteTimeDomainData(dataArray);
        } else {
          analyser.getByteFrequencyData(dataArray);
        }
      } else {
        // Fill with neutral data when not playing
        if (dataArray.length > 0) {
          dataArray.fill(visualizerStyle === 'sine' ? 128 : 0);
        }
      }

      if (!dataArray.length || dataArray.length === 0) return;

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
      
      ctx.globalAlpha = 1;
    }
    renderVisuals();

    // Procedural Synth Sound Generator
    function playSynthTrack(preset) {
      stopSynthTrack();
      initAudioContext();
      
      if (!audioCtx) return;
      
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

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
        try {
          currentSynthOsc.disconnect();
        } catch(e) {}
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

        if (analyser) {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < Math.min(15, dataArray.length); i++) sum += dataArray[i];
          const level = (sum / 15) / 255 * 100 * 1.2;
          vuLeft.style.width = `${Math.min(level, 100)}%`;
        }
      } else if (track.type !== 'SYNTH' && !audio.paused && audio.duration > 0) {
        displayTime.innerText = formatTime(audio.currentTime);

        if (analyser) {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < Math.min(15, dataArray.length); i++) sum += dataArray[i];
          const level = (sum / 15) / 255 * 100 * 1.2;
          vuLeft.style.width = `${Math.min(level, 100)}%`;
        }
      }
    }, 100);

    function formatTime(seconds) {
      if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Controls Action Listeners
    btnPlay.addEventListener('click', () => {
      initAudioContext();
      
      if (!audioCtx) return;
      
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
          executePlay();
        }).catch(err => {
          console.error('Could not resume AudioContext:', err);
        });
      } else {
        executePlay();
      }
    });

    function executePlay() {
      const track = playlist[currentTrackIndex];
      if (!track) return;

      if (track.type === 'SYNTH') {
        audio.pause();
        playSynthTrack(track.url);
        updateDeckUX('play');
      } else {
        stopSynthTrack();
        
        // Connect media source if not already done
        connectMediaSource();
        
        audio.play().then(() => {
          updateDeckUX('play');
          console.log('Audio playback started');
        }).catch(err => {
          console.warn("Playback error:", err);
          // Still update UI to show attempt
          updateDeckUX('play');
        });
      }
    }

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

    audio.addEventListener('error', (e) => {
      console.error('Audio loading error:', e);
      statusText.innerText = 'ERROR';
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
          // Auto-play after a short delay to allow loading
          setTimeout(() => {
            if (audioCtx && audioCtx.state === 'suspended') {
              audioCtx.resume().then(() => btnPlay.click());
            } else {
              btnPlay.click();
            }
          }, 100);
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
      mediaSourceConnected = false; // Reset connection for new track

      if (track.type !== 'SYNTH') {
        audio.src = track.url;
        audio.load();
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
        
        // Reset file input
        localFileInput.value = '';
        
        // Auto-play
        setTimeout(() => {
          if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => btnPlay.click());
          } else {
            btnPlay.click();
          }
        }, 200);
      }
    });

    // Custom URL Input Handler
    addUrlBtn.addEventListener('click', () => {
      const title = trackTitleInput.value.trim() || "EXTERNAL TRACK";
      let url = trackUrlInput.value.trim();

      if (url) {
        // Ensure HTTPS for GitHub Pages
        if (url.startsWith('http://')) {
          url = url.replace('http://', 'https://');
        }
        
        playlist.push({
          title: title.toUpperCase(),
          url: url,
          type: "URL"
        });
        
        trackTitleInput.value = '';
        trackUrlInput.value = '';
        renderPlaylist();
        loadTrack(playlist.length - 1);
        
        // Auto-play
        setTimeout(() => {
          if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => btnPlay.click());
          } else {
            btnPlay.click();
          }
        }, 200);
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
      
      // Auto-play synth tracks
      loadTrack(playlist.length - 1);
      setTimeout(() => {
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume().then(() => btnPlay.click());
        } else {
          btnPlay.click();
        }
      }, 200);
    });

    // Accent Color Picker Handler
    editColor.addEventListener('input', () => {
      playerDeck.style.setProperty('--led-color', editColor.value);
    });

    // Wave Mode Selectors
    document.querySelectorAll('.wave-opt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.wave-opt-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        visualizerStyle = e.target.getAttribute('data-style');
      });
    });

    // Initialize AudioContext on first user interaction
    document.addEventListener('click', function initAudioOnInteraction() {
      initAudioContext();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    }, { once: true });

    // Boot Up
    renderPlaylist();
    loadTrack(0);
    
    console.log('Retro Cassette Deck initialized successfully!');
    console.log('Playlist loaded with', playlist.length, 'tracks');
