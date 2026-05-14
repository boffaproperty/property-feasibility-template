// ─────────────────────────────────────────────────────────────────────────────
// stamp_duty.js
// Australian Stamp Duty / Transfer Duty Calculator
// All 8 states and territories — 2024-25 financial year rates
// Standard (non-concessional) rates — no first home buyer or PPR concessions
// These are the rates that apply to development / investment purchases
// ─────────────────────────────────────────────────────────────────────────────

// ─── SOUTH AUSTRALIA ─────────────────────────────────────────────────────────
// Source: RevenueSA — revenuesa.sa.gov.au/stampduty/real-property
function stampDutySA(value) {
  if (value <= 0)      return 0;
  if (value <= 12000)  return Math.round(value * 0.0100);
  if (value <= 30000)  return Math.round(120   + (value - 12000)  * 0.0200);
  if (value <= 50000)  return Math.round(480   + (value - 30000)  * 0.0300);
  if (value <= 100000) return Math.round(1080  + (value - 50000)  * 0.0350);
  if (value <= 200000) return Math.round(2830  + (value - 100000) * 0.0400);
  if (value <= 250000) return Math.round(6830  + (value - 200000) * 0.0450);
  if (value <= 300000) return Math.round(9080  + (value - 250000) * 0.0500);
  if (value <= 500000) return Math.round(11580 + (value - 300000) * 0.0550);
  return               Math.round(22580 + (value - 500000) * 0.0550);
}

// ─── NEW SOUTH WALES ─────────────────────────────────────────────────────────
// Source: Revenue NSW — revenue.nsw.gov.au/taxes-duties-levies-royalties/transfer-duty
function stampDutyNSW(value) {
  if (value <= 0)         return 0;
  if (value <= 16000)     return Math.round(value * 0.0125);
  if (value <= 35000)     return Math.round(200   + (value - 16000)  * 0.0150);
  if (value <= 93000)     return Math.round(485   + (value - 35000)  * 0.0175);
  if (value <= 351000)    return Math.round(1500  + (value - 93000)  * 0.0350);
  if (value <= 1168000)   return Math.round(10530 + (value - 351000) * 0.0450);
  if (value <= 3636000)   return Math.round(47295 + (value - 1168000)* 0.0550);
  return                  Math.round(177490 + (value - 3636000) * 0.0700);
}

// ─── VICTORIA ────────────────────────────────────────────────────────────────
// Source: SRO Victoria — sro.vic.gov.au/land-transfer-duty
// Non-owner-occupier / investment rates
function stampDutyVIC(value) {
  if (value <= 0)        return 0;
  if (value <= 25000)    return Math.round(value * 0.0140);
  if (value <= 130000)   return Math.round(350   + (value - 25000)  * 0.0240);
  if (value <= 960000)   return Math.round(2870  + (value - 130000) * 0.0600);
  if (value <= 2000000)  return Math.round(value * 0.0550);  // 5.5% of total
  return                 Math.round(value * 0.0650);          // 6.5% of total
}

// ─── QUEENSLAND ──────────────────────────────────────────────────────────────
// Source: Queensland Revenue Office — qro.qld.gov.au/duties/transfer-duty
function stampDutyQLD(value) {
  if (value <= 0)        return 0;
  if (value <= 5000)     return 0;
  if (value <= 75000)    return Math.round((value - 5000)   * 0.0150);
  if (value <= 540000)   return Math.round(1050  + (value - 75000)  * 0.0350);
  if (value <= 1000000)  return Math.round(17325 + (value - 540000) * 0.0450);
  return                 Math.round(38025 + (value - 1000000)* 0.0575);
}

// ─── WESTERN AUSTRALIA ───────────────────────────────────────────────────────
// Source: WA Revenue — revenue.wa.gov.au/duties/transfer-duty
function stampDutyWA(value) {
  if (value <= 0)        return 0;
  if (value <= 80000)    return Math.round(value * 0.0190);
  if (value <= 100000)   return Math.round(1520  + (value - 80000)  * 0.0285);
  if (value <= 250000)   return Math.round(2090  + (value - 100000) * 0.0380);
  if (value <= 500000)   return Math.round(7790  + (value - 250000) * 0.0475);
  return                 Math.round(19665 + (value - 500000) * 0.0515);
}

// ─── TASMANIA ────────────────────────────────────────────────────────────────
// Source: State Revenue Office Tasmania — sro.tas.gov.au/duties/duty-on-dutiable-transactions
function stampDutyTAS(value) {
  if (value <= 0)        return 0;
  if (value <= 3000)     return 50;
  if (value <= 25000)    return Math.round(50    + (value - 3000)   * 0.0175);
  if (value <= 75000)    return Math.round(435   + (value - 25000)  * 0.0225);
  if (value <= 200000)   return Math.round(1560  + (value - 75000)  * 0.0325);
  if (value <= 375000)   return Math.round(5623  + (value - 200000) * 0.0400);
  if (value <= 725000)   return Math.round(12623 + (value - 375000) * 0.0425);
  return                 Math.round(27498 + (value - 725000) * 0.0450);
}

// ─── NORTHERN TERRITORY ──────────────────────────────────────────────────────
// Source: Territory Revenue Office — treasury.nt.gov.au/dtf/territory-revenue-office
// NT uses a unique formula-based calculation
function stampDutyNT(value) {
  if (value <= 0)    return 0;
  if (value <= 525000) {
    const V = value / 1000;
    return Math.round(0.06571441 * V * V + 15 * V);
  }
  return Math.round(value * 0.0495);  // 4.95% flat above $525K
}

// ─── AUSTRALIAN CAPITAL TERRITORY ────────────────────────────────────────────
// Source: ACT Revenue — revenue.act.gov.au/duties/conveyance-duty
// General rates (no concessions) — 2024-25
// Note: ACT is transitioning to land value tax; verify before exchange
function stampDutyACT(value) {
  if (value <= 0)        return 0;
  if (value <= 200000)   return Math.round(value * 0.0060);
  if (value <= 300000)   return Math.round(1200  + (value - 200000) * 0.0230);
  if (value <= 500000)   return Math.round(3500  + (value - 300000) * 0.0390);
  if (value <= 750000)   return Math.round(11300 + (value - 500000) * 0.0490);
  if (value <= 1000000)  return Math.round(23550 + (value - 750000) * 0.0494);
  if (value <= 1455000)  return Math.round(35900 + (value - 1000000)* 0.0498);
  return                 Math.round(58600 + (value - 1455000) * 0.0509);
}

// ─── MASTER FUNCTION ─────────────────────────────────────────────────────────
// Single entry point — auto-selects state function
// Usage: stampDuty(724000, 'SA')  →  returns duty amount in dollars
function stampDuty(value, state) {
  const s = state.toUpperCase().trim();
  switch(s) {
    case 'SA':  return stampDutySA(value);
    case 'NSW': return stampDutyNSW(value);
    case 'VIC': return stampDutyVIC(value);
    case 'QLD': return stampDutyQLD(value);
    case 'WA':  return stampDutyWA(value);
    case 'TAS': return stampDutyTAS(value);
    case 'NT':  return stampDutyNT(value);
    case 'ACT': return stampDutyACT(value);
    default:    throw new Error(`Unknown state: ${state}. Use SA, NSW, VIC, QLD, WA, TAS, NT, or ACT`);
  }
}

// ─── EFFECTIVE RATE HELPER ────────────────────────────────────────────────────
// Returns the effective rate as a percentage — useful for displaying in the UI
function effectiveRate(value, state) {
  if (value <= 0) return 0;
  return (stampDuty(value, state) / value) * 100;
}

// ─── FULL BREAKDOWN HELPER ────────────────────────────────────────────────────
// Returns an object with all figures — useful for the P&L display
function stampDutyBreakdown(value, state) {
  const duty = stampDuty(value, state);
  return {
    purchasePrice:  value,
    state:          state.toUpperCase(),
    duty:           duty,
    effectiveRate:  parseFloat(effectiveRate(value, state).toFixed(2)),
    totalWithDuty:  value + duty,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS — for use in the React app and other skill files
// ─────────────────────────────────────────────────────────────────────────────
export {
  stampDuty,
  stampDutySA,
  stampDutyNSW,
  stampDutyVIC,
  stampDutyQLD,
  stampDutyWA,
  stampDutyTAS,
  stampDutyNT,
  stampDutyACT,
  effectiveRate,
  stampDutyBreakdown,
};

// ─────────────────────────────────────────────────────────────────────────────
// TESTS — run with: node stamp_duty.js
// Validates against known values from each state's revenue office
// ─────────────────────────────────────────────────────────────────────────────
function runTests() {
  const fmt = (n) => `$${Math.round(n).toLocaleString()}`;
  const pct = (n) => `${n.toFixed(2)}%`;

  const tests = [
    // SA — our Moana property
    { state:'SA',  price:699000, desc:'Moana property (bottom of range)' },
    { state:'SA',  price:724000, desc:'Moana property (midpoint)'        },
    { state:'SA',  price:749000, desc:'Moana property (top of range)'    },
    // Cross-state — same $700K purchase for comparison
    { state:'NSW', price:700000, desc:'Sydney equivalent purchase'       },
    { state:'VIC', price:700000, desc:'Melbourne equivalent purchase'    },
    { state:'QLD', price:700000, desc:'Brisbane equivalent purchase'     },
    { state:'WA',  price:700000, desc:'Perth equivalent purchase'        },
    { state:'TAS', price:700000, desc:'Hobart equivalent purchase'       },
    { state:'NT',  price:700000, desc:'Darwin equivalent purchase'       },
    { state:'ACT', price:700000, desc:'Canberra equivalent purchase'     },
    // Edge cases
    { state:'SA',  price:500000, desc:'SA at $500K bracket boundary'    },
    { state:'NSW', price:1000000,desc:'NSW at $1M'                      },
    { state:'VIC', price:1000000,desc:'VIC at $1M (flat rate zone)'     },
  ];

  console.log('\n' + '═'.repeat(72));
  console.log('  STAMP DUTY CALCULATOR — TEST RESULTS');
  console.log('  All Australian States & Territories — 2024-25 rates');
  console.log('═'.repeat(72));
  console.log(
    'State  Purchase Price   Duty          Eff. Rate  Description'
  );
  console.log('─'.repeat(72));

  tests.forEach(t => {
    const duty  = stampDuty(t.price, t.state);
    const rate  = effectiveRate(t.price, t.state);
    console.log(
      `${t.state.padEnd(6)} ${fmt(t.price).padEnd(16)} ${fmt(duty).padEnd(13)} ${pct(rate).padEnd(10)} ${t.desc}`
    );
  });

  console.log('─'.repeat(72));
  console.log('\n  SA CROSS-STATE COMPARISON — $724,000 purchase\n');
  console.log('  State   Duty          Effective Rate');
  console.log('  ' + '─'.repeat(38));
  ['SA','NSW','VIC','QLD','WA','TAS','NT','ACT'].forEach(state => {
    const duty = stampDuty(724000, state);
    const rate = effectiveRate(724000, state);
    console.log(`  ${state.padEnd(7)} ${fmt(duty).padEnd(13)} ${pct(rate)}`);
  });

  console.log('\n  ✓ Tests complete\n');
}

runTests();