import { createMarsBackdrop } from './mars-backdrop.js';
import { createGameAudio } from './game-audio.js';
import { beginGame } from './game-bridge.js';
const $=s=>document.querySelector(s);
const defaults={master:70,ambient:50,effects:65,resolution:'native'};
let settings={...defaults},selected='astronaut-1',screen='intro',muted=false,introTimer,backdrop,busy=false;
let saved=true;
try{const stored=JSON.parse(localStorage.getItem('mars-menu-settings'));if(stored){for(const key of ['master','ambient','effects'])if(Number.isFinite(stored[key]))settings[key]=Math.max(0,Math.min(100,stored[key]));if(['native','1920x1080','1600x900','1280x720'].includes(stored.resolution))settings.resolution=stored.resolution;}const appearance=localStorage.getItem('mars-appearance');if(['astronaut-1','astronaut-2','astronaut-3'].includes(appearance))selected=appearance;}catch{saved=false}
const audio=createGameAudio();audio.update(settings);
function persist(){try{localStorage.setItem('mars-menu-settings',JSON.stringify(settings));localStorage.setItem('mars-appearance',selected);saved=true}catch{saved=false}$('#save-state').textContent=saved?'Ayarlar kaydedildi.':'Tarayıcı kaydı kullanılamıyor; ayarlar bu oturumda geçerli.';}
function show(next,focus=true){clearTimeout(introTimer);screen=next;document.body.dataset.screen=next;document.querySelectorAll('main>.screen').forEach(el=>el.hidden=el.id!==next);backdrop?.setIntro(next==='intro');window.scrollTo(0,0);audio.setActive(next!=='ended');if(focus){const el=$('#'+next).querySelector('h1,h2');if(el){el.setAttribute('tabindex','-1');el.focus({preventScroll:true})}}}
function playIntro(){show('intro',false);introTimer=setTimeout(()=>show('menu'),5000)}
function select(id){selected=id;const index=Number(id.at(-1));document.querySelectorAll('.character').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.astronaut===id)));$('#selection-summary').textContent=`Astronot 0${index} seçildi.`;$('#ready-id').textContent=`ASTRONOT 0${index}`;$('.ready-portrait').style.backgroundPosition=`${(index-1)*50}% 0`;persist();}
try{backdrop=createMarsBackdrop($('#cosmos'),failed=>{$('#background-error').hidden=!failed});backdrop.setResolution(settings.resolution)}catch{$('#background-error').hidden=false;$('#background-error').firstChild.textContent='3D Mars görüntüsü bu cihazda başlatılamadı. ';}
$('#retry-background').onclick=()=>{if(backdrop)backdrop.retry();else location.reload()};
for(const key of ['master','ambient','effects']){const input=$('#'+key+'-volume');input.value=settings[key];$('#'+key+'-output').value=settings[key]+'%';input.addEventListener('input',()=>{settings[key]=Number(input.value);$('#'+key+'-output').value=settings[key]+'%';audio.update(settings);persist()});}
$('#resolution').value=settings.resolution;$('#resolution').onchange=e=>{settings.resolution=e.target.value;backdrop?.setResolution(settings.resolution);persist()};
async function unlock(){try{await audio.unlock()}catch{$('#app-status').textContent='Bu tarayıcıda ses başlatılamadı.'}}
document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});
document.addEventListener('click',e=>{if(e.target.closest('button'))audio.tick();const back=e.target.closest('[data-back]');if(back)show(back.dataset.back)});
$('#skip-intro').onclick=()=>show('menu');$('#replay-intro').onclick=playIntro;
$('#home').onclick=e=>{e.preventDefault();show('menu')};$('#new-game').onclick=()=>show('astronauts');$('#settings-open').onclick=()=>show('settings');
$('.characters').onclick=e=>{const card=e.target.closest('[data-astronaut]');if(card)select(card.dataset.astronaut)};
$('#confirm-astronaut').onclick=async()=>{if(busy)return;busy=true;$('#confirm-astronaut').disabled=true;try{const result=await beginGame(selected,settings);if(result.connected){clearTimeout(introTimer);document.querySelector('main').hidden=true;document.querySelector('.masthead').hidden=true;$('#cosmos').hidden=true;document.querySelector('.cinema-shade').hidden=true;backdrop?.dispose();backdrop=undefined;audio.setActive(false);}else{$('#ready-message').textContent='Astronotun hazır. Yolculuk burada başlayacak.';show('ready')}}catch{$('#ready-message').textContent='Başlangıç sahnesi açılamadı. Görünüş seçimine dönerek tekrar deneyebilirsin.';show('ready')}finally{busy=false;$('#confirm-astronaut').disabled=false}};
$('#sound-toggle').onclick=()=>{muted=!muted;audio.mute(muted);$('#sound-toggle').setAttribute('aria-pressed',String(muted));$('#sound-toggle').setAttribute('aria-label',muted?'Sesi aç':'Sesi kapat');$('#sound-toggle').innerHTML=muted?'SES KAPALI <span>◖×</span>':'SES AÇIK <span>◖))</span>'};
$('#test-sound').onclick=async()=>{await unlock();audio.tick(true)};
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{$('#save-state').textContent='Tarayıcı tam ekrana geçişe izin vermedi.'}};
document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'Tam ekrandan çık ↙':'Tam ekran ↗'});
$('#exit-open').onclick=()=>$('#exit-dialog').showModal();$('#exit-cancel').onclick=()=>$('#exit-dialog').close();$('#exit-confirm').onclick=()=>{$('#exit-dialog').close();show('ended');if(window.opener)window.close()};$('#return-game').onclick=()=>show('menu');
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#exit-dialog').open){if(screen==='intro')show('menu');else if(['astronauts','settings','ready'].includes(screen))show('menu')}});
document.addEventListener('visibilitychange',()=>audio.setActive(!document.hidden&&screen!=='ended'));
window.addEventListener('pagehide',()=>{clearTimeout(introTimer);backdrop?.dispose();audio.dispose()},{once:true});
select(selected);playIntro();
