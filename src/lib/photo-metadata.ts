/** Read only optical EXIF values from the original JPEG; no location data. */
export function focal35FromJpeg(buffer:ArrayBuffer):number|null{
 try{
  const v=new DataView(buffer);if(v.byteLength<4||v.getUint16(0)!==0xffd8)return null;
  for(let pos=2;pos+4<v.byteLength;){
   if(v.getUint8(pos)!==0xff)return null;
   const marker=v.getUint8(pos+1);if(marker===0xda||marker===0xd9)break;
   const length=v.getUint16(pos+2);if(length<2||pos+2+length>v.byteLength)return null;
   if(marker===0xe1&&length>=16&&v.getUint32(pos+4)===0x45786966&&v.getUint16(pos+8)===0){
    const base=pos+10,end=pos+2+length,little=v.getUint16(base)===0x4949;
    if(!little&&v.getUint16(base)!==0x4d4d)return null;
    if(v.getUint16(base+2,little)!==42)return null;
    const valid=(p:number,n:number)=>p>=base&&p+n<=end;
    function entries(offset:number){const at=base+offset;if(!valid(at,2))return [];
     const count=v.getUint16(at,little);if(count>512||!valid(at+2,count*12))return [];
     return Array.from({length:count},(_,i)=>at+2+i*12);
    }
    const first=entries(v.getUint32(base+4,little));const pointer=first.find(p=>v.getUint16(p,little)===0x8769);
    if(pointer===undefined)return null;
    const exif=entries(v.getUint32(pointer+8,little));let focal:number|null=null;let zoom=1;
    for(const p of exif){const tag=v.getUint16(p,little),type=v.getUint16(p+2,little),count=v.getUint32(p+4,little);
     if(tag===0xa405&&type===3&&count===1)focal=v.getUint16(p+8,little);
     if(tag===0xa404&&type===5&&count===1){const at=base+v.getUint32(p+8,little);if(valid(at,8)){const den=v.getUint32(at+4,little);if(den)zoom=v.getUint32(at,little)/den;}}
    }
    // Whether a maker's 35mm field includes digital zoom varies; do not double count it.
    return focal!==null&&focal>=5&&focal<=1000&&zoom<=1.01?focal:null;
   }
   pos+=2+length;
  }
 }catch{/* Truncated or unsupported metadata falls back to image calibration. */}
 return null;
}
export async function readPhotoFocal35(file:File){return focal35FromJpeg(await file.slice(0,256*1024).arrayBuffer());}
