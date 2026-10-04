// View-distribution fitter: lognormal of day-7 views per cell, shrunk toward broader cells (decision 11).
import { readCsv } from './csv.ts';
import { SHRINKAGE_PSEUDO_COUNT } from './config.ts';
import { mean, stddev, quantile } from './stats.ts';
import { FORMATS_BY_PLATFORM, TIERS } from './types.ts';
import type { Campaign, Category, Creator, FitLevel, Format, HistoricalRung, Platform, Post, Tier } from './types.ts';

// posts.csv has no category or tier; they come from the campaign and the creator.
export interface HistPost extends Post {
  category: Category;
  tier: Tier;
}

export interface History {
  campaigns: Campaign[];
  ladders: HistoricalRung[];
  creators: Creator[];
  posts: HistPost[];
}

export interface FitKey {
  category: Category;
  platform: Platform;
  format: Format;
  tier: Tier;
}

export function loadHistory(dir = 'data'): History {
  const campaigns = readCsv<Campaign>(`${dir}/campaigns.csv`);
  const ladders = readCsv<HistoricalRung>(`${dir}/milestone_ladders.csv`);
  const creators = readCsv<Creator>(`${dir}/creators.csv`);
  const categoryOf = new Map(campaigns.map((c) => [c.campaign_id, c.category]));
  const tierOf = new Map(creators.map((c) => [c.creator_id, c.tier]));
  const posts = readCsv<Post>(`${dir}/posts.csv`).map((p) => {
    const category = categoryOf.get(p.campaign_id);
    const tier = tierOf.get(p.creator_id);
    if (!category || !tier) throw new Error(`post ${p.post_id}: unknown campaign or creator`);
    return { ...p, category, tier };
  });
  return { campaigns, ladders, creators, posts };
}

// Levels run global -> finest. Tier stays in every level below global because reach scales with followers.
// Each recorded level carries the running (blended) mu and sigma after that level; the last one is the estimate.
export function fitViews(
  posts: HistPost[],
  key: FitKey,
  opts: { excludeCampaignId?: string; flaggedOnly?: boolean } = {},
): { mu: number; sigma: number; levels: FitLevel[] } {
  const { category, platform, format, tier } = key;
  const pool = posts.filter((p) => p.flagged_suspicious === !!opts.flaggedOnly && p.campaign_id !== opts.excludeCampaignId);
  const levels: [string, (p: HistPost) => boolean][] = [
    ['global', () => true],
    [tier, (p) => p.tier === tier],
    [`${platform}/${tier}`, (p) => p.tier === tier && p.platform === platform],
    [`${category}/${platform}/${tier}`, (p) => p.tier === tier && p.platform === platform && p.category === category],
    [`${category}/${platform}/${format}/${tier}`, (p) => p.tier === tier && p.platform === platform && p.category === category && p.format === format],
  ];
  const k = SHRINKAGE_PSEUDO_COUNT;
  let mu = NaN;
  let sigma = NaN;
  const out: FitLevel[] = [];
  for (const [level, match] of levels) {
    // Simplification: log(max(1, v)) so a zero-view post does not become -Infinity; zeros are clipped, not modelled.
    const logs = pool.filter(match).map((p) => Math.log(Math.max(1, p.views_at_7d)));
    const n = logs.length;
    if (level === 'global') {
      if (n < 2) throw new Error('fitViews: need at least 2 posts in history');
      mu = mean(logs);
      sigma = stddev(logs);
    } else if (n > 0) {
      const sigmaLevel = n < 2 ? sigma : stddev(logs);
      mu = (n * mean(logs) + k * mu) / (n + k);
      // Simplification: blends sigma directly, not variance; ignores between-cell spread of means. Fine for shrinkage toward a prior.
      sigma = (n * sigmaLevel + k * sigma) / (n + k);
    }
    out.push({ level, n, mu, sigma });
  }
  return { mu, sigma, levels: out };
}

export function historicalFraudShare(posts: Post[]): number {
  return posts.filter((p) => p.flagged_suspicious).length / posts.length;
}

// Median distinct creators per campaign: same category+platform, else same platform, else all campaigns.
export function defaultExpectedCreators(
  campaigns: Campaign[],
  posts: Post[],
  category: Category,
  platform: Platform,
  excludeCampaignId?: string,
): number {
  const creatorsIn = new Map<string, Set<string>>();
  for (const p of posts) {
    if (!creatorsIn.has(p.campaign_id)) creatorsIn.set(p.campaign_id, new Set());
    creatorsIn.get(p.campaign_id)!.add(p.creator_id);
  }
  const usable = campaigns.filter((c) => c.campaign_id !== excludeCampaignId && creatorsIn.has(c.campaign_id));
  const tries = [
    usable.filter((c) => c.category === category && c.platform === platform),
    usable.filter((c) => c.platform === platform),
    usable,
  ];
  const pick = tries.find((cs) => cs.length > 0);
  if (!pick) throw new Error('defaultExpectedCreators: no historical campaigns with posts; pass expected_creators');
  return Math.round(quantile(pick.map((c) => creatorsIn.get(c.campaign_id)!.size), 0.5));
}

export function defaultFormatMix(posts: Post[], platform: Platform): Partial<Record<Format, number>> {
  const formats = FORMATS_BY_PLATFORM[platform];
  const onPlatform = posts.filter((p) => p.platform === platform);
  return Object.fromEntries(
    formats.map((f) => [f, onPlatform.length ? onPlatform.filter((p) => p.format === f).length / onPlatform.length : 1 / formats.length]),
  );
}

// Share of participant tiers among campaigns with the same target tier, else all campaigns.
export function defaultTierMix(campaigns: Campaign[], posts: HistPost[], targetTier: Tier, excludeCampaignId?: string): Record<Tier, number> {
  const same = new Set(campaigns.filter((c) => c.target_creator_tier === targetTier && c.campaign_id !== excludeCampaignId).map((c) => c.campaign_id));
  const pool = posts.filter((p) => p.campaign_id !== excludeCampaignId && same.has(p.campaign_id));
  const use = pool.length ? pool : posts.filter((p) => p.campaign_id !== excludeCampaignId);
  return Object.fromEntries(TIERS.map((t) => [t, use.filter((p) => p.tier === t).length / use.length])) as Record<Tier, number>;
}
