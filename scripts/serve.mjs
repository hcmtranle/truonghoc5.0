import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const html=await readFile(fileURLToPath(new URL('../dist/index.html',import.meta.url)));
const port=Number(process.env.PORT||4173);
http.createServer((req,res)=>{
  if(!['/','/index.html','/source'].includes(req.url)){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  res.end(req.url === '/source' ? '<!doctype html><html><body><pre>' + html.toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</pre></body></html>' : html);
}).listen(port,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:'+port));
