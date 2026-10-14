# Molan Business — Master Build Plan

**Status:** Planning / architecture baseline  
**Product family:** ZakiTech ecosystem  
**Product motto for ZakiTech:** “Equipping minds with IT solutions.”  
**Priority order:** Verify and finish Molan Chat first; then implement Molan Business in staged releases.

## 1. Product vision

Molan Business is a secure, modular, multi-organization business operating platform. A user selects an organization type during setup and receives a workspace, navigation, records, reports, roles, and workflows tailored to that industry. Organizations share reliable core services but must never share records or permissions accidentally.

The platform is intended for Uganda and international markets. It should support mobile and web layouts, multiple currencies, configurable country-specific settings, and gradual expansion to additional industries.

## 2. Reference project: Kenbridge Christian School

Use the existing `zakpollyqueens/Kenbridge-Christian-School-` project as a functional and workflow reference, not as code to copy blindly. Its current repository includes public-school pages and separate staff/admin portal patterns. The reference features identified in the repository include:

- Admin dashboard and staff-account management.
- Student and staff workflows.
- Attendance.
- Academic reports and report-card details.
- Announcements and articles.
- Files/resources and calendar.
- Staff messages and notifications.
- Tasks, leave requests, payroll information, and training.
- Role-aware portals and authenticated API requests.

Molan Business should generalize these proven school workflows into a proper school module with server-enforced authorization, organization-scoped data, an audit trail, and a consistent responsive design.

### School module requirements

**School setup and governance**
- School profile, branding, campuses, academic year, terms, classes, streams, subjects, and grading rules.
- School leadership and configurable departments.
- **Staff Council:** council membership and roles; meeting calendar; agenda items; attendance; minutes; resolutions; voting where appropriate; action items; owners and due dates; supporting documents; follow-up status; searchable historical records. Restrict confidential council records to authorized members.
- Optional school board/governor and parent/community committee workflows as separately configurable features.

**Learners and academics**
- Admissions, student profiles, guardians, class allocation, transfers, enrolment history.
- Daily and class attendance with late/absent reasons and authorized corrections.
- Timetables, subjects, teacher assignments, examinations, marks, grading, report cards, academic performance summaries.
- Learner welfare and safeguarding workflows with strict access controls.
- Library, school resources, boarding/hostel, transport, cafeteria, and co-curricular activities as optional modules.

**Staff and administration**
- Staff profiles, departments, role assignments, attendance, leave, payroll records, training, tasks, messages, notifications, files, and performance review.
- Teacher/parent/guardian portals with permissions limited to their relationships and duties.
- School calendar, notices, communication logs, document templates, and printable/exportable reports.

**Fees and reporting**
- Fee structures, invoices, receipts, payment allocation, balances, bursaries/discounts, expenditure, and reconciliation.
- Dashboards for enrolment, attendance, academic outcomes, fees, staffing, and operations.
- Configurable exports and audit history. Payment submission must not be treated as confirmed settlement without reliable verification.

## 3. Initial industry selector: 30 profiles

The selection screen should present searchable, scrollable cards with professional icons, clear labels, subtle motion, and reduced-motion accessibility. Icons should be lightweight SVG/CSS or another optimized asset format; do not add animation libraries or large media files just to make the selector look animated.

1. School / Education
2. College / University / Vocational Training
3. Technology / Software / IT Services
4. Retail Shop
5. Supermarket / Grocery
6. Bedding / Home Furnishings / Furniture
7. Wholesale / Distribution
8. Pharmacy
9. Hospital / Clinic / Healthcare Administration
10. Restaurant / Cafe / Catering
11. Hotel / Lodge / Guest House
12. Agriculture / Crop Farming
13. Livestock / Dairy / Poultry
14. Construction / Civil Engineering
15. Manufacturing / Factory
16. Transport / Fleet / Logistics
17. Real Estate / Property Management
18. Accounting / Tax / Bookkeeping
19. Professional Services / Consulting
20. Beauty Salon / Barber / Spa
21. Fashion / Tailoring / Clothing
22. Automotive / Garage / Spare Parts
23. Telecommunications / ISP
24. Media / Marketing / Advertising
25. Financial Services / SACCO / Microfinance
26. Nonprofit / NGO / Charity
27. Church / Religious Organization
28. Legal Services / Law Firm
29. Cleaning / Security / Facilities Services
30. Freelance / Personal Business

Include “Other / custom organization” so a user is not blocked if their industry is not listed. The taxonomy can be expanded and localized later. Regulated sectors such as healthcare and financial services require appropriate legal, privacy, and professional review before specialized workflows are marketed as compliant.

### How profiles should behave

- A profile is a configuration of reusable core modules plus industry-specific modules, not a separate hard-coded application.
- Ask only relevant setup questions for the chosen industry.
- Allow an authorized organization administrator to enable compatible optional modules later.
- Provide templates for small, growing, multi-branch, and larger organizations where appropriate.
- Allow a user to belong to multiple organizations under one account, with separate memberships and permissions per organization.
- Support branches/campuses and configurable custom fields without weakening data integrity.
- Add new profiles/modules through a versioned registry and migrations rather than rebuilding unrelated profiles.

## 4. Shared platform modules

- Authentication, account recovery, persistent sessions, session revocation, and optional multi-factor authentication.
- Organization setup, membership invitations, multi-organization switcher, roles, and permissions.
- Staff/people records and configurable departments.
- Finance foundation: invoices, receipts, income, expenses, balances, configurable tax settings, and financial periods.
- File/document storage with size/type checks and scoped access.
- Notifications, announcements, calendar, tasks, approvals, and activity/audit logs.
- Dashboards, reports, data import/export, and backups/restore procedures.
- Localization: language, time zone, date/number formats, currency, and country settings.
- Optional integrations with payment providers and other authorized ZakiTech products.

## 5. Subscription and renewal system

**Commercial starting point:** USD $10 per organization per month as the baseline price for the initial paid plan, with country-specific localized pricing. Final local price tables, payment providers, tax treatment, and plan limits must be configurable before launch.

### Required customer billing screen

Every organization administrator should see:
- Current plan and subscription status.
- Current billing period and next renewal date.
- Remaining time, shown as days/hours when useful.
- Localized amount and currency due.
- Payment history, invoices/receipts, failed-payment notices, and renewal actions.
- Upgrade/downgrade options when offered.
- Clear notices before expiry and after a payment failure.
- A link to support and a billing complaint form.

### Country and currency handling

- Use verified billing country and supported payment-provider data as the primary basis for localized billing; IP-based location can be a hint, not the sole authority.
- Display the detected country and currency and allow correction when billing details are wrong.
- Maintain an administrator-controlled price table per country/market. Do not simply recalculate the subscription price from a live exchange rate on every screen refresh.
- Keep a configured base price in USD and define approved local prices or a controlled conversion policy with rounding, effective dates, and a record of the rate/source used.
- Confirm that the selected provider supports local presentment, payment method, recurring charges, refunds, and settlement in the intended markets before enabling it.
- Store amounts in integer minor units where applicable, along with ISO currency codes, provider references, invoice IDs, and timestamps.
- Never store card credentials directly. Use the payment provider's hosted/secure payment flow and verified webhooks for subscription status.
- Make renewals idempotent and audit payment state changes.

### Subscription state and access policy

Define explicit states: trial (if offered), active, payment_due, past_due, grace_period, suspended, cancelled, and expired. The grace period and read-only behavior must be configurable. Do not delete customer data just because a subscription expires. Provide clear export and reactivation policies and ensure lawful retention.

## 6. Security baseline

Security is a launch requirement, not a later add-on.

- Enforce organization-scoped authorization on the server/database, not only by hiding interface controls.
- Use least-privilege role permissions and separate sensitive roles such as finance, HR, school safeguarding, council secretary, and system administration.
- Apply row-level security or equivalent backend policies and test cross-tenant access explicitly.
- Keep secrets and privileged service keys server-side only.
- Validate inputs and uploads; protect against common web/API attacks; rate-limit sensitive endpoints.
- Use secure session handling, account recovery controls, audit events, backups, and incident/recovery procedures.
- Minimize sensitive data, define retention/export/deletion workflows, and review privacy requirements for each jurisdiction and industry.
- Require explicit, auditable authorization for integrations with repositories, payment providers, messaging services, or ZakiTech.

## 7. Complaints and ZakiTech control center

Molan Business should provide an in-app support/complaints route for organization owners and authorized users:
- Complaint categories, subject, description, priority, optional attachment, timestamps, and status.
- Ticket number, acknowledgement, response thread, assigned support owner, and resolution history.
- A user-visible status timeline and optional satisfaction feedback.
- Protect attachments and sensitive complaints using access controls and audit logs.

ZakiTech should eventually have a restricted product control center / Product Hub where authorized company leaders can see product lifecycle records, releases, assignments, announcements, and support escalations. A role title alone must not grant broad product or repository access.

The Product Hub should represent:
- **Molan Chat:** current product; display “Deployed” only after deployment and release evidence is checked. Otherwise show “Deployment verification pending”.
- **Molan Business:** new product; initially “Planned / Architecture”, then “In development”, “Testing”, “Ready for release”, and “Launched” as verified milestones occur.

Each product record should include owner, status, target milestones, linked repository, release/version information, open blockers, authorized team, and audit history. Product Hub and the in-app control center should use authenticated backend APIs and least-privilege permissions. Do not expose private customer data in product-level summaries.

## 8. AI assistant — later phase

AI is intentionally not part of the first marketing/build phase. Keep the architecture ready for a later AI module that can help with permitted tasks such as explaining reports, drafting announcements, summarizing authorized records, and answering help questions.

Before activation, define data boundaries, consent/retention, model-provider terms, access controls, cost limits, logging, human review, and protections against exposing one organization's data to another. AI must not make high-impact decisions about learners, patients, employees, credit, or other sensitive matters without appropriate human oversight.

## 9. Technical approach

- Keep the web application and Android experience responsive and maintainable.
- Use shared UI/core services with modular industry features and versioned database migrations.
- If using Supabase/PostgreSQL, apply row-level security, foreign-key constraints, indexes, server-side Edge Functions for privileged workflows, and automated migration checks.
- Keep business logic out of giant single files; split modules by domain and test shared services before adding more industries.
- Provide accessible motion settings and optimize assets, network use, and performance for lower-powered Android devices and unreliable connectivity.
- Offline workflows, if added, must have conflict resolution and must not claim that an unverified offline payment is settled.

## 10. Release phases and acceptance gates

### Phase 0 — Finish Molan Chat first
Verify merged repository state, build/test workflows, Android installation and device behavior, authentication/session persistence, update/release flow, and the authorized ZakiTech bridge. Do not mark deployed until evidence confirms it.

### Phase 1 — Molan Business foundation
Authentication, organization creation, memberships, organization switcher, roles/permissions, audit logs, secure tenant isolation, responsive shell, and support/complaint foundation.

### Phase 2 — Industry engine and selector
Thirty profile cards, search/filter, lightweight animated icons, adaptive setup forms, module registry, default roles, dashboard/navigation configuration, and “Other/custom” flow.

### Phase 3 — Three contrasting pilot modules
1. Education, explicitly including Staff Council, attendance, academic reporting, report cards, staff operations, fees, and communications.
2. Retail/inventory, including products, suppliers, purchasing, sales, returns, stock alerts, and reports.
3. Technology company, including project registry, roles, assignments, product lifecycle, releases, technical documents, and authorized repository links.

### Phase 4 — Finance, subscription, and localized billing
Billing screen, local pricing table, payment provider integration, webhook verification, invoice history, renewal countdown, grace policy, and billing reports.

### Phase 5 — Expand the remaining industry modules
Build incrementally, reusing shared capabilities and validating each industry with real workflows and appropriate specialist review.

### Phase 6 — ZakiTech Product Hub and integrations
Authenticated product records, lifecycle statuses, assignments, release links, complaints/support escalations, and narrowly scoped integration APIs.

### Phase 7 — AI and advanced capabilities
Only after the core product is stable and the AI data/privacy model has been reviewed.

### Acceptance tests for every release
- A user cannot read or modify another organization's data.
- A school profile has the Staff Council and school workflows; a retail profile does not get forced into school workflows.
- The same account can switch organizations without mixing data.
- Role restrictions are enforced on direct backend requests.
- Subscription price, currency, status, and renewal time agree with verified provider records.
- Payment webhook replay cannot charge or extend a subscription twice.
- Expiry never silently deletes customer data.
- Dashboard, reports, and icon motion work on small Android screens and respect reduced-motion settings.
- New industry configuration does not break existing organizations.

## 11. APK / asset size policy

The requested rough target of around 80–100 MB is a planning expectation, not a reason to add unnecessary code or media. We should prioritize capability, security, reliability, and performance. Measure the actual release APK/AAB after each phase, compress assets, split optional modules where practical, and avoid shipping every industry-specific asset or dependency to every user if modular delivery is feasible.

## 12. Research references

Use these as feature-pattern references, not as products to copy:
- Kenbridge Christian School repository: https://github.com/zakpollyqueens/Kenbridge-Christian-School-
- Uganda school workflows: https://www.myschool.ug/features
- School administration patterns: https://schoolportal.ug/
- Industry-module examples in Uganda: https://www.citycom.ug/industries and https://www.smartclickug.tech/solutions
- Localized subscription pricing concepts: https://developer.paddle.com/build/products/offer-localized-pricing/
- Payment currency and settlement considerations: https://docs.stripe.com/currencies

Before production, verify current provider country coverage, pricing, tax, legal, and regulatory requirements; documentation can change.

## Current next action

Finish and verify Molan Chat first. In parallel, this document establishes the Molan Business requirements baseline. The next implementation change in ZakiTech should add controlled Product Hub records for Molan Chat (with status evidence) and Molan Business (initially Planned / Architecture), without pretending the Product Hub UI or the business application is already implemented.
