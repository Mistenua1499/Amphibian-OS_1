// Seed: datos de ejemplo REALES del contexto de Amphibian Solutions
import { Entities, Timeline, Opps, Health } from "./db.js";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
const today = new Date().toISOString().slice(0, 10);

if (Entities.count() > 0) {
  console.log("Seed omitido: ya hay datos.");
} else {
  const mich = Entities.create({
    type: "PERSONA", name: "Mich", email: "mich@email.com", company: "Independiente / Influencer",
    trust: 85, tags: "influencer,cliente",
    narrative: "Quiere: ser influencer + marca personal. Valores: autenticidad, impacto. Le preocupa: algoritmos, contenido. Lenguaje: casual, emojis.",
  });
  const andres = Entities.create({
    type: "PERSONA", name: "Andrés", company: "Villa Verde", role: "Operaciones",
    trust: 75, tags: "cliente,villaverde",
    narrative: "Contacto operativo de Villa Verde. Decisión final la toma su padre; pagos con Anita. Pidió reportes semanales.",
  });
  const daniel = Entities.create({
    type: "PERSONA", name: "Daniel López", company: "Odontofamily", role: "Director",
    trust: 55, tags: "prospecto,dental",
    narrative: "Prospecto dental. Pitch construido alrededor de diagnóstico + CRM.",
  });
  Entities.create({ type: "EMPRESA", name: "Villa Verde", trust: 80, tags: "cliente,critico",
    narrative: "Cliente ancla: $16k MXN/mes. Google Ads + Meta + SEO + contenido + web + chatbots." });
  Entities.create({ type: "EMPRESA", name: "Odontofamily", trust: 55, tags: "prospecto", narrative: "Clínica dental, prospecto ~$5k." });
  Entities.create({ type: "EMPRESA", name: "DECA / Desarrollos Caballero", trust: 70, tags: "cliente" });

  Timeline.add(mich.id, "Primer contacto por Instagram", "CONVERSACION", daysAgo(300));
  Timeline.add(mich.id, "Primer proyecto cerrado", "VICTORIA", daysAgo(150));
  Timeline.add(mich.id, "Tomografía de identidad iniciada", "DECISION", daysAgo(20));
  Timeline.add(andres.id, "Auditoría Google Ads: Auto-Apply eliminó keywords. Plan de recuperación 48h.", "ERROR", daysAgo(10));
  Timeline.add(daniel.id, "Pitch enviado (diagnóstico + CRM)", "CONVERSACION", daysAgo(4));

  const noon = new Date(); noon.setHours(12, 0, 0, 0);
  const ten = new Date(); ten.setHours(10, 0, 0, 0);

  Opps.create({
    name: "Google Ads Villa Verde", stage: "GANADO", value: 16000, probability: 100,
    personId: andres.id, companyName: "Villa Verde",
    amountPending: 3200, dueDate: new Date(), lastContact: daysAgo(1),
    nextAction: "Llamar a Andrés (reporte semanal)", nextActionAt: noon,
    notes: "Contrato 12 meses, $16k MXN + IVA/mes.",
  });
  Opps.create({
    name: "Video patrocinado Mich", stage: "PROPUESTA", value: 2500, probability: 75,
    personId: mich.id, amountPending: 2500, dueDate: daysAgo(-1), lastContact: daysAgo(2),
    nextAction: "Brainstorm de temas con Mich",
    notes: "Samsung podría patrocinar. Deadline 30 días.",
  });
  Opps.create({
    name: "CRM Odontofamily", stage: "PROPUESTA", value: 5000, probability: 75,
    personId: daniel.id, companyName: "Odontofamily", lastContact: daysAgo(4),
    nextAction: "Enviar propuesta final", nextActionAt: ten,
  });
  Opps.create({
    name: "Web DECA", stage: "DIAGNOSTICADO", value: 8000, probability: 85,
    companyName: "DECA / Desarrollos Caballero", lastContact: daysAgo(7),
    nextAction: "Email de seguimiento",
  });
  Opps.create({
    name: "Airbnb Experiences PIALI", stage: "DIAGNOSTICADO", value: 6500, probability: 70,
    companyName: "PIALI", lastContact: daysAgo(3), nextAction: "Agendar sesión de brand",
  });
  Opps.create({ name: "Gym Power Station relanzamiento", stage: "LEAD", value: 6000, probability: 40, companyName: "Power Station", lastContact: daysAgo(9), nextAction: "" });
  Opps.create({ name: "Carlos Pérez fotografía", stage: "LEAD", value: 3000, probability: 40, companyName: "Independiente", lastContact: daysAgo(12), nextAction: "Reactivar conversación" });

  Health.upsert(today, { sleepHours: 6.3, stress: 78, restingHr: 72, steps: 4200,
    energy: 7, clarity: 8, motivation: 9, peace: 6, anxiety: 4 });

  console.log("✅ Seed completado con datos de Amphibian.");
}
