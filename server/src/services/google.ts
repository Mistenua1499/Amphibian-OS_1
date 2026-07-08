// ============================================================
// GOOGLE SYNC - Sheets (pipeline + clientes), Calendar (acciones), Drive (bitacoras)
// Requiere GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (ver docs/GOOGLE_SETUP.md).
// Flujo: GET /api/google/auth -> consentimiento -> tokens guardados en settings.
// ============================================================
import { google } from "googleapis";
import { Entities, Opps, Settings, SyncLogs } from "../db.js";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.file",
];

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/api/google/callback"
  );
}

export function authUrl(): string {
  return oauthClient().generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES });
}

export async function handleCallback(code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  Settings.set("google_tokens", JSON.stringify(tokens));
}

export function googleConnected(): boolean {
  return !!Settings.get("google_tokens");
}

function authedClient() {
  const saved = Settings.get("google_tokens");
  if (!saved) throw new Error("Google no conectado. Visita /api/google/auth");
  const client = oauthClient();
  client.setCredentials(JSON.parse(saved));
  client.on("tokens", (tokens) => {
    try {
      const prev = JSON.parse(Settings.get("google_tokens") || "{}");
      Settings.set("google_tokens", JSON.stringify({ ...prev, ...tokens }));
    } catch {}
  });
  return client;
}

async function getOrCreateSheet(auth: any): Promise<string> {
  if (process.env.GOOGLE_SHEET_ID) return process.env.GOOGLE_SHEET_ID;
  const saved = Settings.get("google_sheet_id");
  if (saved) return saved;
  const sheets = google.sheets({ version: "v4", auth });
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "AMPHIBIAN OS - Sync" },
      sheets: [{ properties: { title: "Pipeline" } }, { properties: { title: "Clientes" } }, { properties: { title: "Bitacora" } }],
    },
  });
  const id = created.data.spreadsheetId!;
  Settings.set("google_sheet_id", id);
  return id;
}

// ---------- SHEETS: pipeline + clientes ----------
export async function syncToSheets() {
  const auth = authedClient();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetId = await getOrCreateSheet(auth);

  const opps = Opps.withPerson(Opps.list());
  const pipelineRows = [
    ["Nombre", "Etapa", "Valor", "Prob %", "Persona", "Proxima accion", "Por cobrar", "Ultimo contacto"],
    ...opps.map((o: any) => [
      o.name, o.stage, o.value, o.probability, o.person?.name ?? o.companyName ?? "",
      o.nextAction ?? "", o.amountPending, o.lastContact.toISOString().slice(0, 10),
    ]),
  ];

  const people = Entities.list({ type: "PERSONA" });
  const clientRows = [
    ["Nombre", "Email", "Telefono", "Empresa", "Confianza", "Notas"],
    ...people.map((p: any) => [p.name, p.email ?? "", p.phone ?? "", p.company ?? "", p.trust, p.narrative ?? ""]),
  ];

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId, range: "Pipeline!A1", valueInputOption: "RAW",
      requestBody: { values: pipelineRows },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId, range: "Clientes!A1", valueInputOption: "RAW",
      requestBody: { values: clientRows },
    });
    Opps.markAllSynced();
    Entities.markAllSynced("PERSONA");
    SyncLogs.add("GOOGLE_SHEETS", "EXITOSO");
  } catch (e: any) {
    SyncLogs.add("GOOGLE_SHEETS", "ERROR", null, String(e.message));
    throw e;
  }
}

// ---------- CALENDAR: proximas acciones con fecha ----------
export async function syncActionsToCalendar() {
  const auth = authedClient();
  const calendar = google.calendar({ version: "v3", auth });
  const opps = Opps.list({ stageNotIn: ["GANADO", "PERDIDO"] }).filter((o: any) => o.nextActionAt && o.nextAction);
  for (const o of opps) {
    const marker = `amphibian-${o.id}`;
    try {
      const existing = await calendar.events.list({
        calendarId: "primary", privateExtendedProperty: [`amphibianId=${marker}`], maxResults: 1,
      });
      const event = {
        summary: `[Amphibian] ${o.nextAction} — ${o.name}`,
        start: { dateTime: o.nextActionAt.toISOString() },
        end: { dateTime: new Date(o.nextActionAt.getTime() + 30 * 60000).toISOString() },
        extendedProperties: { private: { amphibianId: marker } },
      };
      if (existing.data.items?.length) {
        await calendar.events.update({ calendarId: "primary", eventId: existing.data.items[0].id!, requestBody: event });
      } else {
        await calendar.events.insert({ calendarId: "primary", requestBody: event });
      }
    } catch (e: any) {
      SyncLogs.add("GOOGLE_CALENDAR", "ERROR", o.id, String(e.message));
    }
  }
  SyncLogs.add("GOOGLE_CALENDAR", "EXITOSO");
}

// ---------- CALENDAR: leer eventos de hoy para el dashboard ----------
export async function todayEvents(): Promise<{ summary: string; start: string }[]> {
  if (!googleConnected()) return [];
  try {
    const auth = authedClient();
    const calendar = google.calendar({ version: "v3", auth });
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const res = await calendar.events.list({
      calendarId: "primary", timeMin: start.toISOString(), timeMax: end.toISOString(),
      singleEvents: true, orderBy: "startTime", maxResults: 10,
    });
    return (res.data.items ?? []).map((e) => ({
      summary: e.summary ?? "(sin titulo)",
      start: e.start?.dateTime ?? e.start?.date ?? "",
    }));
  } catch { return []; }
}

// ---------- DRIVE: subir bitacora como markdown ----------
export async function uploadJournalToDrive(date: string, markdown: string) {
  const auth = authedClient();
  const drive = google.drive({ version: "v3", auth });
  try {
    let folderId = Settings.get("drive_folder_id");
    if (!folderId) {
      const folder = await drive.files.create({
        requestBody: { name: "Amphibian Bitacoras", mimeType: "application/vnd.google-apps.folder" },
        fields: "id",
      });
      folderId = folder.data.id!;
      Settings.set("drive_folder_id", folderId);
    }
    await drive.files.create({
      requestBody: { name: `Bitacora-${date}.md`, parents: [folderId] },
      media: { mimeType: "text/markdown", body: markdown },
    });
    SyncLogs.add("GOOGLE_DRIVE", "EXITOSO", date);
  } catch (e: any) {
    SyncLogs.add("GOOGLE_DRIVE", "ERROR", date, String(e.message));
  }
}

export async function runFullGoogleSync() {
  if (!googleConnected()) return { skipped: true };
  await syncToSheets();
  await syncActionsToCalendar();
  return { skipped: false };
}
