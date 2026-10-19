export type CaseProduct={id:string;brand:string;productName:string;amountCents:number;version:number;archivedAt:string|null;configuration:string;requestedConfiguration:string;mediaIds:string};
export function productRequest(item:CaseProduct){try{return JSON.parse(item.requestedConfiguration||'{}');}catch{return {};}}
export function productEditUrl(caseId:string,item:CaseProduct){const request=productRequest(item),query=new URLSearchParams({case:caseId,item:item.id});if(request.kind==='dealer-catalog'){query.set('catalog',request.catalogId);return '/cataloghi/preventivo?'+query;}return '/progetto?'+query;}
export function productDetails(item:CaseProduct){try{return JSON.parse(item.configuration||'{}');}catch{return {};}}
