// Synthetic campaign history. Fixed seed, byte-identical output. Run: node src/generate-data.ts
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { mulberry32, randn, randLognormal, quantile } from './stats.ts';
import { writeCsv } from './csv.ts';
import { CATEGORIES, PLATFORMS, TIERS, FORMATS_BY_PLATFORM } from './types.ts';
import { CPM_TABLE, CREATOR_SHARE_OF_CPM } from './config.ts';
import type { Campaign, Creator, HistoricalRung, Post, Platform, Tier, Format, Category } from './types.ts';

const rng = mulberry32(42);
const uniform = (lo: number, hi: number) => lo + (hi - lo) * rng();
const randInt = (lo: number, hi: number) => Math.floor(uniform(lo, hi + 1)); // inclusive
const pickOne = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];
function pickWeighted<T extends string>(w: Record<T, number>): T {
  let u = rng();
  const keys = Object.keys(w) as T[];
  for (const k of keys) if ((u -= w[k]) < 0) return k;
  return keys[keys.length - 1];
}
const pad = (n: number, w: number) => String(n).padStart(w, '0');
const day = (d: number) => new Date(Date.UTC(2025, 0, 1) + d * 86_400_000).toISOString().slice(0, 10);

const TIER_MIX: Record<Tier, number> = { nano: 0.4, micro: 0.35, mid: 0.2, macro: 0.05 };
const TIER_BAND: Record<Tier, [number, number]> = { nano: [1e3, 1e4], micro: [1e4, 1e5], mid: [1e5, 1e6], macro: [1e6, 1e7] };
// Budget the way a brand would: expected reach (~65 creators x tier median views) priced at the category's creator
// CPM, times a tight/loose factor U[0.5, 2.0], floor Rs 25K. Reach-blind fixed ranges made every campaign underspend.
const REACH_MID: Record<Platform, number> = { instagram: 0.26, youtube: 0.38 }; // blended views per follower
const VIEWS_PER_FOLLOWER: Record<Format, number> = { reel: 0.3, carousel: 0.15, short: 0.5, long_form: 0.1 };
const CATEGORY_MULT: Record<Category, number> = { entertainment: 1.3, gaming: 1.1, D2C: 1.0, FMCG: 0.9, finance: 0.6 };
const FORMAT_MIX: Record<Platform, Record<string, number>> = { instagram: { reel: 0.75, carousel: 0.25 }, youtube: { short: 0.7, long_form: 0.3 } };

// Follower count: lognormal centred on the band's geometric midpoint, redrawn until inside the band.
function followers(tier: Tier): number {
  const [lo, hi] = TIER_BAND[tier];
  const mu = (Math.log(lo) + Math.log(hi)) / 2;
  const sigma = (Math.log(hi) - Math.log(lo)) / 4; // band edges at +/-2 sigma
  for (;;) {
    const f = Math.round(randLognormal(rng, mu, sigma));
    if (f >= lo && f < hi) return f;
  }
}

// --- Creators ---
const creators: Creator[] = [];
const quality = new Map<string, number>(); // latent, persists across a creator's posts
for (let i = 1; i <= 600; i++) {
  const tier = pickWeighted(TIER_MIX);
  const c: Creator = {
    creator_id: `CR${pad(i, 3)}`,
    platform: rng() < 0.65 ? 'instagram' : 'youtube',
    follower_count: followers(tier),
    tier,
    account_age_months: randInt(3, 72),
    historical_avg_views_per_post: 0,
    historical_completion_rate: 0,
  };
  creators.push(c);
  quality.set(c.creator_id, randLognormal(rng, 0, 0.4));
}
const medianFollowers = (t: Tier) => quantile(creators.filter((c) => c.tier === t).map((c) => c.follower_count), 0.5);

// --- Campaigns + historical ladders ---
const campaigns: Campaign[] = [];
const ladders: HistoricalRung[] = [];
for (let i = 0; i < 40; i++) {
  // Blocks of 4 per (category, platform) pair, so even/odd ladder modes are not tied to platform.
  const category = CATEGORIES[Math.floor(i / 8)];
  const platform = PLATFORMS[Math.floor(i / 4) % 2];
  const tier = pickWeighted(TIER_MIX);
  const tierMidFollowers = Math.sqrt(TIER_BAND[tier][0] * TIER_BAND[tier][1]);
  const expectedViews = 65 * tierMidFollowers * REACH_MID[platform] * CATEGORY_MULT[category];
  const start = randInt(0, 364);
  const c: Campaign = {
    campaign_id: `C${pad(i + 1, 2)}`,
    brand: `Brand_${pad(i + 1, 2)}`,
    category,
    platform,
    total_budget: Math.max(25_000, Math.round(((expectedViews * CPM_TABLE[category][platform] * CREATOR_SHARE_OF_CPM) / 1000) * uniform(0.5, 2.0) / 1000) * 1000),
    start_date: day(start),
    end_date: day(start + randInt(30, 100)),
    target_creator_tier: tier,
  };
  campaigns.push(c);

  let thresholds = [10_000, 50_000, 100_000, 500_000]; // even: house template, ignores tier
  let payouts = [500, 2000, 5000, 15_000];
  if (i % 2 === 1) {
    // odd: follower heuristic, x3 per rung, +/-50% noise on thresholds and payouts
    const ratePer1k = uniform(40, 120);
    const t1 = 0.5 * medianFollowers(tier);
    thresholds = [];
    payouts = [];
    for (let k = 0; k < 4; k++) {
      const t = Math.max(Math.round((t1 * 3 ** k * uniform(0.5, 1.5)) / 10) * 10, (thresholds[k - 1] ?? 0) + 10);
      const p = Math.max(Math.round(((t / 1000) * ratePer1k * uniform(0.5, 1.5)) / 10) * 10, (payouts[k - 1] ?? 0) + 10);
      thresholds.push(t);
      payouts.push(p);
    }
  }
  thresholds.forEach((t, k) => ladders.push({ campaign_id: c.campaign_id, milestone_rank: k + 1, view_threshold: t, payout_amount: payouts[k] }));
}

// --- Participation ---
// ponytail: one post per creator per campaign; multi-posting creators would need a post-count draw per (creator, campaign).
const adjacent = (t: Tier) => TIERS.filter((x) => Math.abs(TIERS.indexOf(x) - TIERS.indexOf(t)) === 1);
const roster = new Map<string, Creator[]>(campaigns.map((c) => [c.campaign_id, []]));
for (const camp of campaigns) {
  const chosen = roster.get(camp.campaign_id)!;
  const want = randInt(30, 100);
  const near = [camp.target_creator_tier, ...adjacent(camp.target_creator_tier)];
  for (let k = 0; k < want; k++) {
    const tier = rng() < 0.7 ? camp.target_creator_tier : pickOne(adjacent(camp.target_creator_tier));
    let pool = creators.filter((c) => c.platform === camp.platform && c.tier === tier && !chosen.includes(c));
    // Target pool exhausted (small macro/mid pools): spill into any unused near-tier creator.
    if (!pool.length) pool = creators.filter((c) => c.platform === camp.platform && near.includes(c.tier) && !chosen.includes(c));
    if (!pool.length) break;
    chosen.push(pickOne(pool));
  }
}
// Creators no campaign picked: add them to one random campaign on their platform targeting their tier or a neighbour.
const used = new Set([...roster.values()].flat());
for (const cr of creators.filter((c) => !used.has(c))) {
  const fits = campaigns.filter((c) => c.platform === cr.platform && [c.target_creator_tier, ...adjacent(c.target_creator_tier)].includes(cr.tier));
  roster.get(pickOne(fits.length ? fits : campaigns.filter((c) => c.platform === cr.platform)).campaign_id)!.push(cr);
}

// --- Posts ---
const posts: Post[] = [];
let viralCount = 0;
for (const camp of campaigns) {
  const rungs = ladders.filter((r) => r.campaign_id === camp.campaign_id);
  const span = (Date.parse(camp.end_date) - Date.parse(camp.start_date)) / 86_400_000;
  for (const cr of roster.get(camp.campaign_id)!) {
    const format = pickWeighted(FORMAT_MIX[camp.platform]) as Format;
    const median = cr.follower_count * VIEWS_PER_FOLLOWER[format] * CATEGORY_MULT[camp.category] * quality.get(cr.creator_id)!;
    let v7 = randLognormal(rng, Math.log(median), format === 'short' ? 1.2 : 1.1);
    const flagged = rng() < 0.05;
    const viral = !flagged && rng() < 0.03;
    if (viral) viralCount++;
    if (viral) v7 *= uniform(5, 20);
    if (flagged) v7 *= uniform(3, 8);
    v7 = Math.max(1, Math.round(v7));
    // Clean growth: 24h ~45% (+/-10pp), 30d ~1.15x, final ~1.20x. Flagged: 90-98% lands in 24h, then +2-5%.
    const v24 = Math.round(v7 * (flagged ? uniform(0.9, 0.98) : 0.45 + uniform(-0.1, 0.1)));
    const v30 = Math.max(v7, Math.round(v7 * (flagged ? uniform(1.02, 1.04) : 1.15 * (1 + 0.04 * randn(rng)))));
    const vFinal = Math.max(v30, Math.round(v7 * (flagged ? uniform(1.03, 1.05) : 1.2 * (1 + 0.04 * randn(rng)))));
    const hit = rungs.filter((r) => r.view_threshold <= v7).at(-1);
    posts.push({
      post_id: `P${pad(posts.length + 1, 4)}`,
      campaign_id: camp.campaign_id,
      creator_id: cr.creator_id,
      post_date: day((Date.parse(camp.start_date) - Date.UTC(2025, 0, 1)) / 86_400_000 + randInt(0, span)),
      platform: camp.platform,
      format,
      views_at_24h: v24,
      views_at_7d: v7,
      views_at_30d: v30,
      views_final: vFinal,
      total_payout_earned: hit ? hit.payout_amount : 0,
      flagged_suspicious: flagged,
    });
  }
}

// --- Creator history from their posts ---
for (const c of creators) {
  const mine = posts.filter((p) => p.creator_id === c.creator_id);
  assert(mine.length > 0, `${c.creator_id} has no posts`);
  c.historical_avg_views_per_post = Math.round(mine.reduce((s, p) => s + p.views_at_7d, 0) / mine.length);
  c.historical_completion_rate = Math.round((mine.filter((p) => p.total_payout_earned > 0).length / mine.length) * 1000) / 1000;
}

mkdirSync('data', { recursive: true });
const files: [string, Record<string, unknown>[]][] = [
  ['data/campaigns.csv', campaigns as unknown as Record<string, unknown>[]],
  ['data/milestone_ladders.csv', ladders as unknown as Record<string, unknown>[]],
  ['data/creators.csv', creators as unknown as Record<string, unknown>[]],
  ['data/posts.csv', posts as unknown as Record<string, unknown>[]],
];
for (const [path, rows] of files) {
  for (const r of rows) for (const v of Object.values(r)) assert(v !== undefined && !Number.isNaN(v), `bad cell in ${path}`);
  writeCsv(path, rows);
  console.log(`${path}: ${rows.length} rows`);
}
const pct = (n: number) => `${((n / posts.length) * 100).toFixed(1)}%`;
console.log(`flagged: ${pct(posts.filter((p) => p.flagged_suspicious).length)}, viral tail: ${pct(viralCount)}`);
for (const t of TIERS) {
  const ids = new Set(creators.filter((c) => c.tier === t).map((c) => c.creator_id));
  const v = posts.filter((p) => ids.has(p.creator_id)).map((p) => p.views_at_7d);
  console.log(`${t}: ${v.length} posts, views_at_7d median ${Math.round(quantile(v, 0.5))}, p99 ${Math.round(quantile(v, 0.99))}`);
}
