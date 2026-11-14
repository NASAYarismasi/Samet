import { createWristScene } from './wrist-scene.js';

// Oyun kaynakları ve görev verileri
const mission = {
  resources: { energy: 100, water: 85, oxygen: 96, food: 70 },
  mission: 'ARES-1 // İLK KOLONİ',
  objective: 'Bilek terminali ve yaşam destek kontrolü'
};

const dialog = document.querySelector('#wrist-dialog');
let view;
let returnFocus;

function openScene() {
  if (dialog.open) return;
  returnFocus = document.activeElement;
  dialog.showModal();
  try {
    view ||= createWristScene(document.querySelector('#wrist-scene'), () => mission);
    view.start();
    view.raise(true);
  } catch (error) {
    const status = document.querySelector('#model-status');
    if (status) status.textContent = '3D görünüm başlatılamadı: ' + error.message;
  }
}

function closeScene() {
  if (!dialog.open) return;
  view?.raise(false);
  setTimeout(() => {
    view?.stop();
    dialog.close();
  }, 350);
}

// Buton Etkileşimleri
const openBtn = document.querySelector('#wrist-open');
if (openBtn) openBtn.onclick = openScene;

const closeBtn = document.querySelector('#wrist-close');
if (closeBtn) closeBtn.onclick = closeScene;

const mobileBtn = document.querySelector('#mobile-wrist');
if (mobileBtn) {
  mobileBtn.onclick = () => {
    if (!dialog.open) {
      openScene();
    } else {
      view?.toggle();
    }
  };
}

dialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeScene();
});

dialog.addEventListener('close', () => returnFocus?.focus());

// KLAVYE KONTROLLERİ: [ALT] TUŞU İLE SAATE BAKMA ANİMASYONU
window.addEventListener('keydown', event => {
  if (event.repeat || event.isComposing) return;
  if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;

  // ALT tuşuna basıldığında
  if (event.key === 'Alt') {
    event.preventDefault();
    if (!dialog.open) {
      openScene();
    } else {
      view?.toggle();
    }
    return;
  }

  // ESC tuşuna basıldığında yumuşakça kapat
  if (event.key === 'Escape' && dialog.open) {
    event.preventDefault();
    closeScene();
  }
});

// Oyun verisi güncelleme olayı
window.addEventListener('wrist-data', ({ detail }) => {
  if (!detail) return;
  for (const key of ['energy', 'water', 'oxygen', 'food']) {
    const value = detail.resources?.[key];
    if (Number.isFinite(value)) mission.resources[key] = Math.max(0, Math.min(100, value));
  }
  if (typeof detail.mission === 'string') mission.mission = detail.mission;
  if (typeof detail.objective === 'string') mission.objective = detail.objective;
  view?.update();
});

window.addEventListener('pagehide', () => view?.dispose(), { once: true });
