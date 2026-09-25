# Methodology

How the recommender turns a new campaign into a milestone ladder, why each step is there, and where it can break. Decision numbers refer to [DECISIONS.md](../DECISIONS.md). Every threshold and rupee figure below comes from running `node src/cli.ts` on the generated data.

## 1. What "optimized" means

Budget is the hard constraint. Motivation, fairness, fraud resistance and ROI are optimized inside it (decision 1). The brief asks for budget adherence "not just in expectation", and a brand can forgive a stingy ladder but not a blown budget. ROI-first was rejected because it has a weak retention story. Retention-first was rejected because spend becomes unpredictable.

The five tradeoffs, in that priority order:

**Budget adherence with a confidence level.** The price per view is set so total payout stays within budget in 90% of 5,000 simulated runs of the campaign (decisions 8, 9). The simulation includes the tier mix, the format mix and fraud leakage. The top rung caps what any one post can earn. Not done: a 100% guarantee, which would need a hard stop mid-campaign or a far stingier ladder. 95% was rejected as 20 to 40% stingier. The CLI prints spend at p50, p90 and mean; it does not yet print how far the worst 10% of runs overshoot.

**Creator motivation and retention.** Rung 1 sits at the median, so half of posts earn something (decision 10). The later rungs sit where one in five, one in twenty and one in a hundred posts land, so each gap is a real step but not an unreachable one. In the worked example the gaps are 2.8x, 2.6x and 2.3x. A flat price per view means every extra view is worth the same, so no gap feels arbitrary. Not done: a fifth rung (the first rung becomes too grindable), streak or loyalty bonuses, and any model of how creators change behaviour when the ladder changes.

**Fairness across tiers.** Each tier in the campaign gets its own ladder, placed at that tier's own quantiles, and every ladder pays the same price per view (decision 2). A nano creator's rung 1 is as reachable for them as a mid creator's rung 1 is for the mid creator. Not done: a per-creator ladder normalized to each creator's baseline. It was rejected as gameable (depress your baseline, then beat it) and confusing to brands. Differences inside a tier band are not equalized.

**Fraud and gaming resistance.** Thresholds are fitted on non-flagged posts only, payouts use day-7 views, and the top rung is the per-post cap (decision 7). The budget simulation draws the historical flagged share of posts from the flagged view distribution, so bought views that get paid before flagging catches them are in the budget bound (decision 24). Not done: fraud detection. Flags are taken as given.

**Marginal ROI against paid-media CPM.** The price per view can never exceed 80% of the category's paid-media CPM (decision 17). The discount exists because paid media comes with targeting guarantees creators do not give. When the budget could pay more, the method pays the cap and reports the unspent headroom (decision 13). Not done: any model of view quality or conversion. The CPM table is an assumption.

## 2. The pipeline

### Inputs

| Input | Required | Default when missing |
|---|---|---|
| category, platform, total budget, target tier | yes | none |
| expected creators | no | median creator count of historical campaigns in the same category and platform, else same platform, else all (decision 12) |
| format mix | no | historical format shares on that platform |
| tier mix | no | historical share of participant tiers in campaigns with the same target tier |
| CPM override | no | `CPM_TABLE` in `src/config.ts` |

Creator count is an input, not something the model predicts, because ops knows the invite list (decision 12). Estimating it would hide budget risk.

### View model

For each (category, platform, format, tier) cell, day-7 views of non-flagged posts are fitted with a lognormal: the mean and standard deviation of log views (decision 3). Lognormal is heavy-tailed enough, has two parameters, fits from little data and is standard. Pareto was rejected because its unstable mean hurts budget math. A bootstrap was rejected because it has no cold start and no model to validate.

Sparse cells are shrunk toward broader ones (decision 11). The fitter walks five levels, broadest first:

1. global
2. tier
3. platform and tier
4. category, platform and tier
5. category, platform, format and tier (the exact cell)

At each level with n posts, the running estimate is blended with that level's own estimate using weight n / (n + 20). The pseudo-count of 20 is in `src/config.ts`. Both the log-mean and sigma are blended this way.

Tier stays in every level below global because reach scales with followers, and the tier bands are each ten times the one below. In the example, the global sigma of log views is 2.48; blending in the tier level brings it to 1.46. If a sparse micro cell shrank toward a pool without tier, it would be pulled toward other tiers' reach.

### Thresholds

The four thresholds are the p50, p80, p95 and p99 of the tier's view distribution, mixed across formats by the format mix (decision 5). Because a mixture of lognormals has no closed-form quantile, the code draws 200,000 views from the mixture and reads the quantiles off the sample. Thresholds are rounded to 3 significant figures because brands read round numbers.

| Rung | Quantile | Plain English |
|---|---|---|
| 1 | p50 | half of posts reach it |
| 2 | p80 | one post in five reaches it |
| 3 | p95 | one post in twenty reaches it |
| 4 | p99 | one post in a hundred reaches it; also the per-post cap |

Fixed quantiles answer "why 250K and not 200K" with data. Geometric spacing was rejected because it needs a magic ratio. The quantile positions themselves are a judgment call that a human should own.

### Tiers

There is one ladder for every tier in the campaign's tier mix, plus the target tier always. All ladders share one rate. The tier mix can be passed in (`--tier-mix micro:0.7,mid:0.3`); otherwise it is the historical mix for that target tier. The mix matters for budget: more big creators means more paid views, so the shared rate falls.

### Payouts

The cumulative payout at each rung is threshold x rate / 1000, rounded to the rupee (decision 6). That rounding is why the printed per-1K column wobbles in the second decimal. A flat rate makes every rupee comparable to the brand's paid-media alternative. It also means virality earns no premium, so buying views to reach the top rung pays no better per view than earning them. Front-loaded curves overpay low reach; back-loaded curves are budget-volatile and attract fraud.

The rate is calculated directly (decision 21). The simulation runs once at a rate of Rs 1 per view, so each post's payout equals the threshold views it cleared. Payout is linear in the rate, so:

rate per 1K = budget / (p90 of total paid views across runs) x 1000

No search is needed because the answer has a closed form. The rate is then capped at 80% of the CPM anchor.

### Budget simulation

5,000 runs (decision 8). In each run, for each of N expected creators:

1. draw a tier from the tier mix;
2. with probability equal to the historical flagged share (5.1% in this data), draw views from the flagged-post lognormal for that platform and tier; otherwise draw a format from the format mix and views from that clean cell's fit;
3. apply that tier's ladder at rate 1 and add the payout to the run total.

One post per creator. The random seed is fixed, so the same input always gives the same ladder.

### Worked examples

Gaming, Instagram, micro target, 73 creators (the historical default), default format mix.

| Run | Tier mix | Rate per 1K | Micro ladder (views) | Micro payouts (Rs) | Spend p50 / p90 |
|---|---|---|---|---|---|
| Budget Rs 40,000 | nano 16%, micro 68%, mid 17% (default) | 11.20 | 10,100 / 27,900 / 73,600 / 1,68,000 | 113 / 312 / 824 / 1,881 | Rs 21,916 / Rs 40,000 |
| Budget Rs 40,000 | micro 70%, mid 30% (passed in) | 7.77 | 10,100 / 28,000 / 74,000 / 1,70,000 | 78 / 218 / 575 / 1,321 | Rs 24,333 / Rs 40,000 |
| Budget Rs 4,00,000 | default | 48.00 (capped) | 10,100 / 27,900 / 73,600 / 1,68,000 | 485 / 1,339 / 3,533 / 8,064 | Rs 93,963 / Rs 1,71,499 |

In the first run the other tiers get their own ladders at the same Rs 11.20: nano at 970 / 2,660 / 6,970 / 15,900 views, mid at 82,100 / 2,47,000 / 7,18,000 / 17,70,000 views. Raising the mid share to 30% drops the rate from Rs 11.20 to Rs 7.77, because mid creators are expected to take more of the budget.

### Loose budgets

In the third run the budget could pay far more than the cap of Rs 48 per 1K (Rs 60 CPM x 0.8). The method pays the cap and reports Rs 2,28,501 unspent at the p90 bound, with a suggestion to add creators or extend the campaign (decision 13). Letting the rate rise would mean defending paying creators more than ads cost. Converting surplus into creator slots would make creator count an output.

## 3. Cold start

The shrinkage block from the Rs 40,000 run shows the mechanism. Medians are exp(mu) after each level's blend.

| Level | n | Weight on this level | Median | Sigma |
|---|---|---|---|---|
| global | 2,530 | base | 9,009 | 2.48 |
| micro | 951 | 98% | 10,528 | 1.46 |
| instagram / micro | 408 | 95% | 9,311 | 1.29 |
| gaming / instagram / micro | 130 | 87% | 9,638 | 1.24 |
| gaming / instagram / reel / micro | 92 | 82% | 11,041 | 1.19 |
| gaming / instagram / carousel / micro | 38 | 66% | 7,502 | 1.26 |

The reel cell has 92 posts, so its own data carries 82% of the weight. The carousel cell has 38, so a third of its estimate still comes from the gaming/instagram/micro level above it. A cell with 20 posts would get half its weight from its own data.

The same mechanism covers every cold start. A new category has no posts at levels 4 and 5, so the estimate stops at platform and tier (median 9,311, sigma 1.29 in this example). A new format in a known category stops at level 4. Nothing needs a separate code path. Nearest-neighbour campaigns were rejected because they need a similarity metric and fail on a truly new category. A manual prior table would be gut feel again.

## 4. Fraud

Three levers change both the numbers and the incentives (decision 7):

1. **Clean fit.** Flagged posts never move a threshold, so bought views cannot drag the ladder up.
2. **Day-7 views.** A bought spike has to hold for a week before it is paid (decision 19).
3. **Top rung is the cap.** No post earns more than the p99 payout, and the flat rate gives no premium for going viral.

The budget simulation then includes flagged posts at their historical share, because some will be paid before flagging catches them (decision 24).

Real detection needs growth-curve data this method does not use:

- the 24-hour to 7-day view ratio (in the synthetic data, clean posts get about 45% of day-7 views in 24 hours and flagged posts 90 to 98%);
- account history: views against the account's own past average, and account age;
- engagement-to-view ratio;
- referral or traffic source for the views.

## 5. Synthetic data

`src/generate-data.ts` writes 40 campaigns, 600 creators and 2,666 posts with a fixed seed. Every distributional choice:

| Aspect | Assumption |
|---|---|
| Creator tiers | nano 40%, micro 35%, mid 20%, macro 5% |
| Platform | 65% Instagram, 35% YouTube |
| Followers | lognormal inside the tier band (1K-10K, 10K-100K, 100K-1M, 1M-10M), centred on the band's geometric midpoint, band edges at 2 sigma, redrawn until inside |
| Creator quality | a per-creator lognormal factor (sigma 0.4) that persists across their posts |
| Median day-7 views | followers x views per follower (reel 0.30, carousel 0.15, short 0.50, long-form 0.10) x category (entertainment 1.3, gaming 1.1, D2C 1.0, FMCG 0.9, finance 0.6) x quality |
| Spread | lognormal sigma 1.1, 1.2 on YouTube Shorts |
| Format mix | Instagram reel 75% / carousel 25%; YouTube short 70% / long-form 30% |
| Clean growth | 24h about 45% of day 7 (plus or minus 10 points), day 30 about 1.15x, final about 1.2x, with noise |
| Flagged posts | 5% of posts; day-7 views multiplied by 3x to 8x; 90 to 98% of day-7 views land in the first 24 hours |
| Viral tail | 3% of clean posts multiplied by a further 5x to 20x |
| Participation | 30 to 100 creators wanted per campaign; 70% from the target tier, 30% from an adjacent tier, spilling into any near tier when a pool runs out; one post per creator per campaign |
| Completion rate | share of a creator's posts that hit at least one rung of the historical ladder |

The quality factor widens each cell beyond sigma 1.1, which is why fitted sigmas land near 1.2.

**Viral tail.** The tail is planted on purpose (decision 23). If the data came from the same lognormal the model fits, the validation would be circular. The tail is the part the lognormal will not fit, which makes the fit check real and the limits evidence-based.

**Status-quo ladders.** Two modes, so the backtest has two real failure modes and some campaigns that happen to be fine (decision 18). Even-numbered campaigns use a house template regardless of tier: 10K / 50K / 100K / 500K views for Rs 500 / 2,000 / 5,000 / 15,000. Odd-numbered campaigns use a follower heuristic: rung 1 at half the tier's median follower count, x3 per rung, a rate drawn from Rs 40 to 120 per 1K, and plus or minus 50% noise on every threshold and payout.

**Budgets.** Set the way a brand would: expected reach (65 creators x the tier's typical views) priced at the category's creator CPM (80% of the table), times a tight/loose factor between 0.5 and 2.0, floor Rs 25,000. History therefore holds both tight and loose budgets. This is the same CPM assumption the method uses, stated once. An earlier fixed range of Rs 1 to 25 lakh made every campaign underspend, which made the backtest meaningless.

## 6. Validation

The fit is checked, not asserted. [docs/backtest.md](backtest.md) has a table comparing each tier's fitted quantiles with the observed share of clean posts above them. If the lognormal were right, 1% of posts would land above the fitted p99. The observed share above fitted p99 is {{BACKTEST}} (observed share of clean posts above fitted p99, per tier, from the validation table). The excess above 1% is the planted viral tail showing through, and it is the evidence behind the first limit below.

The backtest replays each historical campaign's actual day-7 views through the actual and proposed ladders, with the proposal fitted leave-one-campaign-out so it never sees the campaign's own posts (decisions 15, 22).

## 7. Assumptions and limits

- **The lognormal under-predicts extreme virality.** The p99 rung is conservative for true breakouts.
- **Tier spill in small campaigns.** A mid-tier campaign also pays a macro ladder when its tier mix includes macro creators. One macro breakout post can then take most of the budget at the macro top rung, and the lognormal tail underprices how often that happens. In leave-one-out replay, 5 of 40 campaigns went over budget, 4 of them mid-tier for this reason. The honest fix is a per-post cap relative to budget. It was not added because it is a policy choice for ops, not a modelling one.
- **One post per creator.** Multi-posting creators are ignored.
- **Creator count is an input.** If ops is wrong by 2x, the budget bound is wrong by roughly 2x.
- **Replay assumes unchanged behaviour.** Creators would really respond to a different ladder, so the completion-rate comparison is a lower bound on the behavioural effect.
- **Fraud labels are given, not detected.** The method is only as good as the flagging.
- **The CPM table is an assumption.** In production it should come from the brand's media plan.
- **Quantile positions are judgment.** p50 / p80 / p95 / p99 are fixed deliberately; they are the part a human should own.
- **Day 7 under-counts long-form,** which keeps growing after a week.
- **No time dynamics.** The ladder does not change mid-flight.

**More data that would help:** growth curves at finer intervals and the fraud signals in section 4; each creator's full posting history, to model multi-posting and baselines; the brand's actual media plan CPMs; ladders that were changed and what creators did next, to measure the behavioural response the replay cannot see; and, for long-form, views beyond day 7.
