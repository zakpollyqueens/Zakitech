export type AiPolicyDecision = {
  allowed: boolean;
  category: "safe_assistance" | "destructive_action" | "confidential_data" | "security_bypass";
  reason: string;
};

/**
 * Conservative first-pass request filter. This is only a guardrail, not authorization.
 * The server must independently authorize every data read and action. The assistant
 * receives no destructive tools, and confidential data is excluded by design.
 */
export function evaluateAiRequest(input: string): AiPolicyDecision {
  const text = String(input || "").normalize("NFKC").toLowerCase();

  const destructive = [
    /\b(delete|erase|destroy|wipe|remove permanently|purge|deactivate|disable|shut down|archive)\b.{0,100}\b(app|application|product|website|repository|database|backup|file|document|account|deployment|company record|project)\b/,
    /\b(delete|erase|destroy|wipe|remove permanently|purge|deactivate|disable|shut down|archive)\b.{0,80}\b(all|every|company|production|customer|staff)\b/,
    /\b(turn off|take down)\b.{0,80}\b(app|application|product|website|service|system)\b/,
  ];
  if (destructive.some((pattern) => pattern.test(text))) {
    return {
      allowed: false,
      category: "destructive_action",
      reason: "The AI is not permitted to delete, deactivate, archive, disable, or take down company assets. Use the authorized manual governance process.",
    };
  }

  const confidential = [
    /\b(show|reveal|dump|export|send|read|open|download|list|expose|retrieve)\b.{0,100}\b(confidential|secret|private key|service role|service-role|api key|access token|password database|payroll file|private file|restricted document|board document|legal document)\b/,
    /\b(confidential|secret|private key|service role|service-role|api key|access token|payroll|private customer file|restricted document)\b.{0,80}\b(contents|content|full text|raw data|all records|download|export)\b/,
    /\b(what is|tell me|give me|display|print)\b.{0,70}\b(password|secret key|service role key|api token|recovery code)\b/,
  ];
  if (confidential.some((pattern) => pattern.test(text))) {
    return {
      allowed: false,
      category: "confidential_data",
      reason: "The AI cannot access or disclose confidential files, credentials, secrets, or restricted records. Ask an authorized person to use the approved secure workflow.",
    };
  }

  const bypass = [
    /\b(bypass|disable|override|ignore)\b.{0,70}\b(security|permission|role check|approval|audit|payment verification|authentication|access control)\b/,
    /\b(grant yourself|make yourself|escalate yourself)\b.{0,60}\b(admin|owner|full access|permission|privilege)\b/,
  ];
  if (bypass.some((pattern) => pattern.test(text))) {
    return {
      allowed: false,
      category: "security_bypass",
      reason: "The AI cannot bypass security checks, approvals, or permission boundaries.",
    };
  }

  return {
    allowed: true,
    category: "safe_assistance",
    reason: "No prohibited intent was detected by the first-pass filter. Server-side authorization is still required before any data access or action.",
  };
}
