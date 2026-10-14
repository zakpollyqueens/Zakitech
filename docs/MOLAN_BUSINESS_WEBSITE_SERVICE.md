# Molan Business App — Business Profile Creation and Website Service

**Product name:** Molan Business App  
**Status:** Requirements baseline; implementation and payment verification still required.

## 1. Business profile creation experience

The owner should be able to start from the web app or mobile app and complete a guided, searchable setup flow. Ask for information appropriate to the selected industry rather than forcing every business to fill irrelevant fields.

Core fields may include:
- Organization/business name, industry/profile type, short description, motto/tagline, contact details, country, currency, time zone, and operating hours.
- Address and optional map pin/location, with clear privacy and public-display controls.
- Logo/profile image, cover image, gallery photographs, and relevant business assets such as premises, products, team, equipment, or vehicles.
- Branches/campuses and public-facing details, where applicable.
- Industry-specific fields, such as school levels/classes or restaurant menu/order details.
- Existing website URL, if the business already has a website.
- Whether the owner wants to request a new website from ZakiTech.

The interface should show step progress, save drafts safely, validate fields and uploads, and clearly distinguish required from optional fields. On final submission, show a progress state such as **Creating your business profile…** while online. Do not claim success until the server confirms creation. If connectivity is lost, preserve the draft and allow safe retry without creating duplicate profiles.

After creation, the business title, logo/profile image, cover, gallery, motto, location, and public-facing details should be displayed using the content the owner supplied. The workspace should feel branded for that business while preserving Molan Business App navigation and consistent accessibility. Public display of location, contact details, staff photos, vehicles, or other images must be controlled by explicit visibility choices; sensitive internal content remains private.

## 2. Existing website versus requested website

During setup, ask:
- **I already have a website** — enter the URL; validate and store it safely, display it only as intended, and allow authorized updates.
- **I need a website for my business** — show the ZakiTech website-creation service, packages, requirements, and request form.

Website creation is an optional paid service separate from the baseline Molan Business App subscription. Do not imply that website creation is included in the normal $10/month business plan.

## 3. Website packages and initial price proposal

The user-proposed package prices are:

| Package | Proposed price in Uganda | Displayed USD reference |
|---|---:|---|
| Unique Website | UGX 200,000 | USD equivalent from configured pricing table |
| Premium | UGX 300,000 | USD equivalent from configured pricing table |
| Gold | UGX 450,000 | USD equivalent from configured pricing table |

These are proposed initial prices and must remain configurable by authorized ZakiTech staff. The earlier spoken USD amount was inconsistent with the UGX tiers, so do not silently assume that USD 100, 200, 300, or 450 are all equivalent package prices. For launch, treat the UGX amounts above as the explicitly stated Uganda package prices, and let ZakiTech configure and approve the corresponding USD/international price list before displaying it.

Currency must be based on the configured market/pricing table and confirmed billing country, not just an unreliable live exchange rate or IP address. Display the package currency and total price clearly before payment. If currency conversion is shown, state that it is an indicative/configured reference and charge the approved amount in the selected currency.

Package inclusions, hosting/domain registration, renewal costs, maintenance, delivery timeline, revisions, content ownership, and support must be described before checkout. Do not promise a fixed launch time until a ZakiTech developer has reviewed the request and confirmed scope.

## 4. Website request intake and content brief

When a customer selects a package, collect a structured brief that the assigned ZakiTech team can use as the source of truth:
- Business name, industry, tagline/motto, overview, services/products, contacts, hours, location, and preferred public contact method.
- Logo, approved images, business premises/area photos, staff/team or vehicles only where the customer has permission to publish them.
- Preferred pages and features (for example About, Services, Products/Menu, Gallery, Location, Contact, ordering/booking, or school information).
- Existing website/domain, if any; preferred domain name if new; and relevant social links.
- Brand colors/style references, languages, target audience, and special instructions.
- Package, quote, payment method/status, installment request, approved delivery milestones, assigned developer, and communications history.

Use the submitted information as the website content reference, but do not publish automatically without human review and customer approval. Validate uploads, protect private files, and distinguish approved public assets from internal-only documents.

## 5. Payment, installments, and service lifecycle

Payment status must be verified server-side using a supported payment provider or a controlled reconciliation process. A screenshot or customer claim is not proof of payment. Store transaction references and audit changes; use idempotent webhook handling where available.

Suggested request states:
1. Draft
2. Submitted
3. Awaiting review/quote
4. Awaiting payment or installment-plan decision
5. Payment verified / deposit verified
6. Accepted for production
7. In progress
8. Customer review / revisions
9. Ready for launch
10. Published / handed over
11. Paused for overdue payment
12. Completed or cancelled

After payment is verified, show **Payment confirmed — your website request is being prepared/reviewed**. When the developer accepts the job, show **Website in progress** with a status timeline. When it is genuinely published and verified, show **Your website is ready**, the working URL, and a message/notification. Do not send a success message or URL before the deployment and domain/HTTPS checks pass.

### Installments

Customers may request installments, but this is not automatically approved. The request should include the proposed amount, frequency, dates, deposit (if any), total agreed price, and remaining balance. An authorized ZakiTech approver must accept or reject the plan and confirm the schedule in writing.

The service agreement must define whether production may start before full payment, what preview/demo access is allowed, who controls the domain and hosting, and what happens if payments become overdue. The system must not secretly or automatically take down a customer's public website. If the agreed contract permits suspension for nonpayment, use a transparent notice and authorized, auditable action, with a recovery path. Do not erase source code, customer content, or records as a payment enforcement mechanism. Preserve ownership and handover terms explicitly in the contract.

## 6. ZakiTech internal routing and access

A new website request should create a ticket visible only to authorized ZakiTech roles, initially:
- Receptionist/intake staff: view incoming requests, check that required fields are present, contact the customer, and route the request.
- Web developer: view the assigned brief, approved assets, milestones, customer feedback, and technical notes needed to build the website.
- CEO / authorized company leader: view and approve quotes, package exceptions, installment plans, assignment, disputes, and completion.
- Other roles only when explicitly granted relevant permissions.

The receptionist can notify the developer and CEO through the authorized company workspace. Assignments, internal comments, customer communications, payment confirmations, scope changes, and status transitions must be audited. Do not expose one customer's brief, payment records, or uploaded private documents to unrelated staff or other businesses.

This should eventually integrate with the ZakiTech Product Hub/work queue, but a customer website request is a service job/ticket and must not be mislabeled as a launched product. Track the customer, request ID, package, assigned team, due-date estimate, current state, live URL (when verified), and release/hand-off notes.

## 7. UX and notifications

The business owner should be able to check website-request status in Molan Business App and receive appropriate in-app/email notifications when:
- The request is submitted.
- A quote or clarification is needed.
- An installment plan is approved or declined.
- A payment is verified or needs attention.
- Production starts, review is needed, or the timeline changes.
- The website is published and its URL is ready.

Messages should be clear, truthful, and localized. Never state that payment or deployment is complete unless verified.

## 8. Acceptance tests

- A business can be created from browser or app with a clear progress state and safe retry.
- The created profile uses the owner's approved business name, logo, photos, motto, location, and details.
- The owner can add an existing website URL or request website creation.
- A customer can see the proposed UGX 200,000 / 300,000 / 450,000 packages and an approved international price table where relevant.
- The exact amount/currency and package scope are confirmed before checkout.
- Website requests route only to authorized ZakiTech intake, development, and leadership roles.
- Payment cannot be marked verified from a client-only flag or screenshot.
- Installment plans require explicit approval and a recorded agreement.
- The customer receives a live URL only after publication and checks are confirmed.
- Overdue payments follow a transparent agreement and never silently delete customer source code or content.
- Private intake files and payment information remain restricted and audited.

## 9. Delivery and pricing guardrails

All package prices, international prices, hosting/domain fees, installment terms, and delivery estimates are configuration values that authorized ZakiTech staff must review before launch. Do not collect real payments for the website service until package scope, contracts, payment provider, tax/receipt handling, refund/cancellation rules, and operational ownership are ready.
