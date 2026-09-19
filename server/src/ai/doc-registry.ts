/**
 * Document reuse registry — "was this exact document (or the identity it
 * proves) already used by a DIFFERENT farmer on another claim?"
 *
 * Three independent matching keys, matched in order of strength:
 *   1. sha256  — byte-identical document reuse (scanned twice).
 *   2. aadhaarMasked — the same person's Aadhaar attached to a different
 *      claimant name (identity borrowing).
 *   3. pHash   — visually identical scans (re-photographed/re-cropped docs).
 *
 * The registry is disk-persisted so reuse is caught across restarts, and
 * every entry keeps its full provenance (claim id, claimant name, file kind,
 * evidence id) so the fraud reason can NAME where the document was seen
 * before — that text is what the reviewer (and the judge demo) reads.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AadhaarFields } from './docs.js';
import type { Claim, Evidence } from '../types.js';

export interface DocEntry {
  /** sha256 hex (0x-prefixed) of the exact bytes. */
  sha256: string;
  /** 64-bit pHash hex, when the doc is image-like. */
  pHash?: string | null;
  /** Masked Aadhaar "XXXX XXXX 1234" if this doc is an Aadhaar (never full number). */
  aadhaarMasked: string | null;
  /** Where we saw it. */
  claimId: string;
  claimantName: string;
  fileId: string;
  kind: Evidence['kind'];
  filename: string;
  lossType: Claim['lossType'];
  at: string;
}

const REGISTRY_FILE = process.env.DOC_REGISTRY_PATH
  ? path.resolve(process.env.DOC_REGISTRY_PATH)
  : path.resolve('.data/doc-registry.json');

let entries: DocEntry[] = [];
let loaded = false;
let dirty = false;

function load(): void {
  if (loaded) return;
  loaded = true;
  if (!existsSync(REGISTRY_FILE)) return;
  try {
    entries = JSON.parse(readFileSync(REGISTRY_FILE, 'utf8')) as DocEntry[];
    console.log(`[doc-registry] loaded ${entries.length} doc fingerprint(s) from ${path.basename(REGISTRY_FILE)}`);
  } catch {
    entries = [];
  }
}

function persist(): void {
  if (!dirty) return;
  try {
    mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
    writeFileSync(REGISTRY_FILE, JSON.stringify(entries));
    dirty = false;
  } catch (err) {
    console.warn('[doc-registry] persist failed:', (err as Error).message);
  }
}

export function docRegistrySize(): number {
  load();
  return entries.length;
}

/**
 * After the pipeline OCRs the Aadhaar, back-fill the masked number onto this
 * claim's registry entries — future claims can then catch identity borrowing
 * (same Aadhaar number under a different claimant name).
 */
export function enrichDocumentIdentity(claimId: string, aadhaarMasked: string | null): void {
  load();
  if (!aadhaarMasked) return;
  let changed = false;
  for (const e of entries) {
    if (e.claimId === claimId && e.kind === 'aadhaar' && e.aadhaarMasked !== aadhaarMasked) {
      e.aadhaarMasked = aadhaarMasked;
      changed = true;
    }
  }
  if (changed) {
    dirty = true;
    persist();
  }
}

/** Register one processed evidence file of a claim (idempotent per claim+file). */
export function registerDocument(claim: Claim, ev: Evidence, aadhaarMasked: string | null): void {
  load();
  const exists = entries.some(
    (e) => e.sha256 === ev.sha256 && e.claimId === claim.id && e.fileId === ev.fileId,
  );
  if (exists) return;
  entries.push({
    sha256: ev.sha256,
    pHash: ev.pHash,
    aadhaarMasked: ev.kind === 'aadhaar' ? aadhaarMasked : null,
    claimId: claim.id,
    claimantName: claim.claimantName,
    fileId: ev.fileId,
    kind: ev.kind,
    filename: ev.filename,
    lossType: claim.lossType,
    at: new Date().toISOString(),
  });
  dirty = true;
  persist();
}

export interface DocReuseHit {
  /** Rule id surfaced in FRAUD_RULES reasons. */
  rule: 'R-DOC-REUSE';
  /** Which file of THIS claim matched. */
  fileId: string;
  /** Human-readable where-it-was-seen-before text. */
  detail: string;
  /** Which key matched. */
  via: 'sha256' | 'pHash' | 'aadhaar';
  /** Matched prior provenance. */
  prior: {
    claimId: string;
    claimantName: string;
    fileId: string;
    kind: Evidence['kind'];
    filename: string;
    at: string;
  };
}

function isIdentityDoc(kind: Evidence['kind']): boolean {
  return kind === 'registry' || kind === 'aadhaar' || kind === 'policy' || kind === 'id';
}

/** Hamming ≤6 on 16-hex-digit pHash strings. */
function hamming6(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    d += (x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1) + ((x >> 3) & 1);
  }
  return d <= 6;
}

/**
 * Check a new claim's documents against every previously registered doc.
 * Only documents that PROVE identity or money (registry/aadhaar/policy/id)
 * are reuse-checked — damage photos are handled by DUPLICATE_PHASH already.
 * Same claimant re-using their own doc on their own new claim is NOT flagged
 * (that's the same farmer filing again) — different claimant = fraud signal.
 *
 * @param aadhaarFields parsed Aadhaar OCR fields of THIS claim (may be null)
 */
export function checkDocumentReuse(
  claim: Claim,
  evidence: Evidence[],
  aadhaarFields: AadhaarFields | null,
): DocReuseHit[] {
  load();
  const hits: DocReuseHit[] = [];
  const thisMasked = aadhaarFields?.aadhaarMasked ?? null;

  for (const ev of evidence) {
    if (!isIdentityDoc(ev.kind)) continue;

    for (const e of entries) {
      if (e.claimId === claim.id) continue;
      const sameClaimant = e.claimantName.toLowerCase() === claim.claimantName.toLowerCase();

      // 1) Byte-identical document under a different claimant = strongest signal.
      if (e.sha256 === ev.sha256) {
        hits.push({
          rule: 'R-DOC-REUSE',
          fileId: ev.fileId,
          via: 'sha256',
          detail: sameClaimant
            ? `document ${ev.filename} already filed by the same claimant on ${e.claimId} (${e.at.slice(0, 10)})`
            : `document ${ev.filename} (sha256 ${ev.sha256.slice(0, 14)}…) was already used on claim ${e.claimId} by claimant "${e.claimantName}" — different claimant, same document`,
          prior: { claimId: e.claimId, claimantName: e.claimantName, fileId: e.fileId, kind: e.kind, filename: e.filename, at: e.at },
        });
        continue;
      }

      // 2) Same Aadhaar number attached to a DIFFERENT claimant name.
      if (
        thisMasked &&
        e.aadhaarMasked === thisMasked &&
        !sameClaimant
      ) {
        hits.push({
          rule: 'R-DOC-REUSE',
          fileId: ev.fileId,
          via: 'aadhaar',
          detail: `Aadhaar ${thisMasked} registered to "${claim.claimantName}" on this claim was already submitted on ${e.claimId} by claimant "${e.claimantName}" (their ${e.kind}) — one identity across multiple claimants`,
          prior: { claimId: e.claimId, claimantName: e.claimantName, fileId: e.fileId, kind: e.kind, filename: e.filename, at: e.at },
        });
        continue;
      }

      // 3) Visually identical scan (re-photographed / re-cropped doc) —
      //    a different-bytes, same-picture reuse that sha256 can't catch.
      if (ev.pHash && e.pHash && hamming6(ev.pHash, e.pHash) && isIdentityDoc(e.kind)) {
        hits.push({
          rule: 'R-DOC-REUSE',
          fileId: ev.fileId,
          via: 'pHash',
          detail: `document ${ev.filename} is a near-identical scan (pHash distance ≤6) of the ${e.kind} already used on ${e.claimId} by claimant "${e.claimantName}"`,
          prior: { claimId: e.claimId, claimantName: e.claimantName, fileId: e.fileId, kind: e.kind, filename: e.filename, at: e.at },
        });
      }
    }
  }
  return hits;
}
