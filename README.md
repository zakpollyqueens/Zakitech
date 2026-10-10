# ZakiTech

A Zakmolanitech Solutions private company-management application.

## Current implementation

- Cyan-blue and deep-navy welcome/sign-in experience with a three-second animated welcome.
- **Private, invitation-only accounts** — no public account-creation option in the interface.
- Supabase Auth-backed username/email and password sign-in with persistent sessions.
- Backend checks account status before returning a sign-in session.
- Protected workspace page with session validation and sign-out.
- Role-aware staff-management screen for the owner and Vice Administrator.
- Staff invitations, unique usernames, role assignment, account suspension/reactivation, and audit events.
- Database row-level security on profile and audit tables.
- Backend roles: owner, vice_admin, web_developer, application_developer, engineer, staff.
- Product Hub, project assignments, and announcements are shown as planned workspace modules, not yet complete.

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
