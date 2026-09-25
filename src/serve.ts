// Usage: node src/serve.ts  -> http://localhost:8787   (DATA_DIR=path/to/csvs to use another history)
// A form in front of the same recommend() the CLI uses. No build step, no dependencies.
import { createServer } from 'node:http';
import { loadHistory } from './fit.ts';
import { recommend } from './recommend.ts';
import { CATEGORIES, PLATFORMS, TIERS } from './types.ts';
import type { CampaignInput, Category, Platform, Tier } from './types.ts';

const history = loadHistory(process.env.DATA_DIR ?? 'data');
const port = Number(process.env.PORT ?? 8787);
const opts = (xs: readonly string[], sel: string) => xs.map((x) => `<option${x === sel ? ' selected' : ''}>${x}</option>`).join('');

const page = `<!doctype html><meta charset="utf-8"><title>Milestone ladder</title>
<style>
body{font:15px/1.4 system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#222}
form{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem 1rem;align-items:end}
label{display:flex;flex-direction:column;font-size:13px;color:#555}
input,select{font:inherit;padding:.4rem}button{font:inherit;padding:.5rem 1rem;grid-column:1/-1;justify-self:start}
table{border-collapse:collapse;margin:1rem 0;width:100%}td,th{padding:.35rem .6rem;border-bottom:1px solid #ddd;text-align:right}th:first-child,td:first-child{text-align:left}
h2{font-size:17px;margin:1.5rem 0 .25rem}.muted{color:#666;font-size:13px}.err{color:#b00020}
</style>
<h1>Milestone ladder</h1>
<p class="muted">Same method as <code>node src/cli.ts</code>. Thresholds sit at the 50th, 80th, 95th and 99th percentile of expected 7-day views; every rung pays one price per 1K views, sized so spend stays within budget in 9 of 10 simulated runs and never above 80% of the paid-media CPM.</p>
<form id="f">
<label>Category<select name="category">${opts(CATEGORIES, 'gaming')}</select></label>
<label>Platform<select name="platform">${opts(PLATFORMS, 'instagram')}</select></label>
<label>Target tier<select name="tier">${opts(TIERS, 'micro')}</select></label>
<label>Budget (Rs)<input name="budget" type="number" min="1" value="40000" required></label>
<label>Expected creators (blank = historical median)<input name="creators" type="number" min="1"></label>
<label>Paid-media CPM override (Rs per 1K, blank = table)<input name="cpm" type="number" min="1" step="any"></label>
<button>Recommend</button>
</form>
<div id="out"></div>
<script>
const rs=x=>'Rs '+Math.round(x).toLocaleString('en-IN'),n=x=>Math.round(x).toLocaleString('en-IN'),pc=x=>Math.round(x*100)+'%';
document.getElementById('f').onsubmit=async e=>{e.preventDefault();const q=new URLSearchParams([...new FormData(e.target)].filter(([,v])=>v!==''));
const r=await fetch('/api?'+q);const d=await r.json();const o=document.getElementById('out');if(!r.ok){o.innerHTML='<p class="err">'+d.error+'</p>';return}
const ladder=(t,rungs)=>'<h2>'+t+' ladder'+(t===d.tier?' (target)':' ('+pc(d.tier_mix[t])+' of creators)')+'</h2><table><tr><th>Rung</th><th>Reach</th><th>Views at day 7</th><th>Cumulative payout</th><th>Rs per 1K</th></tr>'+
rungs.map(r=>'<tr><td>'+r.rank+'</td><td>'+pc(1-r.percentile)+' of posts</td><td>'+n(r.view_threshold)+'</td><td>'+rs(r.payout_amount)+'</td><td>'+(r.payout_amount/r.view_threshold*1000).toFixed(1)+'</td></tr>').join('')+'</table>';
const b=d.input.total_budget;o.innerHTML=ladder(d.tier,d.rungs)+Object.entries(d.ladders).filter(([t])=>t!==d.tier).map(([t,r])=>ladder(t,r)).join('')+
'<h2>Budget</h2><table>'+[['Creators',d.expected_creators+(d.input.expected_creators?'':' (median of similar campaigns)')],['Tier mix',Object.entries(d.tier_mix).filter(([,w])=>w>0).map(([t,w])=>t+' '+pc(w)).join(', ')],
['Spend, typical run (p50)',rs(d.spend_p50)+' ('+pc(d.spend_p50/b)+' of budget)'],['Spend, 9-in-10 bound (p90)',rs(d.spend_p90)+' ('+pc(d.spend_p90/b)+')'],['Spend, worst 1-in-100 run (p99)',rs(d.spend_p99)+' ('+pc(d.spend_p99/b)+')'],
['Rate used','Rs '+d.rate_per_1k.toFixed(2)+' per 1K views'+(d.capped?' (capped)':'')],['Cap','Rs '+d.creator_rate_cap.toFixed(2)+' per 1K (paid-media CPM Rs '+d.cpm_anchor+' x 80%)'],['Headroom',d.capped?rs(d.headroom)+' unspent at p90: add creators or extend the campaign':'Rs 0'],['Fraud share assumed',pc(d.fraud_share)+' of posts']].map(([k,v])=>'<tr><td>'+k+'</td><td>'+v+'</td></tr>').join('')+'</table>';};
</script>`;

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end(page);
  if (url.pathname !== '/api') return res.writeHead(404).end();
  const q = url.searchParams;
  const num = (k: string) => (q.get(k) === null ? undefined : Number(q.get(k)));
  const input = { category: q.get('category') as Category, platform: q.get('platform') as Platform, target_creator_tier: q.get('tier') as Tier, total_budget: num('budget') ?? 0, expected_creators: num('creators'), cpm_override: num('cpm') } satisfies CampaignInput;
  const bad = !CATEGORIES.includes(input.category) || !PLATFORMS.includes(input.platform) || !TIERS.includes(input.target_creator_tier) || !(input.total_budget > 0) || (input.expected_creators !== undefined && !(input.expected_creators > 0)) || (input.cpm_override !== undefined && !(input.cpm_override > 0));
  if (bad) return res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'category, platform and tier must be known values; budget, creators and cpm must be positive' }));
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(recommend(input, history)));
}).listen(port, () => console.log(`http://localhost:${port}`));
