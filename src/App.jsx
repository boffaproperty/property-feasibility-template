import { useState, useMemo } from "react";

// ─── HELPERS ────────────────────────────────────────────────────────────────
const $   = (n) => n < 0 ? `-$${Math.abs(Math.round(n)).toLocaleString()}` : `$${Math.round(n).toLocaleString()}`;
const pct = (n) => `${n.toFixed(1)}%`;
const saStamp = (p) => {
  if (p <= 12000)  return Math.round(p * 0.01);
  if (p <= 30000)  return Math.round(120 + (p - 12000) * 0.02);
  if (p <= 50000)  return Math.round(480 + (p - 30000) * 0.03);
  if (p <= 100000) return Math.round(1080 + (p - 50000) * 0.035);
  if (p <= 200000) return Math.round(2830 + (p - 100000) * 0.04);
  if (p <= 250000) return Math.round(6830 + (p - 200000) * 0.045);
  if (p <= 300000) return Math.round(9080 + (p - 250000) * 0.05);
  if (p <= 500000) return Math.round(11580 + (p - 300000) * 0.055);
  return Math.round(22580 + (p - 500000) * 0.055);
};
// Auto-rent: purchase price × Moana gross yield (4%) × 70% old-dwelling factor ÷ 52 weeks
const autoRent = (pp) => Math.round((pp * 0.04 * 0.70) / 52 / 5) * 5; // round to $5

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const RATE     = 0.065;   // construction loan rate
const TAX_RATE = 0.25;    // company base rate entity
const SURVEY   = { area: 785, frontage: 21.34, rear: 15.24, depth: 42.885 };

// ─── CHECKLIST DEFINITION ────────────────────────────────────────────────────
// Each item: key, label, category, default on/off, why, cost fn (pp, optId, sk)
const CHECKLIST_ITEMS = [
  // ── ACQUISITION ──
  { key:"buyersAgent",    cat:"Acquisition",   label:"Buyer's agent fee",
    default:false, why:"Optional. Useful for competitive markets or if you lack local agent relationships. Negotiates purchase price.",
    cost:(pp,o,sk)=> sk==="high"?14000:sk==="mid"?11000:8000 },
  { key:"contaminPre",    cat:"Acquisition",   label:"Pre-purchase contamination / asbestos assessment",
    default:true,  why:"Pre-1990 Moana dwelling — fibro/asbestos almost certain. Assess BEFORE setting demolition budget.",
    cost:()=>1800 },
  { key:"rateAdj",        cat:"Acquisition",   label:"Rate & water settlement adjustments",
    default:true,  why:"Council rates and water charges pro-rated at settlement. Always applies.",
    cost:()=>1200 },

  // ── DEMOLITION ──
  { key:"asbestosAssess", cat:"Demolition",    label:"Asbestos assessment (licensed assessor)",
    default:true,  why:"Mandatory before demolition if pre-1990 building. Required by SA Work Health & Safety Act.",
    cost:()=>2500 },
  { key:"asbestosRemove", cat:"Demolition",    label:"Asbestos removal & licensed disposal",
    default:true,  why:"Pre-1990 Moana dwellings almost universally contain fibro/asbestos. Licensed Class A/B removal + EPA-approved disposal.",
    cost:(pp,o,sk)=> sk==="high"?25000:18000 },
  { key:"hazmat",         cat:"Demolition",    label:"Hazardous materials — lead paint etc.",
    default:false, why:"Pre-1970 dwellings may contain lead paint. Assessment + disposal if present.",
    cost:()=>5000 },
  { key:"treeRemoval",    cat:"Demolition",    label:"Tree removal (if significant trees on site)",
    default:false, why:"Mature trees on Old Survey blocks common. Council permit required if over regulated size.",
    cost:()=>6500 },
  { key:"dilapidation",   cat:"Demolition",    label:"Dilapidation survey (neighbouring properties)",
    default:true,  why:"Pre-demolition condition report on both neighbours. Protects against false damage claims. Strongly recommended.",
    cost:()=>3500 },
  { key:"epaNotify",      cat:"Demolition",    label:"EPA / council demolition notification",
    default:true,  why:"SA EPA requires notification before demolition. Council may charge assessment fee.",
    cost:()=>750 },

  // ── DEVELOPMENT ──
  { key:"townPlanner",    cat:"Development",   label:"Town planner / planning consultant",
    default:true,  why:"Separate from surveyor. Prepares planning response, writes DA statement, navigates merit assessment. Non-negotiable for merit pathway.",
    cost:(pp,o,sk)=> sk==="high"?13000:sk==="mid"?9000:7000 },
  { key:"preLodge",       cat:"Development",   label:"Pre-lodgement meeting (council / SCAP)",
    default:true,  why:"Confirms DA pathway, TNVs, conditions before lodging. Most important $1K in the project.",
    cost:()=>1000 },
  { key:"arborist",       cat:"Development",   label:"Arborist report (if trees present)",
    default:false, why:"Required by Onkaparinga if significant trees exist on site. DA condition may mandate retention or replacement.",
    cost:()=>2000 },
  { key:"infraContrib",   cat:"Development",   label:"Infrastructure / developer contribution levy",
    default:true,  why:"Onkaparinga Council levies on new allotments. Confirm amount via pre-lodgement meeting — can be $5K–$22K per new lot.",
    cost:(pp,o,sk)=> (o==="C"?2:1) * (sk==="high"?14000:12000) },
  { key:"saWaterHW",      cat:"Development",   label:"SA Water headworks / developer charge",
    default:true,  why:"SA Water charges per NEW lot created. ~$15K per new allotment. Separate from civil connection costs. ALWAYS applies.",
    cost:(pp,o)=> (o==="C"?2:1) * 15000 },
  { key:"nbnPitPipe",     cat:"Development",   label:"NBN pit and pipe (per new dwelling)",
    default:true,  why:"Mandatory under Telecommunications (Low Impact Facilities) Determination for new lots. Nbnco requirement.",
    cost:(pp,o,sk)=> (o==="C"?3:2) * 4500 },
  { key:"sapnConnect",    cat:"Development",   label:"SA Power Networks — new service connection",
    default:true,  why:"New meter, pit and connection per dwelling. SAPN published fee schedule. Always applies to new dwellings.",
    cost:(pp,o,sk)=> (o==="C"?3:2) * 4000 },
  { key:"ldCert",         cat:"Development",   label:"Land division certificate + deposited plan registration",
    default:true,  why:"Land Services SA fees to register new titles. Fixed government charge.",
    cost:()=>2500 },
  { key:"roadPermit",     cat:"Development",   label:"Road opening / crossover permit",
    default:true,  why:"New driveway crossovers (incl. Colleens Row rear access) require council permit + road opening.",
    cost:()=>1800 },

  // ── CONSTRUCTION ──
  { key:"soilUpgrade",    cat:"Construction",  label:"Footing upgrade — Class H/P reactive soil",
    default:false, why:"SA coastal soils can be Class H (highly reactive) or P (problem). If reactive, footings add $15K–$50K per dwelling. Geotechnical report required first.",
    cost:(pp,o,sk)=> (o==="C"?3:2) * (sk==="high"?30000:sk==="mid"?22000:15000) },
  { key:"ncc7star",       cat:"Construction",  label:"NCC 2022 / 7-star NatHERS compliance premium",
    default:true,  why:"NCC 2022 mandates 7-star energy rating. Double glazing, upgraded insulation, external shading. Volume builders partly cover this but there is a gap vs base price.",
    cost:(pp,o,sk)=> (o==="C"?3:2) * (sk==="high"?16000:sk==="mid"?12000:9000) },
  { key:"builderExcl",    cat:"Construction",  label:"Builder exclusions (fencing, driveway, letterbox, antenna etc.)",
    default:true,  why:"Volume builder base prices exclude: boundary fencing, driveway & crossover, letterbox, clothesline, TV antenna, window furnishings, fly screens, front landscaping. These are real costs.",
    cost:(pp,o,sk)=> (o==="C"?3:2) * (sk==="high"?45000:sk==="mid"?32000:22000) },
  { key:"retaining",      cat:"Construction",  label:"Retaining walls (if level change between lots)",
    default:false, why:"Front/rear subdivision creates a boundary. Any level change requires retaining. Common on coastal blocks. Inspect site.",
    cost:(pp,o,sk)=> sk==="high"?22000:sk==="mid"?14000:9000 },
  { key:"balCompliance",  cat:"Construction",  label:"BAL compliance (Bushfire Attack Level)",
    default:false, why:"Coastal SA typically BAL-LOW or BAL-12.5. BAL-12.5+ requires ember protection, upgraded windows. Check hazard mapping.",
    cost:(pp,o,sk)=> (o==="C"?3:2) * 5000 },
  { key:"pci",            cat:"Construction",  label:"Practical completion inspections",
    default:true,  why:"Independent inspector at handover per dwelling. Identifies defects before final payment release.",
    cost:(pp,o)=> (o==="C"?3:2) * 750 },

  // ── FINANCE ──
  { key:"loanEstab",      cat:"Finance",       label:"Loan establishment / facility fee (1%)",
    default:true,  why:"Construction/development loans charge upfront establishment fee. On a $1.5M facility = ~$15K. Always applies.",
    cost:(pp,o,sk)=> { const approxFacility = (pp * 1.2) + (o==="C"?510:440) * SPECS_RATE[sk]; return Math.round(approxFacility * 0.010); } },
  { key:"bankVal",        cat:"Finance",       label:"Bank-appointed valuation",
    default:true,  why:"Lender requires independent valuation before facility approval. Borrower pays.",
    cost:()=>1200 },
  { key:"qsFees",         cat:"Finance",       label:"QS progress inspection fees (6 draws × $420)",
    default:true,  why:"Bank requires QS certification per construction stage. ~6 inspections per dwelling.",
    cost:(pp,o)=> (o==="C"?3:2) * 6 * 420 },
  { key:"loanLegal",      cat:"Finance",       label:"Loan documentation legal fees",
    default:true,  why:"Lender's solicitor prepares construction loan docs. Borrower pays.",
    cost:()=>3200 },
  { key:"finBroker",      cat:"Finance",       label:"Development finance broker fee",
    default:false, why:"A specialist broker can access better development loan terms. Fee typically 0.8–1.5% of facility.",
    cost:(pp,o,sk)=> { const approxFacility = (pp * 1.2) + (o==="C"?510:440) * SPECS_RATE[sk]; return Math.round(approxFacility * 0.010); } },
  { key:"mortDisch",      cat:"Finance",       label:"Mortgage discharge + PEXA at exit",
    default:true,  why:"Fee to discharge construction mortgage when sales settle.",
    cost:()=>700 },
];

const SPECS_RATE = { low:1750, mid:2100, high:2800 };

// Default checked state
const DEFAULT_CHECKS = Object.fromEntries(CHECKLIST_ITEMS.map(i => [i.key, i.default]));

// ─── OPTIONS ──────────────────────────────────────────────────────────────────
const OPTIONS = [
  { id:"A", label:"2 × Detached — Front/Rear",  dwellings:2, buildSqm:440, col:"#1d4ed8", bg:"#dbeafe",
    newLots:1,
    salePrices:{ low:[1050000,880000], mid:[1350000,1050000], high:[1700000,1350000] } },
  { id:"B", label:"2 × Detached — Side by Side", dwellings:2, buildSqm:440, col:"#7c3aed", bg:"#f5f3ff",
    newLots:1,
    salePrices:{ low:[1020000,1000000], mid:[1260000,1240000], high:[1590000,1570000] } },
  { id:"C", label:"3 × Row Terraces",            dwellings:3, buildSqm:510, col:"#059669", bg:"#d1fae5",
    newLots:2,
    salePrices:{ low:[820000,820000,820000], mid:[980000,980000,980000], high:[1180000,1180000,1180000] } },
];

const SPECS = {
  low:  { label:"Entry",   rSqm:1750, tag:"Volume builder — standard inclusions (Statesman, Fairmont)" },
  mid:  { label:"Quality", rSqm:2100, tag:"Quality volume — upgraded (Hickinbotham, Tullipan, GJ Gardner)" },
  high: { label:"Premium", rSqm:2800, tag:"Semi-custom — premium coastal finishes" },
};
const SC = { low:{c:"#b45309",bg:"#fef3c7"}, mid:{c:"#1d4ed8",bg:"#dbeafe"}, high:{c:"#059669",bg:"#d1fae5"} };
const PPS = { low:699000, mid:724000, high:749000 };
const PP_LABELS = { low:"$699K",mid:"$724K",high:"$749K" };

// ─── MAIN CALCULATOR ─────────────────────────────────────────────────────────
function calcFull(pp, optId, sk, checks, holdMo=12) {
  const opt = OPTIONS.find(o => o.id === optId);
  const sp  = SPECS[sk];
  const bm  = { A:{low:11,mid:13,high:16}, B:{low:11,mid:13,high:16}, C:{low:13,mid:16,high:19} }[optId][sk];
  const totalMo = holdMo + 3 + bm + 4;

  // Helper: get checklist cost or 0
  const cc = (key) => {
    if (!checks[key]) return 0;
    const item = CHECKLIST_ITEMS.find(i => i.key === key);
    return item ? item.cost(pp, optId, sk) : 0;
  };

  // ── ACQUISITION ──────────────────────────────────────────
  const stamp      = saStamp(pp);
  const lgl        = sk==="high" ? 4000 : 3500;
  const dd         = 2000;
  const pexa       = 900;
  const titleSrch  = 350;
  const buyersAgt  = cc("buyersAgent");
  const contamPre  = cc("contaminPre");
  const rateAdj    = cc("rateAdj");
  const acqTotal   = pp+stamp+lgl+dd+pexa+titleSrch+buyersAgt+contamPre+rateAdj;

  // ── HOLDING ───────────────────────────────────────────────
  const weekRent   = autoRent(pp);
  const grossRent  = holdMo>0 ? weekRent * 50 : 0;
  const holdRates  = holdMo>0 ? 1900 : 0;
  const holdWater  = holdMo>0 ? 850 : 0;
  const holdIns    = holdMo>0 ? 1600 : 0;
  const holdPM     = holdMo>0 ? Math.round(grossRent*0.085) : 0;
  const holdMaint  = holdMo>0 ? 1500 : 0;
  const holdESL    = holdMo>0 ? 450 : 0;
  const holdOpex   = holdRates+holdWater+holdIns+holdPM+holdMaint+holdESL;
  const holdNet    = grossRent - holdOpex; // positive = benefit

  // ── DEMOLITION ───────────────────────────────────────────
  const demoBase   = sk==="high"?32000:sk==="mid"?25000:20000;
  const asbesAssess= cc("asbestosAssess");
  const asbesRemove= cc("asbestosRemove");
  const hazmat     = cc("hazmat");
  const treeRemov  = cc("treeRemoval");
  const dilap      = cc("dilapidation");
  const epaNote    = cc("epaNotify");
  const demoTotal  = demoBase+asbesAssess+asbesRemove+hazmat+treeRemov+dilap+epaNote;

  // ── DEVELOPMENT ──────────────────────────────────────────
  const surveyor   = opt.id==="C"?(sk==="high"?32000:sk==="mid"?24000:17000):(sk==="high"?22000:sk==="mid"?15000:10000);
  const townPln    = cc("townPlanner");
  const preLodge   = cc("preLodge");
  const arborist   = cc("arborist");
  const counciDA   = opt.id==="C"?(sk==="high"?19000:sk==="mid"?14000:10500):(sk==="high"?12000:sk==="mid"?8000:6000);
  const infraCon   = cc("infraContrib");
  const saWaterHW  = cc("saWaterHW");
  const nbnCost    = cc("nbnPitPipe");
  const sapnCost   = cc("sapnConnect");
  const civil      = opt.id==="C"?(sk==="high"?92000:sk==="mid"?75000:58000):(sk==="high"?68000:sk==="mid"?52000:36000);
  const bldDA      = opt.dwellings*(sk==="high"?5500:sk==="mid"?4200:3500);
  const ldCert     = cc("ldCert");
  const roadPerm   = cc("roadPermit");
  const siteCosts  = opt.id==="C"?(sk==="high"?52000:sk==="mid"?37000:24000):(sk==="high"?46000:sk==="mid"?30000:18000);
  const pm         = sk==="high"?32000:sk==="mid"?22000:14000;
  const strataSet  = opt.id==="C"?(sk==="high"?20000:sk==="mid"?17000:14000):0;
  const devSub = surveyor+townPln+preLodge+arborist+counciDA+infraCon+saWaterHW+
                 nbnCost+sapnCost+civil+bldDA+ldCert+roadPerm+siteCosts+pm+strataSet;
  const devCtg = Math.round((surveyor+civil+siteCosts)*0.08);
  const devTotal = demoTotal + devSub + devCtg;

  // ── CONSTRUCTION ─────────────────────────────────────────
  const buildBase  = opt.buildSqm * sp.rSqm;
  const soilUpg    = cc("soilUpgrade");
  const ncc7star   = cc("ncc7star");
  const bldExcl    = cc("builderExcl");
  const landscape  = opt.id==="C"?(sk==="high"?104000:sk==="mid"?76000:54000):(sk==="high"?95000:sk==="mid"?65000:44000);
  const retaining  = cc("retaining");
  const balComp    = cc("balCompliance");
  const pciInsp    = cc("pci");
  const conTotal   = buildBase+soilUpg+ncc7star+bldExcl+landscape+retaining+balComp+pciInsp;

  // ── FINANCE (phased capitalized interest) ────────────────
  const approxFacility = acqTotal + devTotal + conTotal;
  const loanEstab  = cc("loanEstab");
  const bankVal    = cc("bankVal");
  const qsFees     = cc("qsFees");
  const loanLegal  = cc("loanLegal");
  const finBroker  = cc("finBroker");
  const mortDisch  = cc("mortDisch");
  const finAdmin   = loanEstab+bankVal+qsFees+loanLegal+finBroker+mortDisch;

  // Phased interest (4 phases)
  const devEarly = Math.round(surveyor*0.4 + preLodge + counciDA*0.3 + townPln*0.4);
  const devLate  = devSub - devEarly;

  const p1o=acqTotal+loanEstab, p1d=devEarly;
  const p1int=Math.round((p1o+p1d*0.5)*RATE*(holdMo/12));
  const p1c=p1o+p1d+p1int;

  const p2o=p1c, p2d=devLate+demoTotal;
  const p2int=Math.round((p2o+p2d*0.5)*RATE*(3/12));
  const p2c=p2o+p2d+p2int;

  const p3o=p2c, p3d=conTotal;
  const p3int=Math.round((p3o+p3d*0.5)*RATE*(bm/12));
  const p3c=p3o+p3d+p3int;

  // Revenue & selling
  const salePrices = opt.salePrices[sk];
  const rev        = salePrices.reduce((a,b)=>a+b,0);
  const agt        = Math.round(rev*0.022);
  const mkt        = opt.dwellings*(sk==="high"?13000:sk==="mid"?10000:8000);
  const saleLgl    = opt.dwellings*(sk==="high"?3500:3000);
  const strataLev  = opt.id==="C" ? 3500 : 0;
  const sellTotal  = agt+mkt+saleLgl+strataLev;

  const p4o=p3c, p4d=sellTotal;
  const p4int=Math.round((p4o+p4d*0.5)*RATE*(4/12));
  const p4c=p4o+p4d+p4int;

  const capInt = p1int+p2int+p3int+p4int;
  const finTotal = capInt + finAdmin;

  // ── TAX & COMPLIANCE ─────────────────────────────────────
  // Entity setup: $1,000 fixed. Accountant/BAS: $NIL (we are accountants)
  const entitySetup = 1000;
  const gstGross    = Math.round((rev - pp) / 11);
  const itcOffset   = Math.round(conTotal * 0.08);
  const gstNet      = Math.max(0, gstGross - itcOffset);

  // ── TOTALS ───────────────────────────────────────────────
  const totCosts = acqTotal + (holdOpex - grossRent) + devTotal + conTotal + finTotal + entitySetup + gstNet + sellTotal;
  const grossProfit = rev - totCosts;
  const taxProv   = Math.max(0, Math.round(grossProfit * TAX_RATE));
  const netProfit = grossProfit - taxProv;
  const margin    = (grossProfit / rev) * 100;
  const netMargin = (netProfit / rev) * 100;
  const equityReq = pp * 0.20 + stamp + lgl + dd + pexa + titleSrch + buyersAgt;
  const roi       = equityReq > 0 ? (netProfit / equityReq) * 100 : 0;
  const peakBal   = p4c;

  return {
    // inputs
    pp, weekRent, grossRent, holdNet,
    // acq
    stamp, lgl, dd, pexa, titleSrch, buyersAgt, contamPre, rateAdj, acqTotal,
    // hold
    holdRates, holdWater, holdIns, holdPM, holdMaint, holdESL, holdOpex,
    // demo
    demoBase, asbesAssess, asbesRemove, hazmat, treeRemov, dilap, epaNote, demoTotal,
    // dev
    surveyor, townPln, preLodge, arborist, counciDA, infraCon, saWaterHW,
    nbnCost, sapnCost, civil, bldDA, ldCert, roadPerm, siteCosts, pm, strataSet, devCtg, devTotal,
    // con
    buildBase, soilUpg, ncc7star, bldExcl, landscape, retaining, balComp, pciInsp, conTotal,
    // fin
    loanEstab, bankVal, qsFees, loanLegal, finBroker, mortDisch, finAdmin,
    p1int, p2int, p3int, p4int, capInt, finTotal,
    // tax
    entitySetup, gstGross, itcOffset, gstNet,
    // sell
    agt, mkt, saleLgl, strataLev, sellTotal,
    salePrices,
    // summary
    totCosts, rev, grossProfit, taxProv, netProfit, margin, netMargin,
    equityReq, roi, peakBal, totalMo, buildMo:bm,
    phases:[
      {l:"Hold & DA",     mo:holdMo,  int:p1int},
      {l:"Demo & Civil",  mo:3,       int:p2int},
      {l:"Construction",  mo:bm,      int:p3int},
      {l:"Sales/Settle",  mo:4,       int:p4int},
    ],
  };
}

// ─── SENSITIVITY ─────────────────────────────────────────────────────────────
function calcSens(pp, optId, sk, checks) {
  const base = calcFull(pp, optId, sk, checks, 12);
  return [
    {s:"Base case",                        rv:1.0, cc:1.0, xm:0},
    {s:"Sale price −10%",                  rv:0.9, cc:1.0, xm:0},
    {s:"Sale price −20%",                  rv:0.8, cc:1.0, xm:0},
    {s:"Build costs +15%",                 rv:1.0, cc:1.15,xm:0},
    {s:"DA delay +6 months",               rv:1.0, cc:1.0, xm:6},
    {s:"Price −10% + Build +15%",          rv:0.9, cc:1.15,xm:3},
    {s:"Worst (−20% / +20% / +9mo delay)", rv:0.8, cc:1.20,xm:9},
  ].map(sc => {
    const adjRev  = Math.round(base.rev * sc.rv);
    const adjCon  = Math.round(base.conTotal * sc.cc);
    const extraInt= Math.round(base.peakBal * RATE * (sc.xm / 12));
    const adjCosts= base.totCosts - base.conTotal - base.capInt + adjCon + (base.capInt + extraInt);
    const gp      = adjRev - adjCosts;
    const tax     = Math.max(0, Math.round(gp * TAX_RATE));
    const np      = gp - tax;
    return {label:sc.s, rev:adjRev, gross:gp, tax, net:np, margin:adjRev>0?(gp/adjRev)*100:0, loss:np<=0};
  });
}

// ─── UI HELPERS ──────────────────────────────────────────────────────────────
function Pill({label,active,col,bg,onClick,small}) {
  return <button onClick={onClick} style={{border:`2px solid ${active?col:"#e5e7eb"}`,borderRadius:99,padding:small?"4px 10px":"5px 13px",background:active?bg:"#fff",cursor:"pointer",fontFamily:"'DM Mono',monospace",fontSize:small?10:11,fontWeight:700,color:active?col:"#6b7280",transition:"all 0.12s"}}>{label}</button>;
}
function SL({children,accent}) {
  return <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,fontWeight:700,letterSpacing:2,color:accent||"#6b7280",textTransform:"uppercase",paddingTop:12,paddingBottom:3,borderBottom:`1px solid ${accent?accent+"33":"#f3f4f6"}`,marginBottom:5}}>{children}</div>;
}
function PR({label,val,indent,bold,color,dim,note}) {
  return <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:indent?"2px 0 2px 12px":"3px 0",opacity:dim?0.4:1}}>
    <div style={{flex:1,paddingRight:8}}>
      <span style={{fontFamily:bold?"'DM Mono',monospace":"'Sora',sans-serif",fontSize:bold?12:11,fontWeight:bold?700:400,color:bold?"#111827":"#4b5563",lineHeight:1.4}}>{label}</span>
      {note&&<span style={{fontFamily:"'Sora',sans-serif",fontSize:9.5,color:"#9ca3af",marginLeft:5,fontStyle:"italic"}}>{note}</span>}
    </div>
    <span style={{fontFamily:"'DM Mono',monospace",fontSize:bold?13:11.5,fontWeight:bold?700:400,color:color||(bold?"#111827":"#374151"),flexShrink:0}}>{val}</span>
  </div>;
}
function Kpi({label,val,sub,col,bg}) {
  return <div style={{background:bg||"#fff",borderRadius:10,padding:"10px 12px",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
    <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1.5,color:"#6b7280",marginBottom:3}}>{label}</div>
    <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:col||"#111827"}}>{val}</div>
    {sub&&<div style={{fontFamily:"'Sora',sans-serif",fontSize:10,color:"#6b7280",marginTop:2}}>{sub}</div>}
  </div>;
}

// Checklist toggle component
function CheckItem({item,checked,onToggle,pp,optId,sk}) {
  const cost = item.cost(pp, optId, sk);
  return (
    <div style={{display:"flex",gap:10,padding:"8px 0",borderBottom:"1px solid #f3f4f6",alignItems:"flex-start"}}>
      <button onClick={onToggle} style={{
        width:20, height:20, borderRadius:4, flexShrink:0, marginTop:1,
        border:`2px solid ${checked?"#1d4ed8":"#d1d5db"}`,
        background:checked?"#1d4ed8":"#fff", cursor:"pointer",
        display:"flex",alignItems:"center",justifyContent:"center",
      }}>
        {checked&&<span style={{color:"#fff",fontSize:12,lineHeight:1}}>✓</span>}
      </button>
      <div style={{flex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
          <span style={{fontFamily:"'Sora',sans-serif",fontSize:12,fontWeight:600,color:checked?"#111827":"#9ca3af"}}>{item.label}</span>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:checked?"#1d4ed8":"#d1d5db",flexShrink:0}}>
            {checked ? $(cost) : "$0"}
          </span>
        </div>
        <div style={{fontFamily:"'Sora',sans-serif",fontSize:10.5,color:"#6b7280",lineHeight:1.5,marginTop:2}}>{item.why}</div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,    setTab]    = useState(0);
  const [optId,  setOptId]  = useState("A");
  const [sk,     setSk]     = useState("mid");
  const [ppk,    setPpk]    = useState("mid");
  const [checks, setChecks] = useState(DEFAULT_CHECKS);

  const pp  = PPS[ppk];
  const r   = useMemo(()=>calcFull(pp, optId, sk, checks, 12), [pp, optId, sk, checks]);
  const opt = OPTIONS.find(o => o.id === optId);
  const sc  = SC[sk];
  const sens = useMemo(()=>calcSens(pp, optId, sk, checks), [pp, optId, sk, checks]);

  const toggleCheck = (key) => setChecks(prev => ({...prev, [key]: !prev[key]}));
  const checkedCount = Object.values(checks).filter(Boolean).length;
  const totalCheckedCost = CHECKLIST_ITEMS.reduce((acc, item) =>
    checks[item.key] ? acc + item.cost(pp, optId, sk) : acc, 0);

  const cats = [...new Set(CHECKLIST_ITEMS.map(i => i.cat))];
  const TABS = ["Cost Checklist","Full P&L","Sensitivity","Skill Roadmap"];

  return (
    <div style={{fontFamily:"'Sora',sans-serif",background:"#f5f4f1",minHeight:"100vh",paddingBottom:56}}>

      {/* HEADER */}
      <div style={{background:"linear-gradient(160deg,#0c1a2e,#0f2a4a 50%,#0a2e1a)",padding:"18px 16px 14px",overflow:"hidden"}}>
        <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:3,color:"#475569",marginBottom:4}}>PROPERTY DEVELOPMENT FEASIBILITY · 22 FOURTH AVENUE MOANA SA 5169</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:700,color:"#f8fafc",lineHeight:1.2}}>
          Interactive Cost Checklist + Full Analysis
        </div>
        {/* Property auto-data bar */}
        <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
          {[
            {l:"ADDRESS",v:"22 Fourth Ave, Moana SA 5169"},
            {l:"STATE → DUTIES",v:"SA (auto)"},
            {l:"LAND AREA",v:"785m² (survey)"},
            {l:"COMPANY TAX",v:"25% base rate"},
            {l:"HOLD",v:"12 months"},
            {l:"EST. RENT",v:`${$(autoRent(pp))}/wk (4% yield)`},
          ].map(s=>(
            <div key={s.l} style={{background:"rgba(255,255,255,0.06)",borderRadius:7,padding:"5px 9px"}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:7.5,letterSpacing:1.5,color:"#64748b"}}>{s.l}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:700,color:"#94a3b8",marginTop:1}}>{s.v}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:10,background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:8,padding:"7px 12px",fontFamily:"'Sora',sans-serif",fontSize:11,color:"#6ee7b7"}}>
          ✓ State auto-determined from address · Land area from survey plan · Rent = ${autoRent(pp)}/wk (${$( pp)} × 4.0% gross yield × 70% old-dwelling factor ÷ 52) · Tax = 25% company base rate
        </div>
      </div>

      {/* GLOBAL CONTROLS */}
      <div style={{background:"#fff",borderBottom:"1px solid #e5e7eb",padding:"10px 14px",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#6b7280"}}>Buy:</span>
        {["low","mid","high"].map(k=><Pill key={k} label={PP_LABELS[k]} active={ppk===k} col="#d97706" bg="#fef3c7" onClick={()=>setPpk(k)} small/>)}
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#6b7280",marginLeft:6}}>Option:</span>
        {OPTIONS.map(o=><Pill key={o.id} label={`${o.id}: ${o.dwellings} homes`} active={optId===o.id} col={o.col} bg={o.bg} onClick={()=>setOptId(o.id)} small/>)}
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#6b7280",marginLeft:6}}>Spec:</span>
        {["low","mid","high"].map(s=><Pill key={s} label={SPECS[s].label} active={sk===s} col={SC[s].c} bg={SC[s].bg} onClick={()=>setSk(s)} small/>)}
      </div>

      {/* TABS */}
      <div style={{background:"#fff",borderBottom:"1px solid #e5e7eb",display:"flex"}}>
        {TABS.map((t,i)=>(
          <button key={t} onClick={()=>setTab(i)} style={{flex:1,padding:"11px 4px",fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,background:"none",border:"none",borderBottom:tab===i?"3px solid #1d4ed8":"3px solid transparent",color:tab===i?"#1d4ed8":"#6b7280",cursor:"pointer",whiteSpace:"nowrap"}}>{t}</button>
        ))}
      </div>

      <div style={{padding:"0 14px"}}>

        {/* ══ TAB 0: COST CHECKLIST ══ */}
        {tab===0&&<div>

          {/* Live summary */}
          <div style={{background:"#fff",borderRadius:12,padding:14,marginTop:14,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#111827"}}>
                Cost Confirmation Checklist
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setChecks(Object.fromEntries(CHECKLIST_ITEMS.map(i=>[i.key,true])))} style={{fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,color:"#1d4ed8",background:"#dbeafe",border:"none",borderRadius:99,padding:"3px 10px",cursor:"pointer"}}>ALL ON</button>
                <button onClick={()=>setChecks(DEFAULT_CHECKS)} style={{fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,color:"#6b7280",background:"#f3f4f6",border:"none",borderRadius:99,padding:"3px 10px",cursor:"pointer"}}>RESET</button>
              </div>
            </div>
            <div style={{fontFamily:"'Sora',sans-serif",fontSize:11,color:"#4b5563",lineHeight:1.5,marginBottom:10}}>
              Tick each cost that applies to this property and deal. Defaults are pre-set for a pre-1990 dwelling with 2 new lots. The P&L and sensitivity update live as you toggle. Unticked items show as $0 in the P&L.
            </div>
            <div style={{display:"flex",gap:8}}>
              <div style={{background:"#f0fdf4",borderRadius:8,padding:"8px 12px",flex:1}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#6b7280",marginBottom:2}}>ITEMS CONFIRMED</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#059669"}}>{checkedCount}/{CHECKLIST_ITEMS.length}</div>
              </div>
              <div style={{background:"#fef2f2",borderRadius:8,padding:"8px 12px",flex:1}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#6b7280",marginBottom:2}}>CONFIRMED OPTIONAL COSTS</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#dc2626"}}>{$(totalCheckedCost)}</div>
              </div>
              <div style={{background:"#f0fdf4",borderRadius:8,padding:"8px 12px",flex:1}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"#6b7280",marginBottom:2}}>NET PROFIT (post-tax)</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:r.netProfit>=0?"#065f46":"#991b1b"}}>{$(r.netProfit)}</div>
              </div>
            </div>
          </div>

          {/* Checklist by category */}
          {cats.map(cat => (
            <div key={cat} style={{background:"#fff",borderRadius:12,padding:14,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,fontWeight:700,color:"#374151",letterSpacing:1}}>{cat.toUpperCase()}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:700,color:"#1d4ed8"}}>
                  {$(CHECKLIST_ITEMS.filter(i=>i.cat===cat&&checks[i.key]).reduce((acc,i)=>acc+i.cost(pp,optId,sk),0))}
                </div>
              </div>
              {CHECKLIST_ITEMS.filter(i => i.cat === cat).map(item => (
                <CheckItem key={item.key} item={item} checked={checks[item.key]}
                  onToggle={()=>toggleCheck(item.key)} pp={pp} optId={optId} sk={sk}/>
              ))}
            </div>
          ))}

          {/* Always-included notice */}
          <div style={{background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:10,padding:12,marginBottom:14}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,fontWeight:700,color:"#6b7280",marginBottom:6}}>ALWAYS INCLUDED (not toggleable)</div>
            {["Purchase price + stamp duty + legal + due diligence + PEXA + title search",
              "Holding costs during DA (council rates, water, insurance, PM fees, ESL)",
              "Demolition base cost (structure only — asbestos/hazmat above are separate)",
              "Surveyor + council DA + civil works + site costs + project management",
              "Build cost ($/m² × floor area)",
              "Landscaping & hardstand",
              "Agent commission + marketing + sale conveyancing",
              "Phased capitalized interest on construction loan",
              "GST under margin scheme (net of input credits)",
              "Entity setup ($1,000) · Accountant/BAS fees ($NIL — in-house)",
            ].map((s,i)=>(
              <div key={i} style={{fontFamily:"'Sora',sans-serif",fontSize:11,color:"#4b5563",lineHeight:1.6,paddingLeft:12,position:"relative"}}>
                <span style={{position:"absolute",left:0,color:"#059669"}}>✓</span>{s}
              </div>
            ))}
          </div>
        </div>}

        {/* ══ TAB 1: FULL P&L ══ */}
        {tab===1&&<div>

          {/* KPIs */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:14,marginBottom:10}}>
            <Kpi label="TOTAL REVENUE"         val={$(r.rev)}         col="#111827"/>
            <Kpi label="TOTAL COSTS (ex-tax)"  val={$(r.totCosts)}    col="#374151"/>
            <Kpi label="GROSS PROFIT (pre-tax)" val={$(r.grossProfit)} col={r.grossProfit>=0?"#d97706":"#991b1b"} bg="#fef3c7" sub="Before 25% company tax"/>
            <Kpi label="TAX PROVISION (25%)"   val={$(r.taxProv)}     col="#dc2626" bg="#fef2f2" sub="Company base rate entity"/>
            <Kpi label="NET PROFIT (post-tax)"  val={$(r.netProfit)}   col={r.netProfit>=0?"#065f46":"#991b1b"} bg={r.netProfit>=0?"#f0fdf4":"#fef2f2"} sub="Your real take-home"/>
            <Kpi label="NET MARGIN"             val={pct(r.netMargin)} col={sc.c} bg={sc.bg}/>
            <Kpi label="PEAK LOAN BALANCE"      val={$(r.peakBal)}     col="#1d4ed8" bg="#dbeafe" sub="Repaid from sale proceeds"/>
            <Kpi label="EQUITY REQUIRED"        val={$(r.equityReq)}   col="#7c3aed" bg="#f5f3ff" sub="20% deposit + upfront costs"/>
          </div>

          {/* Detailed P&L */}
          <div style={{background:"#fff",borderRadius:12,padding:14,boxShadow:"0 1px 4px rgba(0,0,0,0.06)",marginBottom:14}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#111827",marginBottom:2}}>Complete P&L — Option {optId} · {SPECS[sk].label} Spec</div>
            <div style={{fontFamily:"'Sora',sans-serif",fontSize:11,color:"#6b7280",marginBottom:8}}>
              {$(pp)} purchase · {$(r.weekRent)}/wk rent (auto-calculated) · {r.totalMo} months total · 25% company tax
            </div>

            <SL accent={sc.c}>1 — Acquisition</SL>
            <PR label="Purchase price" val={$(r.pp)} indent/>
            <PR label={`Stamp duty SA (${pct((r.stamp/r.pp)*100)} effective)`} val={$(r.stamp)} indent/>
            <PR label="Conveyancing & legal" val={$(r.lgl)} indent/>
            <PR label="Due diligence (building / pest)" val={$(r.dd)} indent/>
            <PR label="PEXA electronic settlement" val={$(r.pexa)} indent/>
            <PR label="Certificate of Title search" val={$(r.titleSrch)} indent/>
            <PR label="Buyer's agent fee" val={$(r.buyersAgt)} indent dim={!checks.buyersAgent} note={!checks.buyersAgent?"not selected":undefined}/>
            <PR label="Pre-purchase contamination assessment" val={$(r.contamPre)} indent dim={!checks.contaminPre}/>
            <PR label="Rate & water settlement adjustments" val={$(r.rateAdj)} indent dim={!checks.rateAdj}/>
            <PR label="ACQUISITION TOTAL" val={$(r.acqTotal)} bold/>

            <SL accent="#059669">2 — Holding (12 months @ ${$(r.weekRent)}/wk est.)</SL>
            <PR label={`Gross rent (${$(r.weekRent)}/wk × 50 wks — auto yield calc)`} val={$(r.grossRent)} indent color="#059669"/>
            <PR label="Council rates" val={`-${$(r.holdRates)}`} indent color="#dc2626"/>
            <PR label="SA Water (supply)" val={`-${$(r.holdWater)}`} indent color="#dc2626"/>
            <PR label="Landlord insurance" val={`-${$(r.holdIns)}`} indent color="#dc2626"/>
            <PR label="Property management (8.5%)" val={`-${$(r.holdPM)}`} indent color="#dc2626"/>
            <PR label="Maintenance allowance" val={`-${$(r.holdMaint)}`} indent color="#dc2626"/>
            <PR label="Emergency Services Levy (SA)" val={`-${$(r.holdESL)}`} indent color="#dc2626"/>
            <PR label="NET RENTAL BENEFIT" val={$(r.holdNet)} bold color="#059669"/>

            <SL accent={sc.c}>3 — Demolition</SL>
            <PR label="Demolition (structure)" val={$(r.demoBase)} indent/>
            <PR label="Asbestos assessment (licensed)" val={$(r.asbesAssess)} indent dim={!checks.asbestosAssess}/>
            <PR label="Asbestos removal & disposal" val={$(r.asbesRemove)} indent dim={!checks.asbestosRemove}/>
            <PR label="Hazardous materials (lead paint)" val={$(r.hazmat)} indent dim={!checks.hazmat}/>
            <PR label="Tree removal" val={$(r.treeRemov)} indent dim={!checks.treeRemoval}/>
            <PR label="Dilapidation survey (neighbours)" val={$(r.dilap)} indent dim={!checks.dilapidation}/>
            <PR label="EPA / council demolition notice" val={$(r.epaNote)} indent dim={!checks.epaNotify}/>
            <PR label="DEMOLITION TOTAL" val={$(r.demoTotal)} bold/>

            <SL accent={sc.c}>4 — Development & Subdivision</SL>
            <PR label="Licensed surveyor + land division plan" val={$(r.surveyor)} indent/>
            <PR label="Town planner / planning consultant" val={$(r.townPln)} indent dim={!checks.townPlanner}/>
            <PR label="Pre-lodgement meeting (council/SCAP)" val={$(r.preLodge)} indent dim={!checks.preLodge}/>
            <PR label="Arborist report" val={$(r.arborist)} indent dim={!checks.arborist}/>
            <PR label="Council / SCAP subdivision DA fees" val={$(r.counciDA)} indent/>
            <PR label="Infrastructure / developer contribution levy" val={$(r.infraCon)} indent dim={!checks.infraContrib}/>
            <PR label="SA Water headworks / developer charge" val={$(r.saWaterHW)} indent dim={!checks.saWaterHW}/>
            <PR label="NBN pit and pipe (per new dwelling)" val={$(r.nbnCost)} indent dim={!checks.nbnPitPipe}/>
            <PR label="SAPN new service connection" val={$(r.sapnCost)} indent dim={!checks.sapnConnect}/>
            <PR label="Civil works (sewer, water mains)" val={$(r.civil)} indent/>
            <PR label={`Building DAs / CDCs × ${opt.dwellings} (incl. certifier)`} val={$(r.bldDA)} indent/>
            <PR label="Land division certificate + deposited plan" val={$(r.ldCert)} indent dim={!checks.ldCert}/>
            <PR label="Road opening / crossover permit" val={$(r.roadPerm)} indent dim={!checks.roadPermit}/>
            <PR label="Site costs (soil test, footings, levelling)" val={$(r.siteCosts)} indent/>
            <PR label="Project management & coordination" val={$(r.pm)} indent/>
            {r.strataSet>0&&<PR label="Community / strata title setup" val={$(r.strataSet)} indent/>}
            <PR label="Contingency (8% on key dev items)" val={$(r.devCtg)} indent/>
            <PR label="DEVELOPMENT TOTAL" val={$(r.devTotal)} bold/>

            <SL accent={sc.c}>5 — Construction</SL>
            <PR label={`Build: ${opt.buildSqm}m² @ $${SPECS[sk].rSqm.toLocaleString()}/m² (2-storey)`} val={$(r.buildBase)} indent/>
            <PR label="Footing upgrade — Class H/P reactive soil" val={$(r.soilUpg)} indent dim={!checks.soilUpgrade}/>
            <PR label="NCC 2022 / 7-star NatHERS compliance" val={$(r.ncc7star)} indent dim={!checks.ncc7star}/>
            <PR label="Builder exclusions (fencing, driveway, fittings)" val={$(r.bldExcl)} indent dim={!checks.builderExcl}/>
            <PR label="Landscaping, driveways & hardstand" val={$(r.landscape)} indent/>
            <PR label="Retaining walls (boundary level change)" val={$(r.retaining)} indent dim={!checks.retaining}/>
            <PR label="BAL compliance (bushfire)" val={$(r.balComp)} indent dim={!checks.balCompliance}/>
            <PR label="Practical completion inspections" val={$(r.pciInsp)} indent dim={!checks.pci}/>
            <PR label="CONSTRUCTION TOTAL" val={$(r.conTotal)} bold/>

            <SL accent="#dc2626">6 — Finance (6.5% p.a. CAPITALISED)</SL>
            <PR label="Loan establishment fee (1%)" val={$(r.loanEstab)} indent dim={!checks.loanEstab} color="#dc2626"/>
            <PR label="Bank-appointed valuation" val={$(r.bankVal)} indent dim={!checks.bankVal} color="#dc2626"/>
            <PR label="QS progress inspection fees" val={$(r.qsFees)} indent dim={!checks.qsFees} color="#dc2626"/>
            <PR label="Loan documentation legal fees" val={$(r.loanLegal)} indent dim={!checks.loanLegal} color="#dc2626"/>
            <PR label="Development finance broker" val={$(r.finBroker)} indent dim={!checks.finBroker} color="#dc2626"/>
            <PR label="Mortgage discharge + PEXA at exit" val={$(r.mortDisch)} indent dim={!checks.mortDisch} color="#dc2626"/>
            {r.phases.map((ph,i)=><PR key={i} label={`${ph.l} interest (${ph.mo} months, capitalised)`} val={$(ph.int)} indent color="#dc2626"/>)}
            <PR label="FINANCE TOTAL" val={$(r.finTotal)} bold color="#dc2626"/>

            <SL accent="#d97706">7 — Tax & Compliance</SL>
            <PR label="Entity setup (company, fixed)" val={$(r.entitySetup)} indent note="$1,000 fixed"/>
            <PR label="Accountant fees" val="$NIL" indent note="in-house" color="#059669"/>
            <PR label="BAS lodgement" val="$NIL" indent note="in-house" color="#059669"/>
            <PR label="GST (margin scheme gross)" val={$(r.gstGross)} indent/>
            <PR label="Less: construction input tax credits" val={`-${$(r.itcOffset)}`} indent color="#059669"/>
            <PR label="GST NET PAYABLE" val={$(r.gstNet)} bold color="#d97706"/>

            <SL accent={sc.c}>8 — Selling Costs</SL>
            <PR label={`Agent commission 2.2% on ${$(r.rev)}`} val={$(r.agt)} indent/>
            <PR label={`Marketing × ${opt.dwellings}`} val={$(r.mkt)} indent/>
            <PR label={`Sale conveyancing × ${opt.dwellings}`} val={$(r.saleLgl)} indent/>
            {r.strataLev>0&&<PR label="Strata levies during sales" val={$(r.strataLev)} indent/>}
            <PR label="SELLING TOTAL" val={$(r.sellTotal)} bold/>

            <div style={{height:2,background:`linear-gradient(90deg,${sc.c},transparent)`,margin:"10px 0 7px"}}/>
            <PR label="TOTAL ALL COSTS" val={$(r.totCosts)} bold/>
            <SL accent="#059669">9 — Revenue</SL>
            {r.salePrices.map((sp,i)=><PR key={i} label={`Dwelling ${i+1}`} val={$(sp)} indent/>)}
            <PR label="TOTAL REVENUE" val={$(r.rev)} bold/>
            <div style={{height:2,background:"#111827",margin:"10px 0 7px"}}/>
            <PR label="GROSS PROFIT (pre-tax)" val={$(r.grossProfit)} bold color={r.grossProfit>=0?"#d97706":"#991b1b"}/>
            <PR label="Income tax provision (25% company)" val={`-${$(r.taxProv)}`} indent color="#dc2626"/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:r.netProfit>=0?"#f0fdf4":"#fef2f2",borderRadius:8,marginTop:4}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#111827"}}>NET PROFIT (post-tax)</span>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:20,fontWeight:700,color:r.netProfit>=0?"#065f46":"#991b1b"}}>{$(r.netProfit)}</span>
            </div>
          </div>
        </div>}

        {/* ══ TAB 2: SENSITIVITY ══ */}
        {tab===2&&<div>
          <div style={{background:"#fff",borderRadius:12,padding:14,marginTop:14,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#111827",marginBottom:12}}>7-Scenario Sensitivity Analysis</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:"2px solid #111827"}}>
                  {["Scenario","Revenue","Gross Profit","Tax 25%","Net Profit","Margin",""].map(h=>(
                    <th key={h} style={{padding:"4px 5px 7px",fontFamily:"'DM Mono',monospace",fontSize:9,color:"#6b7280",textAlign:h==="Scenario"?"left":"right"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {sens.map((s,i)=>(
                    <tr key={i} style={{borderBottom:"1px solid #f3f4f6",background:i===0?"#f0fdf4":s.loss?"#fef2f2":"#fff"}}>
                      <td style={{padding:"6px 5px 6px 0",fontFamily:"'Sora',sans-serif",fontSize:10.5,fontWeight:i===0?700:400,color:"#374151"}}>{s.label}</td>
                      <td style={{padding:"6px 5px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:11,color:"#374151"}}>{$(s.rev)}</td>
                      <td style={{padding:"6px 5px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:600,color:s.gross>=0?"#d97706":"#dc2626"}}>{$(s.gross)}</td>
                      <td style={{padding:"6px 5px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:11,color:"#dc2626"}}>{s.gross>0?`-${$(s.tax)}`:"—"}</td>
                      <td style={{padding:"6px 5px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:s.net>=0?"#065f46":"#991b1b"}}>{$(s.net)}</td>
                      <td style={{padding:"6px 5px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:11,color:s.margin>0?"#374151":"#dc2626"}}>{pct(s.margin)}</td>
                      <td style={{padding:"6px 5px",textAlign:"right"}}>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,background:s.loss?"#fef2f2":i===0?"#d1fae5":"#f1f5f9",color:s.loss?"#dc2626":i===0?"#065f46":"#475569",borderRadius:99,padding:"2px 7px"}}>{s.loss?"LOSS":i===0?"BASE":"✓"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Break-even */}
          <div style={{background:"#fff",borderRadius:12,padding:14,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:"#111827",marginBottom:10}}>Break-Even Analysis</div>
            {(()=>{
              const bePricePerDw = Math.round((r.totCosts + r.taxProv) / opt.dwellings);
              const currPerDw    = Math.round(r.rev / opt.dwellings);
              const headroom     = currPerDw - bePricePerDw;
              const headroomPct  = (headroom / currPerDw) * 100;
              return [
                {l:"Break-even sale price (net of all costs + tax)",v:$(bePricePerDw),c:"#374151"},
                {l:"Current projected sale price per dwelling",    v:$(currPerDw),     c:"#1d4ed8"},
                {l:"Headroom before loss",                         v:`${$(headroom)} (${pct(headroomPct)} drop)`,c:"#059669"},
              ].map(row=>(
                <div key={row.l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f3f4f6"}}>
                  <span style={{fontFamily:"'Sora',sans-serif",fontSize:11,color:"#374151"}}>{row.l}</span>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,color:row.c}}>{row.v}</span>
                </div>
              ));
            })()}
          </div>
        </div>}

        {/* ══ TAB 3: SKILL ROADMAP ══ */}
        {tab===3&&<div>
          <div style={{background:"#fff",borderRadius:12,padding:14,marginTop:14,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#111827",marginBottom:4}}>Next Steps — Building the Skill</div>
            <div style={{fontFamily:"'Sora',sans-serif",fontSize:11,color:"#4b5563",lineHeight:1.6}}>
              This feasibility is the specification. Below is the exact build sequence to turn it into a reusable skill in Claude Projects + Claude Code, and then a fully automated pipeline with property API scraping.
            </div>
          </div>

          {/* Phase breakdown */}
          {[
            {
              phase:"Phase 1 — Build the Calculators in Claude Code",
              col:"#1d4ed8", est:"1–2 sessions",
              steps:[
                { n:"stamp_duty.js", d:"State-by-state stamp duty function. Inputs: purchase_price, state. All 8 states + territories. Test against SA RevenueSA online calculator to validate every bracket." },
                { n:"subdivision_yield.js", d:"Inputs: frontage_m, depth_m, rear_frontage_m, land_area_sqm, zone. Outputs: max_lots, lot_sizes, compliance_check, recommended_option. Encode GN/SN/RN zone rules for SA. Extensible to other states." },
                { n:"capitalized_interest.js", d:"Inputs: purchase_price, dev_costs, build_costs, selling_costs, hold_months, build_months, rate. Outputs: phase-by-phase balance, gross_cap_int, peak_balance. Validate against current manual model." },
                { n:"gst_margin_scheme.js", d:"Inputs: sale_price, purchase_price, construction_costs. Outputs: gst_gross, input_credits, gst_net. Handle new residential vs existing correctly." },
                { n:"income_tax.js", d:"Inputs: gross_profit, entity_type. Hard-code: company=25% (base rate), individual=sliding scale to 47%, trust=pass-through. Return provision + effective rate." },
                { n:"sensitivity.js", d:"Wraps the full calc function. Runs 7 scenarios (−10%/−20% rev, +15%/+20% costs, +3/+6/+9 month delays). Returns array of net profit, margin, break-even per scenario." },
                { n:"auto_rent.js", d:"Inputs: purchase_price, suburb, state. Logic: purchase_price × gross_yield × dwelling_factor ÷ 52. Yield sourced from data file or web search. Flag as estimate." },
              ]
            },
            {
              phase:"Phase 2 — Build the Data Files",
              col:"#7c3aed", est:"1 session",
              steps:[
                { n:"build_costs.json", d:"$/m² by: state (SA/VIC/NSW/QLD/WA), region (metro/coastal/regional), spec (entry/quality/premium), dwelling_type (detached/terrace/duplex). Source: HIA Costbuilder or Cordell quarterly." },
                { n:"zone_rules.json", d:"Planning zone → min_site_area, min_frontage by dwelling type. Start with SA (GN/SN/RN/Hills/Coastal). Add VIC/NSW zones in same structure. Include TNV flag fields." },
                { n:"dev_costs.json", d:"Benchmark dev costs by: lot_count (2/3), state, council_type. Include: surveyor, DA fees, civil works, PM, strata. Used when no project-specific quote available." },
                { n:"water_authority_charges.json", d:"Developer/headworks charge per new lot by: state, water authority. SA Water: ~$15K. Sydney Water, Melbourne Water, etc. Update quarterly." },
                { n:"power_authority_fees.json", d:"Connection fee per new dwelling by: state, network operator. SAPN (SA), AusGrid/Endeavour (NSW), Citipower/Powercor (VIC). Source: published fee schedules." },
                { n:"rental_yields.json", d:"Gross rental yield by: suburb, property_type, bedrooms. Updated from Domain/REA quarterly. Used by auto_rent.js as fallback if web search unavailable." },
                { n:"stamp_duty_tables.json", d:"All stamp duty bracket tables by state. Includes concessions, FIRB surcharge flag, first home buyer exemption flag. Referenced by stamp_duty.js." },
              ]
            },
            {
              phase:"Phase 3 — Write SKILL.md for Claude Projects",
              col:"#059669", est:"1 session",
              steps:[
                { n:"Trigger conditions", d:"Activate when: user provides an address, listing URL, land dimensions, or asks about 'development feasibility', 'subdivision', 'can I develop this property'. Also trigger on: 'is this worth buying to develop'." },
                { n:"Input collection flow", d:"If address provided → auto-lookup: zone (PlanSA web search), land area (Land Services SA / Domain listing / user), state (derive from address). Ask only for: purchase price range, strategy, build spec, entity type. Everything else auto-fills." },
                { n:"Processing sequence", d:"1. Validate inputs. 2. Auto-enrich (zone, comps, rent yield, stamp duty, water charges). 3. Run subdivision_yield.js. 4. For each option: run full P&L calc. 5. Run sensitivity. 6. Generate checklist defaults from property age/type. 7. Format output." },
                { n:"Output format spec", d:"Always produce: (a) property summary card, (b) subdivision options table, (c) recommended option, (d) full P&L for recommended option with checklist items flagged, (e) sensitivity table, (f) next steps, (g) confidence flags for auto-estimated items." },
                { n:"Confidence flags", d:"Every auto-estimated value gets a flag: CONFIRMED (from title/quote), ESTIMATED (from data file), VERIFY (needs professional confirmation). Helps user know what's solid vs needs checking." },
              ]
            },
            {
              phase:"Phase 4 — Test & Refine (3–5 real properties)",
              col:"#d97706", est:"1–2 sessions",
              steps:[
                { n:"Test case 1: this property", d:"22 Fourth Avenue Moana. Known dimensions, known zone, known listing price. Validate all outputs match this feasibility." },
                { n:"Test case 2: vacant land", d:"Test with a vacant lot — no demolition, no asbestos, no holding rent. Checklist should auto-uncheck relevant items." },
                { n:"Test case 3: different state", d:"A NSW or VIC address. Confirm stamp duty changes, water authority changes, zone rules update correctly." },
                { n:"Test case 4: unit development", d:"A property in a higher-density zone (e.g. Urban Corridor). Confirm the subdivision yield calculator handles different zone rules." },
                { n:"Refine checklist defaults", d:"After 5 properties, the default on/off state for each checklist item will become more accurate. Update DEFAULT_CHECKS in the skill to reflect learnings." },
              ]
            },
            {
              phase:"Phase 5 — Property API Scraping (Separate Project)",
              col:"#0891b2", est:"2–3 sessions",
              steps:[
                { n:"PlanSA SAPPA API (free)", d:"Government open data API. Inputs: address or coordinates. Returns: zone, overlays, TNVs, DA requirements. No authentication needed for basic lookups. Build a wrapper function in Claude Code." },
                { n:"Domain API", d:"Requires a Domain developer account (free for limited calls). Returns: listing price, land area, bedroom count, photos, comparable sales. The main enrichment source for residential." },
                { n:"Land Services SA", d:"SA Land Title register is partially accessible via PlanSA. Full title search requires a licensed searcher or InfoTrack integration ($5–15 per search). Worth integrating for lot dimensions." },
                { n:"Scraper for council rate estimates", d:"Most councils publish rate-in-dollar figures. Build a scraper that: takes council name → fetches rates page → extracts $/$ rate → multiplies by estimated site value. Store results in council_rates.json." },
                { n:"Input → full feasibility pipeline", d:"Final state: user pastes a Domain URL. The skill: fetches listing data, extracts price/land area/address, auto-lookups zone and charges, fills all 32 input fields, runs the full model, produces the feasibility in one response. Zero manual input required." },
              ]
            },
          ].map(phase=>(
            <div key={phase.phase} style={{background:"#fff",borderRadius:12,padding:14,marginBottom:10,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:700,color:phase.col}}>{phase.phase}</div>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,fontWeight:700,color:phase.col,background:phase.col+"15",borderRadius:99,padding:"2px 8px",flexShrink:0,marginLeft:10}}>{phase.est}</span>
              </div>
              {phase.steps.map((s,i)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid #f9fafb"}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,fontWeight:700,color:phase.col,flexShrink:0,marginTop:1}}>{String(i+1).padStart(2,"0")}</span>
                  <div>
                    <div style={{fontFamily:"'Sora',sans-serif",fontSize:12,fontWeight:600,color:"#111827"}}>{s.n}</div>
                    <div style={{fontFamily:"'Sora',sans-serif",fontSize:11,color:"#4b5563",lineHeight:1.5,marginTop:1}}>{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Immediate next action */}
          <div style={{background:"linear-gradient(135deg,#0f172a,#0a2e1a)",borderRadius:14,padding:16,marginBottom:14}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:2,color:"#64748b",marginBottom:8}}>START HERE — IMMEDIATE NEXT ACTIONS</div>
            {[
              {n:"1. Open Claude Code",   d:"Start a new Claude Code session. Ask it to build stamp_duty.js first — validate against SA RevenueSA online calculator for 5 different purchase prices. This is the easiest calculator and sets the pattern for all others."},
              {n:"2. Create the Project", d:"Create a Claude Project called 'Property Feasibility Skill'. Upload this feasibility as the reference document. As you build each calculator and data file in Claude Code, add them to the Project."},
              {n:"3. Write SKILL.md",     d:"Ask Claude to draft SKILL.md based on the spec in this tab. The skill file tells every conversation in the Project: when someone provides an address or listing, run the feasibility workflow."},
              {n:"4. Test with Moana",    d:"Paste '22 Fourth Avenue Moana SA 5169, listing $699K–$749K, 785m², 21.34m × 42.9m, rear lane 15.24m, 2-storey develop to sell, company, quality spec' into the Project. The skill should produce a complete feasibility matching this one."},
              {n:"5. Then scraping",      d:"Once the skill produces accurate manual-input results for 3+ properties, build the Domain API wrapper in a separate Claude Code session. Feeding auto-data into the skill is a natural Phase 2 once the core logic is validated."},
            ].map(p=>(
              <div key={p.n} style={{marginBottom:12,borderLeft:"3px solid #34d399",paddingLeft:10}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:700,color:"#34d399"}}>{p.n}</div>
                <div style={{fontFamily:"'Sora',sans-serif",fontSize:11,color:"#94a3b8",lineHeight:1.6,marginTop:3}}>{p.d}</div>
              </div>
            ))}
          </div>
        </div>}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Mono:wght@400;700&family=Sora:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        button { outline: none; }
      `}</style>
    </div>
  );
}
