import { EARTH_RADIUS, MU, Elements, sampleOrbit } from './orbit';

export type Mission={name:string;type:string;target:string;revisitDays:number;lifetimeYears:number;minElevationDeg:number;maxMassKg:number;launchSite:string};
export type Payload={name:string;massKg:number;powerW:number;dataRateMbps:number;fovDeg:number;resolutionM:number;dutyCyclePct:number;focalLengthMm:number;detectorPitchUm:number};
export type Spacecraft={busWidthM:number;busHeightM:number;busDepthM:number;dryMassKg:number;panelAreaM2:number;solarEfficiency:number;batteryWh:number;basePowerW:number;txPowerW:number;frequencyMHz:number;bandwidthMHz:number;txGainDb:number;rxGainDb:number;downlinkMbps:number;dataStorageGb:number;thrustN:number;ispS:number;propellantKg:number;inertiaX:number;inertiaY:number;inertiaZ:number;pointingAccuracyDeg:number;settlingTimeS:number;thermalAreaM2:number;absorptivity:number;emissivity:number;batteryEfficiencyPct:number;batteryDoDPct:number;solarDegradationPct:number;thermalHotFactor:number;thermalColdFactor:number};
export type OrbitDesign=Elements&{altitudeKm:number};
export const G0=9.80665, SOLAR_CONSTANT=1361, SIGMA=5.670374419e-8, LIGHT_SPEED=299792458, BOLTZMANN_DBM_HZ=-174;

export function orbitFromAltitude(altitudeKm:number,inclinationDeg:number,e=0.001):OrbitDesign{return{altitudeKm,a:EARTH_RADIUS+altitudeKm,e,i:inclinationDeg,raan:0,argp:0,nu:0};}
export function footprintCentralAngleDeg(altitudeKm:number,fovDeg:number):number{
  const r=EARTH_RADIUS+Math.max(0,altitudeKm);
  const halfFov=Math.min(Math.PI/2,Math.max(1e-7,fovDeg*Math.PI/360));
  const horizon=Math.acos(Math.min(1,EARTH_RADIUS/r));
  if(halfFov>=horizon)return horizon*180/Math.PI;
  const disc=EARTH_RADIUS**2-r**2*Math.sin(halfFov)**2;
  if(disc<=0)return horizon*180/Math.PI;
  const t=r*Math.cos(halfFov)-Math.sqrt(disc);
  const x=t*Math.sin(halfFov),z=r-t*Math.cos(halfFov);
  return Math.min(horizon*180/Math.PI,Math.max(0,Math.atan2(x,z)*180/Math.PI));
}
export function horizonCentralAngleDeg(altitudeKm:number,elevationDeg:number):number{
  const r=EARTH_RADIUS+altitudeKm,e=Math.max(0,elevationDeg)*Math.PI/180;
  return Math.max(0,(Math.acos(Math.min(1,EARTH_RADIUS/r*Math.cos(e)))-e)*180/Math.PI);
}
function haversineDeg(lat1:number,lon1:number,lat2:number,lon2:number){const p1=lat1*Math.PI/180,p2=lat2*Math.PI/180,dp=(lat2-lat1)*Math.PI/180,dl=(lon2-lon1)*Math.PI/180,a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)))*180/Math.PI;}
function elevationFromCentralAngle(centralAngleDeg:number,altitudeKm:number){const psi=centralAngleDeg*Math.PI/180,r=EARTH_RADIUS+altitudeKm;return Math.atan2(r*Math.cos(psi)-EARTH_RADIUS,r*Math.sin(psi))*180/Math.PI;}
function targetCoordinates(target:string){const v=target.toLowerCase();if(v.includes('india'))return{lat:22.5,lon:78.96};if(v.includes('bengaluru')||v.includes('bangalore'))return{lat:12.9716,lon:77.5946};if(v.includes('chennai'))return{lat:13.0827,lon:80.2707};if(v.includes('mumbai'))return{lat:19.076,lon:72.8777};if(v.includes('delhi'))return{lat:28.6139,lon:77.209};return null;}

export function missionGeometry(mission:Mission,payload:Payload,orbit:OrbitDesign){
  const target=targetCoordinates(mission.target);
  if(!target) return {target:null,footprintDeg:0,footprintRadiusKm:0,horizonDeg:0,accessCount:0,accessFraction:0,accessSeconds:0,revisitDays:Infinity,passesWithinRequirement:false,valid:false,error:'Unknown mission target'};
  const footprintDeg=footprintCentralAngleDeg(orbit.altitudeKm,payload.fovDeg), horizonDeg=horizonCentralAngleDeg(orbit.altitudeKm,mission.minElevationDeg), duration=48*3600, step=30, samples=sampleOrbit(orbit,duration,step), starts:number[]=[];
  let inAccess=false,accessStart=0,accessSeconds=0;
  for(const sample of samples){
    const angle=haversineDeg(sample.lla.lat,sample.lla.lon,target.lat,target.lon),elevation=elevationFromCentralAngle(angle,orbit.altitudeKm),visible=angle<=footprintDeg&&elevation>=mission.minElevationDeg;
    if(visible&&!inAccess){starts.push(sample.t);accessStart=sample.t;inAccess=true;}
    if(!visible&&inAccess){accessSeconds+=Math.max(0,sample.t-accessStart);inAccess=false;}
  }
  if(inAccess)accessSeconds+=Math.max(0,duration-accessStart);
  let maxGap=Infinity; let revisitStatus:'MEASURED'|'HORIZON_BOUND'|'NO_ACCESS'='NO_ACCESS';
  if(starts.length>=2){const gaps:number[]=[];for(let i=1;i<starts.length;i++)gaps.push(starts[i]-starts[i-1]);gaps.push(duration-starts[starts.length-1]+starts[0]);maxGap=Math.max(...gaps);revisitStatus='MEASURED';}
  else if(starts.length===1){maxGap=duration;revisitStatus='HORIZON_BOUND';}
  const revisitDays=Number.isFinite(maxGap)?maxGap/86400:Infinity;
  return{target,footprintDeg,footprintRadiusKm:EARTH_RADIUS*footprintDeg*Math.PI/180,horizonDeg,accessCount:starts.length,accessFraction:duration>0?accessSeconds/duration:0,accessSeconds,revisitDays,revisitStatus,passesWithinRequirement:Number.isFinite(revisitDays)&&revisitDays<=mission.revisitDays,valid:true};
}

export function propulsionAnalysis(spacecraft:Spacecraft,payloadMassKg:number){
  const prop=Math.max(0,spacecraft.propellantKg),m0=spacecraft.dryMassKg+payloadMassKg+prop,mf=spacecraft.dryMassKg+payloadMassKg,deltaV=m0>mf&&spacecraft.ispS>0?spacecraft.ispS*G0*Math.log(m0/mf):0,massFlow=spacecraft.thrustN>0&&spacecraft.ispS>0?spacecraft.thrustN/(spacecraft.ispS*G0):0,burnTime=massFlow>0?prop/massFlow:0,initialAcceleration=m0>0?spacecraft.thrustN/m0:0;
  return{wetMassKg:m0,dryPlusPayloadKg:mf,deltaVms:deltaV,massFlowKgs:massFlow,burnTimeS:burnTime,initialAccelerationMs2:initialAcceleration};
}
export function maneuverDeltaV(before:OrbitDesign,afterAltitudeKm:number,afterInclinationDeg:number){
  const r=EARTH_RADIUS+before.altitudeKm,r2=EARTH_RADIUS+afterAltitudeKm,v1=Math.sqrt(MU/r),v2=Math.sqrt(MU/r2),transferA=(r+r2)/2,transferAtR=Math.sqrt(MU*(2/r-1/transferA)),transferAtR2=Math.sqrt(MU*(2/r2-1/transferA)),radialDv=Math.abs(transferAtR-v1)+Math.abs(v2-transferAtR2),planeDv=2*Math.sin(Math.abs(afterInclinationDeg-before.i)*Math.PI/360)*v2;
  return{radialDvMs:radialDv*1000,planeChangeDvMs:planeDv*1000,totalDvMs:(radialDv+planeDv)*1000};
}
export function adcsAnalysis(spacecraft:Spacecraft,payload:Payload,orbit:OrbitDesign){
  const altitudeM=Math.max(1,orbit.altitudeKm*1000);
  const maxInertia=Math.max(spacecraft.inertiaX,spacecraft.inertiaY,spacecraft.inertiaZ);
  const angleRad=Math.max(0,spacecraft.pointingAccuracyDeg*Math.PI/180);
  const settlingTime=Math.max(0.25,spacecraft.settlingTimeS);
  const requiredTorqueNm=maxInertia*4*angleRad/(settlingTime**2);
  const assumedActuatorTorqueNm=0.002;
  const pointingGroundErrorM=Math.tan(angleRad)*altitudeM;
  const allowedGroundErrorM=Math.max(0.5,payload.resolutionM*0.5);
  const requiredPointingDeg=Math.atan2(allowedGroundErrorM,altitudeM)*180/Math.PI;
  return{requiredTorqueNm,actuatorMarginNm:assumedActuatorTorqueNm-requiredTorqueNm,pointingMarginDeg:requiredPointingDeg-spacecraft.pointingAccuracyDeg,pointingGroundErrorM,allowedGroundErrorM,requiredPointingDeg,pointingPass:pointingGroundErrorM<=allowedGroundErrorM,altitudeKm:orbit.altitudeKm};
}
export function powerAnalysis(mission:Mission,payload:Payload,spacecraft:Spacecraft,orbit:OrbitDesign){
  const periodMin=2*Math.PI*Math.sqrt(orbit.a**3/MU)/60;
  const eclipseFraction=Math.asin(Math.min(1,EARTH_RADIUS/orbit.a))/Math.PI;
  const eclipseMin=periodMin*eclipseFraction;
  const sunlightFraction=1-eclipseFraction;
  const eolFactor=Math.max(0,1-spacecraft.solarDegradationPct/100);
  const sunlitGenerationW=SOLAR_CONSTANT*Math.max(0,spacecraft.panelAreaM2)*Math.max(0,spacecraft.solarEfficiency)*eolFactor*0.72;
  const generationW=sunlitGenerationW*sunlightFraction;
  const averageLoadW=Math.max(0,spacecraft.basePowerW)+Math.max(0,payload.powerW)*Math.max(0,payload.dutyCyclePct)/100+Math.max(0,spacecraft.txPowerW)*0.1;
  const eclipseEnergyWh=averageLoadW*eclipseMin/60;
  const usableBatteryWh=Math.max(0,spacecraft.batteryWh)*(spacecraft.batteryDoDPct/100)*(spacecraft.batteryEfficiencyPct/100);
  const batteryEndWh=Math.max(0,usableBatteryWh-eclipseEnergyWh);
  const marginW=generationW-averageLoadW;
  return{periodMin,eclipseMin,sunlightFraction,sunlitGenerationW,generationW,averageLoadW,eclipseEnergyWh,usableBatteryWh,batteryEndWh,batteryMarginPct:usableBatteryWh>0?batteryEndWh/usableBatteryWh*100:0,marginW,pass:marginW>=0&&batteryEndWh>=0,lifetimeYears:Math.max(0.1,mission.lifetimeYears)};
}
export function thermalAnalysis(payload:Payload,spacecraft:Spacecraft){
  const area=Math.max(0.2,spacecraft.thermalAreaM2);
  const a=Math.min(1,Math.max(0,spacecraft.absorptivity));
  const e=Math.min(1,Math.max(0.001,spacecraft.emissivity));
  const solar=SOLAR_CONSTANT*area*a*0.5;
  const albedo=SOLAR_CONSTANT*0.25*area*a*0.25;
  const earthIr=237*area*a*0.25;
  const internal=Math.max(0,payload.powerW);
  const nominal=solar+albedo+earthIr+internal;
  const hot=nominal*Math.max(1,spacecraft.thermalHotFactor);
  const cold=Math.max(0,solar*0.55+albedo*0.4+earthIr*0.9+internal*0.7)*Math.min(1,spacecraft.thermalColdFactor);
  const radiatingArea=Math.max(0.2,area*1.35);
  const toC=(q:number)=>Math.pow(q/(e*SIGMA*radiatingArea),0.25)-273.15;
  const temperatureC=toC(nominal),hotTemperatureC=toC(hot),coldTemperatureC=toC(cold);
  const lowerLimitC=-40,upperLimitC=70;
  return{absorbedW:nominal,temperatureC,hotTemperatureC,coldTemperatureC,lowerLimitC,upperLimitC,marginC:upperLimitC-hotTemperatureC,hotMarginC:upperLimitC-hotTemperatureC,coldMarginC:coldTemperatureC-lowerLimitC,pass:hotTemperatureC<=upperLimitC&&coldTemperatureC>=lowerLimitC,radiatingAreaM2:radiatingArea};
}
function groundStation(target:string){const v=target.toLowerCase();if(v.includes('sriharikota'))return{lat:13.72,lon:80.23,name:'Sriharikota'};if(v.includes('bengaluru')||v.includes('bangalore'))return{lat:12.97,lon:77.59,name:'Bengaluru'};if(v.includes('chennai'))return{lat:13.08,lon:80.27,name:'Chennai'};if(v.includes('mumbai'))return{lat:19.08,lon:72.88,name:'Mumbai'};return{lat:22.5,lon:78.96,name:'India reference station'};}
export function communicationsAnalysis(mission:Mission,payload:Payload,spacecraft:Spacecraft,orbit:OrbitDesign){
  const v=mission.launchSite.toLowerCase();
  const station=v.includes('sriharikota')?'Sriharikota':v.includes('bengaluru')||v.includes('bangalore')?'Bengaluru':v.includes('chennai')?'Chennai':v.includes('mumbai')?'Mumbai':'India reference station';
  const elevation=Math.max(5,mission.minElevationDeg);
  const r=EARTH_RADIUS+Math.max(1,orbit.altitudeKm),e=elevation*Math.PI/180;
  const rangeKm=-EARTH_RADIUS*Math.sin(e)+Math.sqrt(Math.max(0,r*r-EARTH_RADIUS*EARTH_RADIUS*Math.cos(e)**2));
  const frequencyHz=Math.max(1,spacecraft.frequencyMHz)*1e6,bandwidthHz=Math.max(1e3,spacecraft.bandwidthMHz*1e6);
  const fsplDb=20*Math.log10(4*Math.PI*rangeKm*1000*frequencyHz/LIGHT_SPEED);
  const txDbm=10*Math.log10(Math.max(1e-9,spacecraft.txPowerW)*1000);
  const receivedDbm=txDbm+spacecraft.txGainDb+spacecraft.rxGainDb-fsplDb;
  const noiseDbm=BOLTZMANN_DBM_HZ+10*Math.log10(bandwidthHz),cnrDb=receivedDbm-noiseDbm,marginDb=cnrDb-10;
  const periodMin=2*Math.PI*Math.sqrt(orbit.a**3/MU)/60,horizonDeg=horizonCentralAngleDeg(orbit.altitudeKm,elevation);
  const contactMin=Math.max(0.1,Math.min(20,2*horizonDeg/(360/periodMin)));
  const contactsPerDay=Math.max(1,Math.round(1440/periodMin*0.35));
  const capacityGb=spacecraft.downlinkMbps*1e6*contactMin*60/8/1e9*contactsPerDay;
  const generatedGbPerDay=payload.dataRateMbps*1e6*86400*Math.max(0,payload.dutyCyclePct)/100/8/1e9;
  const storageOverflowGb=Math.max(0,generatedGbPerDay-spacecraft.dataStorageGb),dataMarginGbPerDay=capacityGb-generatedGbPerDay;
  return{groundStation:station,referenceElevationDeg:elevation,rangeKm,fsplDb,receivedDbm,noiseDbm,cnrDb,marginDb,referenceContactMinutes:contactMin,contactsPerDay,capacityGb,generatedGbPerDay,storageOverflowGb,dataMarginGbPerDay,pass:marginDb>=0&&storageOverflowGb<=0&&dataMarginGbPerDay>=0};
}
export function systemVerification(mission:Mission,payload:Payload,spacecraft:Spacecraft,orbit:OrbitDesign){
  const geometry=missionGeometry(mission,payload,orbit),propulsion=propulsionAnalysis(spacecraft,payload.massKg),power=powerAnalysis(mission,payload,spacecraft,orbit),thermal=thermalAnalysis(payload,spacecraft),comms=communicationsAnalysis(mission,payload,spacecraft,orbit),adcs=adcsAnalysis(spacecraft,payload,orbit),massKg=propulsion.wetMassKg;
  const finite=[mission.revisitDays,mission.lifetimeYears,mission.minElevationDeg,mission.maxMassKg,payload.massKg,payload.powerW,payload.dataRateMbps,payload.fovDeg,payload.resolutionM,payload.dutyCyclePct,payload.focalLengthMm,payload.detectorPitchUm,spacecraft.dryMassKg,spacecraft.panelAreaM2,spacecraft.solarEfficiency,spacecraft.batteryWh,spacecraft.basePowerW,spacecraft.txPowerW,spacecraft.frequencyMHz,spacecraft.bandwidthMHz,spacecraft.downlinkMbps,spacecraft.dataStorageGb,spacecraft.thrustN,spacecraft.ispS,spacecraft.propellantKg,spacecraft.inertiaX,spacecraft.inertiaY,spacecraft.inertiaZ,spacecraft.pointingAccuracyDeg,spacecraft.settlingTimeS,spacecraft.thermalAreaM2,spacecraft.absorptivity,spacecraft.emissivity,spacecraft.batteryEfficiencyPct,spacecraft.batteryDoDPct,spacecraft.solarDegradationPct,spacecraft.thermalHotFactor,spacecraft.thermalColdFactor,orbit.altitudeKm,orbit.e,orbit.i,orbit.raan,orbit.argp,orbit.nu].every(Number.isFinite);
  const validOrbit=finite&&orbit.altitudeKm>=120&&orbit.altitudeKm<=50000&&orbit.e>=0&&orbit.e<1&&orbit.i>=0&&orbit.i<=180;
  const validPayload=payload.massKg>=0&&payload.fovDeg>0&&payload.fovDeg<=180&&payload.resolutionM>0&&payload.dutyCyclePct>=0&&payload.dutyCyclePct<=100&&payload.focalLengthMm>0&&payload.detectorPitchUm>0;
  const validSpacecraft=spacecraft.solarEfficiency>0&&spacecraft.solarEfficiency<=1&&spacecraft.emissivity>0&&spacecraft.emissivity<=1&&spacecraft.absorptivity>=0&&spacecraft.absorptivity<=1&&spacecraft.batteryEfficiencyPct>0&&spacecraft.batteryEfficiencyPct<=100&&spacecraft.batteryDoDPct>0&&spacecraft.batteryDoDPct<=100&&spacecraft.solarDegradationPct>=0&&spacecraft.solarDegradationPct<100&&spacecraft.thermalHotFactor>0&&spacecraft.thermalColdFactor>0;
  const validInputs=validOrbit&&validPayload&&validSpacecraft&&mission.revisitDays>0&&mission.lifetimeYears>0&&mission.minElevationDeg>=0&&mission.minElevationDeg<90&&mission.maxMassKg>0;
  const gsdM=orbit.altitudeKm*1000*(payload.detectorPitchUm*1e-6)/(payload.focalLengthMm*1e-3),gsdPass=Number.isFinite(gsdM)&&gsdM<=payload.resolutionM;
  const maneuver=maneuverDeltaV(orbit,Math.max(120,orbit.altitudeKm+100),orbit.i),maneuverFeasible=propulsion.deltaVms>=maneuver.totalDvMs;
  const checks=[
    {id:'SYS-INPUT',name:'Engineering inputs valid',value:validInputs?1:0,limit:1,unit:'bool',pass:validInputs},
    {id:'SYS-MASS',name:'Spacecraft mass limit',value:massKg,limit:mission.maxMassKg,unit:'kg',pass:massKg<=mission.maxMassKg},
    {id:'MIS-REV',name:'Target revisit',value:geometry.revisitDays,limit:mission.revisitDays,unit:'days',pass:geometry.passesWithinRequirement&&geometry.valid},
    {id:'PAY-GSD',name:'Payload GSD',value:gsdM,limit:payload.resolutionM,unit:'m',pass:gsdPass},
    {id:'ADCS-POINT',name:'Pointing ground error',value:adcs.pointingGroundErrorM,limit:adcs.allowedGroundErrorM,unit:'m',pass:adcs.pointingPass},
    {id:'EPS-MARGIN',name:'Average power margin',value:power.marginW,limit:0,unit:'W',pass:power.pass},
    {id:'THM-HOT',name:'Thermal hot-case margin',value:thermal.hotMarginC,limit:0,unit:'°C',pass:thermal.pass},
    {id:'THM-COLD',name:'Thermal cold-case margin',value:thermal.coldMarginC,limit:0,unit:'°C',pass:thermal.pass},
    {id:'COMMS-LINK',name:'Communications/data capacity',value:comms.dataMarginGbPerDay,limit:0,unit:'GB/day',pass:comms.pass},
    {id:'PROP-DV',name:'Available propulsion ΔV',value:propulsion.deltaVms,limit:maneuver.totalDvMs,unit:'m/s',pass:maneuverFeasible}
  ];
  return{geometry,propulsion,power,thermal,comms,adcs,massKg,maneuver,performance:{gsdM,requirementM:payload.resolutionM,pass:gsdPass},checks,passCount:checks.filter(x=>x.pass).length,failCount:checks.filter(x=>!x.pass).length};
}
export function formatNumber(value:number,digits=2){return Number.isFinite(value)?value.toFixed(digits):'N/A';}
