"use client";
import {useEffect,useState} from 'react';
import type {ConfigurazionePergola} from '@pergolando/shared/pricing-engine';
import {annotateTechnical,type Projection} from '@/lib/technical-annotations';
import {requestTechnical} from '@/lib/technical-request';
export type BlenderDrawings={plan:string;front:string;side:string;spanCm:number;projections:Record<"plan"|"front"|"side",Projection>};
type Props={quote:ConfigurazionePergola;name:string;brand:string;rise:number;variant:string;technical:string;mount:'parete'|'autoportante';onReady:(d:BlenderDrawings)=>void};
export function TechnicalDrawings({quote:q,name,brand,rise,variant,technical,mount,onReady}:Props){
 const [retry,setRetry]=useState(0);
 const [drawings,setDrawings]=useState<BlenderDrawings|null>(null),[error,setError]=useState('');
 const L=q.L_totale_effettiva_cm,P=q.P_totale_effettiva_cm,H=q.altezza_montanti_cm;
 useEffect(()=>{let active=true;setDrawings(null);setError('');requestTechnical({catalogo:brand,lRichiestaCm:L,pRichiestaCm:P,altezzaCm:H,deltaHCm:brand==='pratic'?0:rise,fissaggio:mount,varianteMontaggio:variant,opzioneTecnica:technical||'H20',nModuli:q.n_moduli,technicalViews:true}).then(async r=>{if(active){const d={...r.technicalDrawings,plan:'data:image/png;base64,'+r.technicalDrawings.plan,front:'data:image/png;base64,'+r.technicalDrawings.front,side:'data:image/png;base64,'+r.technicalDrawings.side};for(const key of ["plan","front","side"] as const)d[key]=await annotateTechnical(d[key],d.projections[key],key);if(!active)return;setDrawings(d);onReady(d);}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Disegni non disponibili');});return()=>{active=false;};},[L,P,H,brand,rise,variant,technical,mount,q.n_moduli,onReady,retry]);
 return <section className="pv-card pv-technical"><h2>Disegni del modello · {name}</h2><p className="pv-note">Viste ortografiche Blender alla stessa scala. Quote in centimetri; non sono disegni esecutivi.</p>{error?<><p role="alert">{error}</p><button className="pv-secondary" onClick={()=>setRetry(v=>v+1)}>Riprova i disegni tecnici</button></>:!drawings?<p role="status">Disegni tecnici in fase di realizzazione…</p>:([['plan','Planimetria'],['front','Prospetto frontale'],['side','Prospetto laterale']] as const).map(([kind,label])=>{return <figure key={kind}><figcaption>{label}</figcaption><img src={drawings[kind]} alt={label+' '+name+' con quote di ingombro reale'} style={{width:'100%',height:'auto'}}/><p className="pv-note">Quote di progetto: L {L} cm · {brand==='pratic'?'P':'SP'} {P} cm · H {H} cm{brand!=='pratic'?` · P frontale ${H-rise} cm · H1 ${rise} cm`:''}. Le quote sul disegno misurano l'ingombro della geometria, compresi gli elementi sporgenti.</p></figure>;})}</section>;
}
