import type {PDFPageProxy} from 'pdfjs-dist';
import type {Worker} from 'tesseract.js';
import type {TextCell} from './catalog-import';

/** One sequential worker per import, terminated on completion and cancellation. */
export class CatalogOcr {
 private worker?:Worker;
 private pending?:Promise<Worker>;
 private closing?:Promise<void>;
 private closed=false;
 constructor(private signal:AbortSignal,private progress:(text:string)=>void){}
 private check(){this.signal.throwIfAborted();}
 private wait<T>(promise:Promise<T>):Promise<T>{
  this.check();
  return new Promise((resolve,reject)=>{
   const cleanup=()=>{clearTimeout(timer);this.signal.removeEventListener('abort',aborted);};
   const aborted=()=>{cleanup();reject(new DOMException('Analisi annullata','AbortError'));};
   const timer=setTimeout(()=>{cleanup();void this.close();reject(new Error('Tempo OCR esaurito. Riprova con meno pagine o controlla la connessione.'));},180000);
   this.signal.addEventListener('abort',aborted,{once:true});
   promise.then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
  });
 }
 async read(page:PDFPageProxy){
  this.check();
  const initial=page.getViewport({scale:1});
  const scale=Math.min(3,2600/Math.max(initial.width,initial.height));
  const viewport=page.getViewport({scale});
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  const render=page.render({canvasContext:canvas.getContext('2d')!,viewport,background:'#ffffff'});
  const cancelRender=()=>render.cancel();this.signal.addEventListener('abort',cancelRender,{once:true});
  try{
   await render.promise;this.check();
   if(!this.pending){
    this.progress('Preparazione OCR italiano e inglese…');
    this.pending=import('tesseract.js').then(({createWorker})=>createWorker('ita+eng',1,{
     workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',
     logger:message=>{if(!this.signal.aborted&&message.status==='recognizing text')this.progress(`Lettura OCR · ${Math.round(message.progress*100)}%`);},
    })).then(async worker=>{if(this.closed||this.signal.aborted){await worker.terminate();throw new DOMException('Analisi annullata','AbortError');}this.worker=worker;return worker;});
   }
   const worker=await this.wait(this.pending);this.check();
   const result=await this.wait(worker.recognize(canvas,{}, {blocks:true}));this.check();
   const cells:TextCell[]=[];
   for(const block of result.data.blocks??[])for(const paragraph of block.paragraphs)for(const line of paragraph.lines){
    // Use a common baseline per OCR line so the table grouper tolerates glyph ascenders.
    for(const word of line.words)cells.push({text:word.text,x:word.bbox.x0/scale,y:(canvas.height-line.bbox.y1)/scale,width:(word.bbox.x1-word.bbox.x0)/scale});
   }
   return {cells,text:result.data.text,confidence:result.data.confidence};
  }finally{this.signal.removeEventListener('abort',cancelRender);canvas.width=canvas.height=1;}
 }
 close(){
  return this.closing??=(async()=>{
   this.closed=true;const worker=this.worker;
   await worker?.terminate();this.worker=undefined;this.pending=undefined;
  })();
 }
}
