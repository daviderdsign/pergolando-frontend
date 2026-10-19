import type {Commercial} from './commercial-engine';
export type TextCell={text:string;x:number;y:number;width:number};
export type PriceTable={id:string;source:string;page:number;title:string;columns:number[];rows:{depth:number;prices:(number|null)[]}[];unit:'cm'|'mm'|'m';horizontal:'width'|'depth';confirmed:boolean;notesReviewed:boolean;notes:string;preview?:string};
export type ImportPhoto={id:string;source:string;page:number;dataUrl:string};
export type ImportPage={source:string;page:number;text:string;preview?:string;method?:'native'|'ocr';confidence?:number};
export type ImportResult={version:1;commercial?:Commercial;tables:PriceTable[];pages:ImportPage[];photos:ImportPhoto[];warnings:string[]};
export type DocumentDraft={id:string;name:string;brand:string;files:File[];savedAt:string;result?:ImportResult};
export function numberFromListino(input:string):number|null{
 const value=input.trim().replace(/(?:EUR|€)/gi,'').replace(/[\s\u00a0']/g,'');
 if(!/^[+-]?\d+(?:[.,]\d+)*$/.test(value))return null;
 let normalized=value;
 if(value.includes(',')){if(!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(value))return null;normalized=value.replace(/\./g,'').replace(',','.');}
 else if(/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(value))normalized=value.replace(/\./g,'');
 else if(!/^[+-]?\d+(?:\.\d{1,2})?$/.test(value))return null;
 const parsed=Number(normalized);return Number.isFinite(parsed)?parsed:null;
}
export function groupTextRows(cells:TextCell[]):TextCell[][]{
 const sorted=cells.filter(c=>c.text.trim()).sort((a,b)=>b.y-a.y||a.x-b.x),rows:TextCell[][]=[];
 for(const cell of sorted){const row=rows.at(-1);if(row&&Math.abs(row[0].y-cell.y)<=2.5)row.push(cell);else rows.push([cell]);}
 return rows.map(row=>row.sort((a,b)=>a.x-b.x));
}
function splitNumbers(row:TextCell[]):TextCell[]{return row.flatMap(cell=>{const tokens=cell.text.trim().split(/\s+/);if(tokens.length>1&&tokens.every(t=>numberFromListino(t)!==null||/^[-–—]$/.test(t)))return tokens.map((text,i)=>({...cell,text,x:cell.x+i*cell.width/tokens.length,width:cell.width/tokens.length}));return [cell];});}
const dimension=(n:number|null):n is number=>n!==null&&n>0&&n<=3000;
export function findPriceTables(cells:TextCell[],source:string,page:number):PriceTable[]{
 const lines=groupTextRows(cells).map(splitNumbers),tables:PriceTable[]=[];
 for(let i=0;i<lines.length-1;i++){
  const numeric=lines[i].map(c=>({cell:c,n:numberFromListino(c.text)})).filter(c=>dimension(c.n));
  if(numeric.length<2||numeric.length>30||numeric.some((c,j)=>j>0&&c.n!<=numeric[j-1].n!))continue;
  const columns=numeric.map(c=>c.n!),gap=Math.min(...numeric.slice(1).map((c,j)=>c.cell.x-numeric[j].cell.x));if(gap<8)continue;
  const rows:PriceTable['rows']=[];const annotations:string[]=[];let last=i;
  for(let j=i+1;j<lines.length&&j<i+65;j++){
   const line=lines[j],depthCell=line.find(c=>c.x<numeric[0].cell.x-4&&dimension(numberFromListino(c.text)));
   if(!depthCell){const continues=rows.length>0&&lines.slice(j+1,j+3).some(next=>{const candidate=next.find(c=>c.x<numeric[0].cell.x-4&&dimension(numberFromListino(c.text)));return candidate&&numberFromListino(candidate.text)!>rows.at(-1)!.depth;});if(continues){annotations.push(line.map(c=>c.text).join(' '));continue;}break;}
   const depth=numberFromListino(depthCell.text)!;if(rows.some(r=>r.depth===depth)||rows.length&&depth<=rows.at(-1)!.depth)break;
   const prices=numeric.map(({cell})=>{const matches=line.filter(c=>Math.abs(c.x-cell.x)<=Math.min(12,gap*.25));if(matches.length!==1)return null;const n=numberFromListino(matches[0].text);return n!==null&&n>0?n:null;});
   if(prices.filter(n=>n!==null).length<1)break;rows.push({depth,prices});last=j;
  }
  if(rows.length<2||rows[0].prices.filter(price=>price!==null).length<2)continue;
  const context=lines.slice(Math.max(0,i-5),i).map(row=>row.map(c=>c.text).join(' ')).join('\n');
  tables.push({id:`${source}:${page}:${i}`,source,page,title:context.split('\n').find(line=>/[a-zA-Z]{3}/.test(line))||`Tabella pagina ${page}`,columns,rows,unit:'cm',horizontal:'width',confirmed:false,notesReviewed:false,notes:[context,...annotations].filter(Boolean).join('\n')});i=last;
 }
 return tables;
}
export function parseCsv(text:string):string[][]{
 const first=text.split(/\r?\n/)[0]??'',separator=first.includes(';')?';':first.includes('\t')?'\t':',';
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===separator&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(c=>c.trim()))rows.push(row);row=[];cell='';}else cell+=ch;}
 if(quoted)throw new Error('CSV con virgolette non chiuse.');row.push(cell);if(row.some(c=>c.trim()))rows.push(row);return rows;
}
export function validateTable(table:PriceTable):string[]{
 const errors:string[]=[];if(!table.title.trim())errors.push('Inserisci il nome del modello e della variante.');
 if(table.columns.length<2||table.rows.length<2)errors.push('Servono almeno due larghezze e due profondità.');
 if(table.columns.some((n,i)=>!Number.isFinite(n)||n<=0||i>0&&n<=table.columns[i-1]))errors.push('Le dimensioni delle colonne devono crescere, senza duplicati.');
 if(table.rows.some((r,i)=>!Number.isFinite(r.depth)||r.depth<=0||i>0&&r.depth<=table.rows[i-1].depth))errors.push('Le dimensioni delle righe devono crescere, senza duplicati.');
 if(table.rows.some(r=>r.prices.length!==table.columns.length||r.prices.some(p=>p!==null&&(!Number.isFinite(p)||p<=0))))errors.push('I prezzi devono essere positivi. Lascia vuote le celle non disponibili.');
 if(!table.rows.some(r=>r.prices.some(p=>p!==null)))errors.push('Nessun prezzo disponibile.');
 if(!table.notesReviewed)errors.push('Verifica le note, le inclusioni e gli eventuali supplementi.');return errors;
}
export function priceFromImportedTable(table:PriceTable,widthCm:number,depthCm:number,rule:'ceil'|'exact'='ceil'){
 if(!table.confirmed||validateTable(table).length)throw new Error('La tabella deve essere verificata e confermata.');
 if(!Number.isFinite(widthCm)||!Number.isFinite(depthCm)||widthCm<=0||depthCm<=0)throw new Error('Inserisci misure positive.');
 const factor=table.unit==='mm'?.1:table.unit==='m'?100:1,x=table.horizontal==='width'?widthCm:depthCm,y=table.horizontal==='width'?depthCm:widthCm;
 const col=table.columns.findIndex(n=>rule==='exact'?Math.abs(n*factor-x)<.001:n*factor>=x),row=table.rows.findIndex(r=>rule==='exact'?Math.abs(r.depth*factor-y)<.001:r.depth*factor>=y);
 if(col<0||row<0)throw new Error('Misure non coperte dal listino. Nessuna estrapolazione dei prezzi.');
 const price=table.rows[row].prices[col];if(price===null)throw new Error('La combinazione scelta non ha un prezzo nel documento.');
 return {price,widthBucketCm:(table.horizontal==='width'?table.columns[col]:table.rows[row].depth)*factor,depthBucketCm:(table.horizontal==='width'?table.rows[row].depth:table.columns[col])*factor};
}

