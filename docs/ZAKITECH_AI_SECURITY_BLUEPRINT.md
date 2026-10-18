# ZakiTech AI — Secure Foundation Blueprint

Status: design baseline for implementation. This document does not claim that an AI provider, payment provider, advertising account, or production deployment has already been connected.

## Mission

Build one governed AI assistant for ZakiTech's current and future products. It supports customers and staff, helps operate approved company workflows, drafts marketing assets, assists with website/application development, and coordinates long-running jobs. The AI is an assistant—not a superuser or an unrestricted database operator.

## Non-negotiable safety boundaries

1. **No destructive AI tools.** The model must never be given tools or credentials that delete, deactivate, archive, overwrite, or irreversibly disable company applications, products, accounts, deployments, repositories, databases, backups, or records. Archive/deactivation is treated as destructive and denied too.
2. **Confidential data is not model context by default.** Payroll, credentials, private keys, authentication secrets, confidential legal/board documents, private customer files, source files marked confidential, and other restricted records are not sent to the model. A separate authorization service may return only a narrowly scoped, approved fact or status when the requester is permitted to see it.
3. **Enforce permissions outside the model.** The backend authenticates the caller, resolves the server-managed role and product/workstation grants, validates every proposed action, and independently checks resource scope. Prompt instructions are not a security boundary.
4. **Read-only by default.** Start with product catalog/status, approved documentation, public support material, and the caller's permitted tasks. Add write actions individually using an explicit allowlist.
5. **Human approval for consequential actions.** Require an authorized person to approve publishing releases, production deployments, external messages/campaign publication, spending, price/contract changes, payment reconciliation, and any workflow with financial or customer impact.
6. **Never trust a payment claim or screenshot.** Order progress advances only from verified provider callbacks/lookups or authorized, audited staff reconciliation. The model cannot mark a payment paid.
7. **No autonomous production deploy without gates.** Generated code runs in an isolated, resource-limited build environment; tests and security checks run first. Production publishing requires an approved workflow and verified provider success.
8. **Secrets stay server-side.** Provider keys, Supabase service-role keys, payment credentials, deployment tokens, and advertising tokens belong in managed server secrets. Never place them in HTML/JavaScript, prompts, logs, Git, or this chat.
9. **Auditable actions.** Log actor, action requested, policy decision, resource scope, approval, result, and correlation ID. Redact secrets and sensitive content from logs.
10. **Safe retries.** Use idempotency keys for payment, publishing, messaging, and deployment operations to prevent duplicate side effects.
11. **External content is untrusted.** Documents, webpages, support messages, and generated code cannot change system policy or grant permissions.
12. **Provider fallback is opt-in.** A hosted model fallback may be used only when configured and when the data classification permits that data to leave the self-hosted environment.

## Capability tiers

- **Tier 0 — Explain:** answer from approved public/product documentation.
- **Tier 1 — Scoped read:** retrieve a specific permitted record or status through a backend tool.
- **Tier 2 — Draft:** prepare task updates, support replies, website briefs, code patches, posters/captions, or campaign plans without publishing.
- **Tier 3 — Approved action:** execute a narrowly defined allowlisted action only after backend permission checks and, where required, explicit human approval.
- **Never granted:** delete/deactivate applications or company assets; access or disclose confidential files/secrets; alter authorization; bypass payment checks; spend money or publish externally without required approval; change security controls; grant itself access.

## Proposed request flow

1. User signs in through the existing ZakiTech Supabase Auth session.
2. Backend verifies the token and active server-managed profile; roles must not be inferred from user-editable metadata.
3. Policy service classifies the request, checks the denylist, and resolves least-privilege product/workstation permissions.
4. The model receives only the minimum approved context and a limited set of typed tools.
5. The backend validates tool arguments and rechecks authorization immediately before execution.
6. Consequential actions enter an approval queue; the model cannot approve its own request.
7. Execution result is verified, logged, and returned to the user. Long jobs run asynchronously and publish status updates.
8. Tests, policy checks, and security review gate every release.

## Initial implementation sequence

1. Add the AI governance baseline and policy tests.
2. Implement a server-side assistant endpoint with provider execution disabled until a provider is configured; authenticate active users and fail closed.
3. Add a narrow capability registry and blocked-action detection, plus audit events that do not contain secrets.
4. Connect only approved product metadata and public support documentation.
5. Add provider adapters: self-hosted open-weight model first; optional hosted fallback only with explicit configuration and data rules.
6. Add draft-only advertising and content generation.
7. Add customer project briefs, quotes from approved pricing logic, and payment status reads.
8. Add isolated build/test/preview workflows, then gated production deployment.
9. Add official publishing/analytics integrations one platform at a time.

## Integrations to connect when ready

- **GitHub:** source repository and pull-request workflow. Keep changes on feature branches; protect the main branch; never let the AI delete repositories or branches.
- **Supabase:** existing authentication/database/Edge Functions. Use the existing project only after confirming the correct connected account/project. Never expose service-role credentials.
- **Hosting/deployment:** current GitHub Pages and/or Render setup for the management app; later, an approved deployment provider for customer projects. Hosting tokens stay in server secrets.
- **AI inference:** an Ollama-compatible host or another approved self-hosted inference server first. A hosted model API is an optional, policy-controlled fallback.
- **Payments:** the actual provider used for customer website orders, once identified. Until connected and verified, the AI must not confirm payment or start paid work.
- **Advertising:** official Meta, TikTok, YouTube/Google, LinkedIn or other platform APIs only where supported and authorized. Begin with downloadable drafts; external publication and paid spend require explicit approval.
- **Notifications:** existing email/SMS/WhatsApp provider, if any, only after identification and authorization.

## Operational rule

No service is considered connected merely because it is named in this document. Each integration must have an owner, minimum scopes, server-side secrets, test evidence, usage limits, and a documented disable/incident procedure. AI may recommend restoring or escalating a protected asset, but must not perform deletion or deactivation.
