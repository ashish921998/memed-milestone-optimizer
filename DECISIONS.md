# Decisions: Milestone Optimization for Brand Campaigns

Date: 2026-09-25. Status: 24 decisions agreed, nothing built yet.
Every choice below was made by Ashish in an interrogation session. Each row has the reason, so it can be defended live.

## The method in one paragraph

Given a new campaign (category, platform, budget, target creator tier, expected creator count, optional format mix and CPM override), fit a lognormal distribution of 7-day views for the matching (category, platform, format, tier) cell using only non-flagged historical posts, shrinking toward broader cells when the exact cell is sparse or empty. Place four thresholds at the 50th, 80th, 95th and 99th percentiles of that distribution. Set the cumulative payout at each rung to threshold x rate / 1000, where rate is the highest price per 1,000 views for which a Monte Carlo simulation of the whole campaign keeps total payout within budget in 90% of runs. Cap rate at 80% of the category's paid-media CPM and report any unspent headroom. Payouts are evaluated on day-7 views, and the top rung is the per-post cap.

## Decision log

| # | Decision | Chosen | Why | Rejected |
|---|----------|--------|-----|----------|
| 1 | What "optimized" means | Budget is the hard constraint; motivation, fairness, fraud, ROI are optimized inside it | Brief says "not just in expectation". A brand can forgive a stingy ladder, not a blown budget. Easiest to defend. | ROI-first (weak retention story). Retention-first (unpredictable spend). |
| 2 | Creator tiers | One ladder per tier (nano/micro/mid/macro); thresholds scale with tier reach, price per view stays constant | Simple to explain and enforce. A brand sees one ladder per tier, not one per creator. | Normalized-to-baseline ladder (gameable, confusing to brands). Single uniform ladder (the status quo problem). |
| 3 | View distribution model | Lognormal per cell | Heavy-tailed enough, two parameters, closed-form quantiles, fits from little data, standard and defensible. | Pareto (unstable mean hurts budget math). Bootstrap (no cold start, no model to validate). |
| 4 | Language | TypeScript | Ashish's fluency for the live walkthrough. | Python (would have given scipy for free). |
| 5 | Threshold placement | Fixed quantiles p50 / p80 / p95 / p99 | Every threshold has a plain-English meaning ("where the top 5% of posts land"). Answers "why 250K not 200K" with data. | Geometric spacing (magic ratio). |
| 6 | Payout curve | Flat price per 1K views, anchored to paid-media CPM | Every rupee is comparable to the brand's alternative. Virality earns no premium, so buying views to reach the top rung has no extra payoff. | Front-loaded (overpays low reach). Back-loaded (budget-volatile, fraud magnet). |
| 7 | Fraud handling | Built into the method: fit on non-flagged posts, pay on day-7 views, top rung caps per-post payout. Write-up lists growth-curve data needed for real detection. | Changes both the numbers and the incentives with almost no extra code. | Budget haircut only (no incentive change). Document only (brief says "account for it somehow"). |
| 8 | Budget engine | Monte Carlo, 5,000 runs | Honest about tail risk, handles caps and tiers trivially, "we ran it 5,000 times" is a sentence a brand manager understands. | Closed-form plus normal approximation (shaky with heavy tails and small creator pools). |
| 9 | Confidence level | 90% | 1 in 10 overshoot, by a bounded amount that is reported. Standard operating risk. | 95% (20-40% stingier). 80% (hard to say out loud to a brand). |
| 10 | Number of rungs | 4 | Matches historical 4-rung ladders so the backtest compares like with like. p50 first rung gives half of posts an early win. | 5 rungs (first rung too grindable). Variable (rung count becomes an output to explain). |
| 11 | Cold start | Hierarchical shrinkage: exact cell, then category+platform, then platform, then global, weighted by post count | One mechanism covers new categories and sparse cells. Textbook. | Nearest-neighbour campaigns (needs a similarity metric, fails on truly new category). Manual prior table (gut feel again). |
| 12 | Creator count | Input parameter; default is the median of similar historical campaigns | Ops knows the invite list. Keeps the model honest about what it predicts. | Always estimated (hides budget risk). Random per run (doubles variance). |
| 13 | Loose budget | Cap rate at the CPM anchor, report headroom, suggest more creators or longer campaign | Never pay above ad rates. Brand keeps its money. | Let rate rise (defends overpaying). Convert to creator slots (creator count becomes an output). |
| 14 | Synthetic data size | ~40 campaigns, ~600 creators, ~3,000 posts | Most cells have 20+ posts; some are sparse on purpose so shrinkage has something to show. CSVs stay readable. | 30K posts (unreadable, cold start has nothing to prove). 800 posts (too many empty cells). |
| 15 | Backtest proxy | Replay each post's actual day-7 views through the actual and proposed ladders | Pure arithmetic on held-out outcomes. Metrics: spend vs budget, share of posts clearing rung 1, share of creators earning anything, effective CPM. | Model-based reachability (model grading itself). |
| 16 | Tooling | Node (22.6+) running .ts natively, zero dependencies, hand-rolled normal math (Box-Muller sampling, erf-based CDF, Acklam inverse CDF) | About 40 lines of well-known formulas. Node 22.6+ strips types itself, so the reviewer runs `node src/cli.ts` with nothing to install, not even tsx. | simple-statistics (dependency for math that fits on one screen). Bun (extra hurdle if reviewer lacks it). |
| 17 | CPM anchor | Per-category default table of Indian paid-media CPMs, creators paid at 80% of it, overridable per campaign | Finance and gaming views are worth different amounts. Paid media comes with targeting guarantees creators do not give, hence the discount. Defaults stated as assumptions. | Single flat number. Required input with no default. |
| 18 | Status-quo ladders in synthetic data | Half the campaigns copy a house template regardless of tier; half use a follower-count heuristic with +/-50% noise | Two real failure modes, some campaigns will happen to be fine, and the backtest must show that too. Stated explicitly in the write-up. | Perturbing the method's own answer (circular). One template for all (one failure mode). |
| 19 | View measurement window | Day 7 | Short-form reach lands within a week, creators get paid fast, a bought spike has to sustain a week. Long-form under-count is flagged as a limit. | Day 30 (creators wait a month). Final (undefined while live). |
| 21 | Rate calculation | Direct: simulate once at rate 1, rate = budget / p90 of total paid views | Payout is linear in the rate, so the answer has a closed form. One simulation, exact, easy to explain. | Bisection search (searching for something with a closed form). |
| 22 | Backtest fitting | Leave-one-campaign-out: fit the view model on every campaign except the one being backtested | Section C says "pretending you don't know how they actually turned out". Fitting on the tested campaign's own posts contaminates the proposal. | Fitting on all history (leakage). |
| 23 | Viral tail in synthetic data | About 3% of posts get an extra 5x to 20x multiplier on top of the lognormal | Section 5 grades "validate rather than assert". If the data comes from the same lognormal the model fits, the validation is circular. The tail makes the fit check real and the limits section evidence-based. | Pure lognormal data (perfect fit, proves nothing). |
| 24 | Fraud in the budget simulation | Each Monte Carlo run draws the historical flagged share of posts from the flagged view distribution | Thresholds stay clean (decision 7) but the budget bound has to reflect that some bought views get paid before flagging catches them. One line, makes "budget is hard" honest. | Zero-fraud simulation (unrealistic, understates spend). |
| 20 | Packaging | One git repo, markdown docs, generated CSVs and backtest report | Three commands for the reviewer. Git history shows the work is Ashish's. | PDF exports (extra build step). Zip (no history). |

## Second-order defaults (veto any of these)

These were not asked because they are implementation detail, but they shape the results and will be stated in the write-up.

Synthetic data
- Tier mix of creators: nano 40%, micro 35%, mid 20%, macro 5%. Platform split 65% Instagram, 35% YouTube.
- Follower counts: lognormal inside each tier's band.
- Median day-7 views = followers x views-per-follower ratio (reel 0.30, carousel 0.15, short 0.50, long_form 0.10) x category multiplier (entertainment 1.3, gaming 1.1, D2C 1.0, FMCG 0.9, finance 0.6).
- Lognormal sigma around 1.1, so p99 is roughly 13x the median. Slightly higher on YouTube Shorts.
- Growth curve for clean posts: 24h is about 45% of day 7, day 30 is about 1.15x day 7, final about 1.2x day 7, all with noise.
- Flagged posts: 5% of posts. Day-7 views inflated 3x to 8x above what the account's history predicts, and 90%+ of those views land in the first 24 hours (the spike signature).
- Viral tail: 3% of clean posts get an extra multiplier drawn uniformly from 5x to 20x. This is the part the lognormal will not fit, on purpose (decision 23).
- One post per creator per campaign. Simplification, marked in code.
- Campaigns: 40, spread across 5 categories x 2 platforms. Budgets set the way a brand would: expected reach (about 65 creators x the tier's median views) priced at the category's creator CPM from the config table, times a tight/loose factor between 0.5 and 2.0, floor Rs 25K. So history holds both tight and loose budgets, and the budget assumption is the same CPM assumption the method uses, stated once. An earlier fixed Rs 1-25 lakh range made every campaign underspend, which would have made the backtest meaningless. 30 to 100 participating creators each.
- historical_completion_rate per creator = share of their past campaigns with at least one milestone hit, computed from the generated posts.

CPM anchor table (Rs per 1,000 views, paid media, Instagram / YouTube)
- finance 250 / 300
- FMCG 90 / 120
- D2C 110 / 140
- gaming 60 / 80
- entertainment 50 / 70
- Creators paid at 80% of these.

Backtest selection rule, not hand-picked
- The campaign with the highest actual spend to budget ratio (blew budget).
- The campaign with the lowest completion rate (underpaid, creators gave up).
- The campaign closest to the median spend ratio (was roughly fine).
- One campaign whose exact cell has fewer than 10 posts (exercises cold start).

Monte Carlo
- Fit uses every campaign except the one being recommended for, when that campaign exists in history (decision 22).
- Each run also draws the historical flagged share of posts (about 5%) from the flagged distribution, so the budget bound includes fraud leakage (decision 24).
- 5,000 runs. Each run draws N creators from the campaign's tier mix (default all target tier), one post each, views from the fitted lognormal, ladder applied at rate 1, sum the paid views. Payout is linear in rate, so rate = budget / 90th percentile of total paid views x 1000. No search needed.

## What each deliverable contains

- A. docs/methodology.md: definition of optimized, weighting, the pipeline, view model and its validation on synthetic data (Q-Q style check of lognormal fit per cell), cold start, assumptions, limits.
- B. src/: generate-data, fit, recommend, backtest. Run with npx tsx. Input is a JSON file of campaign parameters, output is a JSON ladder plus a printed table.
- C. docs/backtest.md: generated by the code with real numbers for the four selected campaigns.
- D. docs/one-pager.md: plain language, no formulas, with the three places it can still be wrong.
- README.md: three commands to run everything.

## Known limits to state in the write-up

- Lognormal under-predicts extreme virality. The p99 rung will be conservative for true breakouts.
- One post per creator ignores multi-posting creators.
- Creator count is an input. If ops is wrong by 2x, the budget bound is wrong by roughly 2x.
- Backtest replay assumes creators would have posted the same content under a different ladder. Real creators respond to incentives, so the completion-rate comparison is a lower bound on the behavioural effect.
- Fraud labels are given, not detected. The method is only as good as the flagging.
- CPM table is an assumption. In production it should come from the brand's actual media plan.
- Quantile positions (p50/p80/p95/p99) are fixed by judgment, not optimized. That is deliberate: they are the part a human should own.
- No within-campaign time dynamics. The ladder does not change mid-flight.

## Environment

Node v26.8.1, npm 11.19.0, git 2.50.1 available. Bun also present but not used.

## Next step

Ashish says go. Then build in this order: data generator, fitter, recommender, backtest, docs. Each step runnable on its own.
