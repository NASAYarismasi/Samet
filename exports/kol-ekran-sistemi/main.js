import { createWristScene } from './wrist-scene.js';

// Kendi oyununun kaynaklarını bu nesneye veya getData fonksiyonuna bağla.
const mission = {
  resources: { energy: 80, water: 75, oxygen: 90, food: 65 },
  mission: 'İlk koloni',
  objective: 'Yaşam alanını kur'
};
const dialog = document.querySelector('#wrist-dialog');
let view;
let returnFocus;

function open() {
  if (dialog.open) return;
  returnFocus = document.activeElement;
  dialog.showModal();
  try {
    view ||= createWristScene(document.querySelector('#wrist-scene'), () => mission);
    view.start();
    view.raise(true);
  } catch (error) {
    document.querySelector('#model-status').textContent = '3D görünüm başlatılamadı: ' + error.message;
  }
}
document.querySelector('#wrist-open').onclick = open;
document.querySelector('#wrist-close').onclick = () => { view?.stop(); dialog.close(); };
document.querySelector('#mobile-wrist').onclick = () => view?.toggle();
dialog.addEventListener('cancel', event => { event.preventDefault(); view?.raise(false); });
dialog.addEventListener('close', () => returnFocus?.focus());
document.addEventListener('keydown', event => {
  if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  if (event.key === 'Alt') {
    event.preventDefault();
    if (!dialog.open) open(); else view?.toggle();
  }
});

// Entegrasyonda oyun durumunu bu olayla güncelleyebilirsin:
// window.dispatchEvent(new CustomEvent('wrist-data', { detail: {
//   resources: { energy: 70, water: 60, oxygen: 80, food: 55 },
//   mission: 'Sera inşası', objective: 'Serayı tamamla'
// }}));
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
