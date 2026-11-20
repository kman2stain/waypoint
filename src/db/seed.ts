// The generic starter roadmap. Public repo: no names, no employer, no numbers about a real person.
import { openDB, request, transactionDone, emitChange } from './db';
import { SCHEMA_VERSION, type Meta, type Milestone, type Phase } from './schema';

type SeedItem = string | { gate: number; title: string };

const SEED: { title: string; from: number; to: number; items: SeedItem[] }[] = [
  {
    title: 'This month',
    from: 0,
    to: 1,
    items: [
      'Get the offer, title and terms from my employer in writing',
      'Collect written impact confirmations and monthly volumes',
      'Write a one-page case study of the best dashboard project',
      'Practise explaining two DAX measures',
      'Hand-over docs and a demo recording',
      'Start SQL in small doses',
    ],
  },
  {
    title: 'Months 1–6',
    from: 1,
    to: 6,
    items: [
      'SQL fundamentals',
      'First Power Automate Desktop bot (in parallel with SQL)',
      'PR app live, with usage numbers and a baseline',
      'Start PL-300',
      'Get WMS / Lobster exposure',
      'Protect ~5–6 study hours a week',
    ],
  },
  {
    title: 'Months 6–18',
    from: 6,
    to: 18,
    items: [
      'Rebuild an app on Dataverse in a free developer environment (test data only)',
      'Pass PL-300',
      'HTTP calls and custom connectors',
      'Own one automation end to end and keep a dated record of results',
      { gate: 12, title: 'Decision gate: is there a path to building work? If not, plan an earlier switch' },
    ],
  },
  {
    title: 'Months 18–30',
    from: 18,
    to: 30,
    items: [
      'Attest degree documents early',
      'Ask about an internal transfer',
      'Apply externally only with interviews booked',
      'Copilot Studio agent once licensing allows',
      'Azure after that',
      'Target roles: Power Platform / BI developer, WMS or systems analyst, automation analyst',
      { gate: 24, title: 'Decision gate: weak hiring in the target country? Consider alternatives or stay longer' },
    ],
  },
];

export function buildSeed(ts: string): { meta: Meta; phases: Phase[]; milestones: Milestone[] } {
  const phases: Phase[] = [];
  const milestones: Milestone[] = [];
  SEED.forEach((p, pi) => {
    const phaseId = `seed-p${pi + 1}`;
    phases.push({ id: phaseId, order: pi + 1, title: p.title, monthsFrom: p.from, monthsTo: p.to, createdAt: ts, updatedAt: ts });
    p.items.forEach((item, mi) => {
      const isGate = typeof item !== 'string';
      milestones.push({
        id: isGate ? `seed-gate-${item.gate}` : `seed-p${pi + 1}-m${mi + 1}`,
        phaseId,
        order: mi + 1,
        title: isGate ? item.title : item,
        kind: isGate ? 'gate' : 'task',
        ...(isGate ? { gateMonth: item.gate } : {}),
        status: 'not_started',
        notes: '',
        evidence: [],
        createdAt: ts,
        updatedAt: ts,
      });
    });
  });
  return { meta: { id: 'meta', schemaVersion: SCHEMA_VERSION, seededAt: ts }, phases, milestones };
}

/**
 * Writes the starter roadmap on first run only. The check and the writes share
 * one transaction, so it can never seed twice or overwrite existing data.
 * Returns true if it seeded.
 */
export async function ensureSeeded(now: Date = new Date()): Promise<boolean> {
  const db = await openDB();
  const tx = db.transaction(['meta', 'phases', 'milestones'], 'readwrite');
  const done = transactionDone(tx);
  const existing = await request(tx.objectStore('meta').get('meta'));
  let seeded = false;
  if (!existing) {
    const { meta, phases, milestones } = buildSeed(now.toISOString());
    tx.objectStore('meta').put(meta);
    for (const p of phases) tx.objectStore('phases').put(p);
    for (const m of milestones) tx.objectStore('milestones').put(m);
    seeded = true;
  }
  await done;
  if (seeded) emitChange(['meta', 'phases', 'milestones']);
  return seeded;
}
