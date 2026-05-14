// ─────────────────────────────────────────────────────────────────────────────
// subdivision_yield.js
// Property Subdivision Yield Calculator
// Determines maximum lot yield, dwelling types, and zone compliance
// Based on SA Planning & Design Code — General Neighbourhood Zone (GN)
// Extensible to other states and zones via the ZONE_RULES data structure
// ─────────────────────────────────────────────────────────────────────────────

// ─── ZONE RULES DATABASE ─────────────────────────────────────────────────────
// Min site area (m²) and min frontage (m) per dwelling type, per zone
// Source: SA Planning & Design Code 2024
// Add new states/zones here as the skill expands

const ZONE_RULES = {
  SA: {
    GN: {  // General Neighbourhood — covers Old Survey Moana, most established suburbs
      name: 'General Neighbourhood Zone',
      detached:      { minSite: 300, minFrontage: 9  },
      semiDetached:  { minSite: 300, minFrontage: 9  },
      row:           { minSite: 200, minFrontage: 7  },
      group:         { minSite: 300, minFrontage: 15 }, // whole building frontage
    },
    SN: {  // Suburban Neighbourhood
      name: 'Suburban Neighbourhood Zone',
      detached:      { minSite: 400, minFrontage: 10 },
      semiDetached:  { minSite: 350, minFrontage: 9  },
      row:           { minSite: 250, minFrontage: 8  },
      group:         { minSite: 350, minFrontage: 15 },
    },
    RN: {  // Residential Neighbourhood
      name: 'Residential Neighbourhood Zone',
      detached:      { minSite: 270, minFrontage: 9  },
      semiDetached:  { minSite: 270, minFrontage: 9  },
      row:           { minSite: 180, minFrontage: 6  },
      group:         { minSite: 270, minFrontage: 12 },
    },
    UC: {  // Urban Corridor — higher density
      name: 'Urban Corridor Zone',
      detached:      { minSite: 250, minFrontage: 8  },
      semiDetached:  { minSite: 200, minFrontage: 7  },
      row:           { minSite: 120, minFrontage: 5  },
      group:         { minSite: 200, minFrontage: 12 },
    },
    HF: {  // Hills Face Zone — very restrictive
      name: 'Hills Face Zone',
      detached:      { minSite: 8000, minFrontage: 30 },
      semiDetached:  { minSite: null, minFrontage: null }, // not permitted
      row:           { minSite: null, minFrontage: null }, // not permitted
      group:         { minSite: null, minFrontage: null }, // not permitted
    },
  },
  // NSW, VIC, QLD placeholders — expand in future sessions
  NSW: {
    R2: {  // Low Density Residential
      name: 'R2 Low Density Residential',
      detached:      { minSite: 450, minFrontage: 12 },
      semiDetached:  { minSite: 300, minFrontage: 9  },
      row:           { minSite: 200, minFrontage: 6  },
      group:         { minSite: 300, minFrontage: 12 },
    },
    R3: {  // Medium Density Residential
      name: 'R3 Medium Density Residential',
      detached:      { minSite: 400, minFrontage: 10 },
      semiDetached:  { minSite: 250, minFrontage: 8  },
      row:           { minSite: 150, minFrontage: 6  },
      group:         { minSite: 250, minFrontage: 10 },
    },
  },
};

// ─── TITLE TYPES ─────────────────────────────────────────────────────────────
const TITLE_TYPE = {
  detached:     'Torrens title',
  semiDetached: 'Torrens title',
  row:          'Community / Strata title',
  group:        'Community / Strata title',
};

// ─── COMPLEXITY RATING ───────────────────────────────────────────────────────
const COMPLEXITY = {
  detached:     'Low',
  semiDetached: 'Low-Medium',
  row:          'Medium',
  group:        'Medium-High',
};

// ─── MAIN YIELD CALCULATOR ───────────────────────────────────────────────────
// Inputs:
//   frontage_m      — primary street frontage in metres
//   depth_m         — average depth in metres
//   land_area_sqm   — total land area in m² (if known, else calculated)
//   rear_frontage_m — rear lane/road frontage in metres (0 if none)
//   state           — 'SA', 'NSW', etc.
//   zone            — 'GN', 'SN', 'R2', etc.
//
// Returns: array of subdivision options, each with full compliance analysis

function calcSubdivisionYield(params) {
  const {
    frontage_m,
    depth_m,
    land_area_sqm,
    rear_frontage_m = 0,
    state = 'SA',
    zone  = 'GN',
  } = params;

  // Calculate land area if not provided
  const area = land_area_sqm ||
    (rear_frontage_m > 0
      ? Math.round(((frontage_m + rear_frontage_m) / 2) * depth_m)
      : Math.round(frontage_m * depth_m));

  const hasRearLane = rear_frontage_m >= 6; // min usable rear frontage
  const rules = ZONE_RULES[state]?.[zone];

  if (!rules) {
    return { error: `Zone ${zone} not found for state ${state}. Check ZONE_RULES.` };
  }

  const options = [];

  // ── OPTION A: 2 × Detached — Front / Rear ────────────────────────────────
  // Only available if there is a rear lane with sufficient frontage
  if (hasRearLane && rules.detached.minSite) {
    const frontDepth = Math.round(depth_m * 0.56); // ~56% to front lot
    const rearDepth  = depth_m - frontDepth;
    const frontArea  = Math.round(frontage_m * frontDepth);
    const rearArea   = Math.round(
      ((frontage_m + rear_frontage_m) / 2) * rearDepth
    );

    const frontOK = frontage_m >= rules.detached.minFrontage &&
                    frontArea  >= rules.detached.minSite;
    const rearOK  = rear_frontage_m >= rules.detached.minFrontage &&
                    rearArea        >= rules.detached.minSite;

    // If rear lot is just under, suggest depth adjustment
    const rearAdjDepth = Math.ceil(rules.detached.minSite / rear_frontage_m);
    const rearAdjOK    = rear_frontage_m >= rules.detached.minFrontage &&
                         rearAdjDepth <= depth_m * 0.55;

    options.push({
      id:          'A',
      label:       '2 × Detached — Front / Rear (Dual Street Access)',
      dwellings:   2,
      dwellingType:'detached',
      title:       TITLE_TYPE.detached,
      complexity:  COMPLEXITY.detached,
      recommended: frontOK && (rearOK || rearAdjOK),
      lots: [
        {
          name:       'Front lot (primary street)',
          frontage:   frontage_m,
          depth:      frontDepth,
          area:       frontArea,
          road:       'Primary street frontage',
          meetsMin:   frontOK,
          minRequired:`${rules.detached.minFrontage}m frontage / ${rules.detached.minSite}m²`,
        },
        {
          name:       'Rear lot (lane access)',
          frontage:   rear_frontage_m,
          depth:      rearDepth,
          area:       rearArea,
          road:       'Rear lane / secondary street',
          meetsMin:   rearOK,
          minRequired:`${rules.detached.minFrontage}m frontage / ${rules.detached.minSite}m²`,
          note:       !rearOK && rearAdjOK
            ? `Adjust depth split: push front/rear boundary ${rearAdjDepth}m from rear to achieve ${rules.detached.minSite}m²`
            : undefined,
        },
      ],
      compliance: frontOK && (rearOK || rearAdjOK) ? 'COMPLIANT' : 'REVIEW',
      why: 'Best option when rear lane exists. Both lots get direct street access — no battle-axe easement required. Rear lot commands near-equal value to front.',
    });
  }

  // ── OPTION B: 2 × Detached — Side by Side ────────────────────────────────
  if (rules.detached.minSite) {
    const lotFrontage = frontage_m / 2;
    const lotArea     = Math.round((area / 2));

    const bothOK = lotFrontage >= rules.detached.minFrontage &&
                   lotArea     >= rules.detached.minSite;

    options.push({
      id:          'B',
      label:       '2 × Detached — Side by Side (Both Face Primary Street)',
      dwellings:   2,
      dwellingType:'detached',
      title:       TITLE_TYPE.detached,
      complexity:  COMPLEXITY.detached,
      recommended: bothOK,
      lots: [
        {
          name:     'Left lot',
          frontage: parseFloat(lotFrontage.toFixed(2)),
          depth:    depth_m,
          area:     lotArea,
          road:     'Primary street frontage',
          meetsMin: bothOK,
          minRequired: `${rules.detached.minFrontage}m frontage / ${rules.detached.minSite}m²`,
        },
        {
          name:     'Right lot',
          frontage: parseFloat(lotFrontage.toFixed(2)),
          depth:    depth_m,
          area:     lotArea,
          road:     'Primary street frontage',
          meetsMin: bothOK,
          minRequired: `${rules.detached.minFrontage}m frontage / ${rules.detached.minSite}m²`,
        },
      ],
      compliance: bothOK ? 'COMPLIANT' : 'NON-COMPLIANT',
      why: 'Simplest DA pathway. Both lots identical size, both face the primary street. Mirror-image design enables builder efficiencies.',
    });
  }

  // ── OPTION C: 3 × Row / Terrace ──────────────────────────────────────────
  if (rules.row.minSite) {
    const terraceFrontage = frontage_m / 3;
    const terraceArea     = Math.round(area / 3);

    const allOK = terraceFrontage >= rules.row.minFrontage &&
                  terraceArea     >= rules.row.minSite;

    // Check if rear lane enables rear garage (key value driver)
    const rearGarageViable = hasRearLane && rear_frontage_m >= 6;

    options.push({
      id:          'C',
      label:       `3 × Row / Terrace${rearGarageViable ? ' — Rear Garages from Lane (Premium)' : ''}`,
      dwellings:   3,
      dwellingType:'row',
      title:       TITLE_TYPE.row,
      complexity:  COMPLEXITY.row,
      recommended: allOK,
      rearGarageViable,
      lots: [1, 2, 3].map(n => ({
        name:     `Terrace ${n}`,
        frontage: parseFloat(terraceFrontage.toFixed(2)),
        depth:    depth_m,
        area:     terraceArea,
        road:     n === 1 ? 'Primary street (end)' : n === 3 ? 'Primary street (end)' : 'Primary street (mid)',
        meetsMin: allOK,
        minRequired: `${rules.row.minFrontage}m frontage / ${rules.row.minSite}m²`,
      })),
      compliance: allOK ? 'COMPLIANT' : 'NON-COMPLIANT',
      why: rearGarageViable
        ? 'Highest total revenue. Rear lane enables garages from the lane — keeps Fourth Ave frontage clean and car-free. Premium coastal terrace product.'
        : 'Highest dwelling count. Strata title required. Pre-lodgement advice recommended.',
    });
  }

  // ── OPTION D: 3 × Detached (merit assessment) ────────────────────────────
  if (rules.detached.minSite) {
    const frontLotF = frontage_m / 2;
    const frontLotA = Math.round((area * 0.60) / 2); // two front lots share 60%
    const rearLotA  = Math.round(area * 0.40);        // rear lot gets 40%
    const rearLotF  = rear_frontage_m || 0;

    const frontUnder = frontLotA < rules.detached.minSite;
    const rearUnder  = rearLotA  < rules.detached.minSite;

    options.push({
      id:          'D',
      label:       '3 × Detached — 2 Front + 1 Rear (Merit Assessment Required)',
      dwellings:   3,
      dwellingType:'detached',
      title:       TITLE_TYPE.detached + ' (subject to approval)',
      complexity:  'High',
      recommended: false,
      warning:     true,
      lots: [
        {
          name:     'Front left lot',
          frontage: parseFloat(frontLotF.toFixed(2)),
          depth:    Math.round(depth_m * 0.60),
          area:     frontLotA,
          road:     'Primary street frontage',
          meetsMin: !frontUnder,
          minRequired: `${rules.detached.minFrontage}m frontage / ${rules.detached.minSite}m²`,
          note:     frontUnder ? `⚠ ${frontLotA}m² is below ${rules.detached.minSite}m² minimum` : undefined,
        },
        {
          name:     'Front right lot',
          frontage: parseFloat(frontLotF.toFixed(2)),
          depth:    Math.round(depth_m * 0.60),
          area:     frontLotA,
          road:     'Primary street frontage',
          meetsMin: !frontUnder,
          minRequired: `${rules.detached.minFrontage}m frontage / ${rules.detached.minSite}m²`,
          note:     frontUnder ? `⚠ ${frontLotA}m² is below ${rules.detached.minSite}m² minimum` : undefined,
        },
        {
          name:     'Rear lot',
          frontage: rearLotF,
          depth:    Math.round(depth_m * 0.40),
          area:     rearLotA,
          road:     rear_frontage_m ? 'Rear lane access' : 'Battle-axe handle required',
          meetsMin: !rearUnder,
          minRequired: `${rules.detached.minFrontage}m frontage / ${rules.detached.minSite}m²`,
          note:     rearUnder ? `⚠ ${rearLotA}m² is below ${rules.detached.minSite}m² minimum` : undefined,
        },
      ],
      compliance: (frontUnder || rearUnder) ? 'MERIT ASSESSMENT REQUIRED' : 'COMPLIANT',
      why: 'Theoretically possible but lots likely fall under detached minimum. Requires merit/performance assessment — not guaranteed. Do NOT proceed without pre-lodgement advice.',
    });
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  const recommended = options
    .filter(o => o.recommended && !o.warning)
    .sort((a, b) => b.dwellings - a.dwellings); // prefer higher yield

  return {
    inputs: {
      frontage_m,
      depth_m,
      land_area_sqm:   area,
      rear_frontage_m,
      state,
      zone,
      zoneName:        rules.name,
      hasRearLane,
    },
    options,
    recommendedOption: recommended[0]?.id || 'B',
    maxDwellings:      Math.max(...options.map(o => o.dwellings)),
    summary: buildSummary(options, area, rules),
  };
}

// ─── SUMMARY BUILDER ─────────────────────────────────────────────────────────
function buildSummary(options, area, rules) {
  const lines = [];
  options.forEach(opt => {
    const status = opt.compliance === 'COMPLIANT'  ? '✓' :
                   opt.compliance === 'REVIEW'     ? '~' : '✗';
    lines.push(`  ${status} Option ${opt.id}: ${opt.dwellings} × ${opt.dwellingType} — ${opt.compliance}`);
  });
  return lines.join('\n');
}

// ─── DISPLAY HELPER ──────────────────────────────────────────────────────────
function displayResults(result) {
  if (result.error) {
    console.log('\n  ERROR:', result.error);
    return;
  }

  const { inputs, options, recommendedOption } = result;

  console.log('\n' + '═'.repeat(70));
  console.log('  SUBDIVISION YIELD ANALYSIS');
  console.log('═'.repeat(70));
  console.log(`  Zone:         ${inputs.state} — ${inputs.zoneName}`);
  console.log(`  Land area:    ${inputs.land_area_sqm}m²`);
  console.log(`  Frontage:     ${inputs.frontage_m}m (primary street)`);
  console.log(`  Rear lane:    ${inputs.hasRearLane ? `${inputs.rear_frontage_m}m ✓ direct road access` : 'None — battle-axe required for rear lot'}`);
  console.log(`  Depth:        ${inputs.depth_m}m`);
  console.log('─'.repeat(70));

  options.forEach(opt => {
    const recTag = opt.id === recommendedOption ? ' ★ RECOMMENDED' : '';
    const warnTag = opt.warning ? ' ⚠ RISKY' : '';
    console.log(`\n  OPTION ${opt.id}${recTag}${warnTag}: ${opt.label}`);
    console.log(`  Title: ${opt.title} | Complexity: ${opt.complexity} | ${opt.compliance}`);
    opt.lots.forEach(lot => {
      const tick = lot.meetsMin ? '✓' : '✗';
      console.log(`    ${tick} ${lot.name}: ${lot.frontage}m × ${lot.depth}m = ${lot.area}m²  (min: ${lot.minRequired})`);
      if (lot.note) console.log(`      ↳ ${lot.note}`);
    });
    console.log(`  Why: ${opt.why}`);
  });

  console.log('\n' + '─'.repeat(70));
  console.log(`  Recommended option: ${recommendedOption}`);
  console.log('  ' + result.summary.trim());
  console.log('─'.repeat(70) + '\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
export {
  calcSubdivisionYield,
  displayResults,
  ZONE_RULES,
};

// ─────────────────────────────────────────────────────────────────────────────
// TESTS — run with: node src/calculators/subdivision_yield.js
// ─────────────────────────────────────────────────────────────────────────────
function runTests() {
  console.log('\n' + '█'.repeat(70));
  console.log('  SUBDIVISION YIELD CALCULATOR — TEST RESULTS');
  console.log('█'.repeat(70));

  // ── TEST 1: The Moana property (confirmed survey dimensions) ──────────────
  console.log('\n  TEST 1 — 22 Fourth Avenue Moana (confirmed survey)');
  console.log('  21.34m frontage · 42.9m depth · 15.24m rear lane · SA GN zone');
  const moana = calcSubdivisionYield({
    frontage_m:      21.34,
    depth_m:         42.885,
    rear_frontage_m: 15.24,
    state:           'SA',
    zone:            'GN',
  });
  displayResults(moana);

  // ── TEST 2: Typical block — no rear lane ──────────────────────────────────
  console.log('\n  TEST 2 — Standard 650m² block, no rear lane');
  console.log('  15m frontage · 43m depth · no rear lane · SA GN zone');
  const noLane = calcSubdivisionYield({
    frontage_m:      15,
    depth_m:         43,
    rear_frontage_m: 0,
    state:           'SA',
    zone:            'GN',
  });
  displayResults(noLane);

  // ── TEST 3: Narrow block — limited options ────────────────────────────────
  console.log('\n  TEST 3 — Narrow 550m² block');
  console.log('  12m frontage · 45m depth · SA GN zone');
  const narrow = calcSubdivisionYield({
    frontage_m:      12,
    depth_m:         45,
    rear_frontage_m: 0,
    state:           'SA',
    zone:            'GN',
  });
  displayResults(narrow);

  // ── TEST 4: Suburban Neighbourhood Zone (different rules) ─────────────────
  console.log('\n  TEST 4 — Same dimensions, Suburban Neighbourhood Zone (SA SN)');
  console.log('  21m frontage · 40m depth · SA SN zone (stricter minimums)');
  const snZone = calcSubdivisionYield({
    frontage_m:      21,
    depth_m:         40,
    rear_frontage_m: 0,
    state:           'SA',
    zone:            'SN',
  });
  displayResults(snZone);

  // ── TEST 5: NSW R2 zone ───────────────────────────────────────────────────
  console.log('\n  TEST 5 — NSW R2 Low Density Residential zone');
  console.log('  20m frontage · 40m depth · NSW R2 zone');
  const nswR2 = calcSubdivisionYield({
    frontage_m:      20,
    depth_m:         40,
    rear_frontage_m: 0,
    state:           'NSW',
    zone:            'R2',
  });
  displayResults(nswR2);

  console.log('  ✓ All tests complete\n');
}

runTests();