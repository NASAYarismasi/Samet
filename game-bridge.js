const ids=['astronaut-1','astronaut-2','astronaut-3'];
let handler;
// The flight/game owner registers their scene here. No flight or colony is started by this module.
export function registerGameStart(callback){if(typeof callback!=='function')throw new TypeError('A scene start function is required');handler=callback;return()=>{if(handler===callback)handler=undefined};}
export async function beginGame(appearanceId,settings){
 if(!ids.includes(appearanceId))throw new Error('Invalid astronaut appearance');
 const session={version:1,player:{appearanceId},settings:{...settings},createdAt:new Date().toISOString()};
 try{localStorage.setItem('mars-new-game',JSON.stringify(session))}catch{}
 window.dispatchEvent(new CustomEvent('mars:new-game',{detail:structuredClone(session)}));
 if(handler){const host=document.getElementById('game-root');if(host)host.hidden=false;try{await handler(structuredClone(session),host);}catch(error){if(host){host.replaceChildren();host.hidden=true;}throw error;}return {connected:true,session};}
 return {connected:false,session};
}
