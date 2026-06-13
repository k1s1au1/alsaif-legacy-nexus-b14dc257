## Goal

Turn the single "مجلس العائلة" channel into a multi-room chat system supporting **public rooms** (open to every signed-in member) and **private rooms** (invite-only), each with its own member list showing participants and administrators.

## Data model (new migration)

New tables in `public`:

- `chat_rooms` — `id`, `name`, `description`, `is_private` (bool), `created_by`, timestamps.
- `chat_room_members` — `room_id`, `user_id`, `room_role` (`owner` | `admin` | `member`), `joined_at`. Unique `(room_id, user_id)`.

Alter `messages`:
- Add `room_id uuid not null references chat_rooms(id) on delete cascade`.
- Backfill existing rows into a seeded default public room "مجلس العائلة" before applying NOT NULL.

Helpers (SECURITY DEFINER, search_path = public) to keep RLS non-recursive:
- `is_room_member(_user, _room) returns boolean`
- `is_room_admin(_user, _room) returns boolean` (owner or admin of that room, or global app admin)

RLS:
- `chat_rooms`: SELECT allowed when `is_private = false` OR `is_room_member(auth.uid(), id)` OR global admin. INSERT/UPDATE/DELETE: global admin or room owner.
- `chat_room_members`: SELECT allowed to members of the same room or global admin. INSERT/DELETE: room admin or global admin.
- `messages`: SELECT/INSERT gated by `is_room_member(auth.uid(), room_id)` for private rooms; public rooms allow all authenticated reads, INSERT still requires `sender_id = auth.uid()` and (for public) auto-membership. DELETE: global admin or room admin.

Realtime: add `chat_rooms` and `chat_room_members` to `supabase_realtime` (messages already enabled).

Seed: one default public room "مجلس العائلة"; reassign existing messages to it; add every existing user as a member (member role; admins → admin).

GRANTs on every new table for `authenticated` + `service_role` as required.

## Routes

- `/messages` (existing) → becomes a room list landing: shows public rooms + private rooms the user belongs to, plus a "New room" button for global admins.
- `/messages/$roomId` (new) → the actual chat surface for one room.

Layout: 3-column desktop layout
1. **Rooms sidebar** (left): public + private rooms the user can see, with unread-ish accents and an admin "+ New room" affordance.
2. **Conversation** (center): existing message stream + composer, scoped to `roomId`. Realtime channel filtered by `room_id`.
3. **Members panel** (right): all participants of the current room, badged with **Owner / Admin / Member**. For admins of a private room: "Add member" picker (searches `profiles`) and remove (×) per member.

Mobile: rooms list and members panel collapse into drawers.

## Permissions surfaced in UI

- Anyone can read/write public rooms.
- Private rooms only render in the sidebar if the user is a member.
- Only global admins or the room's owner/admin can:
  - Create a new room (and choose public/private).
  - Add/remove members in a private room.
  - Delete messages and delete a room.

## Implementation order

1. Migration: new tables, alter `messages`, helpers, RLS, GRANTs, realtime publication, seed default room + members.
2. `src/routes/_authenticated/messages.tsx` → rooms list (public + private the user is in) with create-room dialog for admins.
3. `src/routes/_authenticated/messages.$roomId.tsx` → room view with messages + members panel + (for room/global admins) add/remove member controls.
4. Reuse `AppShell`; keep RTL Arabic strings consistent with existing design tokens (`gold-primary`, `ivory`, `navy-base`).

## Technical notes

- All DB access stays via the browser Supabase client; RLS enforces visibility, so no server functions needed.
- Realtime: subscribe per-room with `filter: room_id=eq.<id>` for `messages`, and a separate channel for `chat_room_members` to keep the members panel live.
- Backwards compatible: existing messages survive (moved to the default public room).
