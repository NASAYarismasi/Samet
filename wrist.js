// Read existing mission state without changing the shared landing schema.
var wristReturnFocus = null;
var wristDialog = document.querySelector('#wrist-dialog');
function renderWrist() {
  const metrics = [['energy','Batarya','ϟ'],['water','Su','H₂O'],['oxygen','Oksijen','O₂'],['food','Yiyecek','♧']];
  const mission = state.stage >= stages.length ? null : stages[state.stage];
  document.querySelector('#wrist-panel').innerHTML = `<div class="terminal-caption">EKİP / ORTAK KAYNAKLAR</div><div class="wrist-readings">${metrics.map(([key,label,icon]) => {
    const value = state.resources[key];
    return `<div class="wrist-stat ${value<=30?'low':''}"><div class="wrist-stat-label"><span>${label}</span><span aria-hidden="true">${icon}</span></div><div class="wrist-stat-value">${value}<small> / 100 birim</small></div><div class="terminal-gauge" role="meter" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><i style="width:${value}%"></i></div></div>`;
  }).join('')}</div><div class="wrist-mission"><div class="terminal-caption">AKTİF GÖREV <span>${Math.min(state.stage+1,4)} / 4</span></div><h3>${mission ? mission.title : 'Koloni kuruldu'}</h3><p>${mission ? mission.desc : 'Görev tamamlandı. Mars’taki yaşam alanı faaliyette.'}</p><div class="wrist-objective">${mission ? '→ '+mission.label : '✓ Tüm aşamalar tamamlandı'}</div></div>`;
}
function openWrist() {
  if(wristDialog.open)return;
  wristReturnFocus = document.activeElement;
  renderWrist();
  wristDialog.showModal();
  document.querySelector('#wrist-close').focus();
}
function closeWrist() { if(wristDialog.open)wristDialog.close(); }
document.querySelector('#wrist-open').onclick = openWrist;
document.querySelector('#wrist-close').onclick = closeWrist;
wristDialog.addEventListener('close', () => wristReturnFocus?.focus());
wristDialog.addEventListener('click', event => {
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
});
