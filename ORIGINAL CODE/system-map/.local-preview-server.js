const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;

http.createServer((req, res) => {
  let p = req.url === '/' ? '/Index.html' : req.url;
  const file = path.join(root, decodeURIComponent(p.split('?')[0]));
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}).listen(8000, () => console.log('Serving on http://localhost:8000'));
