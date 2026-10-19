import {apiFetch} from './api';
import type {Projection} from './technical-annotations';
export type RawDrawings={plan:string;front:string;side:string;spanCm:number;projections:Record<'plan'|'front'|'side',Projection>};
const cache=new Map<string,Promise<{technicalDrawings:RawDrawings}>>();
export function requestTechnical(payload:Record<string,unknown>){
 const body=JSON.stringify(Object.fromEntries(Object.entries({...payload,technicalViews:true}).sort(([a],[b])=>a.localeCompare(b))));
 const existing=cache.get(body);if(existing)return existing;
 const request=apiFetch<{technicalDrawings:RawDrawings}>('/catalog/render3d',{method:'POST',body});cache.set(body,request);
 request.catch(()=>{if(cache.get(body)===request)cache.delete(body);});
 if(cache.size>8)cache.delete(cache.keys().next().value!);
 return request;
}
