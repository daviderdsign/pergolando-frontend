"use client";
import {useEffect,useState} from 'react';
import {apiFetch} from '@/lib/api';
import {requestTechnical} from '@/lib/technical-request';
import {annotateTechnical} from '@/lib/technical-annotations';
import {productDetails,productRequest,type CaseProduct} from '@/lib/case-products';
import {CaseImages} from './CaseImages';

type Saved={id:string;version:number;mediaIds:string};
const jobs=new Map<string,Promise<Saved>>();
function generate(caseId:string,item:CaseProduct){
 const key=`${caseId}/${item.id}/${item.version}`;const previous=jobs.get(key);if(previous)return previous;
 const task=(async()=>{
  const c=productDetails(item),r=productRequest(item),brera=item.brand.toLowerCase()==='pratic';
  if(!Number.isInteger(c.n_moduli)||c.n_moduli<1||typeof r.varianteMontaggio!=='string'||!r.varianteMontaggio)throw Error('Configurazione incompleta: riapri il prodotto e conferma variante e numero di moduli.');
  if(!brera&&(typeof r.deltaHCm!=='number'||!Number.isFinite(r.deltaHCm)))throw Error('Manca il dislivello del tetto salvato: riapri la configurazione e confermalo.');
  if(brera&&!r.opzioneTecnica)throw Error('Manca il tipo di lama salvato: riapri la configurazione e confermalo.');
  const result=await requestTechnical({catalogo:item.brand.toLowerCase(),lRichiestaCm:c.L_totale_effettiva_cm,pRichiestaCm:c.P_totale_effettiva_cm,altezzaCm:c.altezza_montanti_cm,deltaHCm:brera?0:r.deltaHCm,fissaggio:/autoportante/i.test(c.variante_montaggio||'')?'autoportante':'parete',varianteMontaggio:r.varianteMontaggio,opzioneTecnica:r.opzioneTecnica,nModuli:c.n_moduli});
  const images=[];
  for(const kind of ['plan','front','side'] as const){const data=await annotateTechnical('data:image/png;base64,'+result.technicalDrawings[kind],result.technicalDrawings.projections[kind],kind);if(data.length>2200000)throw Error('Un disegno supera il limite di archiviazione. Contatta lo studio.');images.push({kind,data});}
  try{
   const saved=await apiFetch<{items:Saved[]}>(`/cases/${encodeURIComponent(caseId)}/items/${encodeURIComponent(item.id)}/media`,{method:'POST',body:JSON.stringify({requestKey:crypto.randomUUID(),version:item.version,images})});
   const current=saved.items.find(i=>i.id===item.id);if(!current)throw Error('Il prodotto non è più disponibile.');return current;
  }catch(error){
   // A lost response or another view may have already archived this geometry.
   // Never reuse those results for a changed configuration.
   const latest=await apiFetch<{items:CaseProduct[]}>(`/cases/${encodeURIComponent(caseId)}`,{cache:'no-store'}).catch(()=>null),current=latest?.items.find(i=>i.id===item.id);
   if(current&&!current.archivedAt&&current.configuration===item.configuration&&current.requestedConfiguration===item.requestedConfiguration&&['plan','front','side'].every(k=>JSON.parse(current.mediaIds||'{}')[k]))return current;
   throw error;
  }
 })();jobs.set(key,task);task.catch(()=>{if(jobs.get(key)===task)jobs.delete(key);});if(jobs.size>24)jobs.delete(jobs.keys().next().value!);return task;
}
export function CaseTechnicalDrawings({caseId,item,onSaved}:{caseId:string;item:CaseProduct;onSaved?:()=>Promise<void>}){
 const [saved,setSaved]=useState<Saved|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const current=saved?.id===item.id&&saved.version>=item.version?saved:item,ids=JSON.parse(current.mediaIds||'{}'),complete=['plan','front','side'].every(k=>!!ids[k]),c=productDetails(item),r=productRequest(item);
 const supported=!item.archivedAt&&r.kind!=='dealer-catalog'&&['arquati','pratic'].includes(item.brand.toLowerCase())&&[c.L_totale_effettiva_cm,c.P_totale_effettiva_cm,c.altezza_montanti_cm].every(v=>Number(v)>0);
 useEffect(()=>{if(complete||!supported)return;let active=true;setError('');
  // Archiving continues across client-side navigation. The server's item
  // version check prevents attaching results to a subsequently changed model.
  generate(caseId,item).then(async result=>{if(active){setSaved(result);await onSaved?.();}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Disegni non disponibili.');});
  return()=>{active=false;};
 },[caseId,item.id,item.version,complete,supported,retry]);
 return <section aria-label={`Disegni tecnici ${item.productName}`}><h3>Disegni tecnici · {item.productName}</h3>{complete?<p>Planimetria e prospetti archiviati nella pratica.</p>:supported?error?<><p role="alert">Disegni non ancora archiviati: {error}</p><button type="button" className="pv-secondary" onClick={()=>setRetry(v=>v+1)}>Riprova i disegni tecnici</button></>:<p role="status">Disegni tecnici in fase di realizzazione. Li archiviamo appena pronti.</p>:<p>Per questo prodotto non è disponibile la generazione automatica da un modello Blender.</p>}<CaseImages key={current.mediaIds} caseId={caseId} mediaIds={current.mediaIds}/></section>;
}
