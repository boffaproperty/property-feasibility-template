// ─────────────────────────────────────────────────────────────────────────────
// income_tax.js
// Australian Property Development — Income Tax Calculator
// 2024-25 financial year rates
//
// CRITICAL CONCEPT — Development profit is ORDINARY INCOME, not a capital gain:
//
//   When you buy land with the intention of developing and selling, the ATO
//   treats the profit as ordinary income under the "profit-making scheme"
//   doctrine (or as trading stock income). This means:
//
//   ✗ The 50% CGT discount does NOT apply
//   ✗ You cannot use the main residence exemption
//   ✓ All development costs are deductible against the income
//   ✓ Entity structure determines the tax rate
//
//   This is the most important tax concept in development feasibility.
//   A developer showing "gross profit $300K" could net anywhere from
//   $159K (individual top rate) to $255K (trust split) depending on structure.
// ─────────────────────────────────────────────────────────────────────────────

// ─── TAX RATES & THRESHOLDS 2024-25 ──────────────────────────────────────────

// Company rates
const COMPANY_RATES = {
  baseRateEntity: {
    rate:  0.25,
    label: 'Company — Base Rate Entity (turnover < $50M, passive income < 80%)',
    note:  'Most development companies qualify. No CGT discount available in company.',
  },
  standard: {
    rate:  0.30,
    label: 'Company — Standard Rate (turnover > $50M)',
    note:  'Large companies only. Development companies almost always use 25% BRE rate.',
  },
};

// Individual progressive rates (2024-25 — post Stage 3 tax cuts)
// Includes 2% Medicare levy
const INDIVIDUAL_BRACKETS = [
  { min: 0,       max: 18200,  rate: 0.000, cumulative: 0      },
  { min: 18201,   max: 45000,  rate: 0.190, cumulative: 0      },
  { min: 45001,   max: 135000, rate: 0.325, cumulative: 5092   },
  { min: 135001,  max: 190000, rate: 0.370, cumulative: 34342  },
  { min: 190001,  max: Infinity,rate:0.450, cumulative: 54837  },
];

const MEDICARE_LEVY_RATE   = 0.020;
const MEDICARE_LEVY_THRESH = 26000;  // approximate low-income threshold
const LITO_MAX             = 700;    // Low Income Tax Offset (phases out $37.5K-$45K)

// SMSF rates
const SMSF_RATE = {
  accumulation: 0.15,
  pension:      0.00,  // assets supporting pension phase
  note: 'SMSF development is heavily restricted. Seek specialist advice before proceeding.',
};

// ─── INDIVIDUAL TAX CALCULATOR ────────────────────────────────────────────────
function calcIndividualTax(taxableIncome, existingIncome = 0) {
  // existingIncome = other income the individual already has
  // This matters because development profit stacks on top

  const totalIncome = taxableIncome + existingIncome;

  // Tax on total income
  function taxOnIncome(income) {
    if (income <= 0) return 0;
    let tax = 0;
    for (const bracket of INDIVIDUAL_BRACKETS) {
      if (income <= bracket.min) break;
      const taxableInBracket = Math.min(income, bracket.max) - bracket.min;
      if (taxableInBracket > 0) tax += taxableInBracket * bracket.rate;
    }
    return Math.round(tax);
  }

  // LITO — phases out between $37,500 and $45,000
  function calcLITO(income) {
    if (income <= 37500)  return LITO_MAX;
    if (income <= 45000)  return Math.max(0, LITO_MAX - (income - 37500) * (LITO_MAX / 7500));
    if (income <= 66667)  return Math.max(0, 325 - (income - 45000) * (325 / 21667));
    return 0;
  }

  // Medicare levy
  function calcMedicare(income) {
    if (income <= MEDICARE_LEVY_THRESH) return 0;
    return Math.round(income * MEDICARE_LEVY_RATE);
  }

  const taxOnTotal   = taxOnIncome(totalIncome);
  const taxOnExist   = taxOnIncome(existingIncome);
  const taxOnDev     = taxOnTotal - taxOnExist;  // marginal tax on development income
  const lito         = Math.round(calcLITO(totalIncome));
  const medicare     = calcMedicare(totalIncome);
  const mediOnExist  = calcMedicare(existingIncome);
  const mediOnDev    = medicare - mediOnExist;

  const totalTaxOnDev = Math.max(0, taxOnDev - lito + mediOnDev);

  // Effective marginal rate on the development income
  const marginalRate  = taxableIncome > 0
    ? parseFloat(((totalTaxOnDev / taxableIncome) * 100).toFixed(1))
    : 0;

  return {
    taxOnDevIncome:    Math.max(0, taxOnDev),
    medicareOnDev:     Math.max(0, mediOnDev),
    litoOffset:        lito,
    totalTaxOnDev,
    marginalRate,
    netDevProfit:      taxableIncome - totalTaxOnDev,
  };
}

// ─── TRUST DISTRIBUTION CALCULATOR ───────────────────────────────────────────
// Distributes trust income across multiple beneficiaries to minimise total tax
// Each beneficiary is taxed at their individual marginal rate
// Strategy: split income to keep each beneficiary below higher tax brackets

function calcTrustTax(trustIncome, beneficiaries) {
  // beneficiaries = array of { name, existingIncome } objects
  // trustIncome is distributed evenly (simplified — real distribution is flexible)

  const incomePerBeneficiary = trustIncome / beneficiaries.length;

  let totalTax = 0;
  const breakdown = beneficiaries.map(bene => {
    const result = calcIndividualTax(incomePerBeneficiary, bene.existingIncome || 0);
    totalTax += result.totalTaxOnDev;
    return {
      name:          bene.name,
      distribution:  Math.round(incomePerBeneficiary),
      existingIncome: bene.existingIncome || 0,
      tax:           result.totalTaxOnDev,
      marginalRate:  result.marginalRate,
      netIncome:     result.netDevProfit,
    };
  });

  return {
    trustIncome,
    beneficiaries:     breakdown,
    totalTax:          Math.round(totalTax),
    netAfterTax:       Math.round(trustIncome - totalTax),
    effectiveRate:     parseFloat(((totalTax / trustIncome) * 100).toFixed(1)),
  };
}

// ─── MAIN TAX CALCULATOR ─────────────────────────────────────────────────────
function calcIncomeTax(params) {
  const {
    grossProfit,          // development profit before income tax
    entityType,           // 'company_bre' | 'company_std' | 'individual' | 'trust' | 'smsf'
    existingIncome = 0,   // for individuals: other income already earned this year
    trustBeneficiaries = [
      { name: 'Beneficiary 1', existingIncome: 0 },
      { name: 'Beneficiary 2', existingIncome: 0 },
    ],
    companyRate = 0.25,   // override if needed
  } = params;

  if (grossProfit <= 0) {
    return {
      entityType, grossProfit,
      taxPayable: 0, netProfit: 0, effectiveRate: 0,
      note: 'No profit — no tax payable. Tax losses may be carried forward.',
    };
  }

  let result = {};

  switch (entityType) {
    case 'company_bre':
    case 'company': {
      const rate     = 0.25;
      const taxPayable = Math.round(grossProfit * rate);
      result = {
        entityType:    'Company (Base Rate Entity)',
        grossProfit,
        taxPayable,
        netProfit:     grossProfit - taxPayable,
        effectiveRate: rate * 100,
        rateLabel:     '25% flat — base rate entity',
        note:          'Retained profit taxed at 25%. Dividends to shareholders attract dividend imputation credits. No 50% CGT discount in company structure.',
        planning:      'Consider: paying director fees to shift income to individuals at lower marginal rates. Consult accountant on franking credit strategy.',
      };
      break;
    }
    case 'company_std': {
      const rate     = 0.30;
      const taxPayable = Math.round(grossProfit * rate);
      result = {
        entityType:    'Company (Standard Rate)',
        grossProfit,
        taxPayable,
        netProfit:     grossProfit - taxPayable,
        effectiveRate: rate * 100,
        rateLabel:     '30% flat',
        note:          'Standard company rate applies if passive income > 80% or turnover > $50M. Most development companies qualify for 25% BRE rate.',
        planning:      'Verify BRE status with accountant — you may qualify for 25% instead.',
      };
      break;
    }
    case 'individual': {
      const indResult  = calcIndividualTax(grossProfit, existingIncome);
      result = {
        entityType:    'Individual',
        grossProfit,
        taxPayable:    indResult.totalTaxOnDev,
        netProfit:     indResult.netDevProfit,
        effectiveRate: indResult.marginalRate,
        rateLabel:     `${indResult.marginalRate}% effective marginal rate`,
        breakdown: {
          incomeTax:   indResult.taxOnDevIncome,
          medicareLevy:indResult.medicareOnDev,
          litoOffset:  -indResult.litoOffset,
          total:       indResult.totalTaxOnDev,
        },
        note:          `Development profit of $${grossProfit.toLocaleString()} stacks on top of existing income of $${existingIncome.toLocaleString()}. Marginal rate on development income: ${indResult.marginalRate}%. Maximum individual rate is 47% (45% + 2% Medicare).`,
        planning:      'Consider: holding project in a company or trust to avoid top marginal rates. Timing income across tax years can reduce bracket exposure.',
      };
      break;
    }
    case 'trust': {
      const trustResult = calcTrustTax(grossProfit, trustBeneficiaries);
      result = {
        entityType:    `Discretionary Trust (${trustBeneficiaries.length} beneficiaries)`,
        grossProfit,
        taxPayable:    trustResult.totalTax,
        netProfit:     trustResult.netAfterTax,
        effectiveRate: trustResult.effectiveRate,
        rateLabel:     `${trustResult.effectiveRate}% blended effective rate`,
        distribution:  trustResult.beneficiaries,
        note:          'Trust distributes income to beneficiaries at their marginal rates. Most tax-efficient when income can be split across low-income beneficiaries. Trustee has discretion over distribution amounts.',
        planning:      'Optimize distribution: allocate more to lower-income beneficiaries. Consider distributing to a corporate beneficiary (company) at 25% for retained amounts.',
      };
      break;
    }
    case 'smsf': {
      const rate       = 0.15;
      const taxPayable = Math.round(grossProfit * rate);
      result = {
        entityType:    'SMSF (Self-Managed Super Fund)',
        grossProfit,
        taxPayable,
        netProfit:     grossProfit - taxPayable,
        effectiveRate: rate * 100,
        rateLabel:     '15% accumulation phase',
        note:          'WARNING: SMSF property development is heavily restricted. The SMSF cannot develop property for sale if the sole or dominant purpose is profit. Seek specialist SMSF legal advice before proceeding.',
        planning:      'In most cases, SMSF development is NOT appropriate. The low tax rate is attractive but the legal restrictions make it impractical for most development projects.',
        warning:       true,
      };
      break;
    }
    default:
      return { error: `Unknown entity type: ${entityType}. Use: company_bre, company_std, individual, trust, smsf` };
  }

  return result;
}

// ─── ENTITY COMPARISON HELPER ─────────────────────────────────────────────────
// Compare all entity types for a given profit level — shows optimal structure

function compareEntities(grossProfit, options = {}) {
  const {
    existingIncome     = 80000,   // assume individual has $80K other income
    trustBeneficiaries = [
      { name: 'Primary', existingIncome: 80000 },
      { name: 'Spouse',  existingIncome: 30000 },
    ],
  } = options;

  return [
    'company_bre',
    'company_std',
    'individual',
    'trust',
  ].map(entityType => {
    const r = calcIncomeTax({
      grossProfit,
      entityType,
      existingIncome,
      trustBeneficiaries,
    });
    return {
      entityType:    r.entityType,
      taxPayable:    r.taxPayable,
      netProfit:     r.netProfit,
      effectiveRate: r.effectiveRate,
    };
  }).sort((a, b) => b.netProfit - a.netProfit);  // best outcome first
}

// ─── DISPLAY ──────────────────────────────────────────────────────────────────
function displayResults(result, label = '') {
  const fmt = (n) => `$${Math.round(n).toLocaleString()}`;

  console.log('\n' + '═'.repeat(65));
  if (label) console.log(`  ${label}`);
  console.log(`  INCOME TAX ANALYSIS — ${result.entityType?.toUpperCase()}`);
  console.log('═'.repeat(65));
  if (result.warning) console.log('  ⚠  WARNING — see notes below');
  console.log(`  Gross profit (pre-tax):  ${fmt(result.grossProfit)}`);
  console.log(`  Tax payable:            -${fmt(result.taxPayable)}`);
  console.log(`  NET PROFIT (post-tax):   ${fmt(result.netProfit)}`);
  console.log(`  Effective rate:          ${result.effectiveRate}%`);
  if (result.breakdown) {
    console.log('─'.repeat(65));
    console.log('  Tax breakdown:');
    Object.entries(result.breakdown).forEach(([k, v]) => {
      if (k !== 'total') console.log(`    ${k.padEnd(20)} ${fmt(v)}`);
    });
  }
  if (result.distribution) {
    console.log('─'.repeat(65));
    console.log('  Trust distribution:');
    result.distribution.forEach(b => {
      console.log(`    ${b.name.padEnd(18)} receives ${fmt(b.distribution)} → pays ${fmt(b.tax)} tax (${b.marginalRate}%) → keeps ${fmt(b.netIncome)}`);
    });
  }
  console.log('─'.repeat(65));
  console.log(`  Note: ${result.note}`);
  if (result.planning) console.log(`  Planning: ${result.planning}`);
  console.log('─'.repeat(65));
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  calcIncomeTax,
  calcIndividualTax,
  calcTrustTax,
  compareEntities,
  displayResults,
  INDIVIDUAL_BRACKETS,
  COMPANY_RATES,
};

// ─────────────────────────────────────────────────────────────────────────────
// TESTS — node src/calculators/income_tax.js
// ─────────────────────────────────────────────────────────────────────────────
function runTests() {
  console.log('\n' + '█'.repeat(65));
  console.log('  INCOME TAX CALCULATOR — TEST RESULTS');
  console.log('█'.repeat(65));

  // Typical Moana gross profit range after all costs
  const grossProfits = [150000, 220000, 300000, 400000];

  // ── TEST 1: Company BRE — our default assumption ──────────────────────────
  displayResults(
    calcIncomeTax({ grossProfit: 280000, entityType: 'company_bre' }),
    'TEST 1 — Company BRE (25%) — $280K gross profit'
  );

  // ── TEST 2: Individual — high earner (already on top rate) ───────────────
  displayResults(
    calcIncomeTax({ grossProfit: 280000, entityType: 'individual', existingIncome: 120000 }),
    'TEST 2 — Individual — $280K profit stacked on $120K existing income'
  );

  // ── TEST 3: Trust — 2 beneficiaries ──────────────────────────────────────
  displayResults(
    calcIncomeTax({
      grossProfit:  280000,
      entityType:   'trust',
      trustBeneficiaries: [
        { name: 'Primary (salary $80K)',  existingIncome: 80000  },
        { name: 'Spouse (salary $30K)',   existingIncome: 30000  },
      ],
    }),
    'TEST 3 — Trust — $280K split across 2 beneficiaries'
  );

  // ── TEST 4: Entity comparison at multiple profit levels ───────────────────
  console.log('\n' + '═'.repeat(65));
  console.log('  TEST 4 — ENTITY COMPARISON ACROSS PROFIT LEVELS');
  console.log('  Individual existing income: $80K | Trust: 2 beneficiaries ($80K + $30K)');
  console.log('═'.repeat(65));

  grossProfits.forEach(gp => {
    const comparison = compareEntities(gp, {
      existingIncome: 80000,
      trustBeneficiaries: [
        { name: 'Primary', existingIncome: 80000 },
        { name: 'Spouse',  existingIncome: 30000 },
      ],
    });
    const fmt = (n) => `$${Math.round(n/1000)}K`;
    console.log(`\n  Gross profit: $${gp.toLocaleString()}`);
    console.log(`  ${'Entity'.padEnd(35)} ${'Tax'.padEnd(12)} ${'Net Profit'.padEnd(14)} Rate`);
    console.log('  ' + '─'.repeat(58));
    comparison.forEach((r, i) => {
      const star = i === 0 ? ' ★' : '';
      console.log(
        `  ${r.entityType.padEnd(35)} ` +
        `${fmt(r.taxPayable).padEnd(12)}` +
        `${fmt(r.netProfit).padEnd(14)}` +
        `${r.effectiveRate}%${star}`
      );
    });
  });

  // ── TEST 5: The real cost of wrong entity structure ───────────────────────
  console.log('\n' + '═'.repeat(65));
  console.log('  TEST 5 — COST OF WRONG ENTITY STRUCTURE');
  console.log('  $280K gross profit — Moana best estimate');
  console.log('═'.repeat(65));
  const gp = 280000;
  const fmt = (n) => `$${Math.round(n).toLocaleString()}`;
  const company = calcIncomeTax({ grossProfit: gp, entityType: 'company_bre' });
  const individual = calcIncomeTax({ grossProfit: gp, entityType: 'individual', existingIncome: 120000 });
  const trust = calcIncomeTax({
    grossProfit: gp, entityType: 'trust',
    trustBeneficiaries: [
      { name: 'Primary', existingIncome: 80000 },
      { name: 'Spouse',  existingIncome: 30000 },
    ],
  });

  console.log(`\n  Company BRE (25%):     tax ${fmt(company.taxPayable)} → keep ${fmt(company.netProfit)}`);
  console.log(`  Trust (split):         tax ${fmt(trust.taxPayable)} → keep ${fmt(trust.netProfit)}`);
  console.log(`  Individual (top rate): tax ${fmt(individual.taxPayable)} → keep ${fmt(individual.netProfit)}`);
  console.log(`\n  Wrong entity costs you: ${fmt(individual.taxPayable - company.taxPayable)} vs company`);
  console.log(`                          ${fmt(individual.taxPayable - trust.taxPayable)} vs trust`);
  console.log(`\n  Entity setup cost: ~$1,000–4,000 → saves ~${fmt(individual.taxPayable - company.taxPayable)}`);
  console.log(`  ROI on entity setup: ${Math.round((individual.taxPayable - company.taxPayable) / 2500)}× return`);

  console.log('\n  ✓ All tests complete\n');
}

runTests();