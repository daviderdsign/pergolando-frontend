export type Projection={right_axis:number[];up_axis:number[];center_world:number[];ortho_scale:number;resolution_x:number;resolution_y:number;bbox_min:number[];bbox_max:number[]};
export async function annotateTechnical(src:string,meta:Projection,kind:'plan'|'front'|'side'):Promise<string>{
 const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Disegno Blender non leggibile'));image.src=src;});
 const margin=140,canvas=document.createElement('canvas');canvas.width=image.naturalWidth+2*margin;canvas.height=image.naturalHeight+2*margin;const context=canvas.getContext('2d');if(!context)throw Error('Canvas non disponibile');const c=context;c.fillStyle='white';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(image,margin,margin);
 const project=(p:number[])=>{const d=p.map((v,i)=>v-meta.center_world[i]),factor=meta.resolution_x/meta.ortho_scale;return [margin+meta.resolution_x/2+d.reduce((n,v,i)=>n+v*meta.right_axis[i],0)*factor,margin+meta.resolution_y/2-d.reduce((n,v,i)=>n+v*meta.up_axis[i],0)*factor];};
 const lo=meta.bbox_min,hi=meta.bbox_max;
 const corners=Array.from({length:8},(_,n)=>project(lo.map((v,i)=>(n&(1<<i))?hi[i]:v)));const left=Math.min(...corners.map(p=>p[0])),right=Math.max(...corners.map(p=>p[0])),top=Math.min(...corners.map(p=>p[1])),bottom=Math.max(...corners.map(p=>p[1]));
 const fmt=(m:number)=>(m*100).toLocaleString('it-IT',{maximumFractionDigits:1})+' cm';
 c.strokeStyle='#47554b';c.fillStyle='#47554b';c.lineWidth=2;c.font='24px Arial';c.textAlign='center';
 function line(x1:number,y1:number,x2:number,y2:number){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
 const y=bottom+45;line(left,bottom+8,left,y+10);line(right,bottom+8,right,y+10);line(left,y,right,y);line(left-5,y-5,left+5,y+5);line(right-5,y-5,right+5,y+5);c.fillText('Ingombro '+(kind==='side'?'SP':'L')+' '+fmt(hi[kind==='side'?1:0]-lo[kind==='side'?1:0]),(left+right)/2,y+34);
 const x=right+45;line(right+8,top,x+10,top);line(right+8,bottom,x+10,bottom);line(x,top,x,bottom);line(x-5,top-5,x+5,top+5);line(x-5,bottom-5,x+5,bottom+5);c.save();c.translate(x+34,(top+bottom)/2);c.rotate(-Math.PI/2);c.fillText('Ingombro '+(kind==='plan'?'SP':'H')+' '+fmt(hi[kind==='plan'?1:2]-lo[kind==='plan'?1:2]),0,0);c.restore();
 return canvas.toDataURL('image/png');
}
