# AniMayX Firestore Security Specification

## 1. Data Invariants
1. **PII Isolation**: User email addresses and private preferences live exclusively in `/users/{userId}/private/info` and are readable/writable only by `userId` or a verified Admin. Public profiles at `/users/{userId}` never store PII.
2. **Atomic Username Uniqueness**: `/usernames/{username}` locks lowercase alphanumeric+underscore usernames to a single `uid` and cannot be overwritten by another user.
3. **Zero Self-Assigned Admin**: `/admins/{uid}` is read-only for clients (`allow write: if false`). Ordinary users cannot set `role`, `badges`, or admin fields on any document.
4. **Publication Gating**: Draft and archived entries in `/anime`, `/animeMovies`, and `/anime/{animeId}/episodes` are invisible to non-admins.
5. **Owner-Bound Watchlist & Progress**: `userWatchlists` and `watchProgress` enforce `userId == request.auth.uid` on every write and private read.
6. **Verified Email Requirement**: Standard user mutations require `request.auth.token.email_verified == true` (except initial profile/private-info bootstrap or Google-verified sessions where appropriate; enforced strictly on username/public-write actions and admin email checks).
7. **Discord URL Safety**: `communitySettings` writes are admin-only and validate HTTPS Discord invitation domains (`https://discord.gg/...` or `https://discord.com/invite/...`).

## 2. The "Dirty Dozen" Attack Payloads
1. **Unverified Admin Email Spoof**: User with `email: "mrzorvixofficial@gmail.com"` and `email_verified: false` tries to publish an anime in `/anime/123` -> `PERMISSION_DENIED`.
2. **Self-Promotion in `/admins`**: Authenticated user attempts `setDoc(doc(db, 'admins', myUid), { role: 'super_admin' })` -> `PERMISSION_DENIED`.
3. **Ghost Field Shadow Update**: User updates `/users/{myUid}` adding `{ isAdmin: true, badges: ['founder'] }` -> `PERMISSION_DENIED` (`hasOnly` & `affectedKeys` guard).
4. **Cross-User PII Read**: User A attempts `getDoc(doc(db, 'users', userB, 'private', 'info'))` -> `PERMISSION_DENIED`.
5. **Username Hijack**: User A attempts to overwrite `/usernames/existing_name` owned by User B -> `PERMISSION_DENIED`.
6. **ID Poisoning**: User attempts `getDoc` or `setDoc` with a 1,500-character invalid ID containing slashes/spaces -> `PERMISSION_DENIED`.
7. **Watchlist Forgery**: User A creates `/userWatchlists/fake` with `userId: userB` -> `PERMISSION_DENIED`.
8. **Cross-User Watch Progress Scrape**: User A queries `collection(db, 'watchProgress')` without `where('userId', '==', userA)` -> `PERMISSION_DENIED`.
9. **Draft Anime Leak**: Non-admin reads `/anime/draft_title` with `status: 'draft'` -> `PERMISSION_DENIED`.
10. **Non-Admin Discord Hijack**: Non-admin attempts to update `/communitySettings/discord` with `inviteUrl: "https://evil.example"` -> `PERMISSION_DENIED`.
11. **Timestamp Forgery**: User creates `/watchProgress/p1` with backdated client `updatedAt` instead of `request.time` -> `PERMISSION_DENIED`.
12. **Audit Log Tampering**: Even an admin attempts to delete or update `/adminAuditLogs/log1` -> `PERMISSION_DENIED` (immutable audit trail).
