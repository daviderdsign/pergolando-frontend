import {apiFetch} from './api';
import type {ImportResult} from './catalog-import';
export type CatalogTrial={id:string;revision:number;tableId:string;widthCm:number;depthCm:number;rule:string;expectedReject:boolean;actualCents:number|null;passed:boolean;message:string;generatedKey?:string|null;generatedSnapshot?:string|null;reviewedAt?:string|null;reviewedBy?:string|null;reviewNote?:string|null;expectedCents:number|null};
export type CatalogRecord={id:string;name:string;brand:string;version:number;revision:number;status:string;dataset:string;approvedHash?:string;coverageGaps?:string[];validationNotice?:string;approvalNotice?:string;approvedBy?:string;checks:CatalogTrial[];sources:{id:string;name:string;size:number;complete:boolean}[]};
export const catalogData=(record:CatalogRecord)=>JSON.parse(record.dataset) as ImportResult;
export async function uploadCatalogFiles(id:string,files:File[],progress:(message:string)=>void){
 for(const file of files){
  if(!file.size||file.size>50*1024*1024)throw new Error('Ogni originale deve contenere dati e non superare 50 MB.');
  progress(`Verifico ${file.name}…`);const bytes=new Uint8Array(await file.arrayBuffer());
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const source=await apiFetch<{id:string;complete:boolean}>(`/dealer-catalogs/${id}/sources`,{method:'POST',body:JSON.stringify({name:file.name,size:file.size,hash})});
  if(source.complete)continue;
  for(let offset=0,part=0;offset<bytes.length;offset+=1048576,part++){
   progress(`Carico ${file.name}: ${Math.round(offset/bytes.length*100)}%`);
   const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Lettura del file non riuscita.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(new Blob([bytes.slice(offset,offset+1048576)]));});
   await apiFetch(`/dealer-catalogs/${id}/sources/${source.id}/parts/${part}`,{method:'POST',body:JSON.stringify({data})});
  }
  await apiFetch(`/dealer-catalogs/${id}/sources/${source.id}/finish`,{method:'POST'});
 }
}


