// ─────────────────────────────────────────────────────────────────────────────
// sensitivity.js
// Development Feasibility — Sensitivity & Scenario Analysis
//
// This is the final calculator that wraps all previous logic together.
// It answers the three most important developer questions:
//
//   1. What happens to my profit if things go wrong?
//   2. Where is my break-even point?
//   3. Which variables hurt me the most?
//
// Runs 5 scenario types:
//   A. Sale price sensitivity     — market goes soft
//   B. Build cost sensitivity     — construction costs blow out
//   C. Timeline sensitivity       — DA or build delays add interest
//   D. Interest rate sensitivity  — rates move during project
//   E. Combined stress scenarios  — multiple things go wrong at once
//
// Also calculates:
//   • Break-even sale price per dwelling
//   • Maximum viable purchase price
//   • Maximum viable build cost
//   • Profit waterfall (what each variable contributes)
// ─────────────────────────────────────────────────────────────────────────────

// ─── BASE CASE INPUTS ────────────────────────────────────────────────────────
// These are the confirmed figures from the Moana feasibility.
// When used as a skill, these get populated from the other calculators.

const BASE = {
  // Property
  address:        '22 Fourth Avenue, Moana SA 5169',
  option:         'Option A — 2 × Detached Front/Rear',
  dwellings:      2,

  // Finance
  purchasePrice:   724000,
  annualRate:      0.065,
  lvr:             0.70,
  taxRate:         0.25,   // company BRE

  // Revenue (mid spec, quality build)
  salePrices:      [1350000, 1050000],

  // Costs (ex-GST totals from full P&L)
  acquisitionCosts: 70750,    // stamp + legal + DD + PEXA + title
  holdingNetBenefit: 13830,   // rental income offset from auto_rent.js
  developmentCosts: 247700,   // all dev costs
  constructionCosts: 619000,  // build + exclusions + landscape + NCC
  financeAdmin:      25000,   // establishment + val + QS + legal
  gstNetPayable:     64114,   // from gst_margin.js
  sellingCosts:      79800,   // agent + marketing + conveyancing

  // Timeline (months)
  holdMonths:   12,
  demoMonths:    3,
  buildMonths:  13,
  salesMonths:   4,
};

// ─── CORE P&L FUNCTION ───────────────────────────────────────────────────────
// Recalculates full P&L given adjustments to any input
// adj = object of overrides: { salePriceMult, buildCostMult, extraMonths, rate, purchasePrice }

function calcPnL(adj = {}) {
  const {
    salePriceMult  = 1.0,
    buildCostMult  = 1.0,
    extraMonths    = 0,
    rate           = BASE.annualRate,
    purchasePrice  = BASE.purchasePrice,
    taxRate        = BASE.taxRate,
  } = adj;

  // Adjusted revenue
  const adjSalePrices = BASE.salePrices.map(p => Math.round(p * salePriceMult));
  const revenue       = adjSalePrices.reduce((a, b) => a + b, 0);

  // Adjusted construction
  const adjConstruction = Math.round(BASE.constructionCosts * buildCostMult);

  // Re-stamp duty if purchase price changes
  const stampDuty = calcStampDutySA(purchasePrice);
  const acqTotal  = purchasePrice + stampDuty + BASE.acquisitionCosts - calcStampDutySA(BASE.purchasePrice);

  // Recalculate capitalized interest with adjusted rate and extra months
  const totalBuildMonths = BASE.buildMonths + Math.round(extraMonths * 0.5); // extra split over phases
  const extraHoldMonths  = Math.round(extraMonths * 0.5);
  const totalHoldMonths  = BASE.holdMonths + extraHoldMonths;

  const capInt = calcCapInt(
    acqTotal + BASE.financeAdmin,
    BASE.developmentCosts,
    adjConstruction,
    BASE.sellingCosts,
    rate,
    totalHoldMonths,
    BASE.demoMonths,
    totalBuildMonths,
    BASE.salesMonths
  );

  // Re-calculate GST (margin changes with sale price)
  const gstOnMargin  = Math.round((revenue - purchasePrice) / 11);
  const itcEstimate  = Math.round(adjConstruction * 0.0909);
  const gstNet       = Math.max(0, gstOnMargin - itcEstimate);

  // Total costs
  const totalCosts = acqTotal
    + BASE.developmentCosts
    + adjConstruction
    + capInt
    + BASE.financeAdmin
    + gstNet
    + BASE.sellingCosts
    - BASE.holdingNetBenefit;  // rental benefit offsets costs

  const grossProfit  = revenue - totalCosts;
  const taxPayable   = Math.max(0, Math.round(grossProfit * taxRate));
  const netProfit    = grossProfit - taxPayable;
  const margin       = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netMargin    = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const totalMonths  = totalHoldMonths + BASE.demoMonths + totalBuildMonths + BASE.salesMonths;

  return {
    revenue, adjSalePrices, adjConstruction,
    acqTotal, capInt, gstNet, totalCosts,
    grossProfit, taxPayable, netProfit,
    margin, netMargin, totalMonths,
    breakEven: netProfit < 0,
  };
}

// Simplified stamp duty SA (inline to avoid import dependency)
function calcStampDutySA(v) {
  if (v <= 0)       return 0;
  if (v <= 12000)   return Math.round(v * 0.0100);
  if (v <= 30000)   return Math.round(120   + (v-12000)  * 0.0200);
  if (v <= 50000)   return Math.round(480   + (v-30000)  * 0.0300);
  if (v <= 100000)  return Math.round(1080  + (v-50000)  * 0.0350);
  if (v <= 200000)  return Math.round(2830  + (v-100000) * 0.0400);
  if (v <= 250000)  return Math.round(6830  + (v-200000) * 0.0450);
  if (v <= 300000)  return Math.round(9080  + (v-250000) * 0.0500);
  if (v <= 500000)  return Math.round(11580 + (v-300000) * 0.0550);
  return             Math.round(22580 + (v-500000) * 0.0550);
}

// Simplified phased cap interest (inline)
function calcCapInt(acq, dev, con, sell, rate, hold, demo, build, sales) {
  const mr = rate / 12;
  let bal = acq, int = 0;
  const devPerMo = dev / Math.max(hold, 1);
  for (let m = 0; m < hold; m++) { bal += devPerMo; bal += bal * mr; int += bal * mr; }
  const devLatePerMo = dev / demo;
  for (let m = 0; m < demo; m++) { bal += devLatePerMo; const i = Math.round(bal * mr); bal += i; int += i; }
  const conPerMo = con / build;
  for (let m = 0; m < build; m++) { bal += conPerMo; const i = Math.round(bal * mr); bal += i; int += i; }
  const sellPerMo = sell / sales;
  for (let m = 0; m < sales; m++) { bal += sellPerMo; const i = Math.round(bal * mr); bal += i; int += i; }
  return Math.round(int);
}

// ─── BREAK-EVEN CALCULATORS ───────────────────────────────────────────────────

// Minimum sale price per dwelling (binary search)
function calcBreakEvenSalePrice() {
  let lo = 500000, hi = 2000000;
  for (let i = 0; i < 50; i++) {
    const mid  = (lo + hi) / 2;
    const mult = (mid * BASE.dwellings) / BASE.salePrices.reduce((a,b)=>a+b,0);
    const r    = calcPnL({ salePriceMult: mult });
    if (r.netProfit > 0) hi = mid; else lo = mid;
  }
  return Math.round((lo + hi) / 2);
}

// Maximum viable purchase price (keep net profit >= $50K minimum)
function calcMaxPurchasePrice(minNetProfit = 50000) {
  let lo = BASE.purchasePrice, hi = 1200000;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const r   = calcPnL({ purchasePrice: mid });
    if (r.netProfit >= minNetProfit) lo = mid; else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

// Maximum viable build cost multiplier
function calcMaxBuildCost(minNetProfit = 50000) {
  let lo = 1.0, hi = 2.0;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const r   = calcPnL({ buildCostMult: mid });
    if (r.netProfit >= minNetProfit) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ─── PROFIT WATERFALL ────────────────────────────────────────────────────────
// Shows how much each cost category consumes from revenue

function calcWaterfall() {
  const base    = calcPnL();
  const revenue = base.revenue;
  const items   = [
    { label: 'Purchase price',      amount: BASE.purchasePrice },
    { label: 'Stamp duty',          amount: calcStampDutySA(BASE.purchasePrice) },
    { label: 'Acquisition costs',   amount: BASE.acquisitionCosts },
    { label: 'Development costs',   amount: BASE.developmentCosts },
    { label: 'Construction',        amount: BASE.constructionCosts },
    { label: 'Finance (cap. int.)', amount: base.capInt },
    { label: 'GST net payable',     amount: base.gstNet },
    { label: 'Selling costs',       amount: BASE.sellingCosts },
    { label: 'Rental benefit',      amount: -BASE.holdingNetBenefit },
    { label: 'Income tax (25%)',    amount: base.taxPayable },
  ];
  let running = revenue;
  return items.map(item => {
    running -= item.amount;
    return { ...item, runningTotal: running, pctOfRevenue: (item.amount / revenue) * 100 };
  });
}

// ─── DISPLAY ─────────────────────────────────────────────────────────────────
function displaySensitivity(scenarios, title) {
  const fmt = (n) => {
    const abs = Math.abs(Math.round(n));
    const str = `$${abs.toLocaleString()}`;
    return n < 0 ? `-${str}` : str;
  };
  const pct = (n) => `${n.toFixed(1)}%`;

  console.log('\n' + '═'.repeat(78));
  console.log(`  ${title}`);
  console.log('═'.repeat(78));
  console.log(
    `  ${'Scenario'.padEnd(34)} ${'Revenue'.padEnd(12)} ${'Gross P'.padEnd(11)} ${'Net P (post-tax)'.padEnd(17)} Margin`
  );
  console.log('  ' + '─'.repeat(72));
  scenarios.forEach((s, i) => {
    const flag = s.result.breakEven ? ' ✗ LOSS' : i === 0 ? ' ★ BASE' : '';
    console.log(
      `  ${s.label.padEnd(34)} ` +
      `${fmt(s.result.revenue).padEnd(12)} ` +
      `${fmt(s.result.grossProfit).padEnd(11)} ` +
      `${fmt(s.result.netProfit).padEnd(17)} ` +
      `${pct(s.result.margin)}${flag}`
    );
  });
  console.log('  ' + '─'.repeat(72));
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  calcPnL,
  calcBreakEvenSalePrice,
  calcMaxPurchasePrice,
  calcMaxBuildCost,
  calcWaterfall,
  BASE,
};

// ─────────────────────────────────────────────────────────────────────────────
// TESTS — node src/calculators/sensitivity.js
// ─────────────────────────────────────────────────────────────────────────────
function runTests() {
  const fmt = (n) => n < 0 ? `-$${Math.abs(Math.round(n)).toLocaleString()}` : `$${Math.round(n).toLocaleString()}`;

  console.log('\n' + '█'.repeat(78));
  console.log('  SENSITIVITY ANALYSIS — FULL SCENARIO SUITE');
  console.log(`  ${BASE.address} — ${BASE.option}`);
  console.log(`  $${BASE.purchasePrice.toLocaleString()} purchase · Quality spec · 25% company tax`);
  console.log('█'.repeat(78));

  // ── BASE CASE ─────────────────────────────────────────────────────────────
  const base = calcPnL();
  console.log('\n  BASE CASE SUMMARY');
  console.log('  ' + '─'.repeat(50));
  console.log(`  Revenue:              ${fmt(base.revenue)}`);
  console.log(`  Total costs:          ${fmt(base.totalCosts)}`);
  console.log(`  Gross profit:         ${fmt(base.grossProfit)}`);
  console.log(`  Tax (25%):           -${fmt(base.taxPayable)}`);
  console.log(`  NET PROFIT:           ${fmt(base.netProfit)}`);
  console.log(`  Net margin:           ${base.netMargin.toFixed(1)}%`);
  console.log(`  Project duration:     ${base.totalMonths} months`);

  // ── A: SALE PRICE SENSITIVITY ─────────────────────────────────────────────
  const priceScenarios = [
    { label: 'Sale price +10% (strong market)',  adj: { salePriceMult: 1.10 } },
    { label: 'Sale price +5%',                   adj: { salePriceMult: 1.05 } },
    { label: 'BASE CASE',                        adj: {} },
    { label: 'Sale price −5%',                   adj: { salePriceMult: 0.95 } },
    { label: 'Sale price −10%',                  adj: { salePriceMult: 0.90 } },
    { label: 'Sale price −15%',                  adj: { salePriceMult: 0.85 } },
    { label: 'Sale price −20% (soft market)',    adj: { salePriceMult: 0.80 } },
    { label: 'Sale price −25%',                  adj: { salePriceMult: 0.75 } },
  ].map(s => ({ label: s.label, result: calcPnL(s.adj) }));
  displaySensitivity(priceScenarios, 'A — SALE PRICE SENSITIVITY');

  // ── B: BUILD COST SENSITIVITY ─────────────────────────────────────────────
  const costScenarios = [
    { label: 'Build costs −10% (under budget)',  adj: { buildCostMult: 0.90 } },
    { label: 'BASE CASE',                        adj: {} },
    { label: 'Build costs +10%',                 adj: { buildCostMult: 1.10 } },
    { label: 'Build costs +15%',                 adj: { buildCostMult: 1.15 } },
    { label: 'Build costs +20%',                 adj: { buildCostMult: 1.20 } },
    { label: 'Build costs +30%',                 adj: { buildCostMult: 1.30 } },
    { label: 'Build costs +40% (major overrun)', adj: { buildCostMult: 1.40 } },
  ].map(s => ({ label: s.label, result: calcPnL(s.adj) }));
  displaySensitivity(costScenarios, 'B — BUILD COST SENSITIVITY');

  // ── C: TIMELINE (DELAY) SENSITIVITY ──────────────────────────────────────
  const delayScenarios = [
    { label: 'No delays (BASE CASE)',            adj: { extraMonths: 0  } },
    { label: 'DA delay +3 months',               adj: { extraMonths: 3  } },
    { label: 'DA delay +6 months',               adj: { extraMonths: 6  } },
    { label: 'DA + build delay +9 months',       adj: { extraMonths: 9  } },
    { label: 'Major delays +12 months',          adj: { extraMonths: 12 } },
    { label: 'Worst case delays +18 months',     adj: { extraMonths: 18 } },
  ].map(s => ({ label: s.label, result: calcPnL(s.adj) }));
  displaySensitivity(delayScenarios, 'C — TIMELINE / DELAY SENSITIVITY');

  // ── D: INTEREST RATE SENSITIVITY ─────────────────────────────────────────
  const rateScenarios = [
    { label: 'Rate 5.0% (rate cuts)',            adj: { rate: 0.050 } },
    { label: 'Rate 5.5%',                        adj: { rate: 0.055 } },
    { label: 'Rate 6.0%',                        adj: { rate: 0.060 } },
    { label: 'Rate 6.5% (BASE CASE)',            adj: { rate: 0.065 } },
    { label: 'Rate 7.0%',                        adj: { rate: 0.070 } },
    { label: 'Rate 7.5%',                        adj: { rate: 0.075 } },
    { label: 'Rate 8.0% (rate rises)',           adj: { rate: 0.080 } },
  ].map(s => ({ label: s.label, result: calcPnL(s.adj) }));
  displaySensitivity(rateScenarios, 'D — INTEREST RATE SENSITIVITY');

  // ── E: COMBINED STRESS SCENARIOS ─────────────────────────────────────────
  const stressScenarios = [
    { label: 'Optimistic (+5% price, −5% cost)', adj: { salePriceMult:1.05, buildCostMult:0.95 } },
    { label: 'BASE CASE',                        adj: {} },
    { label: 'Conservative (−10% price, +10% cost, +3mo)', adj: { salePriceMult:0.90, buildCostMult:1.10, extraMonths:3 } },
    { label: 'Pessimistic (−15% price, +15% cost, +6mo)', adj: { salePriceMult:0.85, buildCostMult:1.15, extraMonths:6 } },
    { label: 'Stress (−20% price, +20% cost, +9mo)',      adj: { salePriceMult:0.80, buildCostMult:1.20, extraMonths:9 } },
    { label: 'Worst case (−25%, +25%, 7% rate, +12mo)',   adj: { salePriceMult:0.75, buildCostMult:1.25, rate:0.070, extraMonths:12 } },
  ].map(s => ({ label: s.label, result: calcPnL(s.adj) }));
  displaySensitivity(stressScenarios, 'E — COMBINED STRESS SCENARIOS');

  // ── F: PURCHASE PRICE IMPACT ──────────────────────────────────────────────
  console.log('\n' + '═'.repeat(78));
  console.log('  F — PURCHASE PRICE IMPACT (same build, same sale price)');
  console.log('═'.repeat(78));
  console.log(`  ${'Purchase Price'.padEnd(22)} ${'Stamp Duty'.padEnd(12)} ${'Net Profit'.padEnd(14)} Margin   vs Base`);
  console.log('  ' + '─'.repeat(68));
  [649000, 674000, 699000, 724000, 749000, 799000, 849000, 899000].forEach(pp => {
    const r   = calcPnL({ purchasePrice: pp });
    const diff = r.netProfit - base.netProfit;
    const tag  = pp === BASE.purchasePrice ? ' ← current' : diff > 0 ? ` +${fmt(diff)}` : ` ${fmt(diff)}`;
    console.log(
      `  ${fmt(pp).padEnd(22)} ${fmt(calcStampDutySA(pp)).padEnd(12)} ` +
      `${fmt(r.netProfit).padEnd(14)} ${r.netMargin.toFixed(1)}%${tag}`
    );
  });

  // ── BREAK-EVEN ANALYSIS ───────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(78));
  console.log('  BREAK-EVEN ANALYSIS');
  console.log('═'.repeat(78));

  const bePrice    = calcBreakEvenSalePrice();
  const maxPP      = calcMaxPurchasePrice(50000);
  const maxBldMult = calcMaxBuildCost(50000);
  const maxBld     = Math.round(BASE.constructionCosts * maxBldMult);
  const currentAvg = Math.round(BASE.salePrices.reduce((a,b)=>a+b,0) / BASE.dwellings);
  const headroom   = currentAvg - bePrice;
  const headroomPct = (headroom / currentAvg) * 100;

  console.log(`\n  Break-even sale price (net profit = $0):`);
  console.log(`    Per dwelling:         ${fmt(bePrice)}`);
  console.log(`    Current projection:   ${fmt(currentAvg)}/dwelling`);
  console.log(`    Headroom:             ${fmt(headroom)} (${headroomPct.toFixed(1)}% price drop to break even)\n`);

  console.log(`  Maximum purchase price (maintain $50K min net profit):`);
  console.log(`    Current purchase:     ${fmt(BASE.purchasePrice)}`);
  console.log(`    Maximum:              ${fmt(maxPP)}`);
  console.log(`    Negotiation ceiling:  Could pay ${fmt(maxPP - BASE.purchasePrice)} more and still make $50K net\n`);

  console.log(`  Maximum build cost overrun (maintain $50K min net profit):`);
  console.log(`    Current build:        ${fmt(BASE.constructionCosts)}`);
  console.log(`    Maximum build:        ${fmt(maxBld)}`);
  console.log(`    Overrun tolerance:    +${((maxBldMult-1)*100).toFixed(0)}% before dropping below $50K net\n`);

  // ── PROFIT WATERFALL ──────────────────────────────────────────────────────
  console.log('═'.repeat(78));
  console.log('  PROFIT WATERFALL — How revenue is consumed (base case)');
  console.log('═'.repeat(78));
  console.log(`  Starting revenue:     ${fmt(base.revenue)}\n`);
  const wf = calcWaterfall();
  const barMax = BASE.purchasePrice; // scale bars to purchase price
  wf.forEach(item => {
    const barLen = Math.max(0, Math.min(30, Math.round(Math.abs(item.amount) / barMax * 15)));
    const bar    = item.amount < 0 ? '░'.repeat(barLen) : '█'.repeat(barLen);
    const pctStr = item.amount < 0
      ? `−${Math.abs(item.pctOfRevenue).toFixed(1)}%`
      : `${item.pctOfRevenue.toFixed(1)}%`;
    console.log(
      `  ${item.label.padEnd(24)} -${fmt(item.amount).padEnd(12)} ` +
      `${pctStr.padEnd(7)} ${bar}  → ${fmt(item.runningTotal)}`
    );
  });
  console.log(`\n  NET PROFIT REMAINING:   ${fmt(base.netProfit)}`);

  // ── RISK RATING ───────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(78));
  console.log('  PROJECT RISK RATING');
  console.log('═'.repeat(78));
  const conservative = calcPnL({ salePriceMult: 0.90, buildCostMult: 1.15, extraMonths: 6 });
  const stress       = calcPnL({ salePriceMult: 0.80, buildCostMult: 1.20, extraMonths: 9 });

  const riskItems = [
    { metric:'Base case net profit',           value:fmt(base.netProfit),          flag: base.netProfit > 150000 ? '✓ STRONG' : base.netProfit > 50000 ? '~ OK' : '✗ WEAK' },
    { metric:'Conservative scenario net',      value:fmt(conservative.netProfit),  flag: conservative.netProfit > 50000 ? '✓ VIABLE' : conservative.netProfit > 0 ? '~ MARGINAL' : '✗ LOSS' },
    { metric:'Stress scenario net',            value:fmt(stress.netProfit),        flag: stress.netProfit > 0 ? '~ SURVIVES' : '✗ LOSS' },
    { metric:'Price headroom to break-even',   value:`${headroomPct.toFixed(1)}%`, flag: headroomPct > 15 ? '✓ GOOD' : headroomPct > 8 ? '~ OK' : '✗ THIN' },
    { metric:'Build overrun tolerance',        value:`+${((maxBldMult-1)*100).toFixed(0)}%`, flag: (maxBldMult-1) > 0.20 ? '✓ GOOD' : (maxBldMult-1) > 0.10 ? '~ OK' : '✗ THIN' },
  ];

  riskItems.forEach(r => {
    console.log(`  ${r.metric.padEnd(36)} ${r.value.padEnd(12)} ${r.flag}`);
  });

  const allGreen = riskItems.filter(r => r.flag.startsWith('✓')).length;
  const anyRed   = riskItems.filter(r => r.flag.startsWith('✗')).length;
  const verdict  = anyRed > 1 ? 'HIGH RISK — review before proceeding'
    : anyRed === 1 ? 'MEDIUM RISK — proceed with caution'
    : allGreen >= 4 ? 'LOW RISK — strong project fundamentals'
    : 'MODERATE RISK — acceptable for experienced developer';
  console.log(`\n  OVERALL RISK RATING: ${verdict}`);
  console.log('─'.repeat(78));

  console.log('\n  ✓ All sensitivity tests complete\n');
}

runTests();