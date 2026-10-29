import { useMemo, useState } from 'react';
import { Calculator, Delete } from 'lucide-react';

const CONSTANTS = [
  ['Earth μ', '398600.4418', 'km³/s²'],
  ['Earth radius', '6378.137', 'km'],
  ['Standard gravity', '9.80665', 'm/s²'],
  ['Earth rotation', '7.2921150e-5', 'rad/s'],
  ['π', 'pi', 'dimensionless'],
  ['e', 'e', 'dimensionless'],
] as const;

function calculate(expression: string, mode: 'DEG' | 'RAD') {
  const source=expression.replaceAll('×','*').replaceAll('÷','/').replaceAll('π','pi').replace(/\s+/g,'');
  const tokens=source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[A-Za-z]+|[()+\-*/%^]/gi)||[];
  if(tokens.join('')!==source)throw new Error('Unsupported character');
  const fn=new Set(['sin','cos','tan','asin','acos','atan','sqrt','ln','log','abs']),cs=new Set(['pi','e']); let i=0;
  const peek=()=>tokens[i],take=()=>tokens[i++];
  function primary():number{const t=peek();if(!t)throw new Error('Expected value');if(/^(?:\d|\.)/.test(t)){take();return Number(t);}if(cs.has(t.toLowerCase())){take();return t.toLowerCase()==='pi'?Math.PI:Math.E;}if(t==='+'||t==='-'){take();const v=primary();return t==='-'?-v:v;}if(t==='('){take();const v=additive();if(take()!==')')throw new Error('Missing closing parenthesis');return v;}if(fn.has(t.toLowerCase())){const f=take().toLowerCase();if(take()!=='(')throw new Error('Function requires parentheses');const v=additive();if(take()!==')')throw new Error('Missing closing parenthesis');if(f==='sin'||f==='cos'||f==='tan'){const a=mode==='DEG'?v*Math.PI/180:v;return f==='sin'?Math.sin(a):f==='cos'?Math.cos(a):Math.tan(a);}if(f==='asin')return mode==='DEG'?Math.asin(v)*180/Math.PI:Math.asin(v);if(f==='acos')return mode==='DEG'?Math.acos(v)*180/Math.PI:Math.acos(v);if(f==='atan')return mode==='DEG'?Math.atan(v)*180/Math.PI:Math.atan(v);if(f==='sqrt')return Math.sqrt(v);if(f==='ln')return Math.log(v);if(f==='log')return Math.log10(v);return Math.abs(v);}throw new Error('Expected value');}
  function power():number{let v=primary();if(peek()==='^'){take();v=Math.pow(v,power());}return v;}
  function multiplicative():number{let v=power();while(peek()==='*'||peek()==='/'||peek()==='%'){const op=take();const r=power();if((op==='/'||op==='%')&&r===0)throw new Error('Division by zero');v=op==='*'?v*r:op==='/'?v/r:v%r;}return v;}
  function additive():number{let v=multiplicative();while(peek()==='+'||peek()==='-'){const op=take();const r=multiplicative();v=op==='+'?v+r:v-r;}return v;}
  const value=additive();if(i!==tokens.length)throw new Error('Unexpected token');if(!Number.isFinite(value))throw new Error('Result is not finite');return value;
}

export default function ScientificCalculator() {
  const [expression, setExpression] = useState('');
  const [memory, setMemory] = useState(0);
  const [mode, setMode] = useState<'DEG' | 'RAD'>('DEG');
  const [error,setError]=useState('');
  const result = useMemo(() => {
    if (!expression.trim()) return '';
    try { setError(''); return String(calculate(expression, mode)); } catch { return ''; }
  }, [expression, mode]);
  const add = (value: string) => { setError(''); setExpression(v => `${v}${value}`); };
  const evaluate = () => { try { setExpression(String(calculate(expression, mode))); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Invalid expression'); } };
  const memoryAction = (action: string) => {
    if (action === 'MC') setMemory(0);
    if (action === 'MR') add(String(memory));
    if (action === 'M+') { try { setMemory(memory + calculate(expression, mode)); } catch {} }
  };
  const groups = [
    ['sin(', 'cos(', 'tan(', 'π'],
    ['asin(', 'acos(', 'atan(', 'sqrt('],
    ['ln(', 'log(', 'abs(', '^'],
    ['7', '8', '9', '÷'],
    ['4', '5', '6', '×'],
    ['1', '2', '3', '-'],
    ['0', '.', '(', ')'],
    ['%', '+', 'DEL', '='],
  ];
  return <section className="calculator-card glass-panel"><div className="calculator-heading"><div><span className="calculator-icon"><Calculator size={17} /></span><div><b>SCIENTIFIC CALCULATOR</b><small>Local · bounded parser · no code evaluation</small></div></div><button className="angle-toggle glass-control" onClick={() => setMode(v => v === 'DEG' ? 'RAD' : 'DEG')}>{mode}</button></div><div className="calculator-display"><span>{expression || '0'}</span><strong>{result || 'N/A'}</strong>{error && <em className="calculator-error">{error}</em>}</div><div className="calculator-memory"><button onClick={() => memoryAction('MC')}>MC</button><button onClick={() => memoryAction('MR')}>MR</button><button onClick={() => memoryAction('M+')}>M+</button><button onClick={() => setExpression('')}>AC</button></div><div className="calculator-keys">{groups.flat().map(key => <button key={key} className={key === '=' ? 'calc-equals' : key === 'DEL' ? 'calc-delete' : ''} onClick={() => key === '=' ? evaluate() : key === 'DEL' ? setExpression(v => v.slice(0, -1)) : add(key)}>{key === 'DEL' ? <Delete size={15} /> : key}</button>)}</div><div className="calculator-constants"><div className="calculator-constant-title">AEROSPACE CONSTANTS</div>{CONSTANTS.map(([name, value, unit]) => <button key={name} onClick={() => add(value)}><span>{name}</span><b>{value}</b><em>{unit}</em></button>)}</div><p className="calculator-note">Angle mode applies to direct trigonometric functions. The calculator is intended for quick engineering checks, not certified analysis.</p></section>;
}
