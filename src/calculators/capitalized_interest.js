// ─────────────────────────────────────────────────────────────────────────────
// capitalized_interest.js
// Phased Construction Loan — Capitalized Interest Calculator
//
// How construction loans work (different from normal home loans):
//   - You don't make monthly repayments during the project
//   - Interest is added ("capitalized") to the loan balance each month
//   - The balance grows as you draw down funds for each project stage
//   - The full balance (principal + all capitalized interest) is repaid
//     from the proceeds when the completed dwellings are sold
//
// This calculator models 4 distinct phases:
//   Phase 1 — Hold & DA:     Loan open, DA costs drawn, rental income offsets
//   Phase 2 — Demo & Civil:  Demolition + remaining dev costs drawn
//   Phase 3 — Construction:  Build costs drawn progressively (biggest draw)
//   Phase 4 — Sales:         Selling costs drawn, balance held until settlement
// ─────────────────────────────────────────────────────────────────────────────

// ─── MAIN CALCULATOR ─────────────────────────────────────────────────────────
// All dollar inputs in whole dollars. Rate as decimal (e.g. 0.065 for 6.5%).
// Returns full breakdown by phase plus summary totals.

function calcCapitalizedInterest(params) {
  const {
    // Costs
    acquisitionTotal,       // purchase + stamp duty + legal + due diligence
    loanEstablishmentFee,   // upfront fee charged by lender (added to balance day 1)
    devCostsEarly,          // DA-period dev costs: surveyor, town planner, early DA fees
    devCostsLate,           // remaining dev costs: civil, demo, services, PM
    constructionTotal,      // total build + landscape + exclusions
    sellingCostsTotal,      // agent + marketing + conveyancing

    // Rental income (offsets interest during hold phase)
    weeklyRent       = 0,
    holdMonths       = 12,

    // Timeline
    demoMonths       = 3,
    buildMonths      = 13,   // construction only
    salesMonths      = 4,

    // Finance
    annualRate       = 0.065,
    lvr              = 0.70,  // loan to value ratio (what bank lends)
  } = params;

  const monthlyRate = annualRate / 12;

  // ── Net rental benefit during hold ───────────────────────────────────────
  // Gross rent minus: council rates, water, insurance, PM fee (8.5%), maintenance, ESL
  const grossRentHold    = holdMonths > 0 ? weeklyRent * (holdMonths * 52 / 12) : 0;
  const holdOpexPerMonth = holdMonths > 0 ? (1900 + 850 + 1600 + Math.round(weeklyRent * 52 * 0.085) + 1500 + 450) / 12 : 0;
  const holdOpexTotal    = Math.round(holdOpexPerMonth * holdMonths);
  const netRentalBenefit = Math.round(grossRentHold - holdOpexTotal);

  // ── PHASE 1 — Hold & DA ───────────────────────────────────────────────────
  // Opening balance = acquisition + loan establishment fee
  // Draws = early DA costs spread over hold period
  // Interest compounds monthly on running balance
  // Rental income reduces effective interest burden (tracked separately)

  let p1Balance = acquisitionTotal + loanEstablishmentFee;
  let p1Interest = 0;
  const p1Monthly = [];

  const devEarlyPerMonth = holdMonths > 0 ? devCostsEarly / holdMonths : devCostsEarly;

  for (let m = 1; m <= Math.max(holdMonths, 1); m++) {
    const drawThisMonth = holdMonths > 0 ? devEarlyPerMonth : devCostsEarly;
    p1Balance += drawThisMonth;
    const interestThisMonth = Math.round(p1Balance * monthlyRate);
    p1Balance += interestThisMonth;
    p1Interest += interestThisMonth;
    p1Monthly.push({
      month:    m,
      draw:     Math.round(drawThisMonth),
      interest: interestThisMonth,
      balance:  p1Balance,
    });
  }
  const p1Close = p1Balance;

  // ── PHASE 2 — Demo & Civil ────────────────────────────────────────────────
  // Remaining dev costs drawn evenly across demo period

  let p2Balance = p1Close;
  let p2Interest = 0;
  const p2Monthly = [];

  const devLatePerMonth = devCostsLate / demoMonths;

  for (let m = 1; m <= demoMonths; m++) {
    p2Balance += devLatePerMonth;
    const interestThisMonth = Math.round(p2Balance * monthlyRate);
    p2Balance += interestThisMonth;
    p2Interest += interestThisMonth;
    p2Monthly.push({
      month:    m,
      draw:     Math.round(devLatePerMonth),
      interest: interestThisMonth,
      balance:  Math.round(p2Balance),
    });
  }
  const p2Close = p2Balance;

  // ── PHASE 3 — Construction ────────────────────────────────────────────────
  // Construction loan is drawn progressively — typically 5-6 stages:
  //   Stage 1: Slab/base        ~15% of build
  //   Stage 2: Frame            ~20% of build
  //   Stage 3: Lockup           ~20% of build
  //   Stage 4: Fixing           ~20% of build
  //   Stage 5: Practical compl. ~25% of build
  // We model this as a smooth progressive draw over build months

  const buildStages = [
    { name: 'Deposit / mobilisation', pct: 0.05 },
    { name: 'Slab / base',            pct: 0.15 },
    { name: 'Frame',                   pct: 0.20 },
    { name: 'Lockup',                  pct: 0.20 },
    { name: 'Fixing / fit-out',        pct: 0.20 },
    { name: 'Practical completion',    pct: 0.20 },
  ];

  let p3Balance = p2Close;
  let p3Interest = 0;
  const p3Monthly = [];
  const constructionPerMonth = constructionTotal / buildMonths;

  for (let m = 1; m <= buildMonths; m++) {
    p3Balance += constructionPerMonth;
    const interestThisMonth = Math.round(p3Balance * monthlyRate);
    p3Balance += interestThisMonth;
    p3Interest += interestThisMonth;
    p3Monthly.push({
      month:    m,
      draw:     Math.round(constructionPerMonth),
      interest: interestThisMonth,
      balance:  Math.round(p3Balance),
    });
  }
  const p3Close = p3Balance;

  // ── PHASE 4 — Sales & Settlement ─────────────────────────────────────────
  // Selling costs drawn at start of sales period
  // Balance held until proceeds received at settlement
  // Sales are assumed to settle progressively (50% at month 2, 50% at month 4)

  let p4Balance = p3Close;
  let p4Interest = 0;
  const p4Monthly = [];

  const sellingPerMonth = sellingCostsTotal / salesMonths;

  for (let m = 1; m <= salesMonths; m++) {
    p4Balance += sellingPerMonth;
    const interestThisMonth = Math.round(p4Balance * monthlyRate);
    p4Balance += interestThisMonth;
    p4Interest += interestThisMonth;
    p4Monthly.push({
      month:    m,
      draw:     Math.round(sellingPerMonth),
      interest: interestThisMonth,
      balance:  Math.round(p4Balance),
    });
  }
  const p4Close = p4Balance;

  // ── TOTALS ────────────────────────────────────────────────────────────────
  const grossCapitalizedInterest = p1Interest + p2Interest + p3Interest + p4Interest;
  const netFinanceCost           = grossCapitalizedInterest - Math.max(0, netRentalBenefit);
  const peakLoanBalance          = Math.round(p4Close);
  const totalMonths              = (holdMonths || 1) + demoMonths + buildMonths + salesMonths;
  const totalProjectCost         = acquisitionTotal + loanEstablishmentFee +
                                   devCostsEarly + devCostsLate +
                                   constructionTotal + sellingCostsTotal +
                                   grossCapitalizedInterest - Math.max(0, netRentalBenefit);

  return {
    // Phase summaries
    phases: [
      {
        name:            'Phase 1 — Hold & DA',
        months:          holdMonths || 1,
        openingBalance:  Math.round(acquisitionTotal + loanEstablishmentFee),
        totalDraws:      Math.round(devCostsEarly),
        interestCharged: p1Interest,
        closingBalance:  Math.round(p1Close),
        rentalOffset:    Math.max(0, netRentalBenefit),
        monthly:         p1Monthly,
      },
      {
        name:            'Phase 2 — Demo & Civil',
        months:          demoMonths,
        openingBalance:  Math.round(p1Close),
        totalDraws:      Math.round(devCostsLate),
        interestCharged: p2Interest,
        closingBalance:  Math.round(p2Close),
        rentalOffset:    0,
        monthly:         p2Monthly,
      },
      {
        name:            'Phase 3 — Construction',
        months:          buildMonths,
        openingBalance:  Math.round(p2Close),
        totalDraws:      Math.round(constructionTotal),
        interestCharged: p3Interest,
        closingBalance:  Math.round(p3Close),
        rentalOffset:    0,
        monthly:         p3Monthly,
        buildStages,
      },
      {
        name:            'Phase 4 — Sales & Settlement',
        months:          salesMonths,
        openingBalance:  Math.round(p3Close),
        totalDraws:      Math.round(sellingCostsTotal),
        interestCharged: p4Interest,
        closingBalance:  Math.round(p4Close),
        rentalOffset:    0,
        monthly:         p4Monthly,
      },
    ],

    // Summary
    grossCapitalizedInterest,
    netRentalBenefit:   Math.max(0, netRentalBenefit),
    netFinanceCost,
    peakLoanBalance,
    totalMonths,
    annualRate,
    effectiveRate:      parseFloat(((grossCapitalizedInterest / peakLoanBalance) * (12 / totalMonths) * 100).toFixed(2)),

    // Equity analysis
    equityRequired:     Math.round(peakLoanBalance * (1 - lvr)),
    loanFacility:       Math.round(peakLoanBalance * lvr),
    lvr,
  };
}

// ─── RUNNING BALANCE CHART (ASCII) ───────────────────────────────────────────
// Shows how the loan balance grows month by month — useful for visualising peak
function buildBalanceChart(result) {
  const allMonthly = result.phases.flatMap(p => p.monthly);
  const peak = Math.max(...allMonthly.map(m => m.balance));
  const barWidth = 40;
  const lines = [];

  lines.push('\n  Loan Balance Growth (each row = 1 month)\n');
  lines.push('  Month  Balance        Chart');
  lines.push('  ' + '─'.repeat(60));

  let monthNum = 0;
  result.phases.forEach(phase => {
    lines.push(`  ── ${phase.name} (${phase.months} months) ──`);
    phase.monthly.forEach(m => {
      monthNum++;
      const bar  = Math.round((m.balance / peak) * barWidth);
      const fill = '█'.repeat(bar);
      lines.push(
        `  ${String(monthNum).padStart(3)}    ` +
        `$${Math.round(m.balance / 1000).toLocaleString()}K`.padEnd(12) +
        fill
      );
    });
  });

  lines.push('  ' + '─'.repeat(60));
  lines.push(`  Peak: $${Math.round(peak / 1000).toLocaleString()}K at month ${monthNum}`);
  return lines.join('\n');
}

// ─── DISPLAY ─────────────────────────────────────────────────────────────────
function displayResults(result, label = '') {
  const fmt = (n) => `$${Math.round(n).toLocaleString()}`;
  const pct = (n) => `${n.toFixed(2)}%`;

  console.log('\n' + '═'.repeat(68));
  if (label) console.log(`  ${label}`);
  console.log('  CAPITALIZED INTEREST ANALYSIS');
  console.log('═'.repeat(68));

  result.phases.forEach(phase => {
    console.log(`\n  ${phase.name.toUpperCase()} — ${phase.months} months`);
    console.log('  ' + '─'.repeat(55));
    console.log(`  Opening balance:   ${fmt(phase.openingBalance)}`);
    console.log(`  Draws this phase:  ${fmt(phase.totalDraws)}`);
    console.log(`  Interest charged:  ${fmt(phase.interestCharged)}`);
    if (phase.rentalOffset > 0)
      console.log(`  Rental offset:    -${fmt(phase.rentalOffset)}`);
    console.log(`  Closing balance:   ${fmt(phase.closingBalance)}`);
  });

  console.log('\n' + '─'.repeat(68));
  console.log('  FINANCE SUMMARY');
  console.log('─'.repeat(68));
  console.log(`  Total project months:         ${result.totalMonths}`);
  console.log(`  Gross capitalized interest:   ${fmt(result.grossCapitalizedInterest)}`);
  console.log(`  Less: net rental benefit:    -${fmt(result.netRentalBenefit)}`);
  console.log(`  NET FINANCE COST:             ${fmt(result.netFinanceCost)}`);
  console.log(`  Peak loan balance:            ${fmt(result.peakLoanBalance)}`);
  console.log(`  Annual rate:                  ${pct(result.annualRate * 100)}`);
  console.log(`  Loan facility (${Math.round(result.lvr*100)}% of peak):    ${fmt(result.loanFacility)}`);
  console.log(`  Equity required (${Math.round((1-result.lvr)*100)}% of peak):  ${fmt(result.equityRequired)}`);
  console.log('─'.repeat(68));
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  calcCapitalizedInterest,
  displayResults,
  buildBalanceChart,
};

// ─────────────────────────────────────────────────────────────────────────────
// TESTS — node src/calculators/capitalized_interest.js
// ─────────────────────────────────────────────────────────────────────────────
function runTests() {
  console.log('\n' + '█'.repeat(68));
  console.log('  CAPITALIZED INTEREST CALCULATOR — TEST RESULTS');
  console.log('█'.repeat(68));

  // ── TEST 1: Moana Option A — $724K purchase, Quality spec ────────────────
  const moanaA = calcCapitalizedInterest({
    acquisitionTotal:     794750,  // $724K + stamp duty + legal + DD + PEXA + title
    loanEstablishmentFee: 11000,   // ~1% of facility
    devCostsEarly:        32000,   // surveyor, town planner, early DA (drawn over hold)
    devCostsLate:         185000,  // civil, demo, services, site costs, PM
    constructionTotal:    619000,  // build + NCC + exclusions + landscape
    sellingCostsTotal:    71000,   // agent + marketing + conveyancing
    weeklyRent:           390,     // auto-calc: $724K × 4% × 70% ÷ 52
    holdMonths:           12,
    demoMonths:           3,
    buildMonths:          13,
    salesMonths:          4,
    annualRate:           0.065,
    lvr:                  0.70,
  });
  displayResults(moanaA, 'TEST 1 — Moana Option A: 2 × Detached, Quality Spec, $724K');
  console.log(buildBalanceChart(moanaA));

  // ── TEST 2: Same property — no hold period (fast-track comparison) ────────
  const moanaFast = calcCapitalizedInterest({
    acquisitionTotal:     794750,
    loanEstablishmentFee: 11000,
    devCostsEarly:        32000,
    devCostsLate:         185000,
    constructionTotal:    619000,
    sellingCostsTotal:    71000,
    weeklyRent:           0,
    holdMonths:           0,       // no hold
    demoMonths:           3,
    buildMonths:          13,
    salesMonths:          4,
    annualRate:           0.065,
    lvr:                  0.70,
  });
  displayResults(moanaFast, 'TEST 2 — Same property, fast-track (no hold period)');

  // ── TEST 3: Option C — 3 × Terraces (longer build) ───────────────────────
  const moanaC = calcCapitalizedInterest({
    acquisitionTotal:     794750,
    loanEstablishmentFee: 12000,
    devCostsEarly:        38000,
    devCostsLate:         215000,
    constructionTotal:    729000,
    sellingCostsTotal:    83000,
    weeklyRent:           390,
    holdMonths:           12,
    demoMonths:           3,
    buildMonths:          16,     // terraces take longer
    salesMonths:          4,
    annualRate:           0.065,
    lvr:                  0.70,
  });
  displayResults(moanaC, 'TEST 3 — Moana Option C: 3 × Terraces, Quality Spec');

  // ── TEST 4: Rate sensitivity — same project at different rates ────────────
  console.log('\n' + '═'.repeat(68));
  console.log('  TEST 4 — INTEREST RATE SENSITIVITY (Option A, $724K)');
  console.log('═'.repeat(68));
  console.log('  Rate    Gross Interest   Net Finance Cost   Peak Balance');
  console.log('  ' + '─'.repeat(55));
  [0.055, 0.060, 0.065, 0.070, 0.075, 0.080].forEach(rate => {
    const r = calcCapitalizedInterest({
      acquisitionTotal: 794750, loanEstablishmentFee: 11000,
      devCostsEarly: 32000, devCostsLate: 185000,
      constructionTotal: 619000, sellingCostsTotal: 71000,
      weeklyRent: 390, holdMonths: 12, demoMonths: 3,
      buildMonths: 13, salesMonths: 4,
      annualRate: rate, lvr: 0.70,
    });
    const fmt = (n) => `$${Math.round(n/1000)}K`;
    console.log(
      `  ${(rate*100).toFixed(1)}%    ${fmt(r.grossCapitalizedInterest).padEnd(16)}` +
      `${fmt(r.netFinanceCost).padEnd(19)}${fmt(r.peakLoanBalance)}`
    );
  });

  // ── Hold vs Fast-track comparison ────────────────────────────────────────
  console.log('\n' + '═'.repeat(68));
  console.log('  HOLD vs FAST-TRACK COMPARISON (Option A, $724K, 6.5%)');
  console.log('═'.repeat(68));
  const fmt = (n) => `$${Math.round(n).toLocaleString()}`;
  const rows = [
    ['Total months',           `${moanaA.totalMonths} months`,   `${moanaFast.totalMonths} months`],
    ['Gross cap. interest',    fmt(moanaA.grossCapitalizedInterest), fmt(moanaFast.grossCapitalizedInterest)],
    ['Rental income offset',  `-${fmt(moanaA.netRentalBenefit)}`, '$0'],
    ['Net finance cost',       fmt(moanaA.netFinanceCost),        fmt(moanaFast.netFinanceCost)],
    ['Peak loan balance',      fmt(moanaA.peakLoanBalance),       fmt(moanaFast.peakLoanBalance)],
    ['Equity required (30%)',  fmt(moanaA.equityRequired),        fmt(moanaFast.equityRequired)],
  ];
  console.log(`  ${'Item'.padEnd(28)} ${'Hold 12mo'.padEnd(18)} Fast-track`);
  console.log('  ' + '─'.repeat(60));
  rows.forEach(([label, hold, fast]) => {
    console.log(`  ${label.padEnd(28)} ${hold.padEnd(18)} ${fast}`);
  });

  const interestDiff = moanaFast.netFinanceCost - moanaA.netFinanceCost;
  console.log('\n  Net cost of holding vs fast-track: ' +
    (interestDiff > 0
      ? `Holding saves $${Math.round(Math.abs(interestDiff)).toLocaleString()}`
      : `Fast-track saves $${Math.round(Math.abs(interestDiff)).toLocaleString()}`)
  );

  console.log('\n  ✓ All tests complete\n');
}

runTests();