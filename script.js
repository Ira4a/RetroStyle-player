// --- STATE MANAGEMENT ---
let playlist = [
  { title: "RETRO SYNTH INFUSION", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { title: "NEON HORIZON FLIGHT", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" }
];
let currentTrackIndex = 0;
let visualizerStyle = 'bars'; // Global styles tracking state: bars, sine, pulse

// --- AUDIO CONTEXT GRAPH SETUP ---
let audioCtx = null;
let audioSource = null;
let analyser = null;
let dataArray = [];

const audio = document.getElementById('main-audio');

// Initializes the audio node graph upon user gesture to comply with browser safety rules
function initAudioPipeline() {
  if (audioCtx) return; // Keep setup singleton
  
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256; // Defines sample frequency resolution data size
  
  audioSource = audioCtx.createMediaElementSource(audio);
  audioSource.connect(analyser);
  analyser.connect(audioCtx.destination);
  
  const bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);
}

// --- DOM ELEMENT EXTENSIONS ---
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

// --- BACKGROUND CANVAS ANIMATION MOTOR ---
const canvas = document.getElementById('visualizer-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Target initialization call

function renderVisuals() {
  requestAnimationFrame(renderVisuals);
  
  // Clear the canvas area on every frame update loop
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (!analyser) return;
  
  // Fetch specific analytical binary data formats array based on style choices
  if (visualizerStyle === 'sine') {
    analyser.getByteTimeDomainData(dataArray);
  } else {
    analyser.getByteFrequencyData(dataArray);
  }
  
  const accentColor = getComputedStyle(playerDeck).getPropertyValue('--led-color').trim();
  
  // RENDER PATTERN 1: RETRO FREQUENCY BARS (Bottom Anchor)
  if (visualizerStyle === 'bars') {
    const barWidth = (canvas.width / dataArray.length) * 1.5;
    let barHeight;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
      barHeight = (dataArray[i] / 255) * (canvas.height * 0.4);
      
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.12; // Keeps the background subtle
      ctx.fillRect(x, canvas.height - barHeight, barWidth - 4, barHeight);
      x += barWidth;
    }
  } 
  
  // RENDER PATTERN 2: SINE WAVE OSCILLOSCOPE (Center Screen)
  else if (visualizerStyle === 'sine') {
    ctx.lineWidth = 3;
    ctx.strokeStyle = accentColor;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    
    const sliceWidth = canvas.width * 1.0 / dataArray.length;
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
  
  // RENDER PATTERN 3: CYBER PULSE AMBIENT GLOW
  else if (visualizerStyle === 'pulse') {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const averageVolume = sum / dataArray.length;
    const pulseRadius = (averageVolume / 255) * (canvas.width * 0.25) + 100;
    
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, pulseRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = accentColor;
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 15;
    ctx.stroke();
  }
}
// Launch animation cycle loop runtime engine
renderVisuals();

// --- HARDWARE INTERACTIVE BEHAVIORS ---
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

// Drive VU-meter on current audio calculations frame
audio.addEventListener('timeupdate', () => {
  displayTime.innerText = formatTime(audio.currentTime);
  
  if (analyser && !audio.paused) {
    analyser.getByteFrequencyData(dataArray);
    let total = 0;
    for(let i=0; i<10; i++) total += dataArray[i]; // Sample lower bands for kicks
    const lowEndRatio = (total / 10) / 255;
    vuLeft.style.width = `${Math.min(lowEndRatio * 100 * 1.3, 100)}%`;
  }
});

function formatTime(seconds) {
  if (isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// --- CONTROLS BINDING ---
btnPlay.addEventListener('click', () => {
  initAudioPipeline();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  if(playlist.length > 0 && !audio.src) {
    loadTrack(0);
  }
  audio.play();
  updateDeckUX('play');
});

btnPause.addEventListener('click', () => {
  audio.pause();
  updateDeckUX('pause');
});

btnStop.addEventListener('click', () => {
  audio.pause();
  audio.currentTime = 0;
  updateDeckUX('stop');
});

audio.addEventListener('ended', () => {
  updateDeckUX('stop');
});

// --- PLAYLIST ENGINE ACTIONS ---
function renderPlaylist() {
  playlistContainer.innerHTML = '';
  playlist.forEach((track, index) => {
    const div = document.createElement('div');
    div.className = `playlist-item ${index === currentTrackIndex ? 'active-track' : ''}`;
    div.innerHTML = `<span>${index + 1}. ${track.title}</span>`;
    
    div.addEventListener('click', () => {
      initAudioPipeline();
      loadTrack(index);
      audio.play();
      updateDeckUX('play');
    });
    
    playlistContainer.appendChild(div);
  });
}

function loadTrack(index) {
  if (index < 0 || index >= playlist.length) return;
  currentTrackIndex = index;
  audio.src = playlist[index].url;
  displayTitle.innerText = playlist[index].title.toUpperCase();
  renderPlaylist();
}

addTrackBtn.addEventListener('click', () => {
  const title = trackTitleInput.value.trim();
  const url = trackUrlInput.value.trim();
  
  if (title && url) {
    playlist.push({ title: title, url: url });
    trackTitleInput.value = '';
    trackUrlInput.value = '';
    renderPlaylist();
    
    // Auto load if first item added
    if(playlist.length === 1) {
      loadTrack(0);
    }
  }
});

// Color Picker Interface Action Modifier
editColor.addEventListener('input', () => {
  playerDeck.style.setProperty('--led-color', editColor.value);
});

// Visual Style Variant Mode Switches Selector Bindings
document.querySelectorAll('.wave-opt-btn').forEach(button => {
  button.addEventListener('click', (e) => {
    document.querySelectorAll('.wave-opt-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    visualizerStyle = e.target.getAttribute('data-style');
  });
});

// Initial boot configurations setup load
renderPlaylist();
