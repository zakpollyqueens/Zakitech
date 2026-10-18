# ZakiTech AI — Secure Foundation Blueprint

This is the governance baseline for one AI assistant supporting current and future ZakiTech products, staff, customers, development, operations, and advertising. It is a design and implementation baseline, not a claim that model, payment, advertising, or production hosting integrations are already live.

## Non-negotiable security rules

1. The AI receives no tools or credentials to delete, deactivate, archive, overwrite, or irreversibly disable company applications, websites, repositories, databases, backups, accounts, or records.
2. Confidential documents, private customer files, payroll, secrets, keys, credentials, and restricted source files are excluded from model context by default.
3. Authorization is enforced server-side. The model cannot grant itself access or override role/resource permissions.
4. Begin read-only and draft-only. Add individually allowlisted actions only after tests and review.
5. Human approval is required for consequential actions such as production publishing, external campaign publication, spending, price/contract changes, payment reconciliation, and customer-impacting actions.
6. Payment is considered confirmed only through verified provider callbacks/lookups or authorized, audited staff reconciliation. A user claim or screenshot is insufficient.
7. AI-generated code runs in isolated, resource-limited workspaces; tests and security checks must pass before deployment.
8. All provider credentials stay in server-side managed secrets, never in frontend code, prompts, logs, Git, or chat.
9. Audit logs capture actor, action category, decision, resource scope, approval, result, and correlation ID while redacting secrets and sensitive content.
10. Use idempotency controls for payments, notifications, deployments, and publishing to prevent duplicate side effects.
11. External webpages, files, and user messages are untrusted data and cannot change system policy.
12. Hosted-model fallback is disabled unless explicitly configured and permitted by the data classification policy.

## Capability levels

- Explain from approved documentation.
- Read specific records only when the signed-in user has permission.
- Draft support responses, tasks, code changes, website briefs, posters, captions, and campaign plans.
- Execute narrowly scoped, allowlisted actions after independent server-side checks and approval where required.
- Never delete/deactivate assets, disclose restricted files/secrets, bypass payments/security, change its own permissions, or spend/publish without required authorization.

## Request lifecycle

Authenticate the caller; resolve server-managed role and resource grants; classify the request; apply the deny policy; provide the model minimum necessary approved context; validate every tool argument; recheck permissions immediately before execution; require human approval for consequential actions; verify the result; write a redacted audit event; and return status. Long-running jobs use asynchronous status tracking.

## Implementation sequence

1. Security baseline, policy checks, tests, and minimal audit.
2. Authenticated assistant endpoint that fails closed until a vetted model provider is configured.
3. Approved product catalog and public support knowledge.
4. Self-hosted open-weight model adapter; optional hosted fallback under explicit data rules.
5. Draft-only advertising studio.
6. Customer project briefs and quotations computed by trusted pricing logic.
7. JumlaPay payment-status integration using the existing verified Mola Business/Supabase integration where appropriate; inspect its implementation and reuse server-side verification, never copy secrets.
8. Isolated build/test/preview pipeline.
9. Human-approved production deployment and real URL verification.
10. Official advertising APIs one platform at a time, with publication and spend approvals.

## Integration principles

- GitHub: work directly on `main` as requested, using small commits and tests; do not create pull requests for this workflow. Protect destructive operations and never allow AI to delete repositories or branches.
- Supabase: reuse the correct existing project only after confirming the connected account/project. Never expose service-role credentials.
- JumlaPay: user reports that checkout, webhooks, and secrets already exist in the Mola Business upgrade system's Supabase project. Inspect and reuse the trusted server-side integration after confirming exact function and schema; do not assume payment is verified until evidence is checked.
- AI inference: self-hosted model first; hosted API fallback only when explicitly enabled and allowed by policy.
- Hosting: use current company hosting where suitable; customer builds must be isolated from the management app.
- Advertising: begin with drafts; official API publication and paid campaigns require platform authorization and explicit approval.

No service is connected just because it is named here. Each integration requires least-privilege scopes, server-side secrets, test evidence, usage limits, and a documented incident/disable process.
