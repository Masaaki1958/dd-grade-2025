"use client";

import { useMemo, useState } from "react";
import { computeDD2025, type DDInputs } from "../lib/dd2025";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

function num(x: string): number | null {
  const t = x.trim();
  if (t === "") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

function fmt(x: number | null, digits = 2): string {
  if (x == null) return "—";
  const p = Math.pow(10, digits);
  return String(Math.round(x * p) / p);
}

export default function Page() {
  const [form, setForm] = useState({

    isAF: false,

    // Mitral inflow
    E: "",
    A: "",

    // Tissue Doppler
    eSeptal: "",
    eLateral: "",

    // TR / PASP
    trVmax: "",
    pasp: "",

    // Confirmatory
    lavi: "",
    lars: "",
    pvS: "",
    pvD: "",
    ivrt: "",

    // AF-only
    dt: "",
    bmi: "",
  });
  // Pulmonary vein S/D (computed from S and D)
const pvSD = useMemo(() => {
  const s = num(form.pvS);
  const d = num(form.pvD);
  if (s == null || d == null || d === 0) return null;
  return Math.round((s / d) * 100) / 100;
}, [form.pvS, form.pvD]);
  const [showTrace, setShowTrace] = useState(false);
  const [copied, setCopied] = useState(false);

  const inputs: DDInputs = useMemo(
  () => ({
    isAF: form.isAF,

    E: num(form.E),
    A: num(form.A),

    eSeptal: num(form.eSeptal),
    eLateral: num(form.eLateral),

    trVmax: num(form.trVmax),
    pasp: num(form.pasp),

    lavi: num(form.lavi),
    lars: num(form.lars),

    pvS: num(form.pvS),
    pvD: num(form.pvD),

    ivrt: num(form.ivrt),

    dt: num(form.dt),
    bmi: num(form.bmi),
  }),
  [form]
);

  const result = useMemo(() => computeDD2025(inputs), [inputs]);

  const summaryText = useMemo(() => {
    const lines: string[] = [];

    lines.push("LV Diastolic Function (2025)");
    lines.push(`Mode: ${form.isAF ? "Atrial fibrillation" : "Sinus rhythm"}`);
    lines.push("");

    // Inputs (only include those that are present)
    const add = (label: string, value: string | number | null, unit = "") => {
      if (value == null) return;
      lines.push(`${label}: ${value}${unit ? " " + unit : ""}`);
    };

    add("Mitral E", inputs.E, "cm/s");
    if (!form.isAF) add("Mitral A", inputs.A, "cm/s");
    add("Septal e′", inputs.eSeptal, "cm/s");
    if (!form.isAF) add("Lateral e′", inputs.eLateral, "cm/s");
    add("TR Vmax", inputs.trVmax, "m/s");
    add("PASP", inputs.pasp, "mmHg");
    add("LAVI", inputs.lavi, "mL/m²");
    add("LARS", inputs.lars, "%");
    add("Pulm vein S/D", result.derived.pvSD ?? null, "");
    if (!form.isAF) add("IVRT", inputs.ivrt, "ms");
    if (form.isAF) add("DT", inputs.dt, "ms");
    if (form.isAF) add("BMI", inputs.bmi, "kg/m²");

    lines.push("");
    lines.push(`Result: ${result.gradeLabel}`);
    lines.push(`Reason: ${result.summary}`);

    // Derived values
    const derivedParts: string[] = [];
    if (!form.isAF) derivedParts.push(`E/A ${fmt(result.derived.EA, 2)}`);
    derivedParts.push(`Avg e′ ${fmt(result.derived.eAvg, 2)}`);
    derivedParts.push(`E/e′ ${fmt(result.derived.EeAvg, 2)}`);
    lines.push(`Derived: ${derivedParts.join(", ")}`);

    // Missing
    if (result.missing.length > 0) {
      lines.push("");
      lines.push(`Missing/recommended: ${result.missing.join("; ")}`);
    }

    // Optional: trace (only if toggled on)
    if (showTrace && result.ruleTrace.length > 0) {
      lines.push("");
      lines.push("Rule trace:");
      for (const r of result.ruleTrace) lines.push(`- ${r}`);
    }

    return lines.join("\n");
  }, [form.isAF, inputs, result, showTrace]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // Fallback (rare): prompt so user can copy manually
      window.prompt("Copy the summary below:", summaryText);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">LV Diastolic Function (2025)</h1>

          <div className="text-xs text-gray-900">
             Version {APP_VERSION}
          </div>

          <p className="text-sm text-gray-800">
            Educational tool. Not for clinical decision making.
          </p>
        </header>

        {/* Inputs */}
        <section className="rounded-xl bg-white p-5 shadow space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isAF}
                onChange={(e) => setForm((s) => ({ ...s, isAF: e.target.checked }))}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium text-gray-900">Atrial fibrillation</span>
            </label>

            <button
              className="rounded-md border px-3 py-1.5 text-sm text-gray-900
           hover:bg-gray-50
           disabled:opacity-100 disabled:text-gray-700
           disabled:bg-gray-50 disabled:border-gray-300"
              onClick={() => {
                setForm({
                  isAF: false,
                  E: "",
                  A: "",
                  eSeptal: "",
                  eLateral: "",
                  trVmax: "",
                  pasp: "",
                  lavi: "",
                  lars: "",
                  pvS: "",
                  pvD: "",
                  ivrt: "",
                  dt: "",
                  bmi: "",
                });
                setShowTrace(false);
                setCopied(false);
              }}
            >
              Reset
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field
              label="Mitral E (cm/s)"
              hint={form.isAF ? "AF: ≥100 counts positive" : ""}
              v={form.E}
              s="E"
              setForm={setForm}
              placeholder="e.g., 80"
            />

            <Field
              label="Mitral A (cm/s)"
              hint="Needed for E/A (sinus rhythm)"
              v={form.A}
              s="A"
              setForm={setForm}
              placeholder="e.g., 60"
              disabled={form.isAF}
            />

            <Field
              label="Septal e′ (cm/s)"
              hint={form.isAF ? "AF: used for septal E/e′ > 11" : "Abnormal if ≤ 6"}
              v={form.eSeptal}
              s="eSeptal"
              setForm={setForm}
              placeholder="e.g., 7"
            />

            <Field
              label="Lateral e′ (cm/s)"
              hint="Abnormal if ≤ 7 (sinus rhythm)"
              v={form.eLateral}
              s="eLateral"
              setForm={setForm}
              placeholder="e.g., 10"
              disabled={form.isAF}
            />

            <Field
              label="TR Vmax (m/s)"
              hint="Abnormal if ≥ 2.8 (sinus) / >2.8 (AF)"
              v={form.trVmax}
              s="trVmax"
              setForm={setForm}
              placeholder="e.g., 2.6"
            />

            <Field
              label="PASP (mmHg)"
              hint="Abnormal if ≥ 35 (sinus) / >35 (AF)"
              v={form.pasp}
              s="pasp"
              setForm={setForm}
              placeholder="e.g., 40"
            />

            <Field
              label="LAVI (mL/m²)"
              hint="Confirmatory: elevated if > 34"
              v={form.lavi}
              s="lavi"
              setForm={setForm}
              placeholder="e.g., 30"
            />

            <Field
              label="LARS (%)"
              hint={form.isAF ? "Secondary: positive if < 18" : "Confirmatory: positive if ≤ 18"}
              v={form.lars}
              s="lars"
              setForm={setForm}
              placeholder="e.g., 22"
            />

            <Field
              label="IVRT (ms)"
              hint="Confirmatory: positive if ≤ 70 (sinus rhythm)"
              v={form.ivrt}
              s="ivrt"
              setForm={setForm}
              placeholder="e.g., 65"
              disabled={form.isAF}
            />
            
            {/* Pulmonary vein S & D (compute S/D) */}
<div className="grid gap-2">
  <div className="flex items-end justify-between gap-3">
    <div>
      <div className="text-sm font-medium text-gray-900">Pulmonary vein</div>
      <div className="text-xs text-gray-900">
        {form.isAF
          ? "Secondary: positive if S/D < 1"
          : "Confirmatory: positive if S/D ≤ 0.67"}
      </div>
    </div>

    {pvSD == null ? (
      <span className="text-xs text-gray-900">S/D —</span>
    ) : (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-700">
          S/D {fmt(pvSD, 2)}
        </span>

        <span
          className={[
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
            (form.isAF ? pvSD < 1 : pvSD <= 0.67)
              ? "bg-red-100 text-red-700"
              : "bg-emerald-100 text-emerald-800",
          ].join(" ")}
          title={form.isAF ? "Abnormal if S/D < 1" : "Abnormal if S/D ≤ 0.67"}
        >
          {(form.isAF ? pvSD < 1 : pvSD <= 0.67) ? "Abnormal" : "Normal"}
        </span>
      </div>
    )}
  </div>

  <div className="grid grid-cols-2 gap-3">
    <Field
      label="S (cm/s)"
      v={form.pvS}
      s="pvS"
      setForm={setForm}
      placeholder="e.g., 50"
    />
    <Field
      label="D (cm/s)"
      v={form.pvD}
      s="pvD"
      setForm={setForm}
      placeholder="e.g., 60"
    />
  </div>
</div>

            {/* AF-only fields */}
            {form.isAF && (
              <>
                <Field
                  label="DT (ms)"
                  hint="AF primary: positive if ≤ 160"
                  v={form.dt}
                  s="dt"
                  setForm={setForm}
                  placeholder="e.g., 150"
                />
                <Field
                  label="BMI (kg/m²)"
                  hint="AF secondary: positive if > 30"
                  v={form.bmi}
                  s="bmi"
                  setForm={setForm}
                  placeholder="e.g., 28"
                />
              </>
            )}
          </div>

          {form.isAF && (
            <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-sm text-blue-900">
              <div className="font-medium">AF mode</div>
              <div>
                Grading uses the AF LAP algorithm (E, septal E/e′, TR/PASP, DT + secondary criteria).
              </div>
            </div>
          )}
        </section>

        {/* Result */}
        <section className="rounded-xl bg-white p-5 shadow space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="font-semibold text-lg text-gray-900">Result</h2>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  checked={showTrace}
                  onChange={(e) => setShowTrace(e.target.checked)}
                />
                Show rule trace
              </label>

              <button
                onClick={handleCopy}
                className="rounded-md border px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-50
           disabled:opacity-100 disabled:text-gray-700
           disabled:bg-gray-50 disabled:border-gray-300"
                title="Copy a summary to clipboard"
              >
                {copied ? "Copied!" : "Copy summary"}
              </button>

              <Badge tone={result.badgeTone} />
            </div>
          </div>

          <div className="text-2xl font-semibold text-gray-900">{result.gradeLabel}</div>
          <p className="text-sm text-gray-800">{result.summary}</p>

          <div className="text-sm text-gray-800 flex flex-wrap gap-x-4 gap-y-1">
            {!form.isAF && (
              <span>
                <strong>E/A:</strong> {result.derived.EA ?? "—"}
              </span>
            )}
            <span>
              <strong>Avg e′:</strong> {result.derived.eAvg ?? "—"}
            </span>
            <span>
              <strong>E/e′:</strong> {result.derived.EeAvg ?? "—"}
            </span>
          </div>

          {result.missing.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-semibold">Missing / recommended inputs</div>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                {result.missing.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {showTrace && result.ruleTrace.length > 0 && (
            <div className="pt-2">
              <div className="text-sm font-medium text-gray-800">Rule trace</div>
              <ul className="list-disc pl-5 text-sm text-gray-900 mt-1 space-y-0.5">
                {result.ruleTrace.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Hidden preview: useful for debugging (optional) */}
        {/* <pre className="text-xs text-gray-900 whitespace-pre-wrap">{summaryText}</pre> */}
      </div>
      <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-900">
  <div className="space-y-2">
    <div className="font-medium text-gray-700">References</div>

    <ul className="list-disc pl-5 space-y-1">
      <li>
        <a
          href="https://doi.org/10.1016/j.echo.2025.03.011"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-gray-700"
        >
          Nagueh SF, Sanborn DY, Oh JK, et al. Recommendations for the
          Evaluation of Left Ventricular Diastolic Function by Echocardiography
          and for Heart Failure With Preserved Ejection Fraction Diagnosis:
          An Update From the American Society of Echocardiography.
          <em> J Am Soc Echocardiogr.</em> 2025;38:537–569.
          doi:10.1016/j.echo.2025.03.011.
        </a>
      </li>
    </ul>

    <div>Version {APP_VERSION} • Educational use only.</div>
  </div>
</footer>
    </main>
  );
}

function Field({
  label,
  hint,
  v,
  s,
  setForm,
  placeholder,
  disabled,
}: {
  label: string;
  hint?: string;
  v: string;
  s: string;
  setForm: any;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
       <span className={`text-sm font-medium ${disabled ? "text-gray-700" : "text-gray-900"}`}>
        {label}
       </span>

{hint && (
  <span className={`text-xs ${disabled ? "text-gray-900" : "text-gray-900"}`}>
    {hint}
  </span>
)}
      </div>

      <input
        className="w-full border rounded-md px-3 py-2 outline-none focus:ring
           text-gray-900 disabled:text-gray-900
           disabled:opacity-100 disabled:bg-white"
        value={v}
        onChange={(e) => setForm((f: any) => ({ ...f, [s]: e.target.value }))}
        placeholder={placeholder}
        disabled={disabled}
        inputMode="decimal"
      />
    </label>
  );
}

function Badge({ tone }: { tone: "green" | "blue" | "amber" | "red" | "gray" }) {
  const cls =
    tone === "green"
      ? "bg-green-100 text-green-900 border-green-200"
      : tone === "blue"
      ? "bg-blue-100 text-blue-900 border-blue-200"
      : tone === "amber"
      ? "bg-amber-100 text-amber-900 border-amber-200"
      : tone === "red"
      ? "bg-red-100 text-red-900 border-red-200"
      : "bg-gray-100 text-gray-900 border-gray-200";

  const label =
    tone === "green"
      ? "Normal"
      : tone === "blue"
      ? "Grade 1"
      : tone === "amber"
      ? "Indeterminate"
      : tone === "red"
      ? "Elevated"
      : "—";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${cls}`}>
      {label}
    </span>
  );
}