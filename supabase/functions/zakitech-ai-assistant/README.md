# Molano AI provider configuration

The `zakitech-ai-assistant` Edge Function is the server-side gateway for Molano AI.

## Required server-side secrets

Configure these in Supabase Edge Function secrets for the ZakiTech Primary project:

- `AI_PROVIDER_BASE_URL`: Base URL of an OpenAI-compatible inference endpoint, without a trailing slash. The function appends `/chat/completions`.
- `AI_PROVIDER_API_KEY`: Secret API key for that inference endpoint.
- `AI_MODEL`: Exact model identifier supported by that endpoint.
- `ZAKITECH_ALLOWED_ORIGINS`: Optional comma-separated list of additional exact browser origins.

The existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required by the function runtime. Never put provider secrets in browser JavaScript, HTML, GitHub, or user-facing logs.

## Security and runtime behavior

- Requires a valid Supabase user JWT and an active `zt_profiles` record.
- Applies the request policy and records metadata-only audit events; raw prompts are not stored in audit rows.
- Uses a 25-second upstream timeout and caps the input at 4,000 characters.
- Does not execute tools or perform deployments, payments, external posting, or account changes. Those workflows need separate server-side authorization and explicit approval.
- If provider secrets are absent, the function returns a clear not-configured response and does not send the prompt to an external provider.

The configured endpoint must implement the OpenAI-compatible `POST /chat/completions` request/response contract.
