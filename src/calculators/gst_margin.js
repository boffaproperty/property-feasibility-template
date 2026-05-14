// ─────────────────────────────────────────────────────────────────────────────
// gst_margin.js
// GST Calculator — Margin Scheme for Property Development
//
// How GST works in property development (Australia):
//
//   Standard method:  GST = sale price ÷ 11
//                     (10% on every dollar of sale proceeds)
//
//   Margin scheme:    GST = (sale price − purchase price) ÷ 11
//                     (10% only on the VALUE YOU ADDED, not the full sale price)
//
// The margin scheme almost always produces a lower GST liability for developers
// because it excludes the original land value from the taxable base.
//
// ELIGIBILITY for margin scheme:
//   ✓ You are GST-registered (mandatory for development — turnover > $75K)
//   ✓ The original purchase was NOT subject to GST (e.g. buying from a
//     private individual or an input-taxed entity)
//   ✓ You make a written election with the vendor BEFORE or AT settlement
//   ✗ Cannot use if vendor charged you GST on the purchase
//   ✗ Cannot use for commercial property without specific conditions
//
// INPUT TAX CREDITS (ITCs):
//   Even under the margin scheme, you can STILL claim back GST you paid on:
//   ✓ Construction costs (builder, trades)
//   ✓ Professional fees (surveyor, town planner, architect)
//   ✓ Development costs (civil works, demolition)
//   ✓ Selling costs (agent commission, marketing)
//   ✓ Legal fees (conveyancing, loan docs)
//   ✗ Government fees have NO GST (council DA fees, title registration, stamp duty)
//   ✗ Finance costs have NO GST (interest, loan fees)
//   ✗ Water authority charges — no GST
//
// NET GST PAYABLE = GST on margin − eligible input tax credits
// ─────────────────────────────────────────────────────────────────────────────

// ─── GST APPLICABILITY BY COST CATEGORY ──────────────────────────────────────
// true  = GST applies, credit claimable
// false = no GST (government charges, finance, exempt supplies)

const GST_APPLICABILITY = {
  // Acquisition
  purchasePrice:        false,  // buying from private vendor — no GST
  stampDuty:            false,  // government charge — no GST
  legalConveyancing:    true,   // solicitor fees — GST applies
  dueDiligence:         true,   // inspections — GST applies
  buyersAgent:          true,   // agent service — GST applies
  pexa:                 false,  // PEXA settlement fee — no GST (financial)

  // Demolition
  demolition:           true,   // contractor — GST applies
  asbestosRemoval:      true,   // licensed contractor — GST applies
  dilapidation:         true,   // consultant — GST applies
  treeRemoval:          true,   // arborist — GST applies

  // Development
  surveyor:             true,   // professional service — GST applies
  townPlanner:          true,   // professional service — GST applies
  councilDAFees:        false,  // government charge — NO GST
  infrastructureLevy:   false,  // government charge — NO GST
  saWaterHeadworks:     false,  // government authority — NO GST
  nbnPitPipe:           true,   // contractor — GST applies
  sapnConnection:       false,  // network authority — no GST on connection fee
  civilWorks:           true,   // contractor — GST applies
  buildingDA:           false,  // government charge — NO GST
  landDivisionCert:     false,  // government charge — NO GST
  roadPermit:           false,  // government charge — NO GST
  siteCosts:            true,   // contractor — GST applies
  projectManagement:    true,   // consultant — GST applies
  strataSetup:          true,   // legal/admin — GST applies

  // Construction
  buildCost:            true,   // builder — GST applies
  ncc7star:             true,   // contractor — GST applies
  builderExclusions:    true,   // contractor — GST applies
  landscaping:          true,   // contractor — GST applies
  retainingWalls:       true,   // contractor — GST applies
  practicalCompletion:  true,   // inspector — GST applies

  // Finance (ALL exempt — financial services)
  loanEstablishment:    false,
  bankValuation:        false,
  qsFees:               false,  // QS is professional but survey/QS GST is debated — conservative: no
  loanLegal:            true,   // legal fees — GST applies
  financeBroker:        true,   // broker service — GST applies

  // Tax & Compliance
  entitySetup:          true,   // legal/accounting — GST applies
  accountant:           true,   // accounting — GST applies

  // Selling (all taxable)
  agentCommission:      true,   // agent service — GST applies
  marketing:            true,   // marketing — GST applies
  saleConveyancing:     true,   // legal — GST applies
};

// ─── MAIN GST CALCULATOR ─────────────────────────────────────────────────────
function calcGST(params) {
  const {
    // Sale details
    salePrices,               // array of sale prices per dwelling e.g. [1200000, 980000]
    purchasePrice,            // original land purchase price

    // Cost inputs (ex-GST amounts — the base cost before 10% GST is added)
    // Pass each cost category separately for accurate ITC calculation
    costs = {},

    // Options
    useMarginScheme   = true,  // almost always true for dev purchases from private
    gstRegistered     = true,  // assumed yes — development always exceeds $75K threshold
    costsAreExGST     = true,  // true = costs provided are ex-GST (standard for feasibility)
  } = params;

  if (!gstRegistered) {
    return { error: 'GST registration required for property development. Turnover will exceed $75K threshold.' };
  }

  const totalSalePrice = salePrices.reduce((a, b) => a + b, 0);

  // ── MARGIN SCHEME CALCULATION ─────────────────────────────────────────────
  let gstOnSale, method;

  if (useMarginScheme) {
    // Margin = total sale proceeds minus original purchase price
    // Note: purchase price only — NOT stamp duty or other acquisition costs
    const margin = totalSalePrice - purchasePrice;
    gstOnSale    = Math.round(margin / 11);
    method       = 'Margin Scheme';
  } else {
    // Standard method — GST on full sale price
    gstOnSale = Math.round(totalSalePrice / 11);
    method    = 'Standard Method';
  }

  // ── INPUT TAX CREDITS (ITCs) ──────────────────────────────────────────────
  // Calculate claimable ITCs from each cost category
  const itcBreakdown = {};
  let totalITCs = 0;

  Object.entries(costs).forEach(([category, amount]) => {
    if (amount && amount > 0) {
      const hasGST = GST_APPLICABILITY[category];
      if (hasGST === true) {
        // If costs are ex-GST: ITC = cost × 10% (the GST on top)
        // If costs are incl-GST: ITC = cost ÷ 11 (the GST within)
        const itc = costsAreExGST
          ? Math.round(amount * 0.10)
          : Math.round(amount / 11);
        itcBreakdown[category] = { amount, hasGST: true, itc };
        totalITCs += itc;
      } else if (hasGST === false) {
        itcBreakdown[category] = { amount, hasGST: false, itc: 0 };
      } else {
        // Unknown category — assume no GST (conservative)
        itcBreakdown[category] = { amount, hasGST: 'unknown', itc: 0 };
      }
    }
  });

  // ── NET GST ───────────────────────────────────────────────────────────────
  const netGSTPyable = Math.max(0, gstOnSale - totalITCs);

  // ── COMPARISON: margin vs standard ───────────────────────────────────────
  const standardGST          = Math.round(totalSalePrice / 11);
  const marginGST            = Math.round((totalSalePrice - purchasePrice) / 11);
  const marginSchemeSaving   = standardGST - marginGST;

  // ── PER-DWELLING BREAKDOWN ────────────────────────────────────────────────
  // Apportion GST equally across dwellings (or by proportion of sale price)
  const perDwelling = salePrices.map((sp, i) => {
    const proportion    = sp / totalSalePrice;
    const gstApportioned = Math.round(netGSTPyable * proportion);
    const saleExGST     = useMarginScheme
      ? sp  // Under margin scheme, sale price is the full amount (GST included in margin calc)
      : Math.round(sp / 1.1);
    return {
      dwelling:         i + 1,
      salePrice:        sp,
      proportion:       parseFloat((proportion * 100).toFixed(1)),
      gstApportioned,
    };
  });

  // ── EFFECTIVE RATES ────────────────────────────────────────────────────────
  const effectiveGSTRate = parseFloat(((netGSTPyable / totalSalePrice) * 100).toFixed(2));
  const marginPct        = parseFloat((((totalSalePrice - purchasePrice) / totalSalePrice) * 100).toFixed(1));

  return {
    // Method
    method,
    useMarginScheme,
    gstRegistered,

    // Sale
    totalSalePrice,
    purchasePrice,
    margin:             totalSalePrice - purchasePrice,
    marginPct,

    // GST on sale
    gstOnSale,

    // ITCs
    itcBreakdown,
    totalITCs,

    // Net
    netGSTPyable,
    effectiveGSTRate,

    // Comparison
    standardGST,
    marginGST,
    marginSchemeSaving,

    // Per dwelling
    perDwelling,

    // Key advisory flags
    flags: [
      !useMarginScheme && 'WARNING: Not using margin scheme — significantly higher GST liability',
      marginSchemeSaving > 5000 && `Margin scheme saves $${marginSchemeSaving.toLocaleString()} vs standard method`,
      totalITCs > gstOnSale && 'NOTE: ITCs exceed GST on sale — ATO will refund the difference',
      'Margin scheme election must be made IN WRITING before or at settlement',
      'Confirm GST treatment with a property tax accountant before exchange',
    ].filter(Boolean),
  };
}

// ─── SIMPLIFIED HELPER ────────────────────────────────────────────────────────
// Quick estimate when you don't have a full cost breakdown
// Uses the margin scheme formula with a standard ITC estimate

function quickGSTEstimate(salePrices, purchasePrice, constructionTotal) {
  const totalSale    = salePrices.reduce((a, b) => a + b, 0);
  const margin       = totalSale - purchasePrice;
  const gstOnMargin  = Math.round(margin / 11);
  // Estimate ITCs at 9.09% of construction (i.e. 10% / 110 of GST-inclusive construction)
  const estimatedITC = Math.round(constructionTotal * 0.0909);
  const netGST       = Math.max(0, gstOnMargin - estimatedITC);
  return { gstOnMargin, estimatedITC, netGST, margin };
}

// ─── DISPLAY ─────────────────────────────────────────────────────────────────
function displayResults(result, label = '') {
  const fmt = (n) => `$${Math.round(n).toLocaleString()}`;

  console.log('\n' + '═'.repeat(65));
  if (label) console.log(`  ${label}`);
  console.log('  GST ANALYSIS — MARGIN SCHEME');
  console.log('═'.repeat(65));
  console.log(`  Method:              ${result.method}`);
  console.log(`  Total sale price:    ${fmt(result.totalSalePrice)}`);
  console.log(`  Purchase price:      ${fmt(result.purchasePrice)}`);
  console.log(`  Developer margin:    ${fmt(result.margin)} (${result.marginPct}% of sale)`);
  console.log('─'.repeat(65));
  console.log(`  GST on margin:       ${fmt(result.gstOnSale)}`);
  console.log(`  Less: ITCs claimed: -${fmt(result.totalITCs)}`);
  console.log(`  NET GST PAYABLE:     ${fmt(result.netGSTPyable)}`);
  console.log(`  Effective GST rate:  ${result.effectiveGSTRate}% of sale price`);
  console.log('─'.repeat(65));
  console.log(`  MARGIN SCHEME SAVES: ${fmt(result.marginSchemeSaving)} vs standard method`);
  console.log('─'.repeat(65));

  if (result.perDwelling.length > 1) {
    console.log('  Per dwelling:');
    result.perDwelling.forEach(d => {
      console.log(`    Dwelling ${d.dwelling}: ${fmt(d.salePrice)} → GST ${fmt(d.gstApportioned)}`);
    });
    console.log('─'.repeat(65));
  }

  console.log('  Key flags:');
  result.flags.forEach(f => console.log(`    ⚑ ${f}`));
  console.log('─'.repeat(65));
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  calcGST,
  quickGSTEstimate,
  displayResults,
  GST_APPLICABILITY,
};

// ─────────────────────────────────────────────────────────────────────────────
// TESTS — node src/calculators/gst_margin.js
// ─────────────────────────────────────────────────────────────────────────────
function runTests() {
  console.log('\n' + '█'.repeat(65));
  console.log('  GST MARGIN SCHEME CALCULATOR — TEST RESULTS');
  console.log('█'.repeat(65));

  // ── TEST 1: Moana Option A — 2 × detached, quality spec ──────────────────
  const moanaA = calcGST({
    salePrices:    [1350000, 1050000],
    purchasePrice: 724000,
    costs: {
      // Demolition & dev (ex-GST amounts)
      demolition:          22000,
      asbestosRemoval:     18000,
      dilapidation:         3500,
      surveyor:            14000,
      townPlanner:          9000,
      councilDAFees:        7500,   // no GST
      infrastructureLevy:  12000,   // no GST
      saWaterHeadworks:    15000,   // no GST
      nbnPitPipe:           9000,
      civilWorks:          52000,
      buildingDA:           8400,   // no GST (gov charge)
      siteCosts:           30000,
      projectManagement:   22000,
      // Construction (ex-GST)
      buildCost:           462000,
      builderExclusions:    64000,
      landscaping:          65000,
      ncc7star:             24000,
      practicalCompletion:   1500,
      // Selling
      agentCommission:      52800,
      marketing:            20000,
      saleConveyancing:      7000,
      // Finance (no GST)
      loanEstablishment:    11000,  // no GST
      // Legal
      legalConveyancing:     3500,
      loanLegal:             3200,
    },
    useMarginScheme: true,
    costsAreExGST:   true,
  });
  displayResults(moanaA, 'TEST 1 — Moana Option A: $1.35M + $1.05M sale, $724K purchase');

  // ── TEST 2: Option C — 3 × terraces ──────────────────────────────────────
  const moanaC = calcGST({
    salePrices:    [980000, 980000, 980000],
    purchasePrice: 724000,
    costs: {
      demolition:         22000,
      asbestosRemoval:    18000,
      surveyor:           22000,
      townPlanner:         9000,
      councilDAFees:      13000,
      infrastructureLevy: 24000,
      saWaterHeadworks:   30000,
      nbnPitPipe:         13500,
      civilWorks:         75000,
      buildingDA:         12600,
      siteCosts:          37000,
      projectManagement:  25000,
      strataSetup:        17000,
      buildCost:         536000,
      builderExclusions:  96000,
      landscaping:        76000,
      ncc7star:           36000,
      agentCommission:    64680,
      marketing:          29000,
      saleConveyancing:    9000,
      loanEstablishment:  12000,
      legalConveyancing:   3500,
      loanLegal:           3200,
    },
    useMarginScheme: true,
    costsAreExGST:   true,
  });
  displayResults(moanaC, 'TEST 2 — Moana Option C: 3 × $980K terrace, $724K purchase');

  // ── TEST 3: Margin scheme vs standard method comparison ───────────────────
  console.log('\n' + '═'.repeat(65));
  console.log('  TEST 3 — MARGIN SCHEME vs STANDARD METHOD COMPARISON');
  console.log('  Same property, same sale price — $2.4M revenue, $724K purchase');
  console.log('═'.repeat(65));

  const standardMethod = calcGST({
    salePrices:    [1350000, 1050000],
    purchasePrice: 724000,
    costs: { buildCost: 462000, civilWorks: 52000, agentCommission: 52800 },
    useMarginScheme: false,
    costsAreExGST: true,
  });

  const fmt = (n) => `$${Math.round(n).toLocaleString()}`;
  console.log(`\n  ${'Item'.padEnd(35)} ${'Margin Scheme'.padEnd(18)} Standard Method`);
  console.log('  ' + '─'.repeat(58));
  [
    ['GST on sale',    fmt(moanaA.gstOnSale),       fmt(standardMethod.gstOnSale)],
    ['Less: ITCs',    `-${fmt(moanaA.totalITCs)}`,  `-${fmt(standardMethod.totalITCs)}`],
    ['NET GST payable', fmt(moanaA.netGSTPyable),   fmt(standardMethod.netGSTPyable)],
    ['Developer saves', fmt(moanaA.marginSchemeSaving), '—'],
  ].forEach(([label, margin, standard]) => {
    console.log(`  ${label.padEnd(35)} ${margin.padEnd(18)} ${standard}`);
  });

  // ── TEST 4: Quick estimate helper ─────────────────────────────────────────
  console.log('\n' + '═'.repeat(65));
  console.log('  TEST 4 — QUICK ESTIMATE (no full cost breakdown)');
  console.log('═'.repeat(65));
  [
    { label: '$699K purchase, Option A quality',  sale:[1350000,1050000], pp:699000, con:619000 },
    { label: '$724K purchase, Option A quality',  sale:[1350000,1050000], pp:724000, con:619000 },
    { label: '$749K purchase, Option A quality',  sale:[1350000,1050000], pp:749000, con:619000 },
    { label: '$724K purchase, Option C quality',  sale:[980000,980000,980000], pp:724000, con:729000 },
    { label: '$724K purchase, Option A premium',  sale:[1700000,1350000], pp:724000, con:784000 },
  ].forEach(t => {
    const q = quickGSTEstimate(t.sale, t.pp, t.con);
    console.log(`  ${t.label}`);
    console.log(`    Sale: ${fmt(t.sale.reduce((a,b)=>a+b,0))} | GST on margin: ${fmt(q.gstOnMargin)} | Est. ITCs: ${fmt(q.estimatedITC)} | Net GST: ${fmt(q.netGST)}`);
  });

  console.log('\n  ✓ All tests complete\n');
}

runTests();
