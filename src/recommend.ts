// Milestone-ladder recommender: thresholds at fixed quantiles, flat rate per 1K sized by Monte Carlo (decisions 5, 6, 8, 21, 24).
import { BUDGET_CONFIDENCE, CPM_TABLE, CREATOR_SHARE_OF_CPM, FRAUD_SHARE_DEFAULT, MC_RUNS, RUNG_PERCENTILES } from './config.ts';
import { mean, mulberry32, quantile, randLognormal } from './stats.ts';
import type { Rng } from './stats.ts';
import { defaultExpectedCreators, defaultFormatMix, fitViews, historicalFraudShare } from './fit.ts';
import type { History } from './fit.ts';
import type { CampaignInput, FitLevel, Format, Recommendation, Rung } from './types.ts';

const THRESHOLD_SAMPLES = 200_000;

// Cumulative payout for one post: the payout of the highest rung it crossed, 0 below rung 1.
export function applyLadder(views: number, rungs: { view_threshold: number; payout_amount: number }[]): number {
  let paid = 0;
  for (const r of rungs) if (views >= r.view_threshold) paid = Math.max(paid, r.payout_amount);
  return paid;
}

export function recommend(input: CampaignInput, history: History, rng: Rng = mulberry32(7)): Recommendation & { fraud_share: number } {
  const { category, platform, total_budget: budget, target_creator_tier: tier } = input;
  const exclude = input.exclude_campaign_id;
  const posts = history.posts.filter((p) => p.campaign_id !== exclude); // decision 22

  // a. Inputs and defaults.
  const expected_creators = input.expected_creators ?? defaultExpectedCreators(history.campaigns, posts, category, platform, exclude);
  const mix = Object.entries(input.format_mix ?? defaultFormatMix(posts, platform)).filter(([, w]) => (w ?? 0) > 0) as [Format, number][];
  const totalWeight = mix.reduce((s, [, w]) => s + w, 0);
  const cpm_anchor = input.cpm_override ?? CPM_TABLE[category][platform];
  const creator_rate_cap = cpm_anchor * CREATOR_SHARE_OF_CPM;

  // b. One clean fit per format; one flagged fit at platform+tier (levels[2]) for fraud leakage.
  const fits = mix.map(([format, w]) => ({ format, w: w / totalWeight, ...fitViews(posts, { category, platform, format, tier }) }));
  const hasFlags = posts.some((p) => p.flagged_suspicious);
  // ponytail: with no flagged history, fraud posts are drawn from the first clean fit, which understates bought views.
  const fraud = hasFlags ? fitViews(posts, { category, platform, format: mix[0][0], tier }, { flaggedOnly: true }).levels[2] : fits[0];
  const fraudShare = hasFlags ? historicalFraudShare(posts) : FRAUD_SHARE_DEFAULT;

  const drawClean = () => {
    let u = rng();
    const f = fits.find((f) => (u -= f.w) < 0) ?? fits[fits.length - 1];
    return randLognormal(rng, f.mu, f.sigma);
  };

  // c. Thresholds at quantiles of the format mixture, rounded to 3 significant figures (brands read round numbers).
  const samples = Array.from({ length: THRESHOLD_SAMPLES }, drawClean);
  const thresholds = RUNG_PERCENTILES.map((p) => Number(quantile(samples, p).toPrecision(3)));

  // d. Budget sim at rate 1 (payout = views paid for), fraud mixed in at the historical share.
  const atRate1 = thresholds.map((t) => ({ view_threshold: t, payout_amount: t }));
  const sums = Array.from({ length: MC_RUNS }, () => {
    let total = 0;
    for (let i = 0; i < expected_creators; i++) {
      const views = rng() < fraudShare ? randLognormal(rng, fraud.mu, fraud.sigma) : drawClean();
      total += applyLadder(views, atRate1);
    }
    return total;
  });
  const p90Views = quantile(sums, BUDGET_CONFIDENCE);

  // e. Payout is linear in rate, so the rate has a closed form (decision 21), capped at the CPM anchor (decision 13).
  const budgetRate = (budget / p90Views) * 1000;
  const capped = budgetRate >= creator_rate_cap;
  const rate_per_1k = capped ? creator_rate_cap : budgetRate;

  // f. Cumulative payout per rung.
  const rungs: Rung[] = thresholds.map((t, i) => ({
    rank: i + 1,
    percentile: RUNG_PERCENTILES[i],
    view_threshold: t,
    payout_amount: Math.round((t * rate_per_1k) / 1000),
  }));
  const toRs = (views: number) => (views * rate_per_1k) / 1000;
  const fit: FitLevel[] = fits.flatMap((f) => f.levels.map((l) => ({ ...l, level: `${f.format}: ${l.level}` })));

  return {
    input,
    tier,
    rungs,
    rate_per_1k,
    cpm_anchor,
    creator_rate_cap,
    capped,
    headroom: capped ? budget - toRs(p90Views) : 0,
    expected_creators,
    spend_p50: toRs(quantile(sums, 0.5)),
    spend_p90: toRs(p90Views),
    spend_mean: toRs(mean(sums)),
    fit,
    fraud_share: fraudShare,
  };
}
