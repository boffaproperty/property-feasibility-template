// ─────────────────────────────────────────────────────────────────────────────
// auto_rent.js
// Automated Rental Estimate Calculator
//
// Estimates weekly rent for an existing dwelling during the hold period
// before development commences. Used to offset finance costs in the P&L.
//
// Method:
//   weekly_rent = (purchase_price × gross_yield × dwelling_factor) ÷ 52
//
//   gross_yield    — suburb/state benchmark (sourced from data file)
//   dwelling_factor — discount for existing/older dwelling vs new build
//                     (older dwellings rent below their theoretical yield)
//
// Also calculates the full holding period P&L:
//   net_rental_benefit = gross_rent - all_operating_costs
//
// This net figure feeds directly into capitalized_interest.js as the
// rental offset that reduces the effective finance cost during Phase 1.
// ─────────────────────────────────────────────────────────────────────────────

// ─── YIELD DATABASE ──────────────────────────────────────────────────────────
// Gross rental yields by state and suburb type
// Source: CoreLogic / Domain quarterly data (2024-25)
// Update this data file each quarter as yields change

const YIELD_DATA = {
  SA: {
    // Coastal suburbs (Moana, Aldinga Beach, Port Noarlunga, etc.)
    coastal:    { yield: 0.042, label: 'SA Coastal suburban' },
    // Metro Adelaide inner (5km radius)
    metroInner: { yield: 0.036, label: 'SA Metro inner' },
    // Metro Adelaide middle (5-15km)
    metroMid:   { yield: 0.040, label: 'SA Metro middle' },
    // Metro Adelaide outer (15km+)
    metroOuter: { yield: 0.044, label: 'SA Metro outer' },
    // Regional SA
    regional:   { yield: 0.055, label: 'SA Regional' },
    // Default fallback
    default:    { yield: 0.040, label: 'SA default' },
  },
  NSW: {
    coastal:    { yield: 0.032, label: 'NSW Coastal' },
    metroInner: { yield: 0.028, label: 'NSW Metro inner (Sydney)' },
    metroMid:   { yield: 0.031, label: 'NSW Metro middle' },
    metroOuter: { yield: 0.036, label: 'NSW Metro outer' },
    regional:   { yield: 0.048, label: 'NSW Regional' },
    default:    { yield: 0.032, label: 'NSW default' },
  },
  VIC: {
    coastal:    { yield: 0.033, label: 'VIC Coastal' },
    metroInner: { yield: 0.029, label: 'VIC Metro inner (Melbourne)' },
    metroMid:   { yield: 0.033, label: 'VIC Metro middle' },
    metroOuter: { yield: 0.038, label: 'VIC Metro outer' },
    regional:   { yield: 0.050, label: 'VIC Regional' },
    default:    { yield: 0.033, label: 'VIC default' },
  },
  QLD: {
    coastal:    { yield: 0.045, label: 'QLD Coastal' },
    metroInner: { yield: 0.038, label: 'QLD Metro inner (Brisbane)' },
    metroMid:   { yield: 0.042, label: 'QLD Metro middle' },
    metroOuter: { yield: 0.048, label: 'QLD Metro outer' },
    regional:   { yield: 0.058, label: 'QLD Regional' },
    default:    { yield: 0.042, label: 'QLD default' },
  },
  WA: {
    coastal:    { yield: 0.048, label: 'WA Coastal' },
    metroInner: { yield: 0.044, label: 'WA Metro inner (Perth)' },
    metroMid:   { yield: 0.048, label: 'WA Metro middle' },
    metroOuter: { yield: 0.052, label: 'WA Metro outer' },
    regional:   { yield: 0.065, label: 'WA Regional' },
    default:    { yield: 0.048, label: 'WA default' },
  },
  TAS: {
    default:    { yield: 0.045, label: 'TAS default' },
  },
  NT: {
    default:    { yield: 0.058, label: 'NT default' },
  },
  ACT: {
    default:    { yield: 0.038, label: 'ACT default' },
  },
};

// ─── DWELLING CONDITION FACTORS ───────────────────────────────────────────────
// Discount applied to the theoretical yield-based rent for older/existing dwellings
// A newer dwelling achieves closer to gross yield; an old fibro shack gets a discount

const DWELLING_FACTORS = {
  'post-2010':   { factor: 0.95, label: 'Modern dwelling (post-2010)' },
  '1990-2010':   { factor: 0.85, label: 'Established dwelling (1990–2010)' },
  '1970-1990':   { factor: 0.75, label: 'Older dwelling (1970–1990)' },
  'pre-1970':    { factor: 0.65, label: 'Old dwelling (pre-1970)' },
  'unknown':     { factor: 0.75, label: 'Unknown age (conservative estimate)' },
};

// ─── HOLDING COST CONSTANTS ───────────────────────────────────────────────────
// Annual operating costs for a typical investment property during hold
// These are deducted from gross rent to get net rental benefit
// Values are per-year; function prorates for actual hold period

const HOLDING_COSTS = {
  SA: {
    councilRates:  1900,   // Onkaparinga City Council — residential
    saWater:        850,   // SA Water supply charges (tenant pays usage)
    insurance:     1600,   // Landlord insurance
    pmFeeRate:     0.085,  // Property management: 8.5% of gross rent
    maintenance:   1500,   // Allowance for minor repairs
    esl:            450,   // Emergency Services Levy (SA-specific)
  },
  NSW: {
    councilRates:  2200,
    saWater:          0,   // Sydney Water — different structure
    insurance:     1800,
    pmFeeRate:     0.080,
    maintenance:   1500,
    esl:              0,
  },
  VIC: {
    councilRates:  2000,
    saWater:          0,
    insurance:     1700,
    pmFeeRate:     0.080,
    maintenance:   1500,
    esl:              0,
  },
  QLD: {
    councilRates:  2400,
    saWater:          0,
    insurance:     2000,
    pmFeeRate:     0.088,
    maintenance:   1500,
    esl:              0,
  },
  WA: {
    councilRates:  2100,
    saWater:          0,
    insurance:     1700,
    pmFeeRate:     0.095,  // WA PM fees typically higher
    maintenance:   1500,
    esl:              0,
  },
  default: {
    councilRates:  2000,
    saWater:          0,
    insurance:     1700,
    pmFeeRate:     0.085,
    maintenance:   1500,
    esl:              0,
  },
};

// ─── MAIN CALCULATOR ─────────────────────────────────────────────────────────
function calcAutoRent(params) {
  const {
    purchasePrice,
    state          = 'SA',
    suburbType     = 'coastal',    // coastal | metroInner | metroMid | metroOuter | regional | default
    dwellingAge    = '1970-1990',  // post-2010 | 1990-2010 | 1970-1990 | pre-1970 | unknown
    holdMonths     = 12,
    vacancyWeeks   = 2,            // assumed vacancy per year
    overrideWeeklyRent = null,     // if user provides actual rent, use it
  } = params;

  // Get yield data
  const yieldData = YIELD_DATA[state]?.[suburbType]
    || YIELD_DATA[state]?.default
    || YIELD_DATA.SA.default;

  // Get dwelling factor
  const dwellingData = DWELLING_FACTORS[dwellingAge] || DWELLING_FACTORS['unknown'];

  // Calculate estimated weekly rent
  const theoreticalAnnual  = purchasePrice * yieldData.yield;
  const adjustedAnnual     = theoreticalAnnual * dwellingData.factor;
  const estimatedWeeklyRaw = adjustedAnnual / 52;

  // Round to nearest $5 — agents price in $5 increments
  const estimatedWeekly = overrideWeeklyRent
    || Math.round(estimatedWeeklyRaw / 5) * 5;

  const isOverridden = overrideWeeklyRent != null;

  // Calculate gross rent for hold period
  const weeksInHold   = (holdMonths / 12) * 52;
  const occupiedWeeks = Math.max(0, weeksInHold - vacancyWeeks);
  const grossRent     = Math.round(estimatedWeekly * occupiedWeeks);

  // Calculate holding costs for the period
  const costs       = HOLDING_COSTS[state] || HOLDING_COSTS.default;
  const periodRatio = holdMonths / 12;

  const councilRates = Math.round(costs.councilRates * periodRatio);
  const waterCharges = Math.round(costs.saWater      * periodRatio);
  const insurance    = Math.round(costs.insurance    * periodRatio);
  const pmFee        = Math.round(grossRent          * costs.pmFeeRate);
  const maintenance  = Math.round(costs.maintenance  * periodRatio);
  const esl          = Math.round(costs.esl          * periodRatio);

  const totalOpex    = councilRates + waterCharges + insurance + pmFee + maintenance + esl;
  const netBenefit   = grossRent - totalOpex;
  const yieldOnCost  = (grossRent / purchasePrice) * (12 / holdMonths) * 100;

  return {
    // Rent estimate
    estimatedWeeklyRent:  estimatedWeekly,
    isOverridden,
    grossYield:           yieldData.yield,
    dwellingFactor:       dwellingData.factor,
    yieldLabel:           yieldData.label,
    dwellingLabel:        dwellingData.label,

    // Hold period income
    holdMonths,
    weeksInHold:          parseFloat(weeksInHold.toFixed(1)),
    occupiedWeeks:        parseFloat(occupiedWeeks.toFixed(1)),
    grossRent,

    // Holding costs (for the hold period)
    costs: {
      councilRates,
      waterCharges,
      insurance,
      pmFee,
      maintenance,
      esl,
      total: totalOpex,
    },

    // Net position
    netBenefit,
    yieldOnCost:          parseFloat(yieldOnCost.toFixed(2)),
    netYieldOnCost:       parseFloat(((netBenefit / purchasePrice) * (12 / holdMonths) * 100).toFixed(2)),

    // For use in capitalized_interest.js
    rentalOffsetForFinance: Math.max(0, netBenefit),
  };
}

// ─── ANNUAL EQUIVALENT HELPER ─────────────────────────────────────────────────
// Returns annualized figures — useful for comparing across different hold periods
function annualizedRent(params) {
  const r = calcAutoRent({ ...params, holdMonths: 12 });
  return {
    weeklyRent:     r.estimatedWeeklyRent,
    annualGross:    r.grossRent,
    annualOpex:     r.costs.total,
    annualNet:      r.netBenefit,
    grossYieldPct:  r.yieldOnCost,
    netYieldPct:    r.netYieldOnCost,
  };
}

// ─── DISPLAY ─────────────────────────────────────────────────────────────────
function displayResults(result, label = '') {
  const fmt = (n) => `$${Math.round(n).toLocaleString()}`;

  console.log('\n' + '═'.repeat(62));
  if (label) console.log(`  ${label}`);
  console.log('  RENTAL ESTIMATE & HOLDING PERIOD ANALYSIS');
  console.log('═'.repeat(62));
  console.log(`  Yield basis:      ${result.yieldLabel} (${(result.grossYield * 100).toFixed(1)}%)`);
  console.log(`  Dwelling factor:  ${result.dwellingLabel} (×${result.dwellingFactor})`);
  console.log(`  Estimated rent:   ${fmt(result.estimatedWeeklyRent)}/week${result.isOverridden ? ' (user override)' : ' (calculated)'}`);
  console.log(`  Hold period:      ${result.holdMonths} months (${result.occupiedWeeks} occupied weeks)`);
  console.log('─'.repeat(62));
  console.log(`  Gross rent collected:    ${fmt(result.grossRent)}`);
  console.log(`  Council rates:          -${fmt(result.costs.councilRates)}`);
  if (result.costs.waterCharges > 0)
    console.log(`  Water charges:          -${fmt(result.costs.waterCharges)}`);
  console.log(`  Landlord insurance:     -${fmt(result.costs.insurance)}`);
  console.log(`  PM fee (${(result.dwellingFactor >= 0.9 ? '8.5' : '8.5')}%):          -${fmt(result.costs.pmFee)}`);
  console.log(`  Maintenance:            -${fmt(result.costs.maintenance)}`);
  if (result.costs.esl > 0)
    console.log(`  Emergency Services Levy:-${fmt(result.costs.esl)}`);
  console.log(`  Total holding opex:     -${fmt(result.costs.total)}`);
  console.log('─'.repeat(62));
  console.log(`  NET RENTAL BENEFIT:      ${fmt(result.netBenefit)}`);
  console.log(`  (Offsets finance cost in Phase 1 of loan model)`);
  console.log(`  Gross yield on cost:     ${result.yieldOnCost}%`);
  console.log(`  Net yield on cost:       ${result.netYieldOnCost}%`);
  console.log('─'.repeat(62));
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  calcAutoRent,
  annualizedRent,
  displayResults,
  YIELD_DATA,
  HOLDING_COSTS,
  DWELLING_FACTORS,
};

// ─────────────────────────────────────────────────────────────────────────────
// TESTS — node src/calculators/auto_rent.js
// ─────────────────────────────────────────────────────────────────────────────
function runTests() {
  console.log('\n' + '█'.repeat(62));
  console.log('  AUTO RENT CALCULATOR — TEST RESULTS');
  console.log('█'.repeat(62));

  // ── TEST 1: Moana property — our base case ────────────────────────────────
  const moana = calcAutoRent({
    purchasePrice: 724000,
    state:         'SA',
    suburbType:    'coastal',
    dwellingAge:   '1970-1990',
    holdMonths:    12,
  });
  displayResults(moana, 'TEST 1 — Moana $724K, SA coastal, 1970-1990 dwelling');

  // ── TEST 2: Moana at bottom of listing range ($699K) ─────────────────────
  const moanaLow = calcAutoRent({
    purchasePrice: 699000,
    state:         'SA',
    suburbType:    'coastal',
    dwellingAge:   '1970-1990',
    holdMonths:    12,
  });
  displayResults(moanaLow, 'TEST 2 — Moana $699K (bottom of range)');

  // ── TEST 3: Same property but user overrides rent ─────────────────────────
  const moanaOverride = calcAutoRent({
    purchasePrice:        724000,
    state:                'SA',
    suburbType:           'coastal',
    dwellingAge:          '1970-1990',
    holdMonths:           12,
    overrideWeeklyRent:   450,   // agent has confirmed $450/week
  });
  displayResults(moanaOverride, 'TEST 3 — Same property, agent confirms $450/week');

  // ── TEST 4: Cross-state comparison — same $700K purchase ─────────────────
  console.log('\n' + '═'.repeat(62));
  console.log('  TEST 4 — CROSS-STATE COMPARISON ($700K, 1970-1990 dwelling)');
  console.log('═'.repeat(62));
  console.log('  State  Type         Wkly Rent  Gross Rent  Net Benefit');
  console.log('  ' + '─'.repeat(55));

  [
    { state:'SA',  type:'coastal'    },
    { state:'SA',  type:'metroMid'   },
    { state:'NSW', type:'coastal'    },
    { state:'NSW', type:'metroMid'   },
    { state:'VIC', type:'metroMid'   },
    { state:'QLD', type:'coastal'    },
    { state:'WA',  type:'coastal'    },
  ].forEach(({ state, type }) => {
    const r = calcAutoRent({
      purchasePrice: 700000,
      state, suburbType: type,
      dwellingAge: '1970-1990',
      holdMonths: 12,
    });
    console.log(
      `  ${state.padEnd(6)} ${type.padEnd(13)}` +
      `$${r.estimatedWeeklyRent}/wk    ` +
      `$${Math.round(r.grossRent/1000)}K        ` +
      `$${Math.round(r.netBenefit/1000)}K`
    );
  });

  // ── TEST 5: Different dwelling ages — same $724K Moana property ───────────
  console.log('\n' + '═'.repeat(62));
  console.log('  TEST 5 — DWELLING AGE IMPACT ($724K, SA coastal)');
  console.log('═'.repeat(62));
  console.log('  Age           Factor  Est. Rent  Annual Net');
  console.log('  ' + '─'.repeat(45));

  Object.entries(DWELLING_FACTORS).forEach(([age, data]) => {
    const r = calcAutoRent({
      purchasePrice: 724000,
      state: 'SA', suburbType: 'coastal',
      dwellingAge: age, holdMonths: 12,
    });
    console.log(
      `  ${age.padEnd(14)} ×${data.factor}    ` +
      `$${r.estimatedWeeklyRent}/wk   ` +
      `$${Math.round(r.netBenefit/1000)}K net`
    );
  });

  // ── Summary: what feeds into the finance model ────────────────────────────
  console.log('\n' + '═'.repeat(62));
  console.log('  WHAT FEEDS INTO capitalized_interest.js');
  console.log('═'.repeat(62));
  console.log(`  For Moana $724K (1970-1990 coastal dwelling, 12mo hold):`);
  console.log(`  rentalOffsetForFinance = $${moana.rentalOffsetForFinance.toLocaleString()}`);
  console.log(`  This reduces gross capitalized interest in Phase 1`);
  console.log(`  Difference to P&L vs zero rental: $${moana.rentalOffsetForFinance.toLocaleString()}`);
  console.log('─'.repeat(62));

  console.log('\n  ✓ All tests complete\n');
}

runTests();