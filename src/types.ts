// Shared data contracts. CSV files in data/ use exactly these column names.

export type Category = 'gaming' | 'FMCG' | 'finance' | 'D2C' | 'entertainment';
export type Platform = 'instagram' | 'youtube';
export type Tier = 'nano' | 'micro' | 'mid' | 'macro';
export type Format = 'reel' | 'carousel' | 'short' | 'long_form';

export const CATEGORIES: Category[] = ['gaming', 'FMCG', 'finance', 'D2C', 'entertainment'];
export const PLATFORMS: Platform[] = ['instagram', 'youtube'];
export const TIERS: Tier[] = ['nano', 'micro', 'mid', 'macro'];
export const FORMATS_BY_PLATFORM: Record<Platform, Format[]> = {
  instagram: ['reel', 'carousel'],
  youtube: ['short', 'long_form'],
};

// data/campaigns.csv
export interface Campaign {
  campaign_id: string;
  brand: string;
  category: Category;
  platform: Platform;
  total_budget: number;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  target_creator_tier: Tier;
}

// data/milestone_ladders.csv (historical, as actually configured)
// payout_amount is the CUMULATIVE total a post has earned once it crosses view_threshold.
export interface HistoricalRung {
  campaign_id: string;
  milestone_rank: number; // 1..4
  view_threshold: number;
  payout_amount: number;
}

// data/creators.csv
export interface Creator {
  creator_id: string;
  platform: Platform;
  follower_count: number;
  tier: Tier;
  account_age_months: number;
  historical_avg_views_per_post: number;
  historical_completion_rate: number; // share of past campaigns with >=1 milestone hit
}

// data/posts.csv
export interface Post {
  post_id: string;
  campaign_id: string;
  creator_id: string;
  post_date: string;
  platform: Platform;
  format: Format;
  views_at_24h: number;
  views_at_7d: number;
  views_at_30d: number;
  views_final: number;
  total_payout_earned: number; // historical ladder applied to views_at_7d
  flagged_suspicious: boolean;
}

// Input to the recommender.
export interface CampaignInput {
  category: Category;
  platform: Platform;
  total_budget: number;
  target_creator_tier: Tier;
  expected_creators?: number; // default: median of similar historical campaigns
  format_mix?: Partial<Record<Format, number>>; // default: historical mix for the platform
  tier_mix?: Partial<Record<Tier, number>>; // participant tiers; default: historical mix for campaigns with this target tier
  cpm_override?: number; // paid-media CPM in Rs per 1K views; default from config table
  exclude_campaign_id?: string; // backtest: leave this campaign out of the fit
}

export interface Rung {
  rank: number;
  percentile: number; // e.g. 0.5 means half of posts are expected to reach it
  view_threshold: number;
  payout_amount: number; // cumulative Rs on crossing
}

export interface FitLevel {
  level: string; // which shrinkage level contributed
  n: number; // posts at that level
  mu: number;
  sigma: number;
}

export interface Recommendation {
  input: CampaignInput;
  tier: Tier;
  rungs: Rung[]; // the target tier's ladder, same as ladders[tier]
  tier_mix: Record<Tier, number>; // resolved share of creators per tier
  ladders: Partial<Record<Tier, Rung[]>>; // one ladder per tier in the mix, same rate per view (decision 2)
  rate_per_1k: number; // Rs per 1K views actually used
  cpm_anchor: number; // paid-media CPM used as the ceiling
  creator_rate_cap: number; // cpm_anchor * CREATOR_SHARE_OF_CPM
  capped: boolean; // true when budget could have paid more than the cap
  headroom: number; // Rs left unspent at the p90 bound when capped
  expected_creators: number;
  spend_p50: number;
  spend_p90: number;
  spend_p99: number; // decision 9: the size of a 1-in-100 overshoot, reported not hidden
  spend_mean: number;
  fit: FitLevel[]; // per format in the mix
}
