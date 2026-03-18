/**
 * Debug panel for the LLM pipeline.
 *
 * Displays the full pipeline trace when debug mode is enabled
 * via `localStorage.setItem("smartTool.debug", "true")`.
 *
 * Shows: assembled prompt, raw model output, per-action validation
 * scores, repair attempt details, and stage timing.
 */

import type { PipelineDebugLog } from "@/hooks/useBrowserNativeLLM";

interface DebugPanelProps {
  log: PipelineDebugLog | null;
}

export function DebugPanel({ log }: DebugPanelProps) {
  if (!log) return null;

  const outcomeColors: Record<string, string> = {
    llm_success: "text-green-700 dark:text-green-400",
    repair_success: "text-yellow-700 dark:text-yellow-400",
    fallback_templates: "text-red-700 dark:text-red-400",
  };

  return (
    <details className="mt-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-xs">
      <summary className="cursor-pointer px-3 py-2 font-mono font-semibold text-gray-600 dark:text-gray-400 select-none">
        LLM Pipeline Debug
        <span className={`ml-2 ${outcomeColors[log.outcome] ?? ""}`}>
          [{log.outcome}]
        </span>
        <span className="ml-2 text-gray-400">
          {log.finalActionCount} actions in {Math.round(log.totalTimeMs)}ms
        </span>
      </summary>

      <div className="space-y-3 p-3 overflow-x-auto">
        {/* Profile */}
        {log.normalizedProfile && (
          <Section title="Normalized Profile">
            <Pre>{JSON.stringify(log.normalizedProfile, null, 2)}</Pre>
          </Section>
        )}

        {/* Retrieval */}
        <Section title="Retrieval">
          <p className="text-gray-600 dark:text-gray-400">
            {log.retrievalSummary} — {log.templatesRetrieved} templates, {log.skillsRetrieved} skills
          </p>
        </Section>

        {/* Prompt */}
        <Section title={`Assembled Prompt (≈${log.promptEstimatedTokens} tokens)`}>
          {log.promptDroppedSections.length > 0 && (
            <p className="text-yellow-600 dark:text-yellow-400 mb-1">
              Dropped: {log.promptDroppedSections.join(", ")}
            </p>
          )}
          <p className="text-gray-500 mb-1">
            Templates: {log.promptTemplatesIncluded} included, {log.promptTemplatesDropped} dropped
          </p>
          <Pre>{log.assembledPrompt}</Pre>
        </Section>

        {/* Raw Output */}
        <Section title={`Raw Model Output (${Math.round(log.inferenceTimeMs)}ms)`}>
          <Pre>{log.rawModelOutput || "(empty)"}</Pre>
        </Section>

        {/* JSON Parse */}
        <Section title="JSON Parse">
          <p className={log.jsonParseSuccess ? "text-green-600" : "text-red-600"}>
            {log.jsonParseSuccess ? `OK — ${log.parsedActionCount} actions parsed` : "FAILED — could not parse JSON"}
          </p>
        </Section>

        {/* Action Validations */}
        {log.actionValidations.length > 0 && (
          <Section title={`Action Validations (${log.actionValidations.length})`}>
            <div className="space-y-2">
              {log.actionValidations.map((v, i) => (
                <div key={i} className="border border-gray-200 dark:border-gray-700 rounded p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge passed={v.passed} repaired={v.repaired} />
                    <span className="font-mono">score={v.score}</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 mb-1 break-words">
                    {v.actionText}
                  </p>
                  {Object.keys(v.criteria).length > 0 && (
                    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
                      {Object.entries(v.criteria).map(([key, val]) => (
                        <div key={key} className={`rounded px-1 py-0.5 ${val.passed ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300" : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"}`}>
                          {key}: {val.score}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Plan Validation */}
        {log.planValidation && (
          <Section title="Plan Validation">
            <p className="font-mono">score={log.planValidation.score}</p>
            {log.planValidation.issues.length > 0 && (
              <ul className="list-disc list-inside text-red-600 dark:text-red-400 mt-1">
                {log.planValidation.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {/* Repair Attempts */}
        {log.repairAttempts.length > 0 && (
          <Section title={`Repair Attempts (${log.repairAttempts.length})`}>
            {log.repairAttempts.map((r, i) => (
              <details key={i} className="border border-gray-200 dark:border-gray-700 rounded p-2 mb-1">
                <summary className="cursor-pointer select-none">
                  Attempt {r.attempt}: temp={r.temperature.toFixed(2)}
                  {" "}json={r.jsonParseSuccess ? "OK" : "FAIL"}
                  {" "}actions={r.parsedActionCount}
                  {" "}{Math.round(r.timeMs)}ms
                  {" "}— {r.validationOutcome}
                </summary>
                <Pre>{r.rawOutput || "(empty)"}</Pre>
              </details>
            ))}
          </Section>
        )}

        {/* Timing */}
        <Section title="Timing">
          <p className="font-mono">
            Inference: {Math.round(log.inferenceTimeMs)}ms
            {log.repairAttempts.length > 0 && (
              <> | Repairs: {Math.round(log.repairAttempts.reduce((s, r) => s + r.timeMs, 0))}ms</>
            )}
            {" "}| Total: {Math.round(log.totalTimeMs)}ms
          </p>
        </Section>
      </div>
    </details>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="border-l-2 border-gray-300 dark:border-gray-600 pl-2">
      <summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-300 select-none">
        {title}
      </summary>
      <div className="mt-1">{children}</div>
    </details>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="whitespace-pre-wrap break-words bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 max-h-64 overflow-y-auto font-mono text-xs">
      {children}
    </pre>
  );
}

function StatusBadge({ passed, repaired }: { passed: boolean; repaired: boolean }) {
  if (passed) {
    return <span className="rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-1.5 py-0.5 font-semibold">PASS</span>;
  }
  if (repaired) {
    return <span className="rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-1.5 py-0.5 font-semibold">REPAIRED</span>;
  }
  return <span className="rounded bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-1.5 py-0.5 font-semibold">FAIL</span>;
}
