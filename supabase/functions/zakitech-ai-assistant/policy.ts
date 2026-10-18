export type AiPolicyDecision = {
  allowed: boolean;
  category: "safe_assistance" | "destructive_action" | "confidential_data" | "security_bypass";
  reason: string;
};

/** Conservative intent filter; it is not a substitute for authorization. */
export function evaluateAiRequest(input: string): AiPolicyDecision {
  const text = String(input || "").normalize("NFKC").toLowerCase();
  const destructive = [
    /\b(delete|erase|destroy|wipe|purge|deactivate|disable|shut down|archive|remove permanently)\b.{0,120}\b(app|application|product|website|repository|database|backup|file|document|account|deployment|record|project)\b/,
    /\b(delete|erase|destroy|wipe|purge|deactivate|disable|archive)\b.{0,100}\b(all|every|company|production|customer|staff)\b/,
    /\b(take down|turn off)\b.{0,100}\b(app|application|product|website|service|system)\b/,
  ];
  if (destructive.some((pattern) => pattern.test(text))) return {
    allowed: false, category: "destructive_action",
    reason: "The AI cannot delete, deactivate, archive, disable, or take down company assets. Use the authorized manual governance process.",
  };
  const confidential = [
    /\b(show|reveal|dump|export|send|read|open|download|list|expose|retrieve)\b.{0,120}\b(confidential|secret|private key|service role|service-role|api key|access token|payroll file|private file|restricted document|board document|legal document)\b/,
    /\b(confidential|secret|private key|service role|service-role|api key|access token|payroll|private customer file|restricted document)\b.{0,100}\b(contents|content|full text|raw data|all records|download|export)\b/,
    /\b(what is|tell me|give me|display|print)\b.{0,80}\b(password|secret key|service role key|api token|recovery code)\b/,
  ];
  if (confidential.some((pattern) => pattern.test(text))) return {
    allowed: false, category: "confidential_data",
    reason: "The AI cannot access or disclose confidential files, credentials, secrets, or restricted records. Use an approved secure workflow.",
  };
  const bypass = [
    /\b(bypass|disable|override|ignore)\b.{0,80}\b(security|permission|role check|approval|audit|payment verification|authentication|access control)\b/,
    /\b(grant yourself|make yourself|escalate yourself)\b.{0,80}\b(admin|owner|full access|permission|privilege)\b/,
  ];
  if (bypass.some((pattern) => pattern.test(text))) return {
    allowed: false, category: "security_bypass",
    reason: "The AI cannot bypass security checks, approvals, or permission boundaries.",
  };
  return { allowed: true, category: "safe_assistance", reason: "No prohibited intent was detected by this first-pass filter. Server-side authorization is still required." };
}