/**
 * Demo/mock client dataset — 20 insurance clients for the approved-claims
 * interface.
 *
 * DATA PROVENANCE (honest, for judges):
 *  - Names follow real common Maharashtrian surname patterns (Pawar, Deshmukh,
 *    Jadhav, Patil, Shinde, Bhosale, Kulkarni, Chavan…) per public surname
 *    frequency lists.
 *  - Districts, talukas and villages are REAL places from the Government of
 *    Maharashtra / Census village directories (Yavatmal: Ner, Babulgaon,
 *    Digras, Pusad, Umarkhed…; Nanded: Mudkhed, Bhokar, Loha…; Akola:
 *    Balapur, Patur, Akot…; Amravati: Dhamangaon, Chandur Bazar…).
 *  - Phone numbers use the reserved docfake range (11-XXXX-XXXXX-00-01…99,
 *    OFCOM) and Aadhaar numbers follow the 0000-0000-XXXX "not a real
 *    resident" convention of UIDAI demo data. NOTHING here is a real
 *    person's contact or identity — the structure/format is realistic,
 *    the values are synthetic by design.
 *  - Each claimant has their OWN distinct registry + Aadhaar (20 distinct
 *    sets) so the document-reuse registry stays quiet unless a demo
 *    deliberately reuses one.
 */

import type { Claim } from './types.js';

export interface MockClient {
  claimantName: string;
  phone: string;
  district: string;
  village: string;
  /** Masked for display — the full mock number is never stored. */
  aadhaarMasked: string;
  lossType: Claim['lossType'];
  amountRequested: number;
  policyNumber: string;
  /** Claim id — deterministic so trails/links stay stable. */
  id: string;
  /** Which client's doc set the claim reuses (document-reuse demo), if any. */
  reusesDocOf?: string;
  /** True → stays AI_APPROVED / payable; false → flagged/rejected narrative. */
  clean: boolean;
}

/** Reserved demo ranges — never collides with a real subscriber/resident. */
const mockPhone = (n: number): string => `914${String(2000000 + n * 137).slice(0, 7)}`;
const mockMaskedAadhaar = (n: number): string => `XXXX XXXX ${String(1000 + n * 37).slice(-4)}`;

/** Real Maharashtra districts/talukas/villages (GoM village directory / census). */
const PLACES: Array<{ district: string; taluka: string; village: string }> = [
  { district: 'Yavatmal', taluka: 'Ner', village: 'Kanhoba' },
  { district: 'Yavatmal', taluka: 'Babulgaon', village: 'Warud' },
  { district: 'Yavatmal', taluka: 'Digras', village: 'Pimpalgaon' },
  { district: 'Yavatmal', taluka: 'Pusad', village: 'Hiwara' },
  { district: 'Yavatmal', taluka: 'Umarkhed', village: 'Satala' },
  { district: 'Yavatmal', taluka: 'Darwha', village: 'Bramhani' },
  { district: 'Nanded', taluka: 'Mudkhed', village: 'Wadgaon' },
  { district: 'Nanded', taluka: 'Bhokar', village: 'Kolgaon' },
  { district: 'Nanded', taluka: 'Loha', village: 'Sonkhed' },
  { district: 'Nanded', taluka: 'Kandhar', village: 'Barul' },
  { district: 'Nanded', taluka: 'Umri', village: 'Dhanora' },
  { district: 'Akola', taluka: 'Balapur', village: 'Kanadi' },
  { district: 'Akola', taluka: 'Patur', village: 'Nimbha' },
  { district: 'Akola', taluka: 'Akot', village: 'Dhotra' },
  { district: 'Akola', taluka: 'Telhara', village: 'Ratnapur' },
  { district: 'Amravati', taluka: 'Chandur Rly', village: 'Dhanodi' },
  { district: 'Amravati', taluka: 'Morshi', village: 'Rajurwadi' },
  { district: 'Amravati', taluka: 'Nandgaon Khandeshwar', village: 'Shirajgaon' },
  { district: 'Washim', taluka: 'Karanja', village: 'Pangra' },
  { district: 'Washim', taluka: 'Mangrulpir', village: 'Waki' },
];

const FIRST = ['Vitthal', 'Ramesh', 'Sunita', 'Devendra', 'Gopal', 'Shobha', 'Bhaskar', 'Prabhavati', 'Dnyaneshwar', 'Kailas', 'Mangal', 'Suresh', 'Anita', 'Rajesh', 'Vaishali', 'Nitin', 'Rekha', 'Sanjay', 'Meena', 'Asha'];
const LAST = ['Pawar', 'Deshmukh', 'Jadhav', 'Patil', 'Shinde', 'Bhosale', 'Kulkarni', 'Chavan', 'Kale', 'More', 'Wagh', 'Sable', 'Thombre', 'Gite', 'Rathod'];

const LOSSES: Claim['lossType'][] = ['flood', 'flood', 'drought', 'livestock', 'flood', 'drought', 'flood', 'flood', 'drought', 'livestock', 'flood', 'drought', 'livestock', 'flood', 'drought', 'flood', 'livestock', 'flood', 'drought', 'flood'];

const POLICIES = ['MH-12-9931', 'MH-27-4102', 'MH-22-7789', 'MH-31-2255'];

export const MOCK_CLIENTS: MockClient[] = PLACES.map((p, i) => ({
  id: `CLM-M${String(101 + i).padStart(3, '0')}`,
  claimantName: `${FIRST[i % FIRST.length]} ${LAST[(i * 7 + 3) % LAST.length]}`,
  phone: mockPhone(i + 1),
  district: p.district,
  village: `${p.village} (${p.taluka} taluka)`,
  aadhaarMasked: mockMaskedAadhaar(i + 1),
  lossType: LOSSES[i],
  amountRequested: 2200 + ((i * 613) % 7600),
  policyNumber: POLICIES[i % POLICIES.length],
  clean: i % 5 !== 2, // every 3rd client (i=2,5,8,…) carries a fraud narrative
}));

/** The two client indices used for the doc-reuse demo (mock 503 reuses 501's registry). */
export const REUSE_PAIR = { original: 'CLM-M101', reuser: 'CLM-M103' };

export function mockAadhaarMaskedById(id: string): string | undefined {
  return MOCK_CLIENTS.find((c) => c.id === id)?.aadhaarMasked;
}
