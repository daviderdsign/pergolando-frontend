import {CatalogOcr} from './catalog-ocr';
import {findPriceTables,groupTextRows,parseCsv,type ImportResult,type TextCell} from './catalog-import';
import type {PDFPageProxy} from 'pdfjs-dist';
function pictureCanvas(width:number,height:number){const scale=Math.min(1,1100/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));return canvas;}
async function imageFromObject(page:PDFPageProxy,id:string):Promise<string|null>{
 const image=await new Promise<{width:number;height:number;bitmap?:ImageBitmap;data?:Uint8Array;kind?:number}|null>(resolve=>{const timer=setTimeout(()=>resolve(null),2000);try{page.objs.get(id,(value:unknown)=>{clearTimeout(timer);resolve(value as never);});}catch{clearTimeout(timer);resolve(null);}});
 if(!image||image.width<120||image.height<100)return null;
 const canvas=pictureCanvas(image.width,image.height),ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 if(image.bitmap)ctx.drawImage(image.bitmap,0,0,canvas.width,canvas.height);
 else if(image.data&&(image.kind===2||image.kind===3)){
  if(image.width*image.height>24000000)return null;
  const original=document.createElement('canvas');original.width=image.width;original.height=image.height;const rgba=new Uint8ClampedArray(image.width*image.height*4);
  for(let i=0;i<image.width*image.height;i++){const stride=image.kind===2?3:4;rgba[i*4]=image.data[i*stride];rgba[i*4+1]=image.data[i*stride+1];rgba[i*4+2]=image.data[i*stride+2];rgba[i*4+3]=image.kind===3?image.data[i*stride+3]:255;}
  original.getContext('2d')!.putImageData(new ImageData(rgba,image.width,image.height),0,0);ctx.drawImage(original,0,0,canvas.width,canvas.height);original.width=original.height=1;
 }else return null;
 return canvas.toDataURL('image/jpeg',.82);
}
export async function extractCatalogFiles(files:File[],progress:(message:string)=>void,signal:AbortSignal,options:{ocr?:'auto'|'all'|'off'}={}):Promise<ImportResult>{
 const result:ImportResult={version:1,tables:[],pages:[],photos:[],warnings:[]};let processed=0,photoBytes=0;
 const check=()=>{if(signal.aborted)throw new DOMException('Analisi annullata','AbortError');};
 const ocr=new CatalogOcr(signal,progress);const cancelOcr=()=>{void ocr.close();};signal.addEventListener('abort',cancelOcr,{once:true});
 try{for(const file of files){check();try{
  if(file.name.toLowerCase().endsWith('.csv')){const rows=parseCsv(await file.text()),cells:TextCell[]=rows.flatMap((row,i)=>row.map((text,j)=>({text,x:j*100,y:100000-i*20,width:75})));result.tables.push(...findPriceTables(cells,file.name,1));result.pages.push({source:file.name,page:1,text:rows.map(r=>r.join(' | ')).join('\n')});continue;}
  if(file.type.startsWith('image/')){const bitmap=await createImageBitmap(file);const canvas=pictureCanvas(bitmap.width,bitmap.height);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);result.photos.push({id:`${file.name}:foto`,source:file.name,page:0,dataUrl:canvas.toDataURL('image/jpeg',.85)});bitmap.close();continue;}
  if(!file.name.toLowerCase().endsWith('.pdf')){result.warnings.push(`${file.name}: formato conservato, ma l'estrazione è disponibile per PDF e CSV. Esporta Excel in CSV.`);continue;}
  const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
  const abort=()=>{void task.destroy();};signal.addEventListener('abort',abort,{once:true});
  try{const pdf=await task.promise;const count=Math.min(pdf.numPages,250-processed);if(count<pdf.numPages)result.warnings.push(`${file.name}: analizzate ${Math.max(0,count)} di ${pdf.numPages} pagine (limite 250 per analisi).`);
   for(let pageNum=1;pageNum<=count;pageNum++){check();processed++;progress(`${file.name} · pagina ${pageNum} di ${count}`);const page=await pdf.getPage(pageNum),content=await page.getTextContent();
    let cells:TextCell[]=content.items.filter(item=>'str' in item).map(item=>{const t=item as {str:string;transform:number[];width:number};return {text:t.str,x:t.transform[4],y:t.transform[5],width:t.width};});
    let text=groupTextRows(cells).map(r=>r.map(c=>c.text).join(' ')).join('\n');
    const weak=text.replace(/[^\p{L}\p{N}]/gu,'').length<80;let method:'native'|'ocr'='native',confidence:number|undefined;
    if(options.ocr!=='off'&&(weak||options.ocr==='all')){
     try{progress(`${file.name} · pagina ${pageNum}: OCR`);const recognized=await ocr.read(page);
      if(recognized.text.trim()&&recognized.cells.length){cells=recognized.cells;text=recognized.text;method='ocr';confidence=recognized.confidence;
       result.warnings.push(`${file.name}, pagina ${pageNum}: lettura OCR (${Math.round(confidence)}% di confidenza del motore, non garanzia di correttezza). Verifica cifre, note e tabelle sul documento originale.`);
      }else result.warnings.push(`${file.name}, pagina ${pageNum}: OCR senza testo riconoscibile. Verifica manualmente la pagina.`);
     }catch(error){check();result.warnings.push(`${file.name}, pagina ${pageNum}: OCR non riuscito; testo originale conservato. ${error instanceof Error?error.message:''}`);}
    }else if(weak)result.warnings.push(`${file.name}, pagina ${pageNum}: testo debole, OCR disattivato.`);
    const tables=findPriceTables(cells,file.name,pageNum);
    const operators=await page.getOperatorList();const imageIds=[...new Set(operators.fnArray.flatMap((op,i)=>op===pdfjs.OPS.paintImageXObject?[String(operators.argsArray[i][0])]:[]))];
    let preview:string|undefined;
    if(method==='ocr'||tables.length||imageIds.length&&result.photos.length<100){const initial=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(1,900/Math.max(initial.width,initial.height))});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d')!,viewport}).promise;if(method==='ocr'||tables.length)preview=canvas.toDataURL('image/jpeg',.85);canvas.width=canvas.height=1;
     for(const id of imageIds.slice(0,12)){check();if(result.photos.length>=100||photoBytes>25000000)break;const dataUrl=await imageFromObject(page,id);if(dataUrl){photoBytes+=dataUrl.length;result.photos.push({id:`${file.name}:${pageNum}:${id}`,source:file.name,page:pageNum,dataUrl});}}
     if(imageIds.length>12)result.warnings.push(`${file.name}, pagina ${pageNum}: esportate al massimo 12 immagini.`);
    }
    result.pages.push({source:file.name,page:pageNum,text,preview,method,confidence});result.tables.push(...tables.map(table=>({...table,preview})));page.cleanup();await new Promise(resolve=>setTimeout(resolve,0));
   }
  }finally{signal.removeEventListener('abort',abort);await task.destroy();}
 }catch(error){check();result.warnings.push(`${file.name}: ${error instanceof Error?error.message:'documento non leggibile'}`);}}
 if(result.photos.length>=100||photoBytes>25000000)result.warnings.push('Raggiunto il limite delle foto estratte per questa analisi. I documenti originali sono conservati.');
 if(!result.tables.length)result.warnings.push('Nessuna matrice prezzi riconosciuta. Puoi aggiungere un CSV con larghezze sulla prima riga, profondità nella prima colonna e prezzi nelle celle.');
 return result;
 }finally{signal.removeEventListener('abort',cancelOcr);await ocr.close();}
}
