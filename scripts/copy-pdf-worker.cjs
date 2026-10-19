const fs=require('node:fs'),path=require('node:path');
const target=path.join(__dirname,'../public/pdf.worker.min.mjs');fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'),target);
const ocr=path.join(__dirname,'../public/ocr');fs.mkdirSync(path.join(ocr,'core'),{recursive:true});
fs.copyFileSync(require.resolve('tesseract.js/dist/worker.min.js'),path.join(ocr,'worker.min.js'));
const core=path.dirname(require.resolve('tesseract.js-core/package.json',{paths:[path.dirname(require.resolve('tesseract.js'))]}));
for(const file of fs.readdirSync(core))if(/\.wasm(?:\.js)?$/.test(file))fs.copyFileSync(path.join(core,file),path.join(ocr,'core',file));
console.log('Worker PDF e motore OCR pronti');
