# Milestone Ladders: One Page

## What it does

Give it the campaign: category, platform, budget, the creator size you are targeting, and roughly how many creators will post. It gives back a four-step milestone ladder for each creator size (views needed, and what a creator has earned at each step) and a promise: nine times out of ten, total payouts stay within budget. I put the budget first because a brand can forgive a stingy ladder but not a blown one.

## How it decides

- **Steps sit where posts actually land.** The first step is where half of past posts of that size, platform and category reach. The second is one in five, the third one in twenty, the top one in a hundred.
- **Every step pays the same price per view, never above what the brand's ads cost.** Creators get at most 80% of the brand's paid-media price for the same views.
- **It rehearses the campaign 5,000 times** with realistic ups and downs, and sets the price so the budget holds in nine of ten rehearsals.
- **Small and big creators get ladders scaled to their reach, at the same price per view.** A small creator's first step is as reachable for them as a big creator's is for them.
- **Suspicious posts are kept out of the numbers, payment waits a week, and the budget allows for bought views that slip through.** The method does not catch fraud. It stops fraud from inflating the thresholds and keeps it inside the budget promise. The top step is the most any one post can earn.

## Why this beats how ladders are set today

| Today | What goes wrong | What my method does |
|---|---|---|
| Ladders set by feel | Budgets get blown when a few posts do well | Sizes the price so the budget holds nine times in ten |
| One house ladder for every creator size | Small creators never reach the first step and give up; big creators clear every step | Each size gets its own ladder at the same price per view |
| Payouts guessed from follower counts | Price per view swings between campaigns, sometimes above what ads cost | One price, never above the ad benchmark; spare budget is reported |

No real Meme'd data was available, so I built a synthetic history of 40 campaigns, 600 creators and about 2,700 posts, with the view patterns and fraud behaviour described in the methodology. I replayed every campaign through its old ladder and through the ladder my method proposes without having seen that campaign:

| Measure | Old ladders | My ladders |
|---|---|---|
| Campaigns within budget | 21 of 40 | 35 of 40 |
| Total spend | Rs 1.03 crore | Rs 1.34 crore |
| Creators who earned something | 44% | 51% |

Spend goes up because 21 of the 40 campaigns had been paying below budget, 13 of them below half, and most of the increase is one large campaign that had been paying almost nothing. My ladder pays less than the old one in 29 campaigns and more creators earn something in 26. Five still end over budget. That is 12.5%, slightly above the one in ten promised, and with only 40 campaigns a count that high happens about a third of the time even when the promise holds exactly. The replay assumes creators post the same content under either ladder, so the gain in completion is likely understated.

## Where it can still be wrong

- **One viral post from a big creator in a small campaign can eat the budget.** Four of the five overruns were this. A per-post limit tied to the budget would fix it. I left it out because that is a policy call for ops.
- **It needs a rough creator count.** Off by a factor of two, the budget promise is off by about the same.
- **It inherits whatever fraud flagging misses.** Unflagged bought views look like real ones.
- **The price benchmark is my assumption** until the brand supplies its own media plan.

## What to do with it

Use it as the default ladder for every campaign. Override it when there is a reason, and log the reason.
