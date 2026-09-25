import assert from 'node:assert/strict';
import { fitViews } from './fit.ts';
import type { HistPost, History } from './fit.ts';
import { applyLadder, recommend } from './recommend.ts';
import { mean, mulberry32, randLognormal } from './stats.ts';
import type { Campaign, Category, Format, Platform, Tier } from './types.ts';

const close = (a: number, b: number, tol: number, msg: string) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} vs ${b}`);
const rng = mulberry32(1);
let id = 0;
const make = (campaign_id: string, category: Category, platform: Platform, format: Format, tier: Tier, mu: number, n: number, flagged = false) =>
  Array.from({ length: n }, () => ({
    post_id: `P${++id}`, campaign_id, creator_id: `K${id}`, platform, format, category, tier,
    views_at_7d: Math.round(randLognormal(rng, mu, 1)), flagged_suspicious: flagged,
  }) as HistPost);

const posts = [
  ...make('A', 'FMCG', 'youtube', 'short', 'nano', 7, 300),
  ...make('B', 'gaming', 'instagram', 'reel', 'micro', 9, 200),
  ...make('X', 'gaming', 'instagram', 'reel', 'mid', 12, 2000),
  ...make('F', 'gaming', 'instagram', 'reel', 'micro', 11, 20, true),
];
const key = { category: 'gaming', platform: 'instagram', format: 'reel', tier: 'micro' } as const;

// (i) empty cell passes the parent through unchanged.
const empty = fitViews(posts, { ...key, format: 'carousel' });
assert.equal(empty.levels[4].n, 0);
assert.equal(empty.mu, empty.levels[3].mu);
assert.equal(empty.sigma, empty.levels[3].sigma);

// (ii) a cell with many posts lands near its own sample mean.
const big = fitViews(posts, { ...key, tier: 'mid' });
const own = mean(posts.filter((p) => p.campaign_id === 'X').map((p) => Math.log(Math.max(1, p.views_at_7d))));
close(big.mu, own, 0.05, 'big cell mu');
close(big.sigma, 1, 0.05, 'big cell sigma');

// (iii) excludeCampaignId drops that campaign's posts from every level.
const loo = fitViews(posts, { ...key, tier: 'mid' }, { excludeCampaignId: 'X' });
assert.equal(loo.levels[4].n, 0);
assert.equal(loo.levels[0].n, 500);
assert.equal(fitViews(posts, key, { flaggedOnly: true }).levels[0].n, 20);

// (iv) applyLadder.
const ladder = [
  { view_threshold: 1000, payout_amount: 50 },
  { view_threshold: 5000, payout_amount: 250 },
  { view_threshold: 20000, payout_amount: 1000 },
];
assert.equal(applyLadder(999, ladder), 0);
assert.equal(applyLadder(1000, ladder), 50);
assert.equal(applyLadder(7000, ladder), 250);
assert.equal(applyLadder(1e9, ladder), 1000);

// (v) recommend keeps rate <= cap; uncapped spends ~budget at p90; capped reports headroom.
const campaigns = ['A', 'B', 'X', 'F'].map((campaign_id) => ({ campaign_id, category: 'gaming', platform: 'instagram' }) as Campaign);
const history: History = { campaigns, ladders: [], creators: [], posts };
const base = { category: 'gaming', platform: 'instagram', target_creator_tier: 'micro', expected_creators: 40 } as const;
const tight = recommend({ ...base, total_budget: 5000 }, history);
assert.ok(!tight.capped && tight.rate_per_1k <= tight.creator_rate_cap);
close(tight.spend_p90 / 5000, 1, 0.01, 'uncapped p90 spend vs budget');
assert.equal(tight.headroom, 0);
assert.ok(tight.rungs.every((r, i) => i === 0 || r.view_threshold > tight.rungs[i - 1].view_threshold));
const loose = recommend({ ...base, total_budget: 1e9 }, history);
assert.ok(loose.capped && loose.rate_per_1k === loose.creator_rate_cap && loose.headroom > 0);
console.log('fit.test: ok');
