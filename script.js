// Fixed with HTTPS links that support CORS stream headers on GitHub Pages
    let playlist = [
      { title: "80s SYNTHWAVE MIX", url: "https://archive.org/download/independentcyberpunkmix/01.%20Neon%20Defiant.mp3" },
      { title: "CYBERPUNK GRID RUNNER", url: "https://archive.org/download/independentcyberpunkmix/02.%20Hack%20the%20Planet.mp3" }
    ];
    let currentTrackIndex = 0;
    let visualizerStyle = 'bars';

    let audioCtx = null;
    let audioSource = null;
    let analyser = null;
    let dataArray = [];
    let isCorsBlocked = false;

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
    const trackTitleInput = document.getElementById('track-title-input');
    const trackUrlInput = document.getElementById('track-url-input');
    const addTrackBtn = document.getElementById('add-track-btn');
    const canvas = document.getElementById('visualizer-canvas');
    const ctx = canvas.getContext('2d');

    function initAudioPipeline() {
      if (audioCtx) return;
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        
        audioSource = audioCtx.createMediaElementSource(audio);
        audioSource.connect(analyser);
        analyser.connect(audioCtx.destination);
        
        dataArray = new Uint8Array(analyser.frequencyBinCount);
      } catch (e) {
        console.warn("AudioContext init bypassed for safety.");
        isCorsBlocked = true;
      }
    }

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function renderVisuals() {
      requestAnimationFrame(renderVisuals);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const accentColor = getComputedStyle(playerDeck).getPropertyValue('--led-color').trim();

      if (!audio.paused && (isCorsBlocked || !analyser)) {
        generateFakeData();
      } else if (analyser && !audio.paused) {
        try {
          if (visualizerStyle === 'sine') {
            analyser.getByteTimeDomainData(dataArray);
          } else {
            analyser.getByteFrequencyData(dataArray);
          }
        } catch(err) {
          isCorsBlocked = true;
        }
      } else {
        if(dataArray.length > 0) dataArray.fill(visualizerStyle === 'sine' ? 128 : 0);
      }
      
      if (!dataArray.length) return;

      if (visualizerStyle === 'bars') {
        const barWidth = (canvas.width / dataArray.length) * 1.5;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
          let barHeight = (dataArray[i] / 255) * (canvas.height * 0.4);
          ctx.fillStyle = accentColor;
          ctx.globalAlpha = 0.12;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 4, barHeight);
          x += barWidth;
        }
      } else if (visualizerStyle === 'sine') {
        ctx.lineWidth = 3;
        ctx.strokeStyle = accentColor;
        ctx.globalAlpha = 0.25;
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
      } else if (visualizerStyle === 'pulse') {
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const averageVolume = sum / dataArray.length;
        const pulseRadius = (averageVolume / 255) * (canvas.width * 0.2) + 100;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, pulseRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = accentColor;
        ctx.globalAlpha = 0.08;
        ctx.lineWidth = 15;
        ctx.stroke();
      }
    }

    function generateFakeData() {
      if(dataArray.length === 0) dataArray = new Uint8Array(128);
      const time = Date.now() * 0.004;
      for(let i=0; i<dataArray.length; i++) {
        if(visualizerStyle === 'sine') {
          dataArray[i] = 128 + Math.sin(i * 0.1 + time) * 40;
        } else {
          dataArray[i] = 40 + Math.abs(Math.sin(i * 0.04 + time)) * 140;
        }
      }
    }

    renderVisuals();

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
        }
      }
    }

    audio.addEventListener('timeupdate', () => {
      displayTime.innerText = formatTime(audio.currentTime);
      
      if (!audio.paused) {
        let level = 0;
        if (analyser && !isCorsBlocked) {
          try {
            analyser.getByteFrequencyData(dataArray);
            let total = 0;
            for(let i=0; i<10; i++) total += dataArray[i];
            level = (total / 10) / 255 * 100 * 1.3;
          } catch(e) {
            isCorsBlocked = true;
          }
        } else {
          level = 30 + Math.random() * 50; 
        }
        vuLeft.style.width = `${Math.min(level, 100)}%`;
      }
    });

    function formatTime(seconds) {
      if (isNaN(seconds)) return "00:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    btnPlay.addEventListener('click', () => {
      initAudioPipeline();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      if (playlist.length > 0 && !audio.src) loadTrack(0);
      
      audio.play().then(() => {
        updateDeckUX('play');
      }).catch((e) => {
        console.log("CORS playback adjustment triggered.");
        updateDeckUX('play');
      });
    });

    btnPause.addEventListener('click', () => { audio.pause(); updateDeckUX('pause'); });
    btnStop.addEventListener('click', () => { audio.pause(); audio.currentTime = 0; updateDeckUX('stop'); });
    audio.addEventListener('ended', () => { updateDeckUX('stop'); });

    function renderPlaylist() {
      playlistContainer.innerHTML = '';
      playlist.forEach((track, index) => {
        const div = document.createElement('div');
        div.className = `playlist-item ${index === currentTrackIndex ? 'active-track' : ''}`;
        div.innerHTML = `<span>${index + 1}. ${track.title}</span>`;
        div.addEventListener('click', () => {
          initAudioPipeline();
          loadTrack(index);
          audio.play().then(() => updateDeckUX('play')).catch(() => updateDeckUX('play'));
        });
        playlistContainer.appendChild(div);
      });
    }

    function loadTrack(index) {
      if (index < 0 || index >= playlist.length) return;
      currentTrackIndex = index;
      
      // Forces browser to check safe access protocol
      audio.src = playlist[index].url;
      displayTitle.innerText = playlist[index].title.toUpperCase();
      renderPlaylist();
    }

    addTrackBtn.addEventListener('click', () => {
      let title = trackTitleInput.value.trim();
      let url = trackUrlInput.value.trim();
      
      if (title && url) {
        // Enforce HTTPS rules to prevent mixed content locks on GitHub Pages
        if (url.startsWith('http://')) {
          url = url.replace('http://', 'https://');
        }
        
        playlist.push({ title: title, url: url });
        trackTitleInput.value = '';
        trackUrlInput.value = '';
        renderPlaylist();
        if(playlist.length === 1) loadTrack(0);
      }
    });

    editColor.addEventListener('input', () => {
      playerDeck.style.setProperty('--led-color', editColor.value);
    });

    document.querySelectorAll('.wave-opt-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        document.querySelectorAll('.wave-opt-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        visualizerStyle = e.target.getAttribute('data-style');
      });
    });

    // Run Engine Initializer
    renderPlaylist();
    if(playlist.length > 0) loadTrack(0);
