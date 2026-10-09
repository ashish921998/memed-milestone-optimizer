# Milestone Ladders: One Page

## What it does

Give it the campaign: category, platform, budget, the size of creator you are targeting, and roughly how many creators will post. It gives back a four-step milestone ladder for each creator size in the campaign (views needed, and what the creator has earned on reaching each step) and a promise: nine times out of ten, total payouts stay within the budget. I put the budget first because a brand can forgive a stingy ladder but not a blown one.

## How it decides

- **Steps sit where posts actually land.** I put the first step where half of posts reach it, the second where one in five do, the third one in twenty, the top one in a hundred. Every number comes from past posts of that size, on that platform, in that category.
- **Every step pays the same price per view, and that price never exceeds what the brand's ads cost.** I pay creators at most 80% of the brand's paid-media price for the same views.
- **It rehearses the campaign 5,000 times** with realistic ups and downs, and sets the price so the budget holds in nine of ten rehearsals.
- **Small and big creators get ladders scaled to their reach, at the same price per view.** A small creator's first step is as reachable for them as a big creator's is for them.
- **I keep suspicious posts out of the numbers, pay on week-one views, and budget for the share of bought views that slips through.** The method does not catch fraud itself. It stops fraud from inflating the thresholds and keeps it inside the budget promise. The top step is also the most any one post can earn.

## Why this beats how ladders are set today

| Today | What goes wrong | What my method does |
|---|---|---|
| Ladders set by feel | Budgets get blown when a few posts do well | Sizes the price so the budget holds nine times in ten |
| One house ladder for every creator size | Small creators never reach the first step and give up; big creators clear every step | Each size gets its own ladder at the same price per view |
| Payouts guessed from follower counts | Price per view swings from campaign to campaign, sometimes above what ads cost | One price, never above the ad benchmark; any spare budget is reported |

No real Meme'd data was available, so I built a synthetic history of 40 campaigns, 600 creators and about 2,700 posts, with the view patterns and fraud behaviour described in the methodology. I then replayed every campaign through its old ladder and through the ladder my method would have proposed without seeing that campaign:

| Measure | Actual ladders | Proposed ladders |
|---|---|---|
| Campaigns within budget | 21 of 40 | 35 of 40 |
| Total spend | Rs 1.03 crore | Rs 1.34 crore |
| Creators who earned something | 44% | 51% |

Total spend goes up because 21 of the 40 campaigns had been paying out below budget, 13 of them below half, and most of the increase is one large campaign that had been paying almost nothing. Across the 40, my ladder pays less than the old one in 29 and more creators earn something in 26. Five campaigns still end over budget. That is 12.5%, slightly above the one-in-ten the promise allows, and with only 40 campaigns a count that high happens about a third of the time even when the promise holds exactly. Four of the five are the viral-post case below.

The replay assumes creators post the same content under either ladder. Real creators respond to better ladders, so the gain in completion is likely understated.

## Where it can still be wrong

- **One viral post from a big creator in a small campaign can eat the budget.** In the replay this caused most of the overruns. A per-post limit tied to the budget would fix it. I left it out because that is a policy call for ops.
- **It needs a rough creator count.** If that count is out by a factor of two, the budget promise is out by about the same.
- **It inherits whatever fraud flagging misses.** Unflagged bought views look like real ones.
- **The price benchmark is my assumption** until the brand supplies its own media plan.

## What to do with it

I recommend it as the default ladder for every campaign. Override it when there is a reason, and log the reason.
