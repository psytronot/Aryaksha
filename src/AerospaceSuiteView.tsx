import { useState } from 'react';
import { Activity, ArrowRight, BookOpen, Compass, Orbit, Rocket, Satellite, Target } from 'lucide-react';
import RocketStagingView from './RocketStagingView';
import RocketAscentView from './RocketAscentView';
import OrbitalTransferView from './OrbitalTransferView';
import './aerospace.css';

type Product = 'overview' | 'staging' | 'ascent' | 'transfer';
const products: { id: Product; number: string; name: string; discipline: string; outcome: string; audience: string; icon: React.ReactNode }[] = [
  { id: 'staging', number: '01', name: 'Rocket staging optimiser', discipline: 'Launch vehicle architecture', outcome: 'Optimise stage propellant allocation and ideal delta-v.', audience: 'Launch vehicle designers, propulsion students, early-stage teams', icon: <Rocket size={20}/> },
  { id: 'ascent', number: '02', name: 'Rocket ascent simulator', discipline: 'Flight mechanics & trajectory', outcome: 'Explore powered ascent, flight path, burnout and max-Q.', audience: 'Flight dynamics engineers, launch analysts, educators', icon: <Activity size={20}/> },
  { id: 'transfer', number: '03', name: 'Satellite orbital transfer', discipline: 'Astrodynamics & mission design', outcome: 'Estimate transfer delta-v, time of flight and propellant.', audience: 'Mission designers, spacecraft engineers, satellite students', icon: <Orbit size={20}/> }
];

export default function AerospaceSuiteView() {
  const [active, setActive] = useState<Product>('overview');
  const [need, setNeed] = useState('launch-mass');
  const open = (id: Product) => setActive(id);
  return <div className="page aerospace-page aero-suite-page">
    <header className="page-header aero-page-header"><div><small>ARYAKSHA / ENGINEERING PRODUCTS / SUITE 01–03</small><h1>Aerospace Engineering Workbench</h1><p>Choose an engineering problem, configure the relevant model, and inspect transparent calculations and assumptions.</p></div><div className="aero-engine-status"><span/> THREE ANALYTICAL MODULES</div></header>
    <nav className="aero-tabs aero-suite-tabs" aria-label="Aerospace product navigation">
      <button className={active==='overview'?'active':''} onClick={()=>open('overview')}><Compass size={14}/> Product overview</button>
      {products.map(p=><button key={p.id} className={active===p.id?'active':''} onClick={()=>open(p.id)}><span className="aero-tab-number">{p.number}</span>{p.name}</button>)}
    </nav>
    {active==='overview' && <>
      <section className="aero-suite-hero"><div><small>ENGINEERING TOOLKIT / RELEASE TRACK 01–03</small><h2>Start with the problem.<br/>Use the right engineering model.</h2><p>Three focused workspaces cover launch vehicle staging, atmospheric ascent and satellite orbit transfers. Each tool exposes its inputs, equations, outputs and model boundaries.</p></div><div className="aero-suite-hero-mark"><Rocket size={58}/><Orbit size={34}/></div></section>
      <section className="aero-section-heading"><div><small>SELECT A WORKSPACE</small><h2>Engineering products</h2></div><span>3 MODULES / 3 DISTINCT WORKFLOWS</span></section>
      <div className="aero-product-grid">{products.map(p=><article className="aero-product-card" key={p.id}><div className="aero-product-card-top"><span className="aero-product-icon">{p.icon}</span><small>PROJECT {p.number}</small></div><h3>{p.name}</h3><span className="aero-product-discipline">{p.discipline}</span><p>{p.outcome}</p><div className="aero-product-audience"><small>BUILT FOR</small>{p.audience}</div><button className="aero-primary-button" onClick={()=>open(p.id)}>Open workspace <ArrowRight size={14}/></button></article>)}</div>
      <section className="card aero-needs-card"><div className="card-head"><span><Target size={17}/></span><b>Find the right tool for your task</b></div><p className="aero-body-copy">Choose the engineering question closest to what you are trying to solve.</p><div className="aero-need-selector">{[{id:'launch-mass',label:'How should I divide propellant and mass between rocket stages?',module:'staging',answer:'Use the Rocket staging optimiser to explore stage structural fractions, Isp and ideal velocity increment.'},{id:'launch-flight',label:'How will my rocket accelerate and travel through the atmosphere?',module:'ascent',answer:'Use the Rocket ascent simulator to study a simplified powered trajectory, burnout and maximum dynamic pressure.'},{id:'satellite-orbit',label:'How much delta-v is needed to move a satellite to another orbit?',module:'transfer',answer:'Use Satellite orbital transfer to estimate Hohmann transfer burns, transfer time and propellant.'}].map(item=><button key={item.id} className={need===item.id?'selected':''} onClick={()=>setNeed(item.id)}>{item.label}<span>{need===item.id?'SELECTED':'SELECT'}</span></button>)}</div><div className="aero-need-answer"><BookOpen size={16}/><span>{need==='launch-mass'?'Use the Rocket staging optimiser to explore stage structural fractions, Isp and ideal velocity increment.':need==='launch-flight'?'Use the Rocket ascent simulator to study a simplified powered trajectory, burnout and maximum dynamic pressure.':'Use Satellite orbital transfer to estimate Hohmann transfer burns, transfer time and propellant.'}</span><button onClick={()=>open(need==='launch-mass'?'staging':need==='launch-flight'?'ascent':'transfer')}>Open recommended tool <ArrowRight size={13}/></button></div></section>
      <section className="aero-suite-principles"><div><small>01 / TRANSPARENT</small><b>Visible engineering assumptions</b><span>Every workspace explains equations, units and model limitations.</span></div><div><small>02 / INTERACTIVE</small><b>Parameter-driven studies</b><span>Change inputs and immediately inspect the effect on outputs.</span></div><div><small>03 / EDUCATIONAL</small><b>Designed to explore</b><span>Use for learning, concept studies and early trade-space exploration—not flight certification.</span></div></section>
    </>}
    {active==='staging' && <RocketStagingView/>}
    {active==='ascent' && <RocketAscentView/>}
    {active==='transfer' && <OrbitalTransferView/>}
  </div>;
}
