# Molan Business App — Web Research and Firebase Architecture Addendum

**Date:** 2026-10-14  
**Status:** Planning baseline; implementation has not started  
**Product:** Molan Business App  
**ZakiTech motto:** “Equipping minds with IT solutions.”

## 1. Research scope and sources

This addendum summarizes public product documentation and Uganda-facing examples to inform an original product design. These sources show selected features, not complete internal workflows or independently verified security guarantees.

- Odoo dashboards: preconfigured and custom dashboards, permission-aware access, filters and data-driven views. https://www.odoo.com/documentation/19.0/applications/productivity/dashboards.html
- Odoo dashboard design: start from the business question, identify relevant data, then choose the visualization. https://www.odoo.com/documentation/19.0/applications/productivity/dashboards/build_and_customize_dashboards.html
- Zoho Analytics examples: role/department KPI patterns such as HR engagement, e-commerce sales, customer behavior and product performance. https://www.zoho.com/analytics/dashboard-examples/
- School Manager Uganda: local school-management feature groupings including admissions, student records, fees, report cards/grading, staff operations, timetables, resources and audit-oriented administration. https://www.schoolmanageruganda.com/features
- Firebase project model: Firebase projects are backed by Google Cloud projects; apps registered to the same project share its backend resources, IAM, identifiers and billing. https://firebase.google.com/docs/projects/learn-more
- Google Cloud organization/project management: creating a project under an organization requires a real Google Cloud Organization resource and appropriate IAM permissions. https://docs.cloud.google.com/resource-manager/docs/organization-resource-management
- Google Cloud billing: new Firebase Console projects start on Spark by default; enabling Cloud Billing places the project on pay-as-you-go Blaze, with costs depending on usage. https://docs.cloud.google.com/billing/docs/how-to/modify-project

## 2. Design lessons

- **Role-relevant dashboards:** prioritize tasks, exceptions, pending approvals and meaningful KPIs instead of exposing every module to every user.
- **Industry configuration:** reuse core capabilities while industry-specific setup, menus, workflows and reports come from a versioned module registry.
- **Actionable reporting:** every dashboard card should answer a business question and link to a permitted workflow or record.
- **Capture, review and approval:** financial, academic, HR, stock and customer-facing changes need configurable approvals and audit trails.
- **Ugandan operating realities:** Android-first responsive layouts, low-bandwidth behavior, local currency/time-zone settings, printable reports and explicit payment reconciliation.
- **Visual quality with accessibility:** polished cards, restrained gradients/glass effects, legible contrast and subtle animation; respect reduced-motion settings and avoid slowing low-powered devices.
- **Security at the data boundary:** hiding buttons is not authorization. Reads, writes, exports, file access and sensitive operations must be checked by backend rules or trusted server code.

## 3. Firebase architecture

The user has requested Firebase for Molan Business App. This replaces the earlier exploratory suggestion to create a Supabase project for this product unless the user later changes the decision.

### Services to evaluate and use where appropriate

- Firebase Authentication for identity, verification, recovery and privileged-user MFA where supported.
- Cloud Firestore for organization, branch, membership, roles, module configuration and operational records.
- Cloud Storage for Firebase for images and documents with organization- and record-scoped Storage Rules.
- Cloud Functions for Firebase (2nd gen) or Cloud Run for trusted workflows: invitation acceptance, role changes, audit events, payment/webhook verification, privileged exports and other server-authoritative operations.
- Firebase App Check as an additional abuse-control layer, never as a substitute for authentication or authorization.
- Firebase Hosting for the web app if compatible with the selected framework.
- Firebase Cloud Messaging for push notifications after preferences and device-token protections are implemented.
- Google Maps Platform for consent-based delivery location features only after key restrictions, quotas, billing alerts and privacy controls are configured.

### Project/organization guardrails

A Firebase project is a Google Cloud project. “Zaki Chat” must be verified as an actual Google Cloud Organization resource in the Google account used for Firebase; it is not enough that “Zaki Chat” is a display name or a Supabase organization. Verify that the organization appears in the project-creation organization picker and that the account has the required permissions. Never invent an organization ID or claim the project is under it if it is not.

Create a dedicated project named **Molan Business App** with a unique, stable project ID, separate from Molan Chat/ZakiChat. Keep auth configuration, databases, storage, secrets, quotas and billing isolated. Use separate development/staging and production environments when feasible. Start on the no-cost Spark plan where the required services allow it; do not enable Blaze billing or paid APIs without explicit cost awareness and owner approval.

### Logical data model to validate before implementation

- User profile: minimum account-level details; no trusted roles in user-editable fields.
- Organizations: industry, status, branding, configuration, trial/subscription metadata.
- Organization memberships: authoritative active status, role grants, branch scope and invitation provenance.
- Branches/campuses and enabled module configuration.
- Industry records such as learners, staff, products, stock movements, orders, invoices, tasks and reports, always associated with organization and relevant branch/class/department.
- Invitations: server-generated, expiring, revocable, single-use; avoid storing reusable secrets in plain text.
- Audit events: server-created and protected against ordinary-user rewriting.
- Website requests: brief, package, quote, payment state, assignment, approvals, milestones, messages and publication evidence, with restricted internal notes.
- Subscription/payment references: verified provider status and idempotency references; never store raw card details.
- Storage paths: separate public, owner-approved brand assets from private organization documents.

This is a logical outline, not a final schema. Validate queries, indexes, pagination, document size, transactions, retention, export and reporting needs. Avoid unbounded arrays and oversized documents; keep high-volume histories in separate documents.

## 4. Tenant and role security

- Every protected record must be tied to an organization and, where relevant, a branch/class/department/project.
- Membership and permissions are authoritative protected records; users cannot grant themselves access.
- Firestore and Storage Rules deny by default and verify UID, active membership, organization match, branch/record scope and permitted operation.
- Trusted functions independently validate identity and authorization; never trust client-supplied role, organization, price, payment status or approval state.
- Cross-tenant tests must attempt reads, writes, queries, exports, storage paths and function calls using another tenant's IDs.
- Privileged actions such as role changes, invitations, finance approvals, exports, billing changes and website payment reconciliation create protected audit events.
- No service-account keys or private credentials in GitHub, web bundles or Android packages. Use managed secrets and least-privilege service accounts.
- Use Firebase Emulator Suite tests for Firestore/Storage Rules and staging tests with real authentication. App Check is an extra layer, not a replacement for Rules.
- Define and test backups, restore, incident response, retention, export and deletion before onboarding real customers.

## 5. Owner onboarding and branding

1. Open Molan Business App in browser or Android app and create/sign into an identity.
2. Create an organization and select one of the 30 profiles or Other/Custom.
3. Complete an industry-specific wizard with saved drafts, validation and clear progress.
4. Set country, currency, time zone, branches and relevant operating settings.
5. Upload logo, cover, gallery and business details; preview the branded workspace.
6. Choose whether there is an existing website (validate and save URL) or request a ZakiTech website.
7. Review the summary and public/private visibility choices.
8. Submit; trusted backend validates and creates the organization idempotently, initializes approved defaults, writes an audit event and confirms success.
9. Show the workspace with a server-calculated 30-day trial countdown and clear renewal terms.

Public display of location, staff photos, vehicles, contacts and other assets must be explicit. Validate upload signatures/type/size/dimensions, re-encode images where appropriate, and keep private documents non-public.

Staff invitation and browser-to-app activation are specified in MOLAN_BUSINESS_ACCESS_AND_ONBOARDING.md: scoped, expiring, revocable, single-use invitations and a short-lived one-time handoff code, never a reusable session token in a URL.

Website request and payment/installment rules are specified in MOLAN_BUSINESS_WEBSITE_SERVICE.md. Proposed Uganda prices remain Unique Website UGX 200,000, Premium UGX 300,000 and Gold UGX 450,000. Package scope, domain/hosting, maintenance, revisions, timeline, tax/refund terms, payment provider and international prices require approval. Website creation is separate from the baseline USD $10/month Molan Business subscription. Installments require a written, auditable agreement. Do not claim payment or publication until verified.

## 6. Industry profile framework

Implement shared core services and profile-specific bundles; do not attempt all 30 industries in the first release.

| Profile | Initial module bundle to scope |
|---|---|
| School / Education | Admissions, learners/guardians, levels/classes, attendance, academics, report cards, fees, staff, Staff Council, optional separate board/governors, calendar, communications |
| College / University / Vocational | Applicants, enrollment, departments, courses, terms, attendance, assessments, fees, staff and facilities |
| Technology / Software / IT Services | Clients, projects, tasks, support, assets, product/release hub, staff assignments and restricted repository links |
| Retail Shop | Products/SKU, stock, purchases, sales, returns, suppliers, cash-up and reports |
| Supermarket / Grocery | Retail plus expiry/batch tracking, replenishment, checkout and stock loss |
| Bedding / Home Furnishings / Furniture | Catalog/variants, stock, suppliers, quotations, orders, delivery and warranty |
| Wholesale / Distribution | Bulk price lists, customer accounts, orders, warehouses, dispatch, credit and receivables |
| Pharmacy | Inventory, batches, expiry and controlled workflows; licensed-professional and legal review required |
| Hospital / Clinic / Healthcare | Appointments, patient administration, staff and billing; strict records access and clinical/legal review |
| Restaurant / Cafe / Catering | Menu, tables/orders, kitchen queue, suppliers, stock, catering and delivery |
| Hotel / Lodge / Guest House | Rooms, availability, reservations, check-in/out, housekeeping, payments and maintenance |
| Agriculture / Crop Farming | Farms/plots, seasons, crops, inputs, work logs, harvest, sales and costs |
| Livestock / Dairy / Poultry | Herd/flock, health, vaccinations, feed, production, breeding, mortality and sales |
| Construction / Civil Engineering | Projects/sites, budgets, materials, equipment, subcontractors, safety and progress |
| Manufacturing / Factory | BOM, production orders, raw materials, quality checks, equipment, stock, waste and output |
| Transport / Fleet / Logistics | Vehicles, drivers, trips, dispatch, maintenance, fuel, delivery proof and expenses |
| Real Estate / Property | Properties, units, tenants, leases, rent, maintenance, inspections and arrears |
| Accounting / Tax / Bookkeeping | Clients, engagements, document requests, deadlines, reconciliation and strict client isolation |
| Professional Services / Consulting | Clients, engagements, proposals, deliverables, time, billing and tasks |
| Beauty Salon / Barber / Spa | Services, bookings, shifts, customer preferences/consent, stock and sales |
| Fashion / Tailoring / Clothing | Designs, restricted measurements, orders, fittings, materials, production and delivery |
| Automotive / Garage / Spare Parts | Vehicles, job cards, diagnostics, parts, estimates, service history and invoices |
| Telecommunications / ISP | Subscribers, service plans, installations, tickets, network assets, billing and outages |
| Media / Marketing / Advertising | Clients, campaigns, briefs, content calendar, approvals, assets, performance and billing |
| Financial Services / SACCO / Microfinance | Members, loan/savings workflows, repayments, arrears and audit; legal/security review required |
| NGO / Charity | Programs, beneficiaries with privacy controls, grants, donors, budgets, activities and reports |
| Church / Religious Organization | Members, events, ministry teams, giving, pastoral confidentiality and facilities |
| Legal Services / Law Firm | Matters, clients, deadlines, documents and billing with strict confidentiality boundaries |
| Cleaning / Security / Facilities | Sites, shifts, staff assignments, inspections, incidents, equipment and service reports |
| Freelance / Personal Business | Leads, clients, quotes, tasks, calendar, invoices, expenses and portfolio |
| Other / Custom | Approved core modules and configurable fields/workflows without bypassing security |

For every profile, specify roles, dashboard, core entities, workflows, reports, sensitivity, retention and acceptance tests before coding.

## 7. Staged build plan

### Phase 0 — Repository and project foundation
- Create a dedicated Molan Business App repository with README, contribution guidance, security policy, issue templates and branch protection where available.
- Verify the actual Google Cloud Organization called “Zaki Chat”; create a separate Firebase project only if the organization is available and the account is authorized.
- Establish development/staging/production configuration, placeholder-only environment examples, CI, linting, tests and emulator instructions.
- Never commit service-account credentials or secrets.

### Phase 1 — Threat model and secure core
- Data classification, role/permission matrix, Firebase Auth, organization membership model, Firestore/Storage Rules, audit events, App Check, account recovery, revocation and backup/restore plan.
- Build authorization tests before business features.

### Phase 2 — Core shell and organization setup
- Responsive branded shell, accessible themes, profile selector, guided setup, organization switcher, branches, draft recovery and safe media upload.
- Trial/subscription state and countdown; no real charges until billing is approved.

### Phase 3 — Staff workstations and collaboration
- Invitations, activation, roles, tasks, announcements, calendar, internal messages, submit/review workflows, scoped documents and notifications.

### Phase 4 — Three pilot modules
1. **Education:** Nursery/Primary/Secondary configuration, learners, attendance, academic records/report cards, fees, staff operations, Staff Council, separate configurable board/governors and class/branch scope.
2. **Retail and orders:** catalog, stock movements, purchasing, sales, returns, branch inventory, customer orders, dispatch and delivery.
3. **Technology company:** clients/projects, staff assignments, product lifecycle/releases, technical documentation and least-privilege repository links.

### Phase 5 — Website-service workflow
- Brief, package/quote approval, authorized intake/developer/CEO queue, installment agreement, verified payment reconciliation, progress notifications and launch/handover checklist.

### Phase 6 — Remaining profiles
- Expand incrementally by customer demand and risk. Regulated profiles require legal/privacy and sector-specific review.

### Phase 7 — Billing, analytics and release
- Approved localized prices, provider webhooks, invoices, renewals, reminders, exports, support, usage/cost monitoring, security review, accessibility/low-bandwidth tests, Android/browser tests, restore drill and staged rollout.

## 8. Launch acceptance gates

- Automated Rules tests prove cross-organization and unauthorized-branch access is denied.
- Clients cannot self-assign privileged roles, forge payment success, modify trusted trial timestamps or approve restricted submissions.
- Expired/revoked/replayed invitation and handoff codes fail safely.
- Uploads cannot overwrite another tenant's files or expose private documents.
- Audit events cover privileged access and sensitive changes.
- Restore is demonstrated in non-production.
- Accessibility, small-screen, low-bandwidth, retry/error and reduced-motion behavior is tested.
- Subscription and website-service terms/prices are approved; payments are verified server-side.
- Production secrets are absent from source, builds, browser bundles and logs.
- Do not claim launch or full implementation until evidence confirms the gates.

## 9. Execution constraints

The intended order is: finish and review the planning documents; create the dedicated GitHub repository; verify the Google Cloud Organization and create the Firebase project; then implement the secure foundation in small tested changes.

The connected GitHub tool available to this workflow can read/write repository files and branches but does not expose repository creation. The connected tools also do not expose Firebase/Google Cloud project creation. Therefore, those resources must not be reported as created until authenticated creation tools are available. If the target Google Cloud organization is not visible, do not claim the Firebase project is under it.
