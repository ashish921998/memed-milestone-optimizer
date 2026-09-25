// Every number a human chose. Stated as assumptions in docs/methodology.md.
import type { Category, Platform } from './types.ts';

export const RUNG_PERCENTILES = [0.5, 0.8, 0.95, 0.99];
export const BUDGET_CONFIDENCE = 0.9; // total spend must stay under budget in this share of runs
export const MC_RUNS = 5000;
export const SHRINKAGE_PSEUDO_COUNT = 20; // posts of "prior weight" at each shrinkage level
export const CREATOR_SHARE_OF_CPM = 0.8; // creators paid at most this fraction of paid-media CPM
export const FRAUD_SHARE_DEFAULT = 0.05; // share of posts drawn from the flagged distribution in the budget sim

// Paid-media CPM benchmarks, Rs per 1,000 views (assumed, override per campaign).
export const CPM_TABLE: Record<Category, Record<Platform, number>> = {
  finance: { instagram: 250, youtube: 300 },
  FMCG: { instagram: 90, youtube: 120 },
  D2C: { instagram: 110, youtube: 140 },
  gaming: { instagram: 60, youtube: 80 },
  entertainment: { instagram: 50, youtube: 70 },
};
