# Molan Business App — Staff Access, Workstations, Governance, and Branding

**Product name:** Molan Business App  
**Status:** Requirements baseline for implementation  
**Reference:** Kenbridge Christian School workflows, generalized into a reusable multi-industry platform.

## 1. Core product rule

Molan Business App is a multi-organization business-management system. Every organization receives a tailored workspace based on its selected profile. Organizations, branches, teams, classes, departments, files, messages, and records must remain isolated unless an explicit permission grants access. The same signed-in person may belong to multiple organizations, but each organization membership has separate roles and access.

## 2. Organization leadership and governance

Each organization has an owner/creator and can appoint one or more administrators. The owner can grant administrators limited or broad operational responsibilities using explicit permissions. Administrators may be allowed to create additional administrators only when the owner grants that permission. The owner retains control over ownership transfer, billing, security settings, and high-risk permissions unless explicitly delegated through a protected workflow.

Support configurable roles such as:
- Owner / Business Principal
- Administrator
- Board / Governors / Trustees (where applicable)
- Manager / Branch Manager
- Department or section head
- Teacher / Class teacher (education)
- General staff / employee
- Finance / HR / inventory / operations specialist
- Customer and delivery worker (where the business profile needs them)

“Board / Governors” is a configurable governance module, not an automatically privileged role. Members may receive read access to approved board papers, meeting agendas, minutes, resolutions, votes, and action items. Confidential records must be restricted. A board title alone must not grant access to student safeguarding, HR, payroll, finance, or unrelated operational records.

Role templates are profile-specific and editable by authorized owners. Permissions must be granular and enforceable by the backend: view, create, edit, submit, approve, publish, export, manage users, manage roles, manage branches, and access sensitive records. Role assignment alone must never bypass organization or branch boundaries.

## 3. Staff invitation and first-time access flow

### Administrator workflow
1. Open the organization's Staff / People area and choose **Add staff member**.
2. Enter the staff member's email, chosen username, name and any required profile fields; check that the username is available.
3. Select the organization, branch/campus, department/team, job role, and assigned workstation scope. For a school, assignment may be to one or more configured school levels, class/year, stream, subject, or department. Example: a teacher assigned to Primary One can manage only the authorized Primary One attendance, marks/reports, class records, and related tasks.
4. Grant only the permissions needed for that assignment and optionally add an initial task or onboarding note.
5. Save to create a pending invitation and send an email containing a secure invitation link. The administrator can view invitation state (pending, accepted, expired, revoked), resend or revoke it, and review the staff profile subject to privacy rules.

### Invitee workflow
1. The email link opens in the browser to a branded welcome page that says the person has been invited to join **Molan Business App** and names the organization and assigned workstation.
2. The page verifies the invitation and explains the role, organization, branch, and initial permissions. The invitee accepts, verifies control of the email, and completes account activation.
3. If a temporary password is used, it must be random, short-lived, never stored or emailed in plaintext, and must be changed at first sign-in. Prefer a secure activation/password-setup link instead of an administrator-chosen reusable default password. Usernames must not be treated as secrets.
4. After activation, the browser shows the assigned workstation and a **Give access to the Molan Business App** action.
5. If the mobile app is not installed, show **Don't have the app? Download Molan Business App** with the verified official release link. After installing, the user returns to the browser and taps **Give access to the Molan Business App** again.
6. The browser starts a secure app handoff. The app opens, the invitee confirms the organization/account, and the app exchanges a one-time, short-lived, single-use handoff code for its own session. The app session is stored securely on the device; closing the browser must not sign the user out of the app.
7. If the handoff fails or the app cannot open, provide safe retry and standard sign-in recovery. Never display session tokens in the page or place reusable access/refresh tokens in URLs, logs, analytics, or clipboard text.
8. The user may set an app lock or other supported device-level protection. Explicit logout revokes or ends the app session; account switching must not leak one account's data into another account.

### Invitation security
- Invitation tokens must be cryptographically random, single-use, stored hashed where feasible, scoped to one invitation/organization/role, and expire after a configured short period.
- Revoke tokens after acceptance, expiry, cancellation, or role changes that invalidate the invitation.
- The invitation endpoint must not trust client-supplied organization IDs, roles, branches, or permissions.
- Avoid account enumeration, rate-limit invite and recovery flows, and audit invitation creation, resend, acceptance, revocation, and role changes.
- Do not let an invitee gain permissions beyond the exact approved invitation. Any additional permissions require an authorized change.
- If a username is reserved, show a clear error and let the administrator choose another available username.
- If the email is already linked to an account, safely add the organization membership after identity verification rather than creating a duplicate identity.

## 4. Workstation and task workflow

A workstation is the user's role- and assignment-specific landing area inside an organization. It is not a separate security boundary by itself; every data request must still be authorized server-side.

- Staff see assigned work, relevant dashboard cards, messages, due dates, announcements, documents, and forms.
- Staff can create/update records within granted scope, then submit them to the designated manager/administrator for review.
- Submission supports states such as Draft → Submitted → Returned for correction or Approved → Published/Finalized, according to the industry workflow.
- Approvers see submitted items, comments, audit history, and approve/return actions.
- Staff cannot approve their own submissions where separation of duties is required.
- Reassignment, transfer, suspension, or departure must update access promptly and preserve historical attribution.
- Staff should not see another class, branch, department, or customer's records unless an explicit permission permits it.

### Education example
For a school configured for Primary, a teacher assigned to Primary One receives the Primary One workstation. It may include class attendance, learner lists, marks, report preparation, class notices, assigned tasks, and submission to the academic administrator. The teacher does not automatically see other classes, school-wide finance, payroll, safeguarding files, or board-confidential records.

For Nursery, Primary, and Secondary, class/grade and reporting templates must follow the selected school levels. An authorized owner can enable multiple levels when the school operates them. A school may appoint administrators and a board/governors group; the Staff Council remains a separate school governance workflow with membership-scoped confidential records.

### Other industry examples
- Retail: cashier sees permitted sales and shift records; stock manager sees inventory for assigned branches; owner sees authorized consolidated reports.
- Restaurant: kitchen staff see assigned orders; manager handles order routing and approvals; delivery personnel see only the delivery details needed for assigned orders.
- Clinic: reception, clinician, finance, and administrator workstations are separated; patient records require strict role and relationship checks.
- Technology company: staff see assigned projects and documents; repository access is separately granted through least-privilege, auditable integrations.
These are examples; final workflows must be validated against the chosen industry and applicable law.

## 5. Business profile setup and branding

During profile creation, collect the business name, industry, country/time zone, optional registration details, contact information, branches, and appropriate profile-specific configuration. For schools, require Nursery, Primary, and/or Secondary selection with explicit owner confirmation for multi-level setups.

Allow authorized owners/brand managers to:
- Upload a business logo, cover/banner image, profile image, and approved gallery images.
- Preview branding before publishing it across the workspace and any customer-facing ordering page.
- Configure brand colors, theme, optional background treatment, contact details, business hours, and public-facing description.
- Replace, crop, reorder, or remove images, with a safe default theme when no custom assets are supplied.
- See upload progress, validation errors, and the current published branding.

Branding should feel professional and pleasing: polished layouts, responsive cards, subtle motion, tasteful gradients/glass-like surfaces where legible, consistent icons, and accessible contrast. Respect reduced-motion preferences and lower-powered Android devices. Visual effects must never reduce readability or obscure critical financial, school, safety, or security information.

Uploads must validate file size, MIME type, actual file signature, and image dimensions; re-encode images when appropriate; remove unnecessary metadata; and store files in private or correctly scoped storage. Public branding assets may be published deliberately, but private business documents must never be placed in public buckets. Only authorized users can modify branding.

## 6. Multi-branch and delegated management

An organization may have multiple branches/campuses. Owners can appoint branch managers and assign staff to one or more branches. Access to cross-branch reports must be a separate permission. Staff transfer and role changes must be audited. Historical records must retain their branch and creator attribution. Removing a staff member should revoke future access without silently deleting business records they created.

## 7. Minimum data and security rules

- Use a trusted identity provider and server-side authorization; never trust hidden buttons or client-only role checks.
- Use secure, persistent app sessions with refresh-token storage supported by the platform; revoke sessions on logout, compromise, or authorized removal.
- Do not put service keys or privileged secrets in the web app, Android package, or repository.
- Enforce tenant-aware and branch-aware database policies on every exposed table and private storage object.
- Store authoritative roles and memberships in protected server-controlled records, not user-editable profile metadata.
- Audit privileged actions and sensitive record access. Protect audit history from ordinary users editing it.
- Use least privilege, MFA for privileged roles where practical, rate limits, secure recovery, backups, and tested restore procedures.
- Separate personal profile information from organization-specific staff profiles and let organizations access only the data needed for their legitimate workflows.
- Apply data retention, export, deletion, and privacy controls suitable for the country and industry.

## 8. Acceptance tests

1. A staff invitation opens a welcome page naming the correct organization and assigned workstation.
2. An expired, revoked, modified, or already-used invitation cannot activate an account or elevate permissions.
3. A teacher assigned only to Primary One cannot access Primary Two or finance records by changing a URL or calling the backend directly.
4. A manager can perform only the actions explicitly granted by the owner.
5. An administrator cannot appoint another administrator unless granted that permission.
6. Board/governor membership does not automatically expose operational, safeguarding, HR, payroll, or student records.
7. The mobile handoff transfers access using a one-time code; no reusable session token appears in a URL or browser log.
8. Closing the browser after a successful handoff does not end the mobile app session; explicit app logout does.
9. An installed app can be opened from the browser handoff; a missing app leads to the official download route and safe retry.
10. Removing a staff member revokes access promptly while preserving required audit history.
11. Branch boundaries hold for direct API calls, reports, documents, and file URLs.
12. Branding uploads are validated, previewable, replaceable, and stored with the intended privacy.
13. Role and invitation changes create audit records.
14. Workstation dashboards and branded themes remain usable on small Android screens and respect reduced-motion settings.

## 9. Implementation sequence

1. Threat model and role/permission matrix.
2. Identity, organization memberships, branch assignments, and database/RLS isolation tests.
3. Secure invitations and activation, including resend/revoke/expiry.
4. Workstation routing, task submission/review, and audit history.
5. Browser-to-mobile one-time handoff and secure session persistence.
6. Profile branding and safe media upload.
7. School pilot based on Kenbridge Christian School workflows, including class-level access, Staff Council, board/governors, academic submissions, and administration.
8. Retail/orders pilot and technology-company pilot.
9. Security testing, accessibility/performance review, and controlled release.

**Do not claim this flow is implemented until code, migrations, automated tests, and a real device/browser test confirm it.**
