export function loginDestination(search:string):string{
 const next=new URLSearchParams(search).get("next");if(!next||!next.startsWith('/')||next.startsWith('//'))return '/pratiche';
 try{const parsed=new URL(next,'https://pergolando.invalid');if(parsed.origin!=='https://pergolando.invalid')return '/pratiche';let path=parsed.pathname;
 const legacy:Record<string,string>={'/demo':'/pratiche','/wizard':'/progetto','/prova':'/progetto','/demo/catalogo':'/cataloghi/importa','/demo/catalogo/preventivo':'/cataloghi/preventivo'};path=legacy[path]||path;
 if(!['/impostazioni','/pratiche/nuova','/pratiche','/cataloghi','/cataloghi/importa','/cataloghi/preventivo','/progetto'].includes(path)&&!/^\/pratiche\/[A-Za-z0-9_-]{1,100}\/(offerta|gestione|conto|apertura|prodotti|pagamenti)$/.test(path)&&!/^\/cataloghi\/[A-Za-z0-9_-]{1,100}$/.test(path))return '/pratiche';
 const params=new URLSearchParams();for(const key of ['case','item','catalog','catalogo']){const value=parsed.searchParams.get(key);if(value&&/^[A-Za-z0-9_-]{1,100}$/.test(value))params.set(key,value);}return path+(params.size?'?'+params.toString():'');
 }catch{return '/pratiche';}
}

