import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root = fileURLToPath(new URL('./dist/', import.meta.url));
const port = Number(process.env.PORT || 8000);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server = createServer(async (req,res) => {
 try {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const target = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!target.startsWith(root.endsWith(sep) ? root : root + sep)) {res.writeHead(403).end();return;}
  const body = await readFile(target);
  res.writeHead(200,{'Content-Type':types[extname(target)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'}).end(body);
 } catch {res.writeHead(404).end('Not found');}
});
server.on('error',error=>{console.error(`Unable to start ExamCraft: ${error.message}. Try another PORT.`);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`ExamCraft: http://127.0.0.1:${server.address().port} (Ctrl+C to stop)`));
