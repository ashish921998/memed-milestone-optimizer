import assert from 'node:assert/strict';
import { erf, normalCdf, normalInv, lognormalQuantile, quantile, mulberry32, randn, mean, stddev } from './stats.ts';

const close = (a: number, b: number, tol: number, msg: string) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} vs ${b}`);

close(erf(0), 0, 1e-9, 'erf(0)');
close(erf(1), 0.8427007929, 1e-6, 'erf(1)');
close(normalCdf(0), 0.5, 1e-9, 'cdf(0)');
close(normalCdf(1.96), 0.975, 1e-4, 'cdf(1.96)');
close(normalInv(0.5), 0, 1e-9, 'inv(0.5)');
close(normalInv(0.975), 1.959964, 1e-5, 'inv(0.975)');
close(normalInv(0.99), 2.326348, 1e-5, 'inv(0.99)');
close(normalInv(0.01), -2.326348, 1e-5, 'inv(0.01)');
close(lognormalQuantile(Math.log(1000), 1, 0.5), 1000, 1e-6, 'lognormal median');
close(quantile([1, 2, 3, 4, 5], 0.5), 3, 1e-9, 'quantile median');
close(quantile([1, 2, 3, 4], 0.5), 2.5, 1e-9, 'quantile interp');

const rng = mulberry32(42);
const zs = Array.from({ length: 20000 }, () => randn(rng));
close(mean(zs), 0, 0.03, 'randn mean');
close(stddev(zs), 1, 0.03, 'randn sd');
assert.equal(mulberry32(7)(), mulberry32(7)(), 'seeded rng is deterministic');
console.log('stats.test: ok');
