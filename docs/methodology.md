# Methodology

How the recommender turns a new campaign into a milestone ladder, and where it can break. Decision numbers refer to [DECISIONS.md](../DECISIONS.md). Every threshold and rupee figure comes from `node src/cli.ts` on the generated data.

## 1. What "optimized" means

Budget is the hard constraint. Motivation, fairness, fraud resistance and ROI are optimized inside it (decision 1). The brief asks for budget adherence "not just in expectation", and a brand can forgive a stingy ladder but not a blown budget. ROI-first was rejected for its weak retention story, retention-first for unpredictable spend.

**Budget adherence.** The price per view is set so total payout stays within budget in 90% of 5,000 simulated runs, including tier mix, format mix and fraud leakage (decisions 8, 9). The top rung caps any one post. Not done: a 100% guarantee, which needs a mid-campaign stop or a far stingier ladder; 95% was rejected as 20 to 40% stingier. The CLI prints spend at p50, p90 and mean, but not yet how far the worst 10% of runs overshoot.

**Creator motivation and retention.** Rung 1 sits at the median, so half of posts earn something (decision 10). Later rungs sit where one in five, twenty and a hundred posts land, so each gap is a real step but reachable; in the worked example the gaps are 2.8x, 2.6x and 2.3x. A flat price per view means no gap is arbitrary. Not done: a fifth rung (rung 1 becomes too grindable), loyalty bonuses, or a model of how creators react to a new ladder.

**Fairness across tiers.** Each tier gets its own ladder at its own quantiles, and every ladder pays the same price per view (decision 2). A nano creator's rung 1 is as reachable for them as a mid creator's is for them. Not done: per-creator ladders normalized to each baseline, rejected as gameable and confusing to brands. Differences inside a tier band are not equalized.

**Fraud and gaming resistance.** Thresholds are fitted on non-flagged posts, payouts use day-7 views, and the top rung is the per-post cap (decision 7). The budget simulation draws the historical flagged share of posts from the flagged distribution, so bought views paid before flagging are in the bound (decision 24). Not done: fraud detection. Flags are taken as given.

**Marginal ROI against paid media.** The price per view never exceeds 80% of the category's paid-media CPM; the discount is because paid media comes with targeting guarantees creators do not give (decision 17). When the budget could pay more, the method pays the cap and reports the headroom (decision 13). Not done: any model of view quality or conversion.

## 2. The pipeline

### Inputs

| Input | Default when missing |
|---|---|
| category, platform, total budget, target tier | required |
| expected creators | median of historical campaigns in the same category and platform, else platform, else all |
| format mix | historical format shares on that platform |
| tier mix | historical participant tier shares in campaigns with the same target tier |
| CPM override | `CPM_TABLE` in `src/config.ts` |

Creator count is an input because ops knows the invite list; estimating it would hide budget risk (decision 12).

### View model

Day-7 views of non-flagged posts are fitted with a lognormal per (category, platform, format, tier) cell (decision 3). It is heavy-tailed enough, has two parameters and fits from little data. Pareto was rejected because its unstable mean hurts budget math; a bootstrap has no cold start and no model to validate.

Sparse cells shrink toward broader ones (decision 11). The fitter walks five levels, broadest first: global; tier; platform and tier; category, platform and tier; the exact cell. At each level with n posts, the running log-mean and sigma are blended with that level's own values at weight n / (n + 20). The pseudo-count 20 is in `src/config.ts`.

Tier stays in every level below global because reach scales with followers and each tier band is ten times the one below. In the example the global sigma of log views is 2.48; blending in the tier level brings it to 1.46. Without tier, a sparse micro cell would be pulled toward other tiers' reach.

### Thresholds

Thresholds are the p50, p80, p95 and p99 of the tier's views, mixed across formats by the format mix (decision 5). A mixture of lognormals has no closed-form quantile, so the code reads quantiles off 200,000 draws. Thresholds are rounded to 3 significant figures because brands read round numbers.

| Rung | Quantile | Plain English |
|---|---|---|
| 1 | p50 | half of posts reach it |
| 2 | p80 | one post in five |
| 3 | p95 | one post in twenty |
| 4 | p99 | one post in a hundred; also the per-post cap |

Fixed quantiles answer "why 250K and not 200K" with data; geometric spacing needs a magic ratio. The positions themselves are judgment a human should own.

### Tiers

There is one ladder per tier in the tier mix, plus the target tier always, all at one shared rate. The mix can be passed in (`--tier-mix micro:0.7,mid:0.3`) or defaults to history.

### Payouts

Cumulative payout at each rung is threshold x rate / 1000, rounded to the rupee, which is why the printed per-1K column wobbles in the second decimal (decision 6). A flat rate makes every rupee comparable to paid media, and virality earns no premium, so buying views to reach the top rung pays no better per view than earning them.

The rate is direct (decision 21). The simulation runs once at Rs 1 per view, so each post's payout equals the threshold views it cleared. Payout is linear in the rate, so

rate per 1K = budget / (p90 of total paid views across runs) x 1000

and no search is needed. The rate is then capped at 80% of the CPM anchor.

### Budget simulation

5,000 runs (decision 8). In each run, for each of N expected creators: draw a tier from the tier mix; with probability equal to the historical flagged share (5.1% here) draw views from the flagged lognormal for that platform and tier, otherwise draw a format and views from that clean cell; apply the tier's ladder at rate 1 and add to the run total. The seed is fixed, so the same input always gives the same ladder.

### Worked examples

Gaming, Instagram, micro target, 73 creators (historical default).

| Budget | Tier mix | Rate per 1K | Micro thresholds (views) | Micro payouts (Rs) | Spend p50 / p90 |
|---|---|---|---|---|---|
| Rs 40,000 | nano 16%, micro 68%, mid 17% (default) | 11.20 | 10,100 / 27,900 / 73,600 / 1,68,000 | 113 / 312 / 824 / 1,881 | 21,916 / 40,000 |
| Rs 40,000 | micro 70%, mid 30% | 7.77 | 10,100 / 28,000 / 74,000 / 1,70,000 | 78 / 218 / 575 / 1,321 | 24,333 / 40,000 |
| Rs 4,00,000 | default | 48.00 (capped) | 10,100 / 27,900 / 73,600 / 1,68,000 | 485 / 1,339 / 3,533 / 8,064 | 93,963 / 1,71,499 |

In the first run nano gets 970 / 2,660 / 6,970 / 15,900 views and mid 82,100 / 2,47,000 / 7,18,000 / 17,70,000, both at Rs 11.20. A 30% mid share drops the rate to Rs 7.77.

### Loose budgets

In the third run the budget could pay more than the cap of Rs 48 per 1K (Rs 60 CPM x 0.8). The method pays the cap and reports Rs 2,28,501 unspent at p90, suggesting more creators or a longer campaign (decision 13). Letting the rate rise would mean paying creators more than ads cost; converting surplus into creator slots would make creator count an output.

## 3. Cold start

The shrinkage block from the Rs 40,000 run. Medians are exp(mu) after each level's blend.

| Level | n | Weight | Median | Sigma |
|---|---|---|---|---|
| global | 2,530 | base | 9,009 | 2.48 |
| micro | 951 | 98% | 10,528 | 1.46 |
| instagram / micro | 408 | 95% | 9,311 | 1.29 |
| gaming / instagram / micro | 130 | 87% | 9,638 | 1.24 |
| gaming / instagram / reel / micro | 92 | 82% | 11,041 | 1.19 |
| gaming / instagram / carousel / micro | 38 | 66% | 7,502 | 1.26 |

The reel cell's own 92 posts carry 82% of its estimate. The carousel cell has 38, so a third of its estimate still comes from the level above. A 20-post cell would be half its own data.

The same mechanism covers every cold start. A new category has no posts at the last two levels, so the estimate stops at platform and tier (median 9,311, sigma 1.29 here). A new format stops one level earlier. Nearest-neighbour campaigns were rejected because they need a similarity metric and fail on a truly new category; a manual prior table is gut feel again.

## 4. Fraud

Three levers change both the numbers and the incentives (decision 7):

1. **Clean fit.** Flagged posts never move a threshold.
2. **Day-7 views.** A bought spike has to hold for a week before it is paid (decision 19).
3. **Top rung is the cap.** No post earns more than the p99 payout, and the flat rate gives no premium for virality.

The budget simulation adds flagged posts at their historical share, because some get paid before flagging catches them. Real detection needs growth-curve data this method does not use: the 24-hour to 7-day view ratio (about 45% for clean synthetic posts, 90 to 98% for flagged ones); account history, meaning views against the account's own past average and account age; engagement-to-view ratio; and referral or traffic source.

## 5. Synthetic data

`src/generate-data.ts` writes 40 campaigns, 600 creators and 2,666 posts with a fixed seed.

| Aspect | Assumption |
|---|---|
| Creator tiers | nano 40%, micro 35%, mid 20%, macro 5%; 65% Instagram, 35% YouTube |
| Followers | lognormal inside the band (1K-10K, 10K-100K, 100K-1M, 1M-10M), centred on its geometric midpoint, edges at 2 sigma |
| Creator quality | per-creator lognormal factor, sigma 0.4, persists across posts; why fitted sigmas land near 1.2 |
| Median day-7 views | followers x views per follower (reel 0.30, carousel 0.15, short 0.50, long-form 0.10) x category (entertainment 1.3, gaming 1.1, D2C 1.0, FMCG 0.9, finance 0.6) x quality |
| Spread | lognormal sigma 1.1; 1.2 on YouTube Shorts |
| Format mix | Instagram reel 75%, carousel 25%; YouTube short 70%, long-form 30% |
| Clean growth | 24h about 45% of day 7 (plus or minus 10 points), day 30 about 1.15x, final about 1.2x |
| Flagged | 5% of posts; day-7 views x3 to x8; 90 to 98% of them in the first 24 hours |
| Viral tail | 3% of clean posts x5 to x20 more |
| Participation | 30 to 100 creators per campaign, 70% target tier, 30% adjacent tier, spilling into any near tier when a pool runs out; one post per creator |
| Completion rate | share of a creator's posts that hit at least one historical rung |

**Viral tail.** Planted on purpose (decision 23). If the data came from the same lognormal the model fits, validation would be circular. The tail is what the lognormal will not fit, which makes the fit check real.

**Status-quo ladders.** Two modes, so the backtest has two failure modes and some campaigns that happen to be fine (decision 18). Even-numbered campaigns use a house template regardless of tier: 10K / 50K / 100K / 500K views for Rs 500 / 2,000 / 5,000 / 15,000. Odd-numbered ones use a follower heuristic: rung 1 at half the tier's median followers, x3 per rung, a rate of Rs 40 to 120 per 1K, and plus or minus 50% noise on every threshold and payout.

**Budgets.** Set the way a brand would: expected reach (65 creators x the tier's typical views) priced at the category's creator CPM, times a tight/loose factor from 0.5 to 2.0, floor Rs 25,000. History holds tight and loose budgets, and it is the same CPM assumption the method uses, stated once. An earlier fixed Rs 1 to 25 lakh range made every campaign underspend and the backtest meaningless.

## 6. Validation

[docs/backtest.md](backtest.md) compares each tier's fitted quantiles with the observed share of clean posts above them. If the lognormal were right, 1% would land above the fitted p99. Observed: nano 1.1%, micro 1.7%, mid 1.2%, macro 1.6%. The body of the distribution holds within 5% at p50 and p80 for every tier; p95 and p99 are under-predicted by up to 28% for micro and 20% for mid and macro. The excess is the planted viral tail, and it is the evidence for the first limit below.

The backtest replays each campaign's actual day-7 views through the actual and proposed ladders, fitting leave-one-campaign-out so the proposal never sees the campaign's own posts (decisions 15, 22).

## 7. Assumptions and limits

- **The lognormal under-predicts extreme virality.** The p99 rung is conservative for true breakouts.
- **Tier spill in small campaigns.** A mid-tier campaign with macro creators in its mix also pays a macro ladder. One macro breakout can then take most of the budget at the macro top rung, and the lognormal tail underprices how often that happens. In leave-one-out replay, 5 of 40 campaigns went over budget, 4 of them mid-tier for this reason. The honest fix is a per-post cap relative to budget. It was not added because it is a policy choice for ops.
- **One post per creator.** Multi-posting is ignored.
- **Creator count is an input.** Wrong by 2x, the budget bound is wrong by roughly 2x.
- **Replay assumes unchanged behaviour.** Creators respond to incentives, so the completion-rate comparison is a lower bound on the effect.
- **Fraud labels are given, not detected.** The method is only as good as the flagging.
- **The CPM table is an assumption.** In production it should come from the brand's media plan.
- **Quantile positions are judgment,** deliberately. They are the part a human should own.
- **Day 7 under-counts long-form,** which keeps growing.
- **No time dynamics.** The ladder does not change mid-flight.

**More data that would help:** the growth-curve and fraud signals in section 4; each creator's full posting history, for multi-posting and baselines; the brand's real media-plan CPMs; past ladder changes and what creators did next, to measure the behavioural response replay cannot see; and views beyond day 7 for long-form.
