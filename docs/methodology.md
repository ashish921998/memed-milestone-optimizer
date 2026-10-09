# Methodology

How my recommender turns a new campaign into a milestone ladder, and where it can break. Decision numbers refer to [DECISIONS.md](../DECISIONS.md). Every threshold and rupee figure comes from `node src/cli.ts` on the generated data.

## 1. What "optimized" means

I made budget the hard constraint and optimize motivation, fairness, fraud resistance and ROI inside it (decision 1). The brief asks for budget adherence "not just in expectation". I put budget first because a brand can forgive a stingy ladder but not a blown one. I rejected ROI-first for its weak retention story, retention-first for unpredictable spend.

How I weight the tradeoffs: budget comes first and I never trade it. Inside that envelope, I trade motivation and ROI against each other through two dials, the quantile positions (how reachable each rung is) and the CPM cap (the most a view can cost). Fairness is structural, one ladder per tier. Fraud is handled by data hygiene and budgeting for leakage. Neither gets a weight.

**Budget adherence.** I set the price per view so total payout stays within budget in 90% of 5,000 simulated runs, including tier mix, format mix and fraud leakage (decisions 8, 9). The top rung caps any one post. I did not offer a 100% guarantee, which needs a mid-campaign stop or a far stingier ladder, and rejected 95%, which I measured at 12 to 16% stingier on the worked examples, as not worth the retention cost. The CLI also prints p99 spend, so a rare overshoot's size is visible before the ladder ships.

**Creator motivation and retention.** I put rung 1 at the median, so half of posts earn something (decision 10). Later rungs sit where one in five, twenty and a hundred posts land, so each gap is a real step but reachable. In the worked example the gaps are 2.8x, 2.6x and 2.3x. A flat price per view means no gap is arbitrary. I did not add a fifth rung (rung 1 becomes too grindable), loyalty bonuses, or a model of how creators react to a new ladder.

**Fairness across tiers.** I give each tier its own ladder at its own quantiles, and every ladder pays the same price per view (decision 2). A nano creator's rung 1 is as reachable for them as a mid creator's is for them. I rejected per-creator ladders normalized to each baseline as gameable and confusing to brands. I do not equalize differences inside a tier band.

**Fraud and gaming resistance.** I fit thresholds on non-flagged posts, pay on day-7 views, and make the top rung the per-post cap (decision 7). The budget simulation draws the historical flagged share of posts from the flagged distribution, so bought views paid before flagging are in the bound (decision 24). I take flags as given and did not build detection.

**Marginal ROI against paid media.** I cap the price per view at 80% of the category's paid-media CPM. The discount reflects that paid media comes with targeting guarantees creators do not give (decision 17). When the budget could pay more, I pay the cap and report the headroom (decision 13). I did not model view quality or conversion.

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

I fit day-7 views of non-flagged posts with a lognormal per (category, platform, format, tier) cell (decision 3). It is heavy-tailed enough, has two parameters and fits from little data. I rejected Pareto (unstable mean hurts budget math) and a bootstrap (no cold start, no model to validate).

Sparse cells shrink toward broader ones (decision 11). The fitter walks five levels, broadest first: global; tier; platform and tier; category, platform and tier; the exact cell. At each level with n posts, the running log-mean and sigma are blended with that level's own values at weight n / (n + 20). The pseudo-count 20 is in `src/config.ts`.

I keep tier in every level below global because reach scales with followers and each tier band is ten times the one below. In the example the global sigma of log views is 2.48. Blending in the tier level brings it to 1.46. Without tier, a sparse micro cell would be pulled toward other tiers' reach.

### Thresholds

My thresholds are the p50, p80, p95 and p99 of the tier's views, mixed across formats by the format mix (decision 5). A mixture of lognormals has no closed-form quantile, so the code reads quantiles off 200,000 draws. I round thresholds to 3 significant figures because brands read round numbers.

| Rung | Quantile | Plain English |
|---|---|---|
| 1 | p50 | half of posts reach it |
| 2 | p80 | one post in five |
| 3 | p95 | one post in twenty |
| 4 | p99 | one post in a hundred; also the per-post cap |

I chose fixed quantiles because they answer "why 250K and not 200K" with data. Geometric spacing needs a magic ratio. The positions themselves are judgment a human should own.

### Tiers

Each tier in the tier mix gets a ladder, plus the target tier always, all at one shared rate. The mix can be passed in (`--tier-mix micro:0.7,mid:0.3`) or defaults to history.

### Payouts

Cumulative payout at each rung is threshold x rate / 1000, rounded to the rupee, which is why the printed per-1K column wobbles in the second decimal (decision 6). My flat rate makes every rupee comparable to paid media. Virality earns no premium, so buying views to reach the top rung pays no better per view than earning them.

The rate is direct (decision 21). The simulation runs once at Rs 1 per view, so each post's payout equals the threshold views it cleared. Payout is linear in the rate, so

rate per 1K = budget / (p90 of total paid views across runs) x 1000

and no search is needed. I then cap the rate at 80% of the CPM anchor.

### Budget simulation

5,000 runs (decision 8). For each of N expected creators in a run, the simulation draws a tier from the tier mix. With probability equal to the historical flagged share (5.1% here) it draws views from the flagged lognormal for that platform and tier, otherwise a format and views from that clean cell, then applies the tier's ladder at rate 1 and adds to the run total. I fixed the seed, so the same input always gives the same ladder.

### Worked examples

Gaming, Instagram, micro target, 73 creators (historical default).

| Budget | Tier mix | Rate per 1K | Micro thresholds (views) | Micro payouts (Rs) | Spend p50 / p90 |
|---|---|---|---|---|---|
| Rs 40,000 | nano 16%, micro 68%, mid 17% (default) | 11.20 | 10,100 / 27,900 / 73,600 / 1,68,000 | 113 / 312 / 824 / 1,881 | 21,916 / 40,000 |
| Rs 40,000 | micro 70%, mid 30% | 7.77 | 10,100 / 28,000 / 74,000 / 1,70,000 | 78 / 218 / 575 / 1,321 | 24,333 / 40,000 |
| Rs 4,00,000 | default | 48.00 (capped) | 10,100 / 27,900 / 73,600 / 1,68,000 | 485 / 1,339 / 3,533 / 8,064 | 93,963 / 1,71,499 |

In the first run nano gets 970 / 2,660 / 6,970 / 15,900 views and mid 82,100 / 2,47,000 / 7,18,000 / 17,70,000, both at Rs 11.20. A 30% mid share drops the rate to Rs 7.77.

### Loose budgets

In the third run the budget could pay more than the cap of Rs 48 per 1K (Rs 60 CPM x 0.8). I pay the cap and report Rs 2,28,501 unspent at p90 and suggest more creators or a longer campaign (decision 13). Raising the rate would pay creators more than ads cost. Converting surplus into creator slots would make creator count an output.

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

One mechanism covers every cold start. A new category has no posts at the last two levels, so the estimate stops at platform and tier (median 9,311, sigma 1.29 here). A new format stops one level earlier. I rejected nearest-neighbour campaigns (they need a similarity metric and fail on a truly new category) and a manual prior table (gut feel again).

## 4. Fraud

My three levers change both the numbers and the incentives (decision 7):

1. **Clean fit.** Flagged posts never move a threshold.
2. **Day-7 views.** Payment waits a week, which gives flagging time to run before money moves (decision 19). It does not by itself defeat a spike: views are cumulative, so a day-one spike is still in the day-7 count. In the backtest, flagged posts take a similar share of payout under my ladder as under the old one (C02: 22.6% against 18.8%). The method budgets for fraud; it does not reduce it.
3. **Top rung is the cap.** No post earns more than the p99 payout, and the flat rate gives no premium for virality.

The budget simulation adds flagged posts at their historical share, because some get paid before flagging catches them. Real detection needs growth-curve data my method does not use: the 24-hour to 7-day view ratio (about 45% for clean synthetic posts, 90 to 98% for flagged ones); account history, meaning views against the account's own past average and account age; engagement-to-view ratio; and referral or traffic source.

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

**Viral tail.** I planted it on purpose (decision 23). If the data came from the same lognormal the model fits, validation would be circular. The tail is what the lognormal will not fit, which makes the fit check real.

**Status-quo ladders.** I used two modes, so the backtest has two failure modes and some campaigns that happen to be fine (decision 18). Even-numbered campaigns use a house template regardless of tier: 10K / 50K / 100K / 500K views for Rs 500 / 2,000 / 5,000 / 15,000. Odd-numbered ones use a follower heuristic: rung 1 at half the tier's median followers, x3 per rung, a rate of Rs 40 to 120 per 1K, and plus or minus 50% noise on every threshold and payout.

**Budgets.** I set them as a brand would: expected reach (65 creators x the tier's typical views) priced at the category's creator CPM, times a tight/loose factor from 0.5 to 2.0, floor Rs 25,000. History holds tight and loose budgets, and it is the same CPM assumption my method uses, stated once. My earlier fixed Rs 1 to 25 lakh range made every campaign underspend and the backtest meaningless.

## 6. Validation

[docs/backtest.md](backtest.md) compares each tier's fitted quantiles with the observed share of clean posts above them. If the lognormal were right, 1% would land above the fitted p99. Observed: nano 1.1%, micro 1.7%, mid 1.2%, macro 1.6%. The body of the distribution holds within 5% at p50 for every tier and within 10% at p80. In the tail the fit is off in both directions: micro p99 is under-predicted by 28%, mid and macro p95 by about 20%, while micro p95 and macro p99 are slightly over-predicted. The excess above the fitted p99 is the planted viral tail, which is the evidence for the first limit below.

That check is in-sample and on data that is lognormal by construction, so on its own it proves little. The check that matters is held out: for every campaign, I score its clean posts against the ladder proposed without that campaign and count how many clear each rung. Across 2,530 posts the shares are 49.2%, 18.7%, 5.6% and 1.5% against targets of 50%, 20%, 5% and 1%. The rungs land where I say they land, and the top rung is reached a little more often than the model expects, which is the viral tail again.

The backtest replays each campaign's actual day-7 views through the actual and proposed ladders. I fit leave-one-campaign-out so the proposal never sees the campaign's own posts (decisions 15, 22).

## 7. Assumptions and limits

- **The lognormal under-predicts extreme virality.** The p99 rung is conservative for true breakouts.
- **Tier spill in small campaigns.** A mid-tier campaign with macro creators in its mix also pays a macro ladder. One macro breakout can then take most of the budget at the macro top rung, and the lognormal tail underprices how often that happens. In leave-one-out replay, 5 of 40 campaigns went over budget, 4 of them mid-tier for this reason. The honest fix is a per-post cap relative to budget. I did not add it because it is a policy choice for ops.
- **One post per creator.** I ignore multi-posting.
- **Creator count is an input.** Wrong by 2x, the budget bound is wrong by roughly 2x.
- **Replay assumes unchanged behaviour.** Creators respond to incentives, so the completion-rate comparison is a lower bound on the effect.
- **Fraud labels are given, not detected.** My method is only as good as the flagging.
- **My method budgets for fraud but does not reduce it.** Flagged posts take a similar share of payout under the proposed ladder as under the actual one (about 20% in C02), because their inflated day-7 views are paid like any other. Cutting that share needs detection, which is out of scope.
- **The CPM table is an assumption.** In production it should come from the brand's media plan.
- **Quantile positions are my judgment,** deliberately. They are the part a human should own.
- **Day 7 under-counts long-form,** which keeps growing.
- **No time dynamics.** The ladder does not change mid-flight.

**What would break it.**

- A platform algorithm change, or a shift in what content the brand supplies, moves the view distribution. Thresholds fitted on old posts go stale, and the shrinkage keeps leaning on the old cells until the new ones have about 20 posts.
- A campaign whose views are not roughly lognormal, for example one with paid boosting, breaks the quantile placement and the budget bound at once.
- A creator count off by a factor of two moves the budget bound by about the same factor. My method has no defence against this beyond printing the count it used.
- A failure of fraud flagging. My method budgets for the flagged share it sees in history. If flagging stops catching a new pattern, both thresholds and bound drift upward with the bought views.
- Very small budgets against large creators: the top rung of a macro ladder can exceed the whole budget, and the 90% bound is then a single-post lottery.

**More data that would help:** the growth-curve and fraud signals in section 4; each creator's full posting history, for multi-posting and baselines; the brand's real media-plan CPMs; past ladder changes and what creators did next, to measure the behavioural response replay cannot see; and views beyond day 7 for long-form.
