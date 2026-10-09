# Methodology

This is how my recommender turns a new campaign into a milestone ladder, and where it can break. Decision numbers refer to [DECISIONS.md](../DECISIONS.md). Every threshold and rupee figure comes from `node src/cli.ts` on the generated data.

## 1. What "optimized" means

The brief asks for budget adherence "not just in expectation", so I made budget the hard constraint and optimize motivation, fairness, fraud resistance and ROI inside it. I put budget first because a brand can forgive a stingy ladder but not a blown one. I rejected ROI-first for its weak retention story and retention-first for its unpredictable spend (decision 1).

I never trade budget away. Inside it, I trade motivation against ROI with two parameters: the quantile positions, which set how reachable each rung is, and the CPM cap, which sets the most a view can cost. Fairness comes from the structure, one ladder per tier. I handle fraud through data hygiene and by budgeting for leakage. Neither gets a weight.

I set the price per view so total payout stays within budget in 90% of 5,000 simulated runs that vary tier mix, format mix and fraud leakage. The top rung caps any one post. A 100% guarantee would need a mid-campaign stop or a far stingier ladder. At 95% the worked examples came out 12 to 16% stingier, which I judged not worth the retention cost. The CLI also prints p99 spend, so a rare overshoot's size is visible before the ladder ships (decisions 8, 9).

Motivation comes from the gaps between rungs. Rung 1 sits at the median, so half of posts earn something. Later rungs sit where one post in five, twenty and a hundred lands, so each gap is a real but reachable step. In the worked example the gaps are 2.8x, 2.6x and 2.3x, and the flat price per view leaves them to the data. I did not add loyalty bonuses, a model of how creators react to a new ladder, or a fifth rung, which would make rung 1 too grindable (decision 10).

A nano creator's rung 1 should be as reachable for them as a mid creator's is for them, so each tier gets its own ladder at its own quantiles, all at the same price per view. I rejected per-creator ladders normalized to each baseline because creators can game them and brands find them confusing. I do not equalize differences inside a tier band (decision 2).

Against fraud and gaming, I fit thresholds on non-flagged posts, pay on day-7 views, make the top rung the per-post cap, and include flagged posts in the budget simulation. I take flags as given and built no detection (decisions 7, 24).

For ROI against paid media, I cap the price per view at 80% of the category's paid-media CPM, because paid media comes with targeting guarantees creators do not give. When the budget could pay more, I pay the cap and report the headroom. I did not model view quality or conversion (decisions 13, 17).

## 2. The pipeline

### Inputs

| Input | Default when missing |
|---|---|
| category, platform, total budget, target tier | required |
| expected creators | median of historical campaigns in the same category and platform, else platform, else all |
| format mix | historical format shares on that platform |
| tier mix | historical participant tier shares in campaigns with the same target tier |
| CPM override | `CPM_TABLE` in `src/config.ts` |

I made creator count an input because ops knows the invite list. Estimating it would hide budget risk (decision 12).

### View model

I fit a lognormal to the day-7 views of non-flagged posts in each (category, platform, format, tier) cell. It is heavy-tailed enough, has two parameters and fits from little data. I rejected Pareto because its unstable mean hurts the budget math, and a bootstrap because it has no cold start and no model to validate (decision 3).

Sparse cells shrink toward broader ones. The fitter walks five levels, broadest first: global, tier, platform and tier, category with platform and tier, and the exact cell. At each level with n posts, it blends the running log-mean and sigma with that level's own values at weight n / (n + 20). The pseudo-count 20 is in `src/config.ts` (decision 11).

I keep tier in every level below global because reach scales with followers and each tier band is ten times the one below. In the example the global sigma of log views is 2.48, and blending in the tier level brings it to 1.46. Without tier, a sparse micro cell would be pulled toward other tiers' reach.

### Thresholds

My thresholds are the p50, p80, p95 and p99 of the tier's views, mixed across formats by the format mix. A mixture of lognormals has no closed-form quantile, so the code reads quantiles off 200,000 draws. I round thresholds to 3 significant figures so brands see round numbers (decision 5).

| Rung | Quantile | Meaning |
|---|---|---|
| 1 | p50 | half of posts reach it |
| 2 | p80 | one post in five |
| 3 | p95 | one post in twenty |
| 4 | p99 | one post in a hundred, and the per-post cap |

I chose fixed quantiles because they answer "why 250K and not 200K" with data. Geometric spacing needs a ratio the data does not supply.

### Tiers

Each tier in the tier mix gets a ladder, as does the target tier, all at one shared rate. You can pass the mix in with `--tier-mix micro:0.7,mid:0.3` or let it default to history.

### Payouts

Cumulative payout at each rung is threshold x rate / 1000, rounded to the rupee, which is why the printed per-1K column varies in the second decimal. A flat rate makes every rupee comparable to paid media. Virality earns no premium, so buying views to reach the top rung pays no better per view than earning them (decision 6).

I compute the rate directly. The simulation runs once at Rs 1 per view, so each post's payout equals the threshold views it cleared. Payout is linear in the rate, so

rate per 1K = budget / (p90 of total paid views across runs) x 1000

and no search is needed. I then cap the rate at 80% of the CPM anchor (decision 21).

### Budget simulation

The simulation has 5,000 runs. For each of N expected creators in a run, it draws a tier from the tier mix. With probability equal to the historical flagged share, 5.1% here, it draws views from the flagged lognormal for that platform and tier. Otherwise it draws a format and views from that clean cell. It applies the tier's ladder at rate 1 and adds the payout to the run total. I fixed the seed, so the same input always gives the same ladder (decision 8).

### Worked examples

All three runs are gaming on Instagram with a micro target and 73 creators, the historical default.

| Budget | Tier mix | Rate per 1K | Micro thresholds (views) | Micro payouts (Rs) | Spend p50 / p90 |
|---|---|---|---|---|---|
| Rs 40,000 | nano 16%, micro 68%, mid 17% (default) | 11.20 | 10,100 / 27,900 / 73,600 / 1,68,000 | 113 / 312 / 824 / 1,881 | 21,916 / 40,000 |
| Rs 40,000 | micro 70%, mid 30% | 7.77 | 10,100 / 28,000 / 74,000 / 1,70,000 | 78 / 218 / 575 / 1,321 | 24,333 / 40,000 |
| Rs 4,00,000 | default | 48.00 (capped) | 10,100 / 27,900 / 73,600 / 1,68,000 | 485 / 1,339 / 3,533 / 8,064 | 93,963 / 1,71,499 |

In the first run nano gets 970 / 2,660 / 6,970 / 15,900 views and mid gets 82,100 / 2,47,000 / 7,18,000 / 17,70,000, both at Rs 11.20. A 30% mid share drops the rate to Rs 7.77.

### Loose budgets

In the third run the budget could pay more than the cap of Rs 48 per 1K, the Rs 60 CPM x 0.8. I pay the cap, report Rs 2,28,501 unspent at p90, and suggest more creators or a longer campaign. Raising the rate would pay creators more than ads cost, and converting surplus into creator slots would make creator count an output (decision 13).

## 3. Cold start

Here is the shrinkage from the Rs 40,000 run. Medians are exp(mu) after each level's blend.

| Level | n | Weight | Median | Sigma |
|---|---|---|---|---|
| global | 2,530 | base | 9,009 | 2.48 |
| micro | 951 | 98% | 10,528 | 1.46 |
| instagram / micro | 408 | 95% | 9,311 | 1.29 |
| gaming / instagram / micro | 130 | 87% | 9,638 | 1.24 |
| gaming / instagram / reel / micro | 92 | 82% | 11,041 | 1.19 |
| gaming / instagram / carousel / micro | 38 | 66% | 7,502 | 1.26 |

The reel cell's own 92 posts carry 82% of its estimate. The carousel cell has 38, so a third of its estimate still comes from the level above. A cell with 20 posts would be half its own data.

The same shrinkage handles every cold start. A new category has no posts at the last two levels, so its estimate stops at platform and tier (median 9,311, sigma 1.29 here). A new format in a known category stops one level short of the exact cell. I rejected nearest-neighbour campaigns, which need a similarity metric and fail on a new category, and a manual prior table, which brings gut feel back.

## 4. Fraud

Three choices change both the numbers and the incentives (decision 7).

1. I fit on clean posts only, so flagged posts never move a threshold.
2. Paying on day-7 views gives flagging a week to run before money moves. It does not defeat a spike, because a day-one spike is still in the cumulative day-7 count. In the C02 backtest, flagged posts take 22.6% of payout under my ladder against 18.8% under the old one, so the share does not fall (decision 19).
3. The top rung is the cap. No post earns more than the p99 payout, and the flat rate gives no premium for virality.

The budget simulation adds flagged posts at their historical share, because some get paid before flagging catches them. Real detection needs growth-curve data my method does not use:

- the 24-hour to 7-day view ratio, about 45% for clean synthetic posts and 90 to 98% for flagged ones
- account history, meaning views against the account's own past average, and account age
- the engagement-to-view ratio
- referral or traffic source

## 5. Synthetic data

`src/generate-data.ts` writes 40 campaigns, 600 creators and 2,666 posts with a fixed seed.

| Aspect | Assumption |
|---|---|
| Creator tiers | nano 40%, micro 35%, mid 20%, macro 5%, with 65% on Instagram and 35% on YouTube |
| Followers | lognormal inside the band (1K-10K, 10K-100K, 100K-1M, 1M-10M), centred on its geometric midpoint, edges at 2 sigma |
| Creator quality | per-creator lognormal factor, sigma 0.4, that persists across posts. This is why fitted sigmas land near 1.2 |
| Median day-7 views | followers x views per follower (reel 0.30, carousel 0.15, short 0.50, long-form 0.10) x category (entertainment 1.3, gaming 1.1, D2C 1.0, FMCG 0.9, finance 0.6) x quality |
| Spread | lognormal sigma 1.1, or 1.2 on YouTube Shorts |
| Format mix | Instagram reel 75%, carousel 25%. YouTube short 70%, long-form 30% |
| Clean growth | 24h about 45% of day 7 (plus or minus 10 points), day 30 about 1.15x, final about 1.2x |
| Flagged | 5% of posts, with day-7 views x3 to x8 and 90 to 98% of them in the first 24 hours |
| Viral tail | 3% of clean posts get x5 to x20 more |
| Participation | 30 to 100 creators per campaign, 70% target tier and 30% adjacent tier, spilling into any near tier when a pool runs out. One post per creator |
| Completion rate | share of a creator's posts that hit at least one historical rung |

I planted the viral tail on purpose. If the data came from the same lognormal the model fits, validation would be circular. The lognormal cannot fit the tail, so the fit check can fail (decision 23).

The status-quo ladders follow two patterns, so the backtest has two failure modes and some campaigns that happen to be fine. Even-numbered campaigns use a house template regardless of tier, 10K / 50K / 100K / 500K views for Rs 500 / 2,000 / 5,000 / 15,000. Odd-numbered ones use a follower heuristic, with rung 1 at half the tier's median followers, x3 per rung, a rate of Rs 40 to 120 per 1K, and plus or minus 50% noise on every threshold and payout (decision 18).

I set budgets as a brand would. I price expected reach, 65 creators x the tier's typical views, at the category's creator CPM and multiply by a tight or loose factor from 0.5 to 2.0, with a floor of Rs 25,000. History then holds both tight and loose budgets, built on the same CPM assumption my method uses. My earlier fixed range of Rs 1 to 25 lakh made every campaign underspend and the backtest meaningless.

## 6. Validation

[docs/backtest.md](backtest.md) compares each tier's fitted quantiles with the observed share of clean posts above them. If the lognormal were right, 1% would land above the fitted p99. Observed shares are nano 1.1%, micro 1.7%, mid 1.2% and macro 1.6%. The body of the distribution holds within 5% at p50 for every tier and within 10% at p80. In the tail the fit under-predicts micro p99 by 28% and mid and macro p95 by about 20%, and slightly over-predicts micro p95 and macro p99. The excess above the fitted p99 is the planted viral tail, and is the evidence for the first limit below.

That check is in-sample, on data that is lognormal by construction, so on its own it proves little. The check that matters is held out. For every campaign, I score its clean posts against the ladder proposed without that campaign and count how many clear each rung. Across 2,530 posts the shares are 49.2%, 18.7%, 5.6% and 1.5% against targets of 50%, 20%, 5% and 1%. The rungs land close to target, and posts reach the top rung a little more often than the model expects, which is the viral tail again.

The backtest replays each campaign's actual day-7 views through the actual and proposed ladders. I fit leave-one-campaign-out, so the proposal never sees the campaign's own posts (decisions 15, 22).

## 7. Assumptions and limits

- The lognormal under-predicts extreme virality, so the p99 rung is conservative for true breakouts.
- Tier spill hurts small campaigns. A mid-tier campaign with macro creators in its mix also pays a macro ladder. One macro breakout can then take most of the budget, and the lognormal tail underprices how often that happens. In leave-one-out replay, 5 of 40 campaigns went over budget, 4 of them mid-tier for this reason. The fix is a per-post cap relative to budget. I left it out as a policy choice for ops.
- I assume one post per creator and ignore multi-posting.
- If the creator count input is wrong by 2x, the budget bound is wrong by roughly 2x, and my only defence is that the CLI prints the count it used.
- Replay ignores that creators respond to incentives, so the completion-rate comparison is a lower bound on the effect.
- Fraud labels are given, not detected, so my method is only as good as the flagging.
- My method budgets for fraud but does not reduce it. Flagged posts take a similar share of payout under the proposed ladder as under the actual one (about 20% in C02), because their inflated day-7 views are paid like any other. Cutting that share needs detection, which is out of scope.
- The CPM table is an assumption. In production it should come from the brand's media plan.
- The quantile positions are my judgment, not fitted.
- Day 7 under-counts long-form, which keeps growing.
- There are no time dynamics. The ladder does not change mid-flight.

**What would break it.**

- A platform algorithm change, or a shift in what content the brand supplies, moves the view distribution. Thresholds fitted on old posts go stale, and the shrinkage keeps weighting the old cells until the new ones have about 20 posts.
- A campaign whose views are not roughly lognormal, for example one with paid boosting, breaks the quantile placement and the budget bound at once.
- If fraud flagging misses a new pattern, both thresholds and bound drift upward with the bought views, because my method budgets only for the flagged share it sees in history.
- With a very small budget and large creators, the top rung of a macro ladder can exceed the whole budget, and the 90% bound then depends on whether a single post breaks out.

This data would help:

- the growth-curve and fraud signals in section 4
- each creator's full posting history, for multi-posting and baselines
- the brand's real media-plan CPMs
- past ladder changes and what creators did next, to measure the behavioural response that replay cannot see
- views beyond day 7 for long-form
