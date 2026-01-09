// lib/dd2025.ts

export type DDInputs = {
  isAF: boolean;

  E: number | null; // cm/s
  A: number | null; // cm/s

  eSeptal: number | null; // cm/s
  eLateral: number | null; // cm/s

  trVmax: number | null; // m/s
  pasp: number | null; // mmHg

  lavi: number | null; // mL/m^2
  lars: number | null; // %
  pvSD: number | null; // ratio
  ivrt: number | null; // ms

  dt: number | null; // ms (AF)
  bmi: number | null; // kg/m^2 (AF)
};

export type DDResult = {
  gradeLabel: string;
  summary: string;

  badgeTone: "green" | "blue" | "amber" | "red" | "gray";

  derived: {
    EA: number | null;
    eAvg: number | null;
    EeAvg: number | null;
  };

  ruleTrace: string[];

  // New: user guidance
  missing: string[];
};

export function computeDD2025(x: DDInputs): DDResult {
  return x.isAF ? computeAF(x) : computeSinus(x);
}

/* ============================
   SINUS RHYTHM (Algorithm 1)
   ============================ */
function computeSinus(x: DDInputs): DDResult {
  const trace: string[] = [];
  const missing: string[] = [];

  const EA = safeDiv(x.E, x.A);
  const eAvg = avg2(x.eSeptal, x.eLateral);
  const EeAvg = safeDiv(x.E, eAvg);

  // Minimal missing checks (don’t be too strict; allow partial)
  if (x.E == null) missing.push("Mitral E (cm/s)");
  if (x.A == null) missing.push("Mitral A (cm/s) (needed for E/A)");
  if (x.eSeptal == null && x.eLateral == null) missing.push("Septal and/or lateral e′ (cm/s)");

  // Top 3 markers
  const reducedE =
    (x.eSeptal != null && x.eSeptal <= 6) ||
    (x.eLateral != null && x.eLateral <= 7) ||
    (eAvg != null && eAvg <= 6.5);

  // NOTE: Your full guideline allows septal/lateral/avg E/e′ thresholds.
  // Here we use avg only because this minimal engine stores EeAvg.
  // If you want septal/lateral specific display later, we can add EeSeptal/EeLateral.
  const highEe = EeAvg != null && EeAvg >= 14;

  const highTR =
    (x.trVmax != null && x.trVmax >= 2.8) ||
    (x.pasp != null && x.pasp >= 35);

  const nAbn = [reducedE, highEe, highTR].filter(Boolean).length;
  trace.push(`Top markers abnormal: ${nAbn}/3`);

  // All normal
  if (nAbn === 0) {
    return pack(
      "Normal DF",
      "All diastolic markers normal → Normal LAP",
      "green",
      EA,
      eAvg,
      EeAvg,
      trace,
      missing
    );
  }

  // Reduced e′ only with E/A ≤ 0.8 -> Grade 1
  if (reducedE && !highEe && !highTR) {
    trace.push("Reduced e′ only branch");
    if (EA != null && EA <= 0.8) {
      return pack(
        "Grade 1",
        "Reduced e′ only with E/A ≤ 0.8",
        "blue",
        EA,
        eAvg,
        EeAvg,
        trace,
        missing
      );
    }
  }

  // Confirm LAP (purple box)
  const anyConfirmAvailable =
    x.pvSD != null || x.lars != null || x.lavi != null || x.ivrt != null;

  const lap =
    (x.pvSD != null && x.pvSD <= 0.67) ||
    (x.lars != null && x.lars <= 18) ||
    (x.lavi != null && x.lavi > 34) ||
    (x.ivrt != null && x.ivrt <= 70);

  if (!anyConfirmAvailable) {
    trace.push("No confirmatory variables available");
    return pack(
      "Indeterminate",
      "Need ≥1 confirmatory variable (PV S/D, LARS, LAVI, or IVRT) to confirm LAP",
      "amber",
      EA,
      eAvg,
      EeAvg,
      trace,
      missing
    );
  }

  trace.push(lap ? "LAP elevated" : "LAP not elevated");

  if (!lap) {
    // In your flowchart, some branches can be Normal LAP or Grade 1.
    // Here we keep it conservative as Indeterminate if abnormal markers exist but LAP not elevated.
    return pack(
      "Indeterminate",
      "Abnormal markers present but LAP not confirmed by PV S/D, LARS, LAVI, or IVRT",
      "amber",
      EA,
      eAvg,
      EeAvg,
      trace,
      missing
    );
  }

  // Elevated LAP -> Grade depends on E/A
  if (EA == null) {
    return pack(
      "Increased LAP (grade unknown)",
      "Elevated LAP but E/A missing → cannot assign Grade 2 vs 3",
      "red",
      EA,
      eAvg,
      EeAvg,
      trace,
      missing
    );
  }

  if (EA >= 2) {
    return pack(
      "Grade 3",
      "Elevated LAP with E/A ≥ 2",
      "red",
      EA,
      eAvg,
      EeAvg,
      trace,
      missing
    );
  }

  return pack(
    "Grade 2",
    "Elevated LAP with E/A < 2",
    "red",
    EA,
    eAvg,
    EeAvg,
    trace,
    missing
  );
}

/* ============================
   ATRIAL FIBRILLATION (Algorithm 2)
   ============================ */
function computeAF(x: DDInputs): DDResult {
  const trace: string[] = [];
  const missing: string[] = [];

  const eAvg = avg2(x.eSeptal, x.eLateral);
  const EeAvg = safeDiv(x.E, eAvg);

  // Missing checks specific to AF primary criteria
  if (x.E == null) missing.push("Mitral E (cm/s)");
  if (x.eSeptal == null) missing.push("Septal e′ (cm/s) (for septal E/e′)");
  if (x.trVmax == null && x.pasp == null) missing.push("TR Vmax (m/s) or PASP (mmHg)");
  if (x.dt == null) missing.push("DT (ms)");

  let count = 0;

  // 1) E ≥ 100
  if (x.E != null && x.E >= 100) count++;

  // 2) septal E/e′ > 11
  if (x.E != null && x.eSeptal != null && x.eSeptal !== 0 && x.E / x.eSeptal > 11) count++;

  // 3) TR > 2.8 or PASP > 35
  if ((x.trVmax != null && x.trVmax > 2.8) || (x.pasp != null && x.pasp > 35)) count++;

  // 4) DT ≤ 160
  if (x.dt != null && x.dt <= 160) count++;

  trace.push(`AF criteria positive: ${count}/4`);

  if (count <= 1) {
    return pack(
      "Normal LAP",
      "0–1 AF criteria positive",
      "green",
      null,
      eAvg,
      EeAvg,
      trace,
      missing
    );
  }

  if (count >= 3) {
    return pack(
      "Elevated LAP",
      "≥3 AF criteria positive",
      "red",
      null,
      eAvg,
      EeAvg,
      trace,
      missing
    );
  }

  // Exactly 2 positive → secondary criteria
  let sec = 0;
  let secAvail = 0;

  if (x.lars != null) {
    secAvail++;
    if (x.lars < 18) sec++;
  }
  if (x.pvSD != null) {
    secAvail++;
    if (x.pvSD < 1) sec++;
  }
  if (x.bmi != null) {
    secAvail++;
    if (x.bmi > 30) sec++;
  }

  trace.push(`Secondary criteria positive: ${sec}/${secAvail || 0}`);

  if (secAvail === 0) {
    return pack(
      "Indeterminate",
      "2 AF criteria positive, but no secondary criteria available (LARS, PV S/D, BMI)",
      "amber",
      null,
      eAvg,
      EeAvg,
      trace,
      missing
    );
  }

  if (sec >= 2) {
    return pack(
      "Elevated LAP",
      "2 AF criteria + ≥2 secondary criteria positive",
      "red",
      null,
      eAvg,
      EeAvg,
      trace,
      missing
    );
  }

  if (sec === 0) {
    return pack(
      "Normal LAP",
      "2 AF criteria + no secondary criteria positive",
      "green",
      null,
      eAvg,
      EeAvg,
      trace,
      missing
    );
  }

  return pack(
    "Indeterminate",
    "2 AF criteria + only 1 secondary criterion positive (or unreliable)",
    "amber",
    null,
    eAvg,
    EeAvg,
    trace,
    missing
  );
}

/* ============================
   Utilities
   ============================ */
function safeDiv(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null;
  return Math.round((a / b) * 100) / 100;
}

function avg2(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return Math.round(((a + b) / 2) * 100) / 100;
}

function pack(
  gradeLabel: string,
  summary: string,
  badgeTone: DDResult["badgeTone"],
  EA: number | null,
  eAvg: number | null,
  EeAvg: number | null,
  ruleTrace: string[],
  missing: string[]
): DDResult {
  return {
    gradeLabel,
    summary,
    badgeTone,
    derived: { EA, eAvg, EeAvg },
    ruleTrace,
    missing,
  };
}