# Milestone optimization for brand campaigns

Given a new campaign's parameters, this recommender outputs a milestone ladder of four (view threshold, cumulative payout) pairs. The ladder keeps total spend within budget with 90% confidence. It pays creators at a rate tied to what the brand would pay for the same reach in paid media, and it places thresholds where posts in that tier land.

The project has no dependencies. Node 22.18 or newer (or 23.6+) runs the TypeScript directly. On older Node, replace `node` with `npx tsx` in every command below, and nothing else changes.

## Run it

```bash
node src/generate-data.ts        # writes data/*.csv (synthetic history, fixed seed)
node src/cli.ts examples/campaign.json
node src/backtest.ts             # writes docs/backtest.md (about 25 s: 40 campaigns x 5,000 simulated runs)
npm test                         # self-checks for the math and the fitter
```

You can also pass the campaign as flags:

```bash
node src/cli.ts --category finance --platform instagram --budget 800000 --tier micro --creators 60
```

The same method also runs in a browser, behind a form:

```bash
node src/serve.ts
```

Then open http://localhost:8787. The form is optional, and the command line is the main interface.

To run on your own sample, point any command at a folder with the same four CSVs and the column names in [src/types.ts](src/types.ts): `node src/cli.ts examples/campaign.json --data path/to/csvs`, `node src/backtest.ts --data path/to/csvs`, or `DATA_DIR=path/to/csvs node src/serve.ts`. The CSV reader handles quoted fields. Posts need `views_at_7d` and `flagged_suspicious`, and the other columns are read as they are.

`--cpm <Rs per 1K views>` overrides the paid-media anchor. `--exclude <campaign_id>` fits on history without that campaign, which is how the backtest uses it. `--json` prints the full recommendation object.

## Read it

- [docs/one-pager.md](docs/one-pager.md): what the method does and why, written for a brand manager or founder. Start here.
- [docs/methodology.md](docs/methodology.md): definition of "optimized", the model, threshold and payout logic, cold start, validation, assumptions, limits.
- [docs/backtest.md](docs/backtest.md): four historical campaigns, each with its proposed and actual ladder and the numbers. `src/backtest.ts` generates it.
- [DECISIONS.md](DECISIONS.md): every design decision, with my reason and the alternative I rejected.

## Layout

```
src/
  types.ts          data contracts (CSV columns) and the recommendation shape
  config.ts         every human-chosen number: percentiles, confidence, CPM table
  stats.ts          normal-distribution math, seeded RNG (hand-rolled, tested)
  csv.ts            tiny CSV read/write
  generate-data.ts  synthetic history
  fit.ts            lognormal fit per cell with hierarchical shrinkage
  recommend.ts      thresholds, Monte Carlo budget check, payouts
  cli.ts            command line
  serve.ts          optional local web form in front of the same recommender
  backtest.ts       replay historical campaigns through both ladders
data/               generated CSVs
docs/               write-ups
examples/           sample input
```
