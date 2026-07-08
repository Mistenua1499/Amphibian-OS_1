// ============================================================
// CAPA DE DATOS - SQLite nativo de Node 22+ (node:sqlite)
// CERO dependencias externas. La DB vive en server/amphibian.db.
// Para migrar a Postgres despues: ver docs/MIGRAR_POSTGRES.md
// ============================================================
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = (process.env.DATABASE_URL || "file:./amphibian.db").replace(/^file:/, "");
const dbPath = path.isAbsolute(dbFile) ? dbFile : path.join(__dirname, "..", dbFile);

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// ---------- Schema ----------
db.exec(`
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT, phone TEXT, company TEXT, role TEXT,
  trust INTEGER DEFAULT 50,
  narrative TEXT,
  tags TEXT DEFAULT '',
  data TEXT DEFAULT '{}',
  googleId TEXT, obsidianPath TEXT,
  syncStatus TEXT DEFAULT 'PENDIENTE',
  lastSync TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  fromId TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  toId TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS timeline (
  id TEXT PRIMARY KEY,
  entityId TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  type TEXT DEFAULT 'CONVERSACION',
  timestamp TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  personId TEXT REFERENCES entities(id) ON DELETE SET NULL,
  companyName TEXT,
  stage TEXT DEFAULT 'LEAD',
  value REAL DEFAULT 0,
  probability INTEGER DEFAULT 50,
  expectedClose TEXT,
  nextAction TEXT,
  nextActionAt TEXT,
  notes TEXT,
  amountPending REAL DEFAULT 0,
  dueDate TEXT,
  lastContact TEXT NOT NULL,
  googleId TEXT,
  syncStatus TEXT DEFAULT 'PENDIENTE',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,
  channel TEXT DEFAULT 'APP',
  kind TEXT DEFAULT 'TEXTO',
  raw TEXT NOT NULL,
  summary TEXT, entities TEXT, hypothesis TEXT, suggestedAction TEXT, aiCost TEXT,
  processed INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journal (
  id TEXT PRIMARY KEY,
  date TEXT UNIQUE NOT NULL,
  whatHappened TEXT, learned TEXT, hypothesis TEXT,
  hypothesisConfidence INTEGER DEFAULT 50,
  decision TEXT, promises TEXT, mistakes TEXT, wins TEXT,
  nextAction TEXT, gratitude TEXT, aiSummary TEXT,
  exportedToObsidian INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS health (
  id TEXT PRIMARY KEY,
  date TEXT UNIQUE NOT NULL,
  sleepHours REAL, stress INTEGER, restingHr INTEGER, steps INTEGER,
  energy INTEGER, clarity INTEGER, motivation INTEGER, peace INTEGER, anxiety INTEGER,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS finances (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  amountIn REAL DEFAULT 0, amountOut REAL DEFAULT 0,
  category TEXT, opportunityId TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  rule TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'NORMAL',
  refId TEXT,
  done INTEGER DEFAULT 0,
  sentTelegram INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  refId TEXT,
  status TEXT NOT NULL,
  error TEXT,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

// ---------- Utilidades ----------
export const uuid = () => randomUUID();
export const now = () => new Date().toISOString();
const toDate = (v: any) => (v ? new Date(v) : null);
const toBool = (v: any) => !!v;

type Row = Record<string, any>;

function mapEntity(r: Row | undefined) {
  if (!r) return null;
  return { ...r, lastSync: toDate(r.lastSync), createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt) };
}
function mapOpp(r: Row | undefined) {
  if (!r) return null;
  return {
    ...r,
    expectedClose: toDate(r.expectedClose), nextActionAt: toDate(r.nextActionAt),
    dueDate: toDate(r.dueDate), lastContact: toDate(r.lastContact)!,
    createdAt: toDate(r.createdAt)!, updatedAt: toDate(r.updatedAt)!,
  };
}
function mapCapture(r: Row | undefined) {
  if (!r) return null;
  return { ...r, processed: toBool(r.processed), createdAt: toDate(r.createdAt) };
}
function mapReminder(r: Row | undefined) {
  if (!r) return null;
  return { ...r, done: toBool(r.done), sentTelegram: toBool(r.sentTelegram), createdAt: toDate(r.createdAt)! };
}
function mapJournal(r: Row | undefined) {
  if (!r) return null;
  return { ...r, exportedToObsidian: toBool(r.exportedToObsidian), createdAt: toDate(r.createdAt), updatedAt: toDate(r.updatedAt) };
}
const isoOrNull = (v: any) => {
  if (v === null || v === undefined || v === "") return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
};

// ============ ENTITIES ============
export const Entities = {
  list(opts: { type?: string; q?: string } = {}) {
    let sql = "SELECT * FROM entities WHERE 1=1";
    const params: any[] = [];
    if (opts.type) { sql += " AND type = ?"; params.push(opts.type); }
    if (opts.q) { sql += " AND name LIKE ?"; params.push(`%${opts.q}%`); }
    sql += " ORDER BY updatedAt DESC";
    return db.prepare(sql).all(...params).map(mapEntity);
  },
  get(id: string) { return mapEntity(db.prepare("SELECT * FROM entities WHERE id = ?").get(id) as Row); },
  findByName(type: string, name: string) {
    return mapEntity(db.prepare("SELECT * FROM entities WHERE type = ? AND name = ? COLLATE NOCASE").get(type, name) as Row);
  },
  create(d: Row) {
    const id = uuid(); const t = now();
    db.prepare(`INSERT INTO entities (id,type,name,email,phone,company,role,trust,narrative,tags,data,syncStatus,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, d.type ?? "PERSONA", d.name, d.email ?? null, d.phone ?? null, d.company ?? null, d.role ?? null,
        d.trust ?? 50, d.narrative ?? null, d.tags ?? "", d.data ?? "{}", d.syncStatus ?? "PENDIENTE", t, t);
    return this.get(id)!;
  },
  update(id: string, d: Row) {
    const fields = ["name", "email", "phone", "company", "role", "trust", "narrative", "tags", "data", "googleId", "obsidianPath", "syncStatus"];
    const sets: string[] = []; const params: any[] = [];
    for (const f of fields) if (f in d && d[f] !== undefined) { sets.push(`${f} = ?`); params.push(d[f]); }
    if ("lastSync" in d) { sets.push("lastSync = ?"); params.push(isoOrNull(d.lastSync)); }
    sets.push("updatedAt = ?"); params.push(now()); params.push(id);
    db.prepare(`UPDATE entities SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    return this.get(id)!;
  },
  markAllSynced(type?: string) {
    if (type) db.prepare("UPDATE entities SET syncStatus='SINCRONIZADO', lastSync=? WHERE type=?").run(now(), type);
    else db.prepare("UPDATE entities SET syncStatus='SINCRONIZADO', lastSync=?").run(now());
  },
  countPending() { return (db.prepare("SELECT COUNT(*) c FROM entities WHERE syncStatus='PENDIENTE'").get() as Row).c as number; },
  remove(id: string) { db.prepare("DELETE FROM entities WHERE id = ?").run(id); },
  count() { return (db.prepare("SELECT COUNT(*) c FROM entities").get() as Row).c as number; },
};

// ============ TIMELINE ============
export const Timeline = {
  add(entityId: string, event: string, type = "CONVERSACION", timestamp?: Date) {
    const id = uuid();
    db.prepare("INSERT INTO timeline (id,entityId,event,type,timestamp) VALUES (?,?,?,?,?)")
      .run(id, entityId, event, type, (timestamp ?? new Date()).toISOString());
    return db.prepare("SELECT * FROM timeline WHERE id = ?").get(id);
  },
  list(entityId: string, limit = 100, order: "asc" | "desc" = "desc") {
    return db.prepare(`SELECT * FROM timeline WHERE entityId = ? ORDER BY timestamp ${order === "asc" ? "ASC" : "DESC"} LIMIT ?`)
      .all(entityId, limit).map((r: Row) => ({ ...r, timestamp: toDate(r.timestamp)! }));
  },
};

// ============ OPPORTUNITIES ============
export const Opps = {
  list(opts: { stageNotIn?: string[]; pendingMoney?: boolean } = {}) {
    let sql = "SELECT * FROM opportunities WHERE 1=1";
    const params: any[] = [];
    if (opts.stageNotIn?.length) {
      sql += ` AND stage NOT IN (${opts.stageNotIn.map(() => "?").join(",")})`;
      params.push(...opts.stageNotIn);
    }
    if (opts.pendingMoney) sql += " AND amountPending > 0";
    sql += " ORDER BY updatedAt DESC";
    return db.prepare(sql).all(...params).map(mapOpp) as any[];
  },
  withPerson(opps: any[]) {
    return opps.map((o) => ({ ...o, person: o.personId ? Entities.get(o.personId) : null }));
  },
  get(id: string) { return mapOpp(db.prepare("SELECT * FROM opportunities WHERE id = ?").get(id) as Row); },
  findByName(name: string) { return mapOpp(db.prepare("SELECT * FROM opportunities WHERE name = ? COLLATE NOCASE").get(name) as Row); },
  create(d: Row) {
    const id = uuid(); const t = now();
    db.prepare(`INSERT INTO opportunities
      (id,name,description,personId,companyName,stage,value,probability,expectedClose,nextAction,nextActionAt,notes,amountPending,dueDate,lastContact,syncStatus,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, d.name, d.description ?? null, d.personId ?? null, d.companyName ?? null,
        d.stage ?? "LEAD", d.value ?? 0, d.probability ?? 50,
        isoOrNull(d.expectedClose), d.nextAction ?? null, isoOrNull(d.nextActionAt),
        d.notes ?? null, d.amountPending ?? 0, isoOrNull(d.dueDate),
        isoOrNull(d.lastContact) ?? t, d.syncStatus ?? "PENDIENTE", t, t);
    return this.get(id)!;
  },
  update(id: string, d: Row) {
    const strFields = ["name", "description", "personId", "companyName", "stage", "nextAction", "notes", "googleId", "syncStatus"];
    const numFields = ["value", "probability", "amountPending"];
    const dateFields = ["expectedClose", "nextActionAt", "dueDate", "lastContact"];
    const sets: string[] = []; const params: any[] = [];
    for (const f of strFields) if (f in d && d[f] !== undefined) { sets.push(`${f} = ?`); params.push(d[f]); }
    for (const f of numFields) if (f in d && d[f] !== undefined) { sets.push(`${f} = ?`); params.push(Number(d[f])); }
    for (const f of dateFields) if (f in d && d[f] !== undefined) { sets.push(`${f} = ?`); params.push(isoOrNull(d[f])); }
    sets.push("updatedAt = ?"); params.push(now()); params.push(id);
    db.prepare(`UPDATE opportunities SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    return this.get(id)!;
  },
  markAllSynced() { db.prepare("UPDATE opportunities SET syncStatus='SINCRONIZADO'").run(); },
  countPending() { return (db.prepare("SELECT COUNT(*) c FROM opportunities WHERE syncStatus='PENDIENTE'").get() as Row).c as number; },
  totalPendingMoney() { return ((db.prepare("SELECT COALESCE(SUM(amountPending),0) s FROM opportunities WHERE amountPending > 0").get() as Row).s ?? 0) as number; },
  remove(id: string) { db.prepare("DELETE FROM opportunities WHERE id = ?").run(id); },
  byPerson(personId: string) {
    return db.prepare("SELECT * FROM opportunities WHERE personId = ? ORDER BY updatedAt DESC").all(personId).map(mapOpp);
  },
};

// ============ CAPTURES ============
export const Captures = {
  list(limit = 50) { return db.prepare("SELECT * FROM captures ORDER BY createdAt DESC LIMIT ?").all(limit).map(mapCapture); },
  get(id: string) { return mapCapture(db.prepare("SELECT * FROM captures WHERE id = ?").get(id) as Row); },
  create(d: Row) {
    const id = uuid();
    db.prepare("INSERT INTO captures (id,channel,kind,raw,createdAt) VALUES (?,?,?,?,?)")
      .run(id, d.channel ?? "APP", d.kind ?? "TEXTO", d.raw, now());
    return this.get(id)!;
  },
  update(id: string, d: Row) {
    const fields = ["summary", "entities", "hypothesis", "suggestedAction", "aiCost"];
    const sets: string[] = []; const params: any[] = [];
    for (const f of fields) if (f in d) { sets.push(`${f} = ?`); params.push(d[f]); }
    if ("processed" in d) { sets.push("processed = ?"); params.push(d.processed ? 1 : 0); }
    if (!sets.length) return this.get(id)!;
    params.push(id);
    db.prepare(`UPDATE captures SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    return this.get(id)!;
  },
};

// ============ JOURNAL ============
export const Journal = {
  list(limit = 30) { return db.prepare("SELECT * FROM journal ORDER BY date DESC LIMIT ?").all(limit).map(mapJournal); },
  get(date: string) { return mapJournal(db.prepare("SELECT * FROM journal WHERE date = ?").get(date) as Row); },
  upsert(date: string, d: Row) {
    const existing = this.get(date);
    const fields = ["whatHappened", "learned", "hypothesis", "hypothesisConfidence", "decision", "promises", "mistakes", "wins", "nextAction", "gratitude", "aiSummary"];
    if (existing) {
      const sets: string[] = []; const params: any[] = [];
      for (const f of fields) if (f in d && d[f] !== undefined) { sets.push(`${f} = ?`); params.push(d[f]); }
      if ("exportedToObsidian" in d) { sets.push("exportedToObsidian = ?"); params.push(d.exportedToObsidian ? 1 : 0); }
      if (sets.length) {
        sets.push("updatedAt = ?"); params.push(now()); params.push(date);
        db.prepare(`UPDATE journal SET ${sets.join(", ")} WHERE date = ?`).run(...params);
      }
      return this.get(date)!;
    }
    const id = uuid(); const t = now();
    db.prepare(`INSERT INTO journal (id,date,whatHappened,learned,hypothesis,hypothesisConfidence,decision,promises,mistakes,wins,nextAction,gratitude,aiSummary,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, date, d.whatHappened ?? null, d.learned ?? null, d.hypothesis ?? null,
        d.hypothesisConfidence ?? 50, d.decision ?? null, d.promises ?? null, d.mistakes ?? null,
        d.wins ?? null, d.nextAction ?? null, d.gratitude ?? null, d.aiSummary ?? null, t, t);
    return this.get(date)!;
  },
};

// ============ HEALTH ============
export const Health = {
  get(date: string) { return db.prepare("SELECT * FROM health WHERE date = ?").get(date) ?? null; },
  upsert(date: string, d: Row) {
    const fields = ["sleepHours", "stress", "restingHr", "steps", "energy", "clarity", "motivation", "peace", "anxiety"];
    const existing = this.get(date);
    if (existing) {
      const sets: string[] = []; const params: any[] = [];
      for (const f of fields) if (f in d && d[f] !== undefined) { sets.push(`${f} = ?`); params.push(d[f] === "" ? null : d[f]); }
      if (sets.length) { params.push(date); db.prepare(`UPDATE health SET ${sets.join(", ")} WHERE date = ?`).run(...params); }
      return this.get(date);
    }
    db.prepare(`INSERT INTO health (id,date,sleepHours,stress,restingHr,steps,energy,clarity,motivation,peace,anxiety,createdAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(uuid(), date, d.sleepHours ?? null, d.stress ?? null, d.restingHr ?? null, d.steps ?? null,
        d.energy ?? null, d.clarity ?? null, d.motivation ?? null, d.peace ?? null, d.anxiety ?? null, now());
    return this.get(date);
  },
};

// ============ FINANCES ============
export const Finances = {
  list(limit = 100) { return db.prepare("SELECT * FROM finances ORDER BY date DESC LIMIT ?").all(limit); },
  create(d: Row) {
    const id = uuid();
    db.prepare("INSERT INTO finances (id,date,amountIn,amountOut,category,opportunityId,notes) VALUES (?,?,?,?,?,?,?)")
      .run(id, now(), d.amountIn ?? 0, d.amountOut ?? 0, d.category ?? null, d.opportunityId ?? null, d.notes ?? null);
    return db.prepare("SELECT * FROM finances WHERE id = ?").get(id);
  },
};

// ============ REMINDERS ============
export const Reminders = {
  list(onlyPending = true, limit = 100) {
    const sql = onlyPending
      ? "SELECT * FROM reminders WHERE done = 0 ORDER BY CASE severity WHEN 'CRITICO' THEN 0 ELSE 1 END, createdAt DESC LIMIT ?"
      : "SELECT * FROM reminders ORDER BY createdAt DESC LIMIT ?";
    return db.prepare(sql).all(limit).map(mapReminder) as any[];
  },
  existsToday(rule: string, refId: string | null) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const r = refId
      ? db.prepare("SELECT id FROM reminders WHERE rule=? AND refId=? AND createdAt >= ?").get(rule, refId, today.toISOString())
      : db.prepare("SELECT id FROM reminders WHERE rule=? AND refId IS NULL AND createdAt >= ?").get(rule, today.toISOString());
    return !!r;
  },
  create(d: Row) {
    const id = uuid();
    db.prepare("INSERT INTO reminders (id,rule,message,severity,refId,createdAt) VALUES (?,?,?,?,?,?)")
      .run(id, d.rule, d.message, d.severity ?? "NORMAL", d.refId ?? null, now());
    return mapReminder(db.prepare("SELECT * FROM reminders WHERE id = ?").get(id) as Row)!;
  },
  markDone(id: string) {
    db.prepare("UPDATE reminders SET done = 1 WHERE id = ?").run(id);
    return mapReminder(db.prepare("SELECT * FROM reminders WHERE id = ?").get(id) as Row);
  },
  markSent(ids: string[]) {
    for (const id of ids) db.prepare("UPDATE reminders SET sentTelegram = 1 WHERE id = ?").run(id);
  },
};

// ============ SYNC LOG ============
export const SyncLogs = {
  add(target: string, status: string, refId?: string | null, error?: string | null) {
    db.prepare("INSERT INTO sync_log (id,target,refId,status,error,createdAt) VALUES (?,?,?,?,?,?)")
      .run(uuid(), target, refId ?? null, status, error ?? null, now());
  },
  list(limit = 20) {
    return db.prepare("SELECT * FROM sync_log ORDER BY createdAt DESC LIMIT ?").all(limit)
      .map((r: Row) => ({ ...r, createdAt: toDate(r.createdAt) }));
  },
  lastSuccess() {
    const r = db.prepare("SELECT * FROM sync_log WHERE status='EXITOSO' ORDER BY createdAt DESC LIMIT 1").get() as Row;
    return r ? { ...r, createdAt: toDate(r.createdAt) } : null;
  },
};

// ============ SETTINGS ============
export const Settings = {
  get(key: string): string | null {
    const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as Row;
    return r ? r.value : null;
  },
  set(key: string, value: string) {
    db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
  },
};
