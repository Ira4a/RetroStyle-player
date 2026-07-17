// DOM Element Targets
const audio = document.getElementById('main-audio');
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');
const spindleL = document.getElementById('spindle-l');
const spindleR = document.getElementById('spindle-r');
const displayTime = document.getElementById('display-time');
const statusText = document.getElementById('status-text');
const vuBar = document.getElementById('vu-bar');
const vuLeft = document.getElementById('vu-left');

// Editor Form targets
const editTitle = document.getElementById('edit-title');
const editColor = document.getElementById('edit-color');
const editSource = document.getElementById('edit-source');
const applyBtn = document.getElementById('apply-changes-btn');

const displayTitle = document.getElementById('display-title');
const playerDeck = document.getElementById('player-deck');

let vuInterval = null;

// Helper: Format audio seconds into MM:SS
function formatTime(seconds) {
  if (isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Audio Engine Action triggers
function setPlaybackState(state) {
  statusText.innerText = state.toUpperCase();
  
  if (state === 'play') {
    spindleL.classList.add('spinning');
    spindleR.classList.add('spinning');
    startVUMeter();
  } else {
    spindleL.classList.remove('spinning');
    spindleR.classList.remove('spinning');
    stopVUMeter();
    if (state === 'stop') {
      displayTime.innerText = "00:00";
    }
  }
}

// Simulated active VU-Meter behavior
function startVUMeter() {
  if (vuInterval) clearInterval(vuInterval);
  vuInterval = setInterval(() => {
    const level = Math.floor(Math.random() * 85) + 15; // bouncing 15%-100%
    vuLeft.style.width = `${level}%`;
  }, 100);
}

function stopVUMeter() {
  clearInterval(vuInterval);
  vuLeft.style.width = '0%';
}

// Hardware Deck Bindings
btnPlay.addEventListener('click', () => {
  audio.play().then(() => {
    setPlaybackState('play');
  }).catch(err => console.log("Audio play blocked or loading:", err));
});

btnPause.addEventListener('click', () => {
  audio.pause();
  setPlaybackState('pause');
});

btnStop.addEventListener('click', () => {
  audio.pause();
  audio.currentTime = 0;
  setPlaybackState('stop');
});

// Update runtime clock counter
audio.addEventListener('timeupdate', () => {
  displayTime.innerText = formatTime(audio.currentTime);
});

// Auto reset deck when tape reaches end
audio.addEventListener('ended', () => {
  setPlaybackState('stop');
});

// Dynamic Configuration / Live Editor Processor
applyBtn.addEventListener('click', () => {
  // Update Title
  displayTitle.innerText = editTitle.value.toUpperCase();
  
  // Update Color Theme using CSS Variables
  const hexColor = editColor.value;
  playerDeck.style.setProperty('--led-color', hexColor);
  
  // Swap Track Source Safe Injection
  const currentlyPlaying = !audio.paused;
  audio.src = editSource.value;
  audio.load();
  
  if (currentlyPlaying) {
    audio.play().then(() => setPlaybackState('play'));
  } else {
    setPlaybackState('stop');
  }
});
