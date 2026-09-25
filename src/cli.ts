// Usage: node src/cli.ts <input.json> [--json]
//    or: node src/cli.ts --category gaming --platform instagram --budget 500000 --tier micro [--creators 60] [--cpm 80] [--exclude C007] [--json]
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { SHRINKAGE_PSEUDO_COUNT } from './config.ts';
import { loadHistory } from './fit.ts';
import { recommend } from './recommend.ts';
import { CATEGORIES, PLATFORMS, TIERS } from './types.ts';
import type { CampaignInput } from './types.ts';

const { values: v, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    category: { type: 'string' },
    platform: { type: 'string' },
    budget: { type: 'string' },
    tier: { type: 'string' },
    creators: { type: 'string' },
    cpm: { type: 'string' },
    exclude: { type: 'string' },
    json: { type: 'boolean', default: false },
  },
});

const num = (s?: string) => (s === undefined ? undefined : Number(s));
const input: CampaignInput = positionals[0]
  ? JSON.parse(readFileSync(positionals[0], 'utf8'))
  : {
      category: v.category,
      platform: v.platform,
      total_budget: num(v.budget),
      target_creator_tier: v.tier,
      expected_creators: num(v.creators),
      cpm_override: num(v.cpm),
      exclude_campaign_id: v.exclude,
    } as CampaignInput;
if (positionals[0] && v.exclude) input.exclude_campaign_id = v.exclude;

const problems = [
  !CATEGORIES.includes(input.category) && `category must be one of ${CATEGORIES.join(', ')}`,
  !PLATFORMS.includes(input.platform) && `platform must be one of ${PLATFORMS.join(', ')}`,
  !TIERS.includes(input.target_creator_tier) && `tier must be one of ${TIERS.join(', ')}`,
  !(input.total_budget > 0) && 'budget must be a positive number',
  input.expected_creators !== undefined && !(Number.isInteger(input.expected_creators) && input.expected_creators > 0) && 'creators must be a positive integer',
  input.cpm_override !== undefined && !(input.cpm_override > 0) && 'cpm must be a positive number',
].filter(Boolean);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const rec = recommend(input, loadHistory());
const rs = (x: number) => 'Rs ' + Math.round(x).toLocaleString('en-IN');

console.log(`\n${input.category} / ${input.platform} / ${rec.tier}, budget ${rs(input.total_budget)}` + (input.exclude_campaign_id ? `, fit excludes ${input.exclude_campaign_id}` : ''));
console.log('\nrank  pctl  reach  threshold (7d views)  cumulative payout  Rs per 1K');
for (const r of rec.rungs) {
  const reach = `${Math.round((1 - r.percentile) * 100)}%`;
  const per1k = ((r.payout_amount / r.view_threshold) * 1000).toFixed(2);
  console.log(`${String(r.rank).padEnd(6)}p${String(r.percentile * 100).padEnd(5)}${reach.padEnd(7)}${r.view_threshold.toLocaleString('en-IN').padStart(20)}  ${rs(r.payout_amount).padStart(17)}  ${per1k.padStart(9)}`);
}

const pct = (x: number) => `${((x / input.total_budget) * 100).toFixed(0)}% of budget`;
console.log(`\ncreators         ${rec.expected_creators}${input.expected_creators ? '' : ' (median of similar campaigns)'}`);
console.log(`spend p50        ${rs(rec.spend_p50)} (${pct(rec.spend_p50)})`);
console.log(`spend p90        ${rs(rec.spend_p90)} (${pct(rec.spend_p90)})`);
console.log(`spend mean       ${rs(rec.spend_mean)} (${pct(rec.spend_mean)})`);
console.log(`rate used        Rs ${rec.rate_per_1k.toFixed(2)} per 1K views${rec.capped ? ' (capped)' : ''}`);
console.log(`cap              Rs ${rec.creator_rate_cap.toFixed(2)} per 1K (paid-media CPM Rs ${rec.cpm_anchor} x share)`);
console.log(`headroom         ${rs(rec.headroom)}${rec.capped ? ' unspent at p90: add creators or extend the campaign' : ''}`);
console.log(`fraud share      ${(rec.fraud_share * 100).toFixed(1)}% of posts drawn from the flagged distribution`);

console.log(`\nshrinkage (weight = n / (n + ${SHRINKAGE_PSEUDO_COUNT}) at each level, global is the base)`);
for (const l of rec.fit) {
  const w = l.level.endsWith(': global') ? 'base' : `${Math.round((l.n / (l.n + SHRINKAGE_PSEUDO_COUNT)) * 100)}%`;
  console.log(`  ${l.level.padEnd(42)} n=${String(l.n).padEnd(6)} weight ${w.padEnd(5)} -> median ${Math.round(Math.exp(l.mu)).toLocaleString('en-IN')}, sigma ${l.sigma.toFixed(2)}`);
}

if (v.json) console.log('\n' + JSON.stringify(rec, null, 2));
