// UI adapter: food/water use the existing shared mission stock.
// Replace the health placeholder with the active astronaut's crew.health on 3D integration.
var wristMetric = 'health';
var wristReturnFocus = null;
var wristDialog = document.querySelector('#wrist-dialog');
function renderWrist() {
  const labels = {health:'Sağlık',food:'Yemek',water:'Su'};
  const value = wristMetric === 'health' ? 100 : state.resources[wristMetric];
  document.querySelectorAll('[data-metric]').forEach(button => {
    const active = button.dataset.metric === wristMetric;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  const panel = document.querySelector('#wrist-panel');
  panel.setAttribute('aria-labelledby', `tab-${wristMetric}`);
  panel.innerHTML = `<div class="terminal-caption">${wristMetric === 'health' ? 'ASTRONOT / VİTAL BULGULAR' : 'EKİP / ORTAK STOK'}</div><div class="terminal-reading"><strong>${value}</strong><span>${wristMetric === 'health' ? '/ 100' : 'birim'}</span></div><h3>${labels[wristMetric]}</h3><div class="terminal-gauge" role="meter" aria-label="${labels[wristMetric]}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><i style="width:${value}%"></i></div><p>${wristMetric === 'health' ? 'Örnek sağlık verisi · 3D mürettebat bağlantısı bekleniyor.' : value > 30 ? 'Ortak rezerv yeterli. Görev ilerledikçe stok güncellenir.' : 'Düşük rezerv. Sonraki görev maliyetlerini kontrol et.'}</p>`;
}
function openWrist() {
  if(wristDialog.open)return;
  wristReturnFocus = document.activeElement;
  renderWrist();
  wristDialog.showModal();
  document.querySelector(`[data-metric="${wristMetric}"]`).focus();
}
function closeWrist() { if(wristDialog.open)wristDialog.close(); }
document.querySelector('#wrist-open').onclick = openWrist;
document.querySelector('#wrist-close').onclick = closeWrist;
wristDialog.addEventListener('close', () => wristReturnFocus?.focus());
wristDialog.addEventListener('click', event => {
  const button = event.target.closest('[data-metric]');
  if(button){ wristMetric=button.dataset.metric; renderWrist(); }
  if(event.target===wristDialog)closeWrist();
});
document.addEventListener('keydown', event => {
  if(event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.shiftKey)return;
  if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(event.key==='Alt') {
    event.preventDefault();
    wristDialog.open ? closeWrist() : openWrist();
    return;
  }
  if(!wristDialog.open || event.altKey)return;
  const keys = {'1':'health','2':'food','3':'water'};
  if(keys[event.key]){event.preventDefault();wristMetric=keys[event.key];renderWrist();document.querySelector(`[data-metric="${wristMetric}"]`).focus();}
  if(event.target.matches('[role="tab"]') && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();
    const metrics=['health','food','water'];
    const index=metrics.indexOf(wristMetric);
    wristMetric=metrics[event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3];
    renderWrist();document.querySelector(`[data-metric="${wristMetric}"]`).focus();
  }
});
