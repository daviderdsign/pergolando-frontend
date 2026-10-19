import {jsPDF} from 'jspdf';
import type {DealerProfile} from './dealer-profile';
export function drawLetterhead(doc:jsPDF,profile?:DealerProfile){
 if(!profile)return;
 const l=profile.letterhead,w=doc.internal.pageSize.getWidth(),h=doc.internal.pageSize.getHeight();
 if(l.mode==='pdf'&&l.background){doc.addImage(l.background,0,0,w,h);return;}
 let x=18;
 if(l.logo){const p=doc.getImageProperties(l.logo),scale=Math.min(55/p.width,20/p.height);doc.addImage(l.logo,18,10,p.width*scale,p.height*scale);x=80;}
 doc.setFont('times','normal');doc.setTextColor(40,53,44);doc.setFontSize(11);
 const heading=l.heading||[profile.company,profile.address,profile.email+' · '+profile.phone].filter(Boolean).join('\n');
 const lines=doc.splitTextToSize(heading,w-x-18);doc.text(lines.slice(0,5),x,13,{lineHeightFactor:1.1});
 doc.setDrawColor(210);doc.line(18,l.topMm-10,w-18,l.topMm-10);
 doc.setFontSize(8);doc.setTextColor(80);const footer=l.footer||[profile.company,profile.vatNumber&&'P.IVA '+profile.vatNumber,profile.email].filter(Boolean).join(' · ');doc.text(doc.splitTextToSize(footer,w-36).slice(0,3),18,h-l.bottomMm+8);
}
export function letterheadPdf(profile:DealerProfile){const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});drawLetterhead(doc,profile);return doc;}
