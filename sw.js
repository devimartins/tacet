const C='tacet-v17',F=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];
const STATIC=/\/(vendor\/|icon-|apple-touch|og-image)/;
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin||u.pathname.endsWith('config.js'))return;
  // arquivos pesados e estáveis: cache primeiro (abre rápido e funciona sem rede); o resto: rede primeiro
  if(STATIC.test(u.pathname)){e.respondWith(caches.match(e.request).then(h=>h||fetch(e.request).then(r=>{const k=r.clone();caches.open(C).then(c=>c.put(e.request,k));return r})));return}
  e.respondWith(fetch(e.request).then(r=>{const k=r.clone();caches.open(C).then(c=>c.put(e.request,k));return r}).catch(()=>caches.match(e.request)));
});
