# Milestone ladders: one page

## What it does

Give it the campaign's category, platform, budget, target creator size and a rough creator count. It returns a four-step milestone ladder for each creator size, priced so that total payouts stay within budget nine times out of ten. I put the budget first because a brand can forgive a stingy ladder but not a blown one.

## How it decides

- **Steps sit where posts land.** The first step is what half of past posts of that size, platform and category reach. The others are where one post in five, twenty and a hundred land.
- **One price per view.** Every step pays the same price per view, never more than 80% of what the brand pays for the same views in paid media.
- **The budget is rehearsed.** It runs the campaign 5,000 times and sets the price so the budget holds in nine of ten runs.
- **Ladders scale with reach.** At one price per view, the first step is equally reachable for small and big creators.
- **Suspicious posts do not set the steps.** Payment also waits a week, and the budget allows for bought views that flagging misses.

## Why this beats how ladders are set today

| Today | What goes wrong | What my method does |
|---|---|---|
| Ladders set by feel | Budgets get blown when a few posts do well | Sizes the price so the budget holds nine times in ten |
| One house ladder for every creator size | Small creators never reach step one and give up. Big creators clear every step | Each size gets its own ladder at the same price per view |
| Payouts guessed from follower counts | Price per view swings between campaigns, sometimes above ad cost | One price, never above the ad benchmark, with spare budget reported |

I had no real Meme'd data, so I built a synthetic history of 40 campaigns, 600 creators and about 2,700 posts, and replayed each campaign through its old ladder and through mine, which never saw that campaign:

| Measure | Old ladders | My ladders |
|---|---|---|
| Campaigns within budget | 21 of 40 | 35 of 40 |
| Total spend | Rs 1.03 crore | Rs 1.34 crore |
| Creators who earned something | 44% | 51% |

Spend goes up because 21 of the 40 campaigns had been paying below budget. My ladder pays less than the old one in 29 campaigns, and more creators earn something in 26. Five still end over budget, 12.5% against the one in ten promised, which is within chance for only 40 campaigns.

## Where it can still be wrong

- One viral post from a big creator in a small campaign can take most of the budget. Four of the five overruns were this. A per-post cap would fix it, but that is a policy call for ops.
- It needs a rough creator count. If it is off by a factor of two, so is the budget promise.
- It inherits what fraud flagging misses, because unflagged bought views look real.
- The price benchmark is my assumption until the brand supplies its own media plan.

I recommend making it the default ladder and logging the reason whenever someone overrides it.
