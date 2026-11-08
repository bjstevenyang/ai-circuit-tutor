import {test,expect} from '@playwright/test';
import {writeEvidence} from './helpers';
test('fixed B scenarios: 10 warmups and 100 full compilations in production Chromium',async({page,browser})=>{
  await page.goto('/tests/performance/core.html');
  const results=await page.evaluate(()=>window.stage2Bench.core());
  for(const row of results){expect(row.times).toHaveLength(100);expect(row.p95,row.name).toBeLessThanOrEqual(100);if(row.name==='B-MAX'){expect(row.polar).toBe(6);expect(row.transistors).toBe(2);expect(row.candidates).toBe(576);expect(row.maxKclResidualA!).toBeLessThanOrEqual(1e-8);}}
  await writeEvidence('core-performance',{browser:browser.version(),results});
  console.log(results.map(r=>`${r.name} P95=${r.p95.toFixed(3)}ms`).join('\n'));
});
