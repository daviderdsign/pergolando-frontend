"use client";
import {useEffect,useState} from 'react';import {usePathname,useSearchParams} from 'next/navigation';import Link from 'next/link';import {apiFetch} from '@/lib/api';import {useI18n} from '@/lib/i18n';import './case-road.css';
type Progress={offers:number;id:string;caseName?:string;items:{archivedAt:string|null}[];acceptedProposalId:string|null;confirmedProposalId:string|null;deliveredAt:string|null};
export function CaseRoad(){const path=usePathname(),params=useSearchParams(),{lang}=useI18n(),en=lang==='en';const match=path.match(/^\/pratiche\/([^/]+)\//),id=match?.[1]||params.get('case')||'',isNew=path==='/pratiche/nuova',visible=isNew||!!id&&/^(\/pratiche\/|\/progetto|\/prova|\/cataloghi)/.test(path);const [progress,setProgress]=useState<Progress>(),[notice,setNotice]=useState(''),[error,setError]=useState('');
 useEffect(()=>{if(!visible||!id){setProgress(undefined);return;}let active=true;const load=()=>{apiFetch<Progress>(`/cases/${encodeURIComponent(id)}/progress`,{cache:'no-store'}).then(p=>{if(active){setProgress(p);setError('');}}).catch(()=>{if(active)setError(en?'Progress unavailable':'Avanzamento non disponibile');});};let timer:ReturnType<typeof setTimeout>;const refresh=()=>{clearTimeout(timer);timer=setTimeout(load,300);};load();window.addEventListener('pergolando:case-changed',refresh);return()=>{active=false;clearTimeout(timer);window.removeEventListener('pergolando:case-changed',refresh);};},[visible,id,path,en]);
 useEffect(()=>{if(!visible)return;document.body.classList.add('has-case-road');return()=>document.body.classList.remove('has-case-road');},[visible]);
 if(!visible)return null;
 const base='/pratiche/'+encodeURIComponent(id);const names=en?['Project','Products','Offer','Negotiation','Orders','Installation','Delivery','Support']:['Pratica','Prodotti','Offerta','Trattativa','Ordini','Posa','Consegna','Assistenza'];const links=[id?base+'/apertura':'/pratiche/nuova',id?base+'/prodotti':'',id?base+'/offerta':'',id?base+'/gestione':'','','', ''];links[4]=id?base+'/ordini':'';links[5]=id?base+'/posa':'';links[6]=id?base+'/consegna':'';links[7]=id?base+'/assistenza':'';
 const active=progress?.id===id?progress:undefined;const done=[!!active,!!active?.items?.some(i=>!i.archivedAt),(active?.offers||0)>0,!!active?.confirmedProposalId,false,false,!!active?.deliveredAt,false];
 const current=isNew||path.endsWith('/apertura')?0:path.endsWith('/offerta')?2:(path.endsWith('/gestione')||path.endsWith('/pagamenti'))?3:path.endsWith('/ordini')?4:path.endsWith('/posa')?5:path.endsWith('/assistenza')?7:(path.endsWith('/conto')||path.endsWith('/consegna'))?6:1;
 return <nav className="case-road" aria-label={en?'Project journey':'Percorso della commessa'}><div className="case-road-inner"><div className="case-road-caption"><strong>{current+1} · {names[current]}</strong><span>{error||notice||active?.caseName||(en?'Your project, step by step':'La tua commessa, un passo alla volta')}</span></div><ol>{names.map((name,i)=><li key={name} className={`${done[i]?'done':''} ${i===current?'current':''} ${i>0&&done[i-1]&&done[i]?'connected':''}`}>
 {links[i]?<Link href={links[i]} aria-current={i===current?'step':undefined} aria-label={`${i+1}. ${name}${done[i]?(en?', completed':', completato'):''}`} onClick={()=>setNotice('')}><span>{i+1}</span><small>{name}</small></Link>:<button type="button" data-unavailable="true" aria-label={`${i+1}. ${name} — ${en?'not yet available':'in preparazione'}`} onClick={()=>setNotice(en?`${name}: this module is not yet available.`:`${name}: modulo ancora in preparazione.`)}><span>{i+1}</span><small>{name}</small></button>}
 </li>)}</ol><p className="case-road-live" role="status">{notice}</p></div></nav>;
}





