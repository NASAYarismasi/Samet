import html2canvas from 'html2canvas';
import template from './terminal-template.html?raw';
import './terminal-generated.css';

// The supplied HTML is the display source, not a separately redrawn imitation.
export function createTerminalTexture(onPaint) {
  const source=document.createElement('div');
  source.id='terminal-source';source.setAttribute('aria-hidden','true');
  source.style.cssText='position:fixed;left:0;top:0;z-index:-1000;width:576px;font-family:monospace;color:#e5e7eb;pointer-events:none;';
  source.innerHTML=template;
  source.querySelectorAll('*').forEach(el=>el.style.boxSizing='border-box');
  document.body.append(source);
  let disposed=false,busy=false,pending;
  function drawWave(id,phase){
    const canvas=source.querySelector(id),ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#f97316';ctx.lineWidth=1.5;ctx.beginPath();
    for(let x=0;x<canvas.width;x++){
      const p=(x+phase)%48;
      const y=id==='#ecgCanvas'?16+(p===18?-12:p===19?12:Math.sin(x*.14)*1.3):15+Math.sin(x*.13+phase)*Math.cos(x*.04)*7;
      if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }ctx.stroke();
  }
  async function update(data){
    if(disposed)return;
    pending=data;if(busy)return;busy=true;
    while(pending&&!disposed){
      const next=pending;pending=null;
      const text=(id,value)=>source.querySelector(id).textContent=value;
      text('#o2-val',next.resources.oxygen+'');text('#water-val',next.resources.water);text('#food-val',next.resources.food);text('#rcs-val',next.resources.energy);
      source.querySelector('#o2-bar').style.width=next.resources.oxygen+'%';
      source.querySelectorAll('.grid-cols-4 > div').forEach(el=>el.style.height=next.resources.energy+'%');
      text('#terminal-mission',next.mission);text('#terminal-objective',next.objective);
      drawWave('#ecgCanvas',0);drawWave('#commsCanvas',0);
      try{
        const canvas=await html2canvas(source,{backgroundColor:null,scale:2,logging:false,width:576,windowWidth:1200,onclone:doc=>{const el=doc.getElementById("terminal-source");el.style.left="0";el.style.top="0";doc.querySelectorAll("dialog").forEach(d=>d.removeAttribute("open"));}});
        if(!disposed){source.dataset.rendered=`${canvas.width}x${canvas.height}`;onPaint(canvas);}
      }catch(error){console.error('Terminal render failed',error);}
    }busy=false;
  }
  return {update,dispose(){disposed=true;pending=null;source.remove();}};
}
