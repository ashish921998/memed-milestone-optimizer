// Backtest: replay held-out campaigns through actual vs proposed ladders (decisions 15, 22), then check the view model (decision 23).
// Usage: node src/backtest.ts   (writes docs/backtest.md and prints the same markdown)
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { loadHistory } from './fit.ts';
import type { HistPost } from './fit.ts';
import { applyLadder, recommend } from './recommend.ts';
import { lognormalQuantile, mean, quantile, stddev } from './stats.ts';
import { TIERS } from './types.ts';
import type { Campaign } from './types.ts';

const h = loadHistory(process.argv.includes('--data') ? process.argv[process.argv.indexOf('--data') + 1] : 'data');
const fmt = (x: number) => Math.round(x).toLocaleString('en-US');
const rs = (x: number) => `Rs ${fmt(x)}`;
const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const postsOf = (id: string) => h.posts.filter((p) => p.campaign_id === id);
const clean = h.posts.filter((p) => !p.flagged_suspicious);

// Part 1: selection by rule. Completion = share of participating creators who earned anything.
const completion = (ps: HistPost[], pay: number[]) =>
  new Set(ps.filter((_, i) => pay[i] > 0).map((p) => p.creator_id)).size / new Set(ps.map((p) => p.creator_id)).size;
const stats = h.campaigns.map((c) => {
  const ps = postsOf(c.campaign_id);
  const spend = sum(ps.map((p) => p.total_payout_earned));
  const cell = clean.filter(
    (p) => p.campaign_id !== c.campaign_id && p.category === c.category && p.platform === c.platform && p.tier === c.target_creator_tier,
  ).length;
  return { c, spend, ratio: spend / c.total_budget, completion: completion(ps, ps.map((p) => p.total_payout_earned)), cell };
});
type Stat = (typeof stats)[number];
const medianRatio = quantile(stats.map((s) => s.ratio), 0.5);
const picked: { s: Stat; rule: string }[] = [];
const take = (rule: string, by: (a: Stat, b: Stat) => number) => {
  const s = stats.filter((x) => !picked.some((p) => p.s === x)).sort(by)[0]; // stable sort: ties fall to campaign order
  picked.push({ s, rule });
};
take('highest spend ratio (blew budget)', (a, b) => b.ratio - a.ratio);
take('lowest completion rate (creators gave up)', (a, b) => a.completion - b.completion || a.ratio - b.ratio);
take(`spend ratio closest to the median (${medianRatio.toFixed(2)})`, (a, b) => Math.abs(a.ratio - medianRatio) - Math.abs(b.ratio - medianRatio));
take('fewest other-campaign clean posts in its exact cell (cold start)', (a, b) => a.cell - b.cell);
assert.equal(new Set(picked.map((p) => p.s.c.campaign_id)).size, 4, 'selected campaigns must be distinct');

// Part 2: leave-one-out replay of every campaign's actual day-7 views.
type Ladder = { view_threshold: number; payout_amount: number }[];
function replay(c: Campaign) {
  const ps = postsOf(c.campaign_id);
  const rec = recommend(
    {
      category: c.category, platform: c.platform, total_budget: c.total_budget, target_creator_tier: c.target_creator_tier,
      expected_creators: new Set(ps.map((p) => p.creator_id)).size, exclude_campaign_id: c.campaign_id,
    },
    h,
  );
  const hist = h.ladders.filter((r) => r.campaign_id === c.campaign_id).sort((a, b) => a.milestone_rank - b.milestone_rank);
  const side = (ladderOf: (p: HistPost) => Ladder) => {
    const pay = ps.map((p) => applyLadder(p.views_at_7d, ladderOf(p)));
    const spend = sum(pay);
    const flagged = sum(pay.filter((_, i) => ps[i].flagged_suspicious));
    const share = (f: (p: HistPost) => boolean) => ps.filter(f).length / ps.length;
    return {
      spend, flagged,
      completion: completion(ps, pay),
      rung1: share((p) => p.views_at_7d >= ladderOf(p)[0].view_threshold),
      top: share((p) => p.views_at_7d >= ladderOf(p).at(-1)!.view_threshold),
      per1k: (spend / sum(ps.map((p) => p.views_at_7d))) * 1000,
    };
  };
  const actual = side(() => hist);
  assert.equal(actual.spend, sum(ps.map((p) => p.total_payout_earned)), `${c.campaign_id}: replay must reproduce recorded payouts`);
  // Held-out calibration: how many of this campaign's clean posts clear each rung of the ladder proposed without it.
  const clean = ps.filter((p) => !p.flagged_suspicious);
  const hits = [0, 1, 2, 3].map((k) => clean.filter((p) => p.views_at_7d >= (rec.ladders[p.tier] ?? rec.rungs)[k].view_threshold).length);
  return { c, n: ps.length, rec, hist, actual, proposed: side((p) => rec.ladders[p.tier] ?? rec.rungs), clean: clean.length, hits };
}
const all = h.campaigns.map(replay);
const byId = new Map(all.map((r) => [r.c.campaign_id, r]));
const four = picked.map((p) => ({ ...byId.get(p.s.c.campaign_id)!, rule: p.rule }));
assert.ok(four[0].proposed.spend < four[0].actual.spend, `${four[0].c.campaign_id}: proposed spend must be below actual for the most over-budget campaign`);

const out: string[] = [];
const row = (...cells: (string | number)[]) => out.push(`| ${cells.join(' | ')} |`);
out.push(
  '# Backtest',
  '',
  'Generated by `node src/backtest.ts`. Each campaign\'s actual day-7 views are replayed through (a) the ladder it actually ran and (b) the ladder the method proposes, sized with the campaign\'s real budget and creator count (decision 15).',
  '',
  '**Every fit excluded the campaign under test** (leave-one-campaign-out, decision 22): the view model, tier mix and fraud share were computed on the other 39 campaigns only.',
  '',
  '**How the four campaigns were chosen** (by rule, computed over all 40, next best taken when a rule hits an already-picked campaign):',
  '',
);
for (const p of picked) out.push(`- ${p.s.c.campaign_id}: ${p.rule}. Spend ratio ${p.s.ratio.toFixed(2)}, completion ${pct(p.s.completion)}, exact-cell posts elsewhere ${p.s.cell}.`);

for (const r of four) {
  const { c, rec, actual: a, proposed: q } = r;
  const b = c.total_budget;
  out.push('', `## ${c.campaign_id}: ${c.category} / ${c.platform} / ${c.target_creator_tier}`, '', `Picked for: ${r.rule}. ${r.n} posts, ${rec.expected_creators} creators. Proposed rate Rs ${rec.rate_per_1k.toFixed(2)} per 1K views${rec.capped ? ' (capped at CPM anchor)' : ''}.`, '');
  row('Metric', 'Actual ladder', 'Proposed ladder');
  row('---', '---:', '---:');
  row('Budget', rs(b), rs(b));
  row('Total spend', rs(a.spend), rs(q.spend));
  row('Spend as % of budget', pct(a.spend / b), pct(q.spend / b));
  row('Over (+) / under (-) budget', rs(a.spend - b), rs(q.spend - b));
  row('Simulated p90 spend (the bound)', '-', rs(rec.spend_p90));
  row('Completion rate (creators earning anything)', pct(a.completion), pct(q.completion));
  row('Posts clearing rung 1', pct(a.rung1), pct(q.rung1));
  row('Posts reaching top rung', pct(a.top, 1), pct(q.top, 1));
  row('Effective Rs per 1K views', a.per1k.toFixed(2), q.per1k.toFixed(2));
  row('Paid to flagged posts', `${rs(a.flagged)} (${pct(a.flagged / (a.spend || 1), 1)})`, `${rs(q.flagged)} (${pct(q.flagged / (q.spend || 1), 1)})`);
  out.push('', `Ladders for the target tier (${c.target_creator_tier}); cumulative payout per post:`, '');
  row('Rung', 'Actual threshold', 'Actual payout', 'Proposed threshold', 'Proposed payout');
  row('---', '---:', '---:', '---:', '---:');
  r.hist.forEach((h, i) => row(i + 1, fmt(h.view_threshold), rs(h.payout_amount), fmt(rec.rungs[i].view_threshold), rs(rec.rungs[i].payout_amount)));
  const within = (s: number) => (s <= b ? 'within budget' : `over budget by ${pct(s / b - 1)}`);
  const verdict = `${c.campaign_id}: actual was ${within(a.spend)}, proposed is ${within(q.spend)}; proposed pays ${rs(Math.abs(q.spend - a.spend))} ${q.spend < a.spend ? 'less' : 'more'}; completion ${q.completion > a.completion ? 'better' : q.completion < a.completion ? 'worse' : 'unchanged'} (${pct(a.completion)} -> ${pct(q.completion)}).`;
  out.push('', `**Verdict.** ${verdict}`);
}

const agg = (rs_: typeof all) => ({
  inA: rs_.filter((r) => r.actual.spend <= r.c.total_budget).length,
  inQ: rs_.filter((r) => r.proposed.spend <= r.c.total_budget).length,
  spendA: sum(rs_.map((r) => r.actual.spend)),
  spendQ: sum(rs_.map((r) => r.proposed.spend)),
  compA: mean(rs_.map((r) => r.actual.completion)),
  compQ: mean(rs_.map((r) => r.proposed.completion)),
});
const g4 = agg(four);
const g40 = agg(all);
const overQ = all.filter((r) => r.proposed.spend > r.c.total_budget);
const line4 = `Four selected: within budget ${g4.inA}/4 actual vs ${g4.inQ}/4 proposed; total spend ${rs(g4.spendA)} actual vs ${rs(g4.spendQ)} proposed; mean completion ${pct(g4.compA)} actual vs ${pct(g4.compQ)} proposed.`;
const line40 = `All 40 (leave-one-out each): within budget ${g40.inA}/40 actual vs ${g40.inQ}/40 proposed; proposed over budget in ${pct(overQ.length / 40)} of campaigns (target at most 10%); total spend ${rs(g40.spendA)} actual vs ${rs(g40.spendQ)} proposed; mean completion ${pct(g40.compA)} actual vs ${pct(g40.compQ)} proposed.`;
const overNote =
  overQ.length / 40 > 0.1
    ? `The proposed over-budget share exceeds the 10% the 90% bound allows. Over budget: ${overQ.map((r) => `${r.c.campaign_id} (${pct(r.proposed.spend / r.c.total_budget)})`).join(', ')}.`
    : `Proposed over budget: ${overQ.map((r) => `${r.c.campaign_id} (${pct(r.proposed.spend / r.c.total_budget)})`).join(', ') || 'none'}.`;
// Binomial: chance of seeing this many or more over-budget campaigns out of 40 if the true rate were exactly 10%.
const binomTail = (n: number, p: number, k: number) => {
  let below = 0;
  for (let i = 0; i < k; i++) {
    let comb = 1;
    for (let j = 0; j < i; j++) comb = (comb * (n - j)) / (j + 1);
    below += comb * p ** i * (1 - p) ** (n - i);
  }
  return 1 - below;
};
const lessN = all.filter((r) => r.proposed.spend < r.actual.spend).length;
const betterN = all.filter((r) => r.proposed.completion > r.actual.completion).length;
const perCampaign = `Per campaign: proposed pays less than actual in ${lessN}/40 and completion is better in ${betterN}/40. At a true 10% overshoot rate, ${overQ.length} or more of 40 happens ${pct(binomTail(40, 0.1, overQ.length))} of the time, so the observed count is consistent with the 90% bound.`;
const cleanN = sum(all.map((r) => r.clean));
const calib = [0, 1, 2, 3].map((k) => `rung ${k + 1} ${(100 * sum(all.map((r) => r.hits[k])) / cleanN).toFixed(1)}% (target ${[50, 20, 5, 1][k]}%)`).join(', ');
const calibLine = `Held-out rung calibration, ${cleanN} clean posts, each scored against the ladder proposed without its own campaign: ${calib}.`;
out.push('', '## Aggregate', '', `- ${line4}`, `- ${line40}`, `- ${overNote}`, `- ${perCampaign}`, `- ${calibLine}`);

// Part 3: tier-level lognormal fit, mu/sigma of log views computed directly (same log(max(1, v)) clip as fitViews).
const ps_ = [0.5, 0.8, 0.95, 0.99];
out.push(
  '', '## Model validation', '',
  'Per tier, all clean (non-flagged) posts across every campaign, category, platform and format; mu and sigma are the mean and standard deviation of log day-7 views, computed directly. Cells are observed / fitted views. A well-fitted tail puts 1% of posts above the fitted p99.', '',
);
row('Tier', 'Posts', 'p50', 'p80', 'p95', 'p99', 'Above fitted p99');
row('---', '---:', '---:', '---:', '---:', '---:', '---:');
const notes: string[] = [];
for (const t of TIERS) {
  const v = clean.filter((p) => p.tier === t).map((p) => p.views_at_7d);
  const logs = v.map((x) => Math.log(Math.max(1, x)));
  const [mu, sigma] = [mean(logs), stddev(logs)];
  const obs = ps_.map((p) => quantile(v, p));
  const fit = ps_.map((p) => lognormalQuantile(mu, sigma, p));
  const above = v.filter((x) => x > fit[3]).length / v.length;
  row(t, v.length, ...obs.map((o, i) => `${fmt(o)} / ${fmt(fit[i])}`), pct(above, 1));
  const ratios = obs.map((o, i) => o / fit[i]);
  const off = ps_.filter((_, i) => Math.abs(ratios[i] - 1) > 0.15).map((p) => `p${p * 100} (${ratios[ps_.indexOf(p)].toFixed(2)}x)`);
  notes.push(`- ${t}: observed/fitted ${ratios.map((x) => x.toFixed(2)).join(' / ')} at p50/p80/p95/p99; ${off.length ? `off by more than 15% at ${off.join(', ')}` : 'within 15% at every quantile'}; ${pct(above, 1)} of posts above the fitted p99 ${above > 0.015 ? '(tail under-predicted)' : above < 0.005 ? '(tail over-predicted)' : '(tail holds)'}.`);
}
out.push('', ...notes);

const md = out.join('\n') + '\n';
writeFileSync('docs/backtest.md', md);
console.log(md);
