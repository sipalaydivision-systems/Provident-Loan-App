/**
 * System settings (stored in the `settings` table) and DepEd moratoria.
 */
const DEFAULTS = {
  // Renewal: 'payments' = months paid ≥ term × threshold (Accounting's SUMMARY column Q: No. of Months × 30%)
  //          'principal' = principal paid ≥ threshold (wording of the 2026 PF application form)
  renewal_rule: 'payments',
  renewal_threshold: 0.3,
  interest_rate: 6,
  nthp_threshold: 5000, // GAA general provisions / DO 5 s.2018
  max_multi_purpose: 100000,
  max_additional: 200000,
  min_term: 12,
  max_term: 60,
  co_maker_max_loans: 3,
  co_maker_min_years: 1,
  retirement_age: 65,
  office_name: 'Schools Division Office of Sipalay City',
  section_name: 'Accounting Section',
  signatory_prepared_by: '',
  signatory_prepared_position: 'Accountant',
  signatory_approved_by: '',
  signatory_approved_position: 'Schools Division Superintendent',
};

const DEFAULT_MORATORIA = [
  {
    name: 'State of National Energy Emergency (EO No. 110, s. 2026)',
    start_month: '2026-07',
    end_month: '2026-09',
    date_occurred: '2026-03-24',
    reference: 'DepEd Memorandum dated June 24, 2026 – Implementation of Three (3)-Month Moratorium on Provident Fund Loans',
  },
];

let cache = null;
let cacheAt = 0;
let morCache = null;

const models = () => require('../database/db').models;

async function getSettings() {
  if (cache && Date.now() - cacheAt < 30000) return cache;
  const rows = await models().Setting.findAll();
  const out = { ...DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  cache = out;
  cacheAt = Date.now();
  return out;
}

async function updateSettings(patch) {
  const { Setting } = models();
  for (const [key, value] of Object.entries(patch || {})) {
    if (!(key in DEFAULTS)) continue;
    let v = value;
    if (typeof DEFAULTS[key] === 'number') v = Number(value);
    if (key === 'renewal_rule' && !['payments', 'principal'].includes(v)) continue;
    const existing = await Setting.findOne({ where: { key } });
    if (existing) await existing.update({ value: v });
    else await Setting.create({ key, value: v });
  }
  cache = null;
  return getSettings();
}

async function getMoratoria() {
  if (morCache) return morCache;
  const rows = await models().Moratorium.findAll({ order: [['start_month', 'ASC']] });
  morCache = rows.map((r) => r.toJSON());
  return morCache;
}

function clearMoratoriaCache() {
  morCache = null;
}

async function seedReferenceData() {
  const { Moratorium } = models();
  if ((await Moratorium.count()) === 0) {
    for (const m of DEFAULT_MORATORIA) await Moratorium.create(m);
  }
  morCache = null;
}

module.exports = { DEFAULTS, getSettings, updateSettings, getMoratoria, clearMoratoriaCache, seedReferenceData };
