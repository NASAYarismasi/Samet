const format=value=>Number.isFinite(value)?value.toLocaleString('tr-TR',{maximumFractionDigits:2}):'—';
export function mountPowerTablet(onOpen){
  const panel=document.createElement('section');panel.className='colony-drawer';panel.hidden=true;
  panel.innerHTML='<h2>Enerji dağıtımı</h2><div data-controls></div><div data-readings></div><button data-report>İki sondaj kararını karşılaştır</button><div data-results></div>';
  document.body.append(panel);
  const controller=new AbortController(),on=(node,type,fn)=>node.addEventListener(type,fn,{signal:controller.signal});
  let latest=null;
  const controls=panel.querySelector('[data-controls]');
  for(const [key,label]of [['closed','Ana şalter'],['drill','Sondaj'],['lamp','Sera LED izni'],['blackStart','İlk gece otomatik kurtarma']]){
    const button=document.createElement('button');button.dataset.control=key;button.textContent=label;
    on(button,'click',()=>window.dispatchEvent(new CustomEvent('colony:power-command',{detail:{key,value:!latest?.controls[key]}})));controls.append(button);
  }
  const select=document.createElement('select');select.setAttribute('aria-label','Mars mevsimi');
  for(const [value,label]of [[0,'Ekinoks'],[90,'Kuzey yazı'],[180,'Sonbahar'],[270,'Kuzey kışı']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
  on(select,'change',()=>window.dispatchEvent(new CustomEvent('colony:power-command',{detail:{key:'season',value:Number(select.value)}})));controls.append(select);
  on(window,'colony:state',event=>{
    latest=event.detail?.lifeSupport?.electrical;
    if(!latest||panel.hidden)return;
    for(const button of controls.querySelectorAll('button')){const enabled=latest.controls[button.dataset.control];button.setAttribute('aria-pressed',String(enabled));}
    const t=latest.live,s=latest.state;
    const root=panel.querySelector('[data-readings]');root.replaceChildren();
    const paragraph=text=>{const p=document.createElement('p');p.textContent=text;root.append(p);};
    paragraph('Depo '+format(s.battery)+' / 180 kWh · PV '+format(t?.production)+' kW · Gece rezervi '+format(t?.reserve)+' kWh');
    paragraph('Panel tozu %'+format(latest.dust*100)+' · Kabin '+format(s.temperature)+' °C · Habitat açığı '+format(s.dailyShortfall)+' kWh');
    const table=document.createElement('table');
    for(const [index,g]of (t?.groups??[]).entries()){
      const row=document.createElement('tr');
      for(const value of ['G'+(index+1),format(g.stored)+' kWh','PV '+format(g.pv)+' kW','Şarj '+format(g.charge)+' kW','Depodan '+format(g.draw)+' kW','AC '+format(g.output)+' kW',format(g.kvar)+' kvar',format(Math.hypot(g.output??0,g.kvar??0))+' kVA']){
        const cell=document.createElement('td');cell.textContent=value;row.append(cell);
      }table.append(row);
    }root.append(table);
    for(const key of ['habitat','water','moxie','greenhouse']){
      const m=t?.[key];const label={habitat:'Yaşam alanı',water:'Buz sondajı',moxie:'MOXIE',greenhouse:'Sera'}[key];if(m)paragraph(label+' · '+(m.duty>0?'ÇALIŞIYOR':'BESLEME YOK / DURDU')+' · Tesise '+format(m.consumption)+' kW · Hattan '+format(m.supply)+' kW · Kayıp '+format(m.loss)+' kW · Akım '+format(m.current)+' A · Kaynak '+(m.sources??[]).join(', '));
    }
    paragraph('AC bara desteği '+format(t?.transferKW)+' kW');
    for(const transfer of t?.transfers??[])paragraph('G'+transfer.from+' → G'+transfer.to+' · '+format(transfer.kw)+' kW');
    for(const [i,g]of (t?.groups??[]).entries())paragraph('G'+(i+1)+' panel aralığı '+format(g.weakest*1000)+'–'+format(g.strongest*1000)+' W · %80 altında '+(g.lowPanels??0)+' panel');
    paragraph('MOXIE · CO₂ giriş '+format(t?.gas?.intakeKgHour*1000)+' g/sa · toplam '+format(s.co2Intake)+' kg · O₂ '+format(t?.gas?.oxygenKgHour*1000)+' g/sa · tank '+format(s.oxygen)+' / 15 kg');
    paragraph('MOXIE üretim tankı bu modelde habitatın tüketiminden ayrı izlenir.');

    for(const message of latest.log)paragraph(message);
  });
  on(panel.querySelector('[data-report]'),'click',()=>window.dispatchEvent(new CustomEvent('colony:power-command',{detail:{key:'forecast'}})));
  on(window,'colony:power-report',event=>{
    const results=panel.querySelector('[data-results]');results.replaceChildren();
    for(const [name,rows]of Object.entries(event.detail)){const p=document.createElement('p');p.textContent=(name==='drillOn'?'Sondaj açık':'Sondaj kapalı')+' · '+rows.map((r,i)=>'Sol '+(i+1)+': depo '+format(r.stored)+' kWh / habitat açığı '+format(r.gap)+' kWh / su '+format(r.water)+' L / O₂ '+format(r.oxygen)+' kg / ışık '+format(r.led)+' sa').join(' | ');results.append(p);}
  });
  return {open(){onOpen(panel);},dispose(){controller.abort();panel.remove();}};
}
