# Property Development Feasibility Skill
**Version:** 1.0  
**Repo:** github.com/boffaproperty/property-feasibility-template  
**Last updated:** May 2026

---

## WHAT THIS SKILL DOES

When a user provides a property address, listing URL, land dimensions, or asks about development feasibility for a residential property, this skill activates and produces a complete development feasibility analysis.

The output covers every cost from purchase through to post-tax net profit, across multiple subdivision options, with sensitivity analysis and a risk rating.

---

## TRIGGER CONDITIONS

Activate this skill when the user provides ANY of the following:

- A residential property address (e.g. "22 Fourth Avenue Moana SA 5169")
- A Domain or realestate.com.au listing URL
- Land dimensions with a suburb or postcode
- Any of these phrases or clear intent:
  - "development feasibility" / "feasibility analysis"
  - "can I develop this" / "is this worth developing"
  - "subdivision" / "subdivide" / "split the block"
  - "how many dwellings" / "how many lots"
  - "development potential" / "knock down rebuild"
  - "should I buy this to develop"

Do NOT activate for:
- General property market questions without a specific property
- Rental yield questions only (no development intent)
- Commercial property (this skill covers residential only)

---

## INPUT COLLECTION

### Step 1 — Auto-determine from address
When an address is provided, immediately derive:

| Field | How to get it |
|---|---|
| `state` | Parse from address (e.g. "SA", "NSW", "VIC") |
| `council` | Derive from suburb/postcode lookup |
| `zone` | Web search: "[suburb] [state] planning zone PlanSA" or equivalent |
| `land_area_sqm` | Check listing (Domain/REA often shows land size), or ask user |
| `stamp_duty` | Run `stamp_duty.js` with purchase price + state |
| `weekly_rent` | Run `auto_rent.js` with purchase price + state + suburb type |

### Step 2 — Ask only for what's missing
After auto-filling everything possible, ask the user ONLY for fields that cannot be derived. Present these as a short list, not one by one:

**Required from user:**
- Purchase price (or range — use listing price if provided)
- Land dimensions if not in listing: frontage (m), depth (m), rear frontage if lane access (m)
- Development strategy: subdivide + build + sell / subdivide + sell land / hold + rent
- Build specification: Entry / Quality / Premium
- Entity type: Company (default) / Individual / Trust

**Auto-assumed defaults (state explicitly, user can override):**
- Hold period: 12 months
- Construction loan rate: 6.5% p.a.
- Tax rate: 25% company base rate entity
- Accountant/BAS fees: $NIL (in-house)
- Entity setup: $1,000 fixed
- Vacancy allowance: 2 weeks per year

### Step 3 — Confirm before running
Before producing the full analysis, show the user a brief confirmation summary:

```
Running feasibility for:
  Address:       [address]
  State:         [state] → stamp duty calculated
  Zone:          [zone name]
  Land:          [area]m² · [frontage]m front · [depth]m deep[· rear lane: Xm]
  Purchase:      $[price] ([range if applicable])
  Strategy:      Subdivide + Build + Sell (2-storey)
  Spec:          [spec]
  Entity:        Company (25% tax)
  Est. rent:     $[X]/week during hold (auto-calculated)

Shall I proceed? (or adjust any inputs above)
```

---

## PROCESSING SEQUENCE

Run these steps in order. Each feeds into the next.

### 1. Subdivision yield
Using `subdivision_yield.js`:
- Inputs: frontage, depth, rear_frontage, land_area, state, zone
- Outputs: Options A/B/C/D with lot sizes, compliance check, recommended option
- Flag any option requiring merit assessment as high risk

### 2. Stamp duty
Using `stamp_duty.js`:
- Inputs: purchase_price, state
- Output: duty amount + effective rate

### 3. Rental estimate
Using `auto_rent.js`:
- Inputs: purchase_price, state, suburb_type, dwelling_age, hold_months
- Output: weekly_rent, gross_rent, holding_opex, net_rental_benefit
- Default dwelling_age to '1970-1990' for pre-existing dwellings unless user specifies

### 4. Full P&L for each viable option
For each compliant subdivision option (typically A, B, C):
- Build complete cost schedule (all line items from checklist)
- Run `capitalized_interest.js` for phased loan model
- Run `gst_margin.js` for net GST
- Run `income_tax.js` for tax provision
- Calculate: gross profit → tax → net profit → margin → ROI on equity

### 5. Sensitivity analysis
Using `sensitivity.js`:
- Run all 5 scenario types (A through E)
- Calculate break-even sale price
- Calculate max viable purchase price
- Produce risk rating

### 6. Recommend
Select the recommended option based on:
- Highest net profit (primary)
- Zone compliance confidence (must be Accepted Development, not merit)
- Complexity (prefer Torrens title over strata for same profit level)
- Timeline (shorter is better when profit is similar)

---

## OUTPUT FORMAT

Always produce the following sections in order. Use clear headers. Be concise within each section.

---

### SECTION 1 — Property Summary
```
ADDRESS:    [address]
ZONE:       [zone name] — [state planning code ref]
LAND:       [area]m² · [frontage]m × [depth]m · [rear lane details if applicable]
LISTING:    $[price range]
COUNCIL:    [council name]
SUBURB:     [suburb context — median house price, 5yr growth if available]
```

---

### SECTION 2 — Subdivision Options
Table showing all options with:
- Option ID (A/B/C/D)
- Dwelling type and count
- Lot sizes
- Zone compliance (✅ COMPLIANT / ⚠️ MERIT / ❌ NON-COMPLIANT)
- Title type
- Recommended ★

---

### SECTION 3 — Floor Plan Summary
For the recommended option, show per dwelling:
- Beds / baths / garage / floor area
- Ground floor rooms (brief list)
- Upper floor rooms (brief list)
- Matching SA builder product example

---

### SECTION 4 — Complete P&L (Recommended Option)
Show ALL line items from the cost checklist, grouped by section:
1. Acquisition
2. Holding period (rental income vs costs)
3. Demolition
4. Development & subdivision
5. Construction
6. Finance (phased capitalized interest — each phase shown)
7. Tax & compliance
8. Selling costs
9. Revenue
10. Gross profit → tax provision → **NET PROFIT**

For each checklist item that is uncertain or property-specific, add a `[VERIFY]` flag.

---

### SECTION 5 — Sensitivity Analysis
Condensed version — show combined stress scenarios table + break-even summary:

```
Break-even sale price:   $[X]/dwelling  (market can fall [X]% before loss)
Max purchase price:      $[X]           (to maintain $50K min net profit)
Conservative scenario:   $[X] net profit (−10% price, +10% build, +3mo delay)
Stress scenario:         $[X] net profit (−20% price, +20% build, +9mo delay)
Risk rating:             [LOW / MODERATE / MEDIUM / HIGH]
```

---

### SECTION 6 — Cost Checklist Status
List each checklist item with default status for this property and a `[CONFIRM]` flag where the user should verify before exchange:

Example:
```
✅ Asbestos assessment        $2,500   [pre-1990 dwelling — assumed required]
✅ Asbestos removal           $18,000  [CONFIRM — assess extent before locking in]
⬜ Hazardous materials        $0       [not selected — inspect before exchange]
✅ SA Water headworks         $15,000  [CONFIRM — call SA Water developer line]
✅ NCC 7-star compliance      $24,000  [assumed — confirm with builder]
```

---

### SECTION 7 — Next Steps Checklist
Ordered action list from today to exchange and beyond:

```
BEFORE EXCHANGE:
  □ Title search — confirm exact lot dimensions and encumbrances (Land Services SA)
  □ SAPPA lookup — confirm zone and TNV overlays at this address (plan.sa.gov.au)
  □ Pre-lodgement meeting — City of Onkaparinga / SCAP ($500-1,200)
  □ Asbestos pre-purchase assessment ($1,800)
  □ Entity setup — company incorporated before exchange ($1,000)
  □ GST margin scheme election — written agreement with vendor at settlement
  □ Development finance broker — arrange construction loan pre-approval

AFTER EXCHANGE:
  □ Engage licensed surveyor — land division plan
  □ Engage town planner — DA documentation
  □ Get 3 builder quotes (fix-price contract essential)
  □ Call SA Water developer line — confirm headworks charge
  □ Confirm SAPN connection fee — sapowernetworks.com.au

DURING DA PERIOD:
  □ Rent existing dwelling — property manager engaged
  □ Lodge subdivision DA via SA Planning Portal
  □ Lodge building DAs / CDCs once subdivision approved
```

---

### SECTION 8 — Confidence Flags
Be transparent about what was estimated vs confirmed:

```
CONFIRMED:    Purchase price (from listing)
CONFIRMED:    Land dimensions (from survey plan / listing)
ESTIMATED:    Zone — [zone name] (verify via SAPPA before exchange)
ESTIMATED:    SA Water headworks ~$15,000 (call SA Water to confirm)
ESTIMATED:    Build costs at $[X]/m² (get 3 fixed-price quotes)
ESTIMATED:    Sale prices based on [comparable sales cited]
VERIFY:       Asbestos extent (pre-purchase assessment required)
VERIFY:       Soil classification (geotechnical report at DA stage)
VERIFY:       Infrastructure levy amount (confirm at pre-lodgement meeting)
```

---

## COST CHECKLIST DEFAULTS BY PROPERTY TYPE

Use these defaults to pre-populate the checklist. User can override any item.

### Pre-1990 existing dwelling (most common for development sites)
```
Asbestos assessment:       ✅ ON  (almost certain to be present)
Asbestos removal:          ✅ ON  (budget for full removal)
Hazardous materials:       ⬜ OFF (inspect before exchange)
Tree removal:              ⬜ OFF (site inspection required)
Dilapidation survey:       ✅ ON  (always recommended)
Town planner:              ✅ ON  (merit pathway likely)
Pre-lodgement meeting:     ✅ ON  (always required)
Infrastructure levy:       ✅ ON  (Onkaparinga applies this)
SA Water headworks:        ✅ ON  (always applies to new lots)
NBN pit and pipe:          ✅ ON  (mandatory for new dwellings)
SAPN connection:           ✅ ON  (always applies)
NCC 7-star compliance:     ✅ ON  (NCC 2022 mandatory)
Builder exclusions:        ✅ ON  (always missing from volume builder price)
Retaining walls:           ⬜ OFF (inspect site levels)
BAL compliance:            ⬜ OFF (check bushfire hazard mapping)
Loan establishment:        ✅ ON  (always applies to construction loan)
Bank valuation:            ✅ ON  (always applies)
QS inspection fees:        ✅ ON  (bank requires these)
Loan legal:                ✅ ON  (always applies)
Finance broker:            ⬜ OFF (optional — user preference)
```

### Vacant land
```
Asbestos assessment:       ⬜ OFF
Asbestos removal:          ⬜ OFF
Demolition:                ⬜ OFF
Tree removal:              ⬜ OFF (inspect site)
[All development/construction items same as above]
```

### Post-2000 dwelling
```
Asbestos assessment:       ⬜ OFF (post-1990 unlikely)
Asbestos removal:          ⬜ OFF
Demolition:                ✅ ON  (lower amount — ~$12,000)
[All other items same as pre-1990]
```

---

## DATA SOURCES FOR AUTO-ENRICHMENT

When running this skill, use web search to retrieve current data for:

| Data needed | Search query to use |
|---|---|
| Planning zone | `[address] planning zone site:plan.sa.gov.au` OR `[suburb] [postcode] zoning PlanSA` |
| Comparable sales | `[suburb] [beds] sold 2025 site:domain.com.au` |
| Rental estimate | `[suburb] [beds] rent per week site:domain.com.au` |
| Suburb median | `[suburb] SA median house price 2025` |
| Council rates | `[council name] rate in dollar 2024-25` |
| SA Water headworks | `SA Water developer charge residential 2024-25` |

If web search returns no result for a specific field, flag it as `[VERIFY]` and use the benchmark from the data files.

---

## CALCULATOR REFERENCE

| Calculator | File | When used |
|---|---|---|
| Stamp duty | `src/calculators/stamp_duty.js` | Every analysis, all states |
| Subdivision yield | `src/calculators/subdivision_yield.js` | Every analysis — drives all options |
| Capitalized interest | `src/calculators/capitalized_interest.js` | Every analysis — phased loan model |
| Auto rent | `src/calculators/auto_rent.js` | When hold period > 0 |
| GST margin scheme | `src/calculators/gst_margin.js` | Every sale of new residential |
| Income tax | `src/calculators/income_tax.js` | Every analysis — default company 25% |
| Sensitivity | `src/calculators/sensitivity.js` | Every analysis — 5 scenario types |

---

## FIXED ASSUMPTIONS (do not ask user — state in output)

| Assumption | Value | Reason |
|---|---|---|
| Entity type | Company (base rate entity) | Default for development |
| Tax rate | 25% | Company BRE — turnover < $50M |
| Entity setup cost | $1,000 | Fixed — one-off company incorporation |
| Accountant fees | $NIL | In-house accounting |
| BAS lodgement | $NIL | In-house accounting |
| Hold period | 12 months | Standard DA processing time |
| Construction loan rate | 6.5% p.a. | Current market rate — update quarterly |
| LVR | 70% | Standard construction loan LVR |
| Agent commission | 2.2% of sale price | SA market rate |
| Vacancy allowance | 2 weeks/year | Standard investment assumption |
| DA pathway | Merit assumed | Conservative — pre-lodgement may confirm Accepted Dev. |
| GST method | Margin scheme | Always elect this for residential development |

---

## SCOPE & LIMITATIONS

This skill produces indicative feasibility analysis only. The following always require professional engagement before exchange:

- **Licensed valuer (API/RICS)** — certified property valuation
- **Town planner** — DA pathway confirmation and TNV check
- **Licensed surveyor** — exact lot dimensions and land division plan
- **Accountant** — tax structure, GST election, entity setup
- **Development finance broker** — construction loan terms
- **Solicitor** — title search, encumbrances, contract review
- **SA Water** — headworks charge confirmation
- **SAPN** — connection fee confirmation

Always include this disclaimer at the end of every feasibility output:

> *This analysis is indicative only and does not constitute financial, legal, planning, or valuation advice. Figures are estimates based on publicly available market data and benchmark costs. Engage licensed professionals before committing to any property transaction.*

---

## VERSION HISTORY

| Version | Date | Changes |
|---|---|---|
| 1.0 | May 2026 | Initial release — 7 calculators, SA focus, all residential zones |

**Planned for v1.1:**
- NSW, VIC, QLD zone rules in subdivision_yield.js
- Domain API integration for auto-fill from listing URL
- PlanSA SAPPA API wrapper for auto zone lookup
- Multi-property comparison (up to 3 properties side by side)