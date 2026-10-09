# Decisions: milestone optimization for brand campaigns

Date: 2026-09-25. All 24 decisions below are built.
This is my record of every design choice in the method, with the reason I made it and what I rejected. Where the brief was ambiguous, I made a choice and wrote it down here instead of asking.

## The method in one paragraph

The method takes a new campaign's category, platform, budget, target creator tier and expected creator count, plus an optional format mix and CPM override. It fits a lognormal distribution of 7-day views for the matching (category, platform, format, tier) cell using only non-flagged historical posts, and shrinks toward broader cells when the exact cell is sparse or empty. It places four thresholds at the 50th, 80th, 95th and 99th percentiles of that distribution. The cumulative payout at each rung is threshold x rate / 1000. The rate is the highest price per 1,000 views at which a Monte Carlo simulation of the whole campaign keeps total payout within budget in 90% of runs. The method caps the rate at 80% of the category's paid-media CPM and reports any unspent headroom. Payouts use day-7 views, and the top rung is the per-post cap.

## Decision log

Each row gives what I decided, why, and what I turned down.

| # | Decision | Chosen | Why | Rejected |
|---|----------|--------|-----|----------|
| 1 | What "optimized" means | Budget is the hard constraint. Motivation, fairness, fraud and ROI are optimized inside it | The brief says "not just in expectation". A brand will accept a ladder that pays too little more readily than an overspent budget. | ROI-first, which says little about retention. Retention-first, which makes spend unpredictable. |
| 2 | Creator tiers | One ladder per tier (nano/micro/mid/macro). Thresholds scale with tier reach, and the price per view stays constant | A brand sees one ladder per tier instead of one per creator, which is easier to explain and to enforce. | A ladder normalized to each creator's baseline, which creators can game and brands find confusing. A single uniform ladder, which is the status-quo problem. |
| 3 | View distribution model | Lognormal per cell | It is heavy-tailed enough, has two parameters and fits from little data. Thresholds come from 200,000 samples of the format mixture rather than a closed form, because a mixture of lognormals has no closed-form quantile. | Pareto, whose unstable mean hurts the budget math. Bootstrap, which has no cold start and no model to validate. |
| 4 | Language | TypeScript | It is the language I know best, so I can explain every line. | Python, which would have given me scipy for free. |
| 5 | Threshold placement | Fixed quantiles p50 / p80 / p95 / p99 | Each threshold has a meaning a brand can read, such as "where the top 5% of posts land". It answers "why 250K not 200K" with data. | Geometric spacing, which needs a ratio the data does not supply. |
| 6 | Payout curve | Flat price per 1K views, anchored to paid-media CPM | Every rupee is comparable to what the brand would spend on paid media. Virality earns no premium, so buying views to reach the top rung has no extra payoff. | Front-loaded, which overpays low reach. Back-loaded, which makes spend volatile and rewards bought views. |
| 7 | Fraud handling | Handled inside the method. Thresholds are fitted on non-flagged posts, payment uses day-7 views, and the top rung caps per-post payout. The methodology lists the growth-curve data that real detection would need. | It changes both the numbers and the incentives with almost no extra code. | A budget haircut alone, which changes no incentive. Documentation alone, when the brief says "account for it somehow". |
| 8 | Budget engine | Monte Carlo, 5,000 runs | It shows tail risk directly and handles caps and tiers with no extra math. A brand manager understands "we ran it 5,000 times". | A closed form with a normal approximation, which is unreliable with heavy tails and small creator pools. |
| 9 | Confidence level | 90% | 1 in 10 campaigns may overshoot, and the recommender reports by how much. | 95%, which I measured at 12 to 16% stingier. 80%, because a one-in-five overshoot is hard to put to a brand. |
| 10 | Number of rungs | 4 | Historical ladders have 4 rungs, so the backtest compares like with like. A first rung at p50 gives half of posts an early win. | 5 rungs, which make the first rung too grindable. A variable count, which becomes one more output to explain. |
| 11 | Cold start | Hierarchical shrinkage: global, then tier, then platform+tier, then category+platform+tier, then the exact cell with format. Each level blends with its parent at weight n/(n+20) | The same mechanism covers new categories and sparse cells. I keep tier at every level because reach scales with followers, so a prior without tier would be far off. A pseudo-count of 20 means a cell needs 20 posts to count as much as its parent. | Nearest-neighbour campaigns, which need a similarity metric and fail on a new category. A manual prior table, which brings gut feel back. |
| 12 | Creator count | Input parameter, defaulting to the median of similar historical campaigns | Ops knows the invite list. Taking it as an input leaves the model to predict views only. | Always estimated, which hides budget risk. Random per run, which doubles the variance. |
| 13 | Loose budget | Cap rate at the CPM anchor, report headroom, suggest more creators or a longer campaign | Creators never cost more per view than ads, and the brand keeps the unspent money. | Letting the rate rise, which overpays. Converting the surplus into creator slots, which makes creator count an output. |
| 14 | Synthetic data size | About 40 campaigns, 600 creators and 3,000 posts | Most cells have 20+ posts, and some are sparse on purpose so shrinkage has work to do. The CSVs stay small enough to read. | 30K posts, too many to read and enough data that cold start never arises. 800 posts, which leave too many empty cells. |
| 15 | Backtest proxy | Replay each post's actual day-7 views through the actual and proposed ladders | It is arithmetic on held-out outcomes. The metrics are spend against budget, share of posts clearing rung 1, share of creators earning anything, and effective CPM. | Model-based reachability, where the model would grade itself. |
| 16 | Tooling | Node (22.18+) running .ts natively, zero dependencies, hand-rolled normal math (Box-Muller sampling, erf-based CDF, Acklam inverse CDF) | The math is about 40 lines of well-known formulas. Node 22.18+ strips types itself, so the reviewer runs `node src/cli.ts` with nothing to install. On older Node, `npx tsx` is the fallback. | simple-statistics, a dependency for math that fits on one screen. Bun, which the reviewer may not have. |
| 17 | CPM anchor | Per-category default table of Indian paid-media CPMs, creators paid at 80% of it, overridable per campaign | Finance and gaming views are worth different amounts. The discount reflects that paid media comes with targeting guarantees creators do not give. The defaults are my assumptions until a brand supplies its own. | A single flat number. A required input with no default. |
| 18 | Status-quo ladders in synthetic data | Half the campaigns copy a house template regardless of tier. The other half use a follower-count heuristic with +/-50% noise | This gives two failure modes seen in practice, and some campaigns happen to be fine, which the backtest also has to show. The methodology describes both. | Perturbing the method's own answer, which is circular. One template for all, which gives one failure mode. |
| 19 | View measurement window | Day 7 | Short-form reach arrives within a week. Creators get paid quickly, and flagging has a week to run before money moves. I list the long-form under-count as a limit. | Day 30, which makes creators wait a month. Final views, which are undefined while a post is live. |
| 20 | Packaging | One git repo, markdown docs, generated CSVs and backtest report | The reviewer can run everything with four commands, and the git history shows the order in which I built the work. | PDF exports, which add a build step. A zip file, which has no history. |
| 21 | Rate calculation | Direct: simulate once at rate 1, rate = budget / p90 of total paid views | Payout is linear in the rate, so the answer has a closed form. It needs one simulation and gives an exact answer. | Bisection search, which searches for a value the closed form gives directly. |
| 22 | Backtest fitting | Leave-one-campaign-out: fit the view model on every campaign except the one being backtested | Section C says "pretending you don't know how they actually turned out". Fitting on the tested campaign's own posts would leak its outcome into the proposal. | Fitting on all history, which leaks the outcome. |
| 23 | Viral tail in synthetic data | About 3% of posts get an extra 5x to 20x multiplier on top of the lognormal | Section 5 grades "validate rather than assert". If the data comes from the same lognormal the model fits, the validation is circular. The tail gives the fit check something to fail on and gives the limits section measured evidence. | Pure lognormal data, which fits perfectly and proves nothing. |
| 24 | Fraud in the budget simulation | Each Monte Carlo run draws the historical flagged share of posts from the flagged view distribution | Thresholds stay clean (decision 7), but the budget bound has to include bought views that get paid before flagging catches them. It is one line of code, and without it the budget is not a hard constraint. | A zero-fraud simulation, which understates spend. |

## Second-order defaults

These are implementation details rather than design decisions, but they shape the results, so I state them here and in the methodology.

Synthetic data
- Tier mix of creators: nano 40%, micro 35%, mid 20%, macro 5%. Platform split 65% Instagram, 35% YouTube.
- Follower counts are lognormal inside each tier's band.
- Median day-7 views are followers x views-per-follower ratio (reel 0.30, carousel 0.15, short 0.50, long_form 0.10) x category multiplier (entertainment 1.3, gaming 1.1, D2C 1.0, FMCG 0.9, finance 0.6).
- Lognormal sigma is around 1.1, so p99 is roughly 13x the median. It is slightly higher on YouTube Shorts.
- Growth curve for clean posts: 24h is about 45% of day 7, day 30 is about 1.15x day 7, final about 1.2x day 7, all with noise.
- Flagged posts are 5% of posts. Their day-7 views are inflated 3x to 8x above what the account's history predicts, and 90%+ of those views land in the first 24 hours, which is the spike signature.
- Viral tail: 3% of clean posts get an extra multiplier drawn uniformly from 5x to 20x. The lognormal will not fit this part, and I added it for that reason (decision 23).
- One post per creator per campaign. This is a simplification, marked in the code.
- Campaigns: 40, spread across 5 categories x 2 platforms. I set budgets the way a brand would: expected reach (65 creators x the geometric midpoint of the tier's follower band x a blended views-per-follower of 0.26 on Instagram and 0.38 on YouTube x the category multiplier) priced at the category's creator CPM from the config table, times a tight or loose factor between 0.5 and 2.0, with a floor of Rs 25K. History therefore holds both tight and loose budgets, and the budgets use the same CPM assumption as the method. An earlier fixed Rs 1-25 lakh range made every campaign underspend, which would have made the backtest meaningless. Each campaign has 30 to 100 participating creators.
- historical_completion_rate per creator is the share of their past campaigns with at least one milestone hit, computed from the generated posts.

CPM anchor table (Rs per 1,000 views, paid media, Instagram / YouTube)
- finance 250 / 300
- FMCG 90 / 120
- D2C 110 / 140
- gaming 60 / 80
- entertainment 50 / 70
- Creators are paid 80% of these.

Backtest campaigns, chosen by rule rather than by hand
- The campaign with the highest ratio of actual spend to budget (it blew its budget).
- The campaign with the lowest completion rate (it underpaid and creators gave up).
- The campaign closest to the median spend ratio (it was roughly fine).
- One campaign whose exact cell has fewer than 10 posts (it exercises cold start).

Monte Carlo
- The fit uses every campaign except the one being recommended for, when that campaign exists in history (decision 22).
- Each run also draws the historical flagged share of posts (about 5%) from the flagged distribution, so the budget bound includes fraud leakage (decision 24).
- There are 5,000 runs. Each run draws N creators from the campaign's tier mix. The default mix is the historical tier mix of campaigns with the same target tier, because about 30% of participants come from adjacent tiers and ignoring them blew the budget in 20 of 40 replays. Each creator makes one post, paid on their own tier's ladder, with views from the fitted lognormal. The run applies the ladder at rate 1 and sums the paid views. Payout is linear in rate, so rate = budget / 90th percentile of total paid views x 1000, and no search is needed.

## What each deliverable contains

What I built against the brief:

- A. docs/methodology.md covers the definition of optimized, the weighting, the pipeline, the view model, cold start, assumptions and limits. Its validation has an in-sample quantile check per tier and a held-out rung calibration across all 40 campaigns.
- B. src/ holds generate-data, fit, recommend and backtest. Each runs with `node src/<file>.ts` and needs no install. Input is a JSON file of campaign parameters, and output is a JSON ladder plus a printed table.
- C. docs/backtest.md is generated by the code, with computed numbers for the four selected campaigns.
- D. docs/one-pager.md is written for a brand manager and lists where the method can still be wrong.
- README.md gives four commands to run everything, plus an optional local web form.

## Known limits I state in the write-up

- I found this while building. With tier spill, one macro-tier breakout in a mid-tier campaign can take most of the budget at the macro top rung. Leave-one-out replay put 5 of 40 campaigns over budget, 4 of them mid-tier for this reason. The fix is a per-post cap relative to budget. I have not added it because the cap's size is a policy choice, and I want ops to set it with me.
- I also found that the method budgets for fraud but does not reduce it. Flagged posts take a similar share of payout under the proposed ladder as under the actual one (about 20% in C02), because their inflated day-7 views are paid like any other. Reducing that share needs detection, which is out of scope.

- The lognormal under-predicts extreme virality. The p99 rung will be conservative for true breakouts.
- Assuming one post per creator ignores creators who post more than once.
- Creator count is an input. If ops is wrong by 2x, the budget bound is wrong by roughly 2x.
- Backtest replay assumes creators would have posted the same content under a different ladder. Real creators respond to incentives, so the completion-rate comparison is a lower bound on the behavioural effect.
- Fraud labels are given, not detected. The method is only as good as the flagging.
- The CPM table is an assumption. In production it should come from the brand's actual media plan.
- I fixed the quantile positions (p50/p80/p95/p99) by judgment. The method does not optimize them.
- The method has no time dynamics within a campaign. The ladder does not change mid-flight.
