import { randomUUID, randomBytes } from 'node:crypto';
export class Jobs {
  constructor({ run, remove, now = Date.now, max = 10, ttl = 3600000, perDay = 20 }) {
    Object.assign(this, { run, remove, now, max, ttl, perDay });
    this.items = new Map(); this.usage = new Map(); this.busy = false;
  }
  create(owner, scene) {
    const pending = [...this.items.values()].filter(j => !['ready','failed','cancelled'].includes(j.state));
    if (pending.length >= this.max || pending.some(j => j.owner === owner)) throw Object.assign(new Error('Aguarde a captura atual terminar.'), { status: 429 });
    const key = owner + ':' + Math.floor(this.now() / 86400000), used = this.usage.get(key) || 0;
    if (used >= this.perDay) throw Object.assign(new Error('Limite diário de capturas atingido.'), { status: 429 });
    this.usage.set(key, used + 1);
    const job = { id: randomUUID(), owner, scene, state: 'queued', percent: 0, created: this.now(), controller: new AbortController(), secret: randomBytes(32).toString('hex') };
    this.items.set(job.id, job); queueMicrotask(() => this.drain()); return job;
  }
  owned(id, owner) { const j = this.items.get(id); return j?.owner === owner ? j : null; }
  async cancel(job) { job.controller.abort(); job.state = 'cancelled'; job.expires = this.now() + this.ttl; }
  async drain() {
    if (this.busy) return;
    const job = [...this.items.values()].find(j => j.state === 'queued'); if (!job) return;
    this.busy = true; job.state = 'preparing';
    try {
      await this.run(job);
      if (job.controller.signal.aborted) { await this.remove(job); job.state = 'cancelled'; }
      else { job.state = 'ready'; job.percent = 100; }
    } catch (e) {
      await this.remove(job);
      if (job.state !== 'cancelled') { job.state = 'failed'; job.error = 'Não foi possível concluir a gravação. Tente novamente.'; console.error('capture_failed', job.id, e.message); }
    } finally { job.scene = null; job.expires = this.now() + this.ttl; this.busy = false; queueMicrotask(() => this.drain()); }
  }
  async clean() {
    for (const [id, j] of this.items) if (j.expires && j.expires < this.now()) { await this.remove(j); this.items.delete(id); }
    const day = Math.floor(this.now() / 86400000);
    for (const key of this.usage.keys()) if (Number(key.split(':').at(-1)) < day) this.usage.delete(key);
  }
}
