import { state, stages } from './game.js';
import { createWristScene } from './wrist-scene.js';
const dialog=document.querySelector('#wrist-dialog');
let view,returnFocus;
function open(){
 if(dialog.open)return;
 returnFocus=document.activeElement;dialog.showModal();
 try{view ||= createWristScene(document.querySelector('#wrist-scene'),()=>({resources:{...state.resources},mission:stages[state.stage]?.title||'Koloni kuruldu',objective:stages[state.stage]?.label||'Görev tamamlandı'}));view.start();view.raise(true);}
 catch(error){document.querySelector('#model-status').textContent='3D görünüm başlatılamadı: '+error.message;}
}
document.querySelector('#wrist-open').onclick=open;
document.querySelector('#wrist-close').onclick=()=>{view?.stop();dialog.close()};
document.querySelector('#mobile-wrist').onclick=()=>view?.toggle();
dialog.addEventListener('cancel',e=>{e.preventDefault();view?.raise(false)});
dialog.addEventListener('close',()=>returnFocus?.focus());
window.addEventListener('mission-update',()=>view?.update());
document.addEventListener('keydown',e=>{if(e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.shiftKey||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;if(e.key==='Alt'){e.preventDefault();if(!dialog.open)open();else view?.toggle();}});
window.addEventListener('pagehide',()=>view?.dispose(),{once:true});
