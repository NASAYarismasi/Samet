import {createGridState,stepMicrogrid,payForSweep} from './live-grid.mjs';
import {SOL_HOURS,solarDay} from './mars-power.mjs';
import {createAutomaticRecovery} from './black-start.mjs';
import {projectPower} from './live-projection.mjs';

export function createPowerController(){
  let lastTransmission=1;
  let state=createGridState(),recovery=createAutomaticRecovery(),live=null,lastClock=null,sol=0,hour=0,dust=.03;
  const controls={closed:true,drill:true,season:0,lamp:true,blackStart:true};
  const log=[];
  function append(message){if(message){log.push(message);if(log.length>30)log.shift();}}
  function options(transmission,lamp){return {...controls,transmission,panelDust:dust,rowDust:Array(6).fill(dust),lamp:lamp?1:0,faults:{}};}
  return {
    controls,
    consumeEnergy(requested){
      if(!Number.isFinite(requested))return 0;
      if(requested<0){
        const refund=Math.min(-requested,36-state.banks[4]);
        state.banks[4]+=refund;state.battery+=refund;
        return 0;
      }
      if(requested===0)return 0;
      const surplus=Math.max(0,(live?.production??0)-(live?.groups??[]).reduce((sum,g)=>sum+(g.output??0),0));
      const canUseDaylight=Boolean(live?.daylight)&&surplus>0;
      const available=canUseDaylight?state.battery:Math.max(0,state.battery-(live?.reserve??0));
      const accepted=Math.min(requested,available);
      if(state.battery>0)state.banks=state.banks.map(value=>value*(1-accepted/state.battery));
      state.battery=state.banks.reduce((sum,value)=>sum+value,0);
      return accepted;
    },
    update(environment,lamp){
      const clock=environment.unixSeconds;
      if(lastClock===null){lastClock=clock;const daylight=solarDay(controls.season).daylight;hour=((environment.lmst??8)*SOL_HOURS/24-(SOL_HOURS-daylight)/2+SOL_HOURS)%SOL_HOURS;}
      let remaining=Math.max(0,clock-lastClock);lastClock=clock;
      while(remaining>1e-8){
        const day=solarDay(controls.season);
        const boundary=hour<day.daylight?day.daylight:SOL_HOURS;
        const seconds=Math.min(remaining,30,(boundary-hour)*3600);
        if(seconds<1e-7){if(hour<day.daylight){hour=day.daylight;}else{hour=0;sol++;}continue;}
        const midpoint=hour+seconds/7200;
        const transmission=environment.storm?.20:1;lastTransmission=transmission;
        dust=Math.min(.75,dust+seconds/3600*(environment.storm?.008:.0001));
        const opts=options(transmission,controls.lamp&&lamp);
        live=(controls.blackStart?recovery.step(state,midpoint<day.daylight,seconds,append):null)
          ??stepMicrogrid(state,midpoint,seconds/3600,opts);
        if(dust>=.12&&payForSweep(state,live.reserve)){dust*=.25;append('Kuru temizlik tamamlandı · bataryadan 0,20 kWh ayrıldı.');}
        hour+=seconds/3600;remaining-=seconds;
        if(hour>=SOL_HOURS-1e-9){hour=0;sol++;}
      }
    },
    get telemetry(){return {state:structuredClone(state),live:live?structuredClone(live):null,sol,hour,dust,controls:{...controls},log:[...log]};},
    forecast(){
      const snapshot={...options(1,controls.lamp),state:structuredClone(state),recovery:recovery.snapshot(),hour,sol,
        weather:Array.from({length:3},()=>({transmission:lastTransmission,rowDust:Array(6).fill(dust)}))};
      return {drillOn:projectPower(snapshot,true),drillOff:projectPower(snapshot,false)};
    },
    reset(){state=createGridState();recovery=createAutomaticRecovery();lastClock=null;hour=0;sol=0;live=null;dust=.03;}
  };
}
