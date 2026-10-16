# ZakiTech

A Zakmolanitech Solutions private company-management application.

## Current implementation

- Cyan-blue and deep-navy welcome/sign-in experience with a three-second animated welcome.
- **Private, invitation-only accounts** — no public account-creation option in the interface.
- Supabase Auth-backed assigned-username and password sign-in with persistent sessions while browser/app storage remains installed. After reinstalling, staff sign in again with their assigned username and password; their server-stored profile, permissions, and workspace data are loaded from the same account.
- Backend checks account status before returning a sign-in session.
- Protected workspace page with session validation and sign-out.
- Role-aware staff-management screen for the owner and Vice Administrator.
- Staff invitations, unique usernames, role assignment, account suspension/reactivation, and audit events.
- Database row-level security on profile and audit tables.
- Backend roles: owner, vice_admin, web_developer, application_developer, engineer, staff.
- Product Hub with evidence-based lifecycle tracking and deployment verification
- Dedicated Molan Business Control Center for leadership-approved milestones, blockers, release notes, staff tasks, product workstation access, technical links, and audited project announcements
- Product-specific staff access is explicit and least-privilege; product role labels alone do not grant repository access

## Security design

- Public browser code uses only the Supabase publishable key.
- The Supabase service-role key is used only inside Edge Functions and must never be committed to this repository.
- `zakitech-signin` checks the server-managed profile status before authenticating a username/email and password.
- `zakitech-staff-admin` requires a valid session and checks the server-managed role before listing, inviting, or suspending staff.
- Public self-registration must be disabled in Supabase Authentication settings; staff accounts are created only by the authorized admin workflow. (A faulty database trigger that blocked valid invitations was removed.)
- Profile role and status values are stored in `zt_profiles`; user-editable Auth metadata is not used to grant permissions.
- Audit events are stored in `zt_audit_events`.

## Backend

Supabase project: `mmozesoarwkimhyloivu` (region: eu-west-1).

Database migrations:
- `20261010000000_zakitech_private_staff_access.sql`
- `20261010000001_zakitech_audit_access_and_indexes.sql`
- `20261010000002_zakitech_invite_only_auth_guard.sql` (documents the correct invite-only configuration; intentionally does not add a blocking trigger)

Edge Functions:
- `zakitech-signin` (public endpoint, validates credentials itself; JWT gateway verification is intentionally disabled for sign-in only)
- `zakitech-staff-admin` (JWT verification enabled; owner/Vice Administrator permissions checked inside the function)

## Owner account setup

The first owner account has not yet been provisioned. Invite the owner's email from the Supabase Authentication users page so the invite-only database guard permits the account, then add its matching `zt_profiles` row with role `owner` and status `active`. Do not put passwords, passcodes, service-role keys, or other secrets in this repository.

After the owner account is provisioned, use the workspace staff-management screen to invite the Vice Administrator and other staff. The invite email is where each staff member sets their own password.

## Local preview

Open `index.html` through a static web server. The Supabase project URL and publishable key are in `assets/js/supabase-config.js`; publishable keys are designed for browser use. Never add service-role credentials to frontend files.

## Product direction

ZakiTech is a separate company-management application. ZakiChat is one product that will eventually be represented in the ZakiTech Product Hub; it is not the ZakiTech codebase.

## Workstation security rollout (partially implemented)

Branch `feat/staff-onboarding-workstation-security` adds the initial server-side foundation for application workstation passcodes:

- `supabase/migrations/20261011000000_zakitech_workstation_security.sql` creates a server-only credential table with row-level security and no direct client grants.
- `supabase/functions/zakitech-workstation-security/index.ts` provides authenticated setup, status, and verification actions. It uses salted PBKDF2-SHA-256 verifiers, checks active account status, rate-limits failed attempts, and writes audit events.
- The Appearance & Settings page lets a signed-in user choose a four-digit PIN or a separate application password (8–128 characters).
- The shared workstation-lock script is loaded on the protected workspace pages, provides a manual Lock button, prompts for verification when configured, and locks after inactivity or a sufficiently long background period.
- The credential table is server-only with RLS and no direct client grants. The Edge Function stores salted PBKDF2-SHA-256 verifiers, validates the active account, rate-limits failed attempts, and audits credential creation and successful verification.

The database migration and Edge Function have been deployed. The website lock screen is implemented as a client-side convenience barrier, not a complete device-security boundary: users with technical access to browser storage/devtools may bypass a JavaScript overlay, and backend APIs do not rely on this overlay for authorization. Administrator-controlled credential reset, staff invite-link onboarding, and official profile-image policy remain follow-up work.


## Reinstall and mobile security requirements

- A reinstall clears device-local authentication/session data; the staff member signs in again with their assigned username and password. The account's profile, role, assignments, products, tasks, and other server-stored workspace data remain associated with the same Supabase user and are reloaded after successful sign-in.
- The current repository is a browser-based web application; it does not yet contain a native Android/Capacitor project. Native fingerprint/face authentication, Android Keystore-backed credentials, and application-level lock/resume handling cannot be truthfully enabled by changing the website alone. These require a packaged native app and device testing.
- The website currently has a PIN/password setup and a client-side lock/unlock screen. The current project does not include a native Android/Capacitor application, so fingerprint/face unlock and Android Keystore protection are not implemented. Those require a native app package, platform biometric APIs, and device testing before the mobile security requirement can be considered complete.


## Branding and live workspace synchronization

- The launcher/web app mark is the glossy **ZAK** icon in cyan blue, deep navy, and white.
- Official company motto: **“Equipping minds with IT solutions.”**
- Authenticated pages load `assets/js/live-sync.js` to show live connection status and listen on the private Supabase Broadcast topic `zt-live-workspace`.
- Database triggers send only a generic change signal (table name and operation), not row contents. The channel is restricted by an RLS policy to active ZakiTech profiles. Pages refresh data through their existing workspace Edge Functions, preserving role checks; refreshes are deferred while a user is editing a form.
- Trigger coverage includes profiles, products, workstation assignments, published build workflow, announcements, notifications, product messages, tasks, staff group messages, meetings, meeting RSVPs, and board items. Payroll, workstation credentials, audit events, direct staff messages, performance events, and exit requests are excluded from broadcast triggers.
- When a device is offline, live delivery pauses; on reconnection or when the app is brought back into view, the client refreshes through the authenticated backend.
- Native Android code does not silently self-install updates. A new Android build must be signed and distributed through an approved update channel; the existing workflow builds a debug test APK for testing.

## Molan Business subscription and Workshop Real Time reference

The Molan Business subscription package fees renew at the end of each selected period: Gold every 3 months, Silver every 2 months, and Premium every month. Full package fees: Uganda (UGX) 100,000 / 70,000 / 30,000; Kenya (KES) 90,000 / 80,000 / 70,000; Tanzania (TZS) 140,000 / 120,000 / 90,000; other Africa (USD) $80 / $50 / $40; Europe (EUR default) €100 / €50 / €30; Asia (USD) $80 / $70 / $50; America (USD) $100 / $60 / $50 (Gold / Silver / Premium). Unspecified markets default to $80 / $50 / $40. Molan Business can request browser location permission and reverse-geocode the coordinates to suggest a market, or the customer can choose manually. The price catalogue is stored in Supabase, but payment checkout and verified activation remain disabled until provider integration is completed. Automatic expiry locking and scheduled renewal reminders are not yet implemented end-to-end.

Workshop Real Time is owner-controlled camera oversight. A working connection requires owner-authorised device ownership verification, compatible IP camera/NVR/DVR or an approved manufacturer API/ONVIF/secure relay, stable power and internet, configured storage/retention and timestamps, and explicit staff viewing permissions. QR/Bluetooth/Wi-Fi may assist setup but are not proof of ownership or a universal streaming connection. Only the active business owner can modify or delete archived footage. Security controls reduce risk but do not guarantee zero risk.
