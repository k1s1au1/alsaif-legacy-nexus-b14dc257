## Scope & approach

The existing chat (`chat_rooms`, `chat_room_members`, `messages`, `/messages` routes) will be **dropped and replaced** with a new WhatsApp-style messenger. Given the size of the request, I'll deliver every item you listed, but be upfront about the realistic tradeoffs for two of them:

- **Push notifications**: I'll wire **in-app realtime notifications** (sound + badge + browser `Notification` API when the tab is granted permission). True mobile push (APNs/FCM) requires a native shell or a paid web-push provider and isn't possible from a Lovable web app alone — I'll flag where to plug that in later.
- **Voice messages**: recorded via the browser `MediaRecorder` API (webm/opus). Plays back inline. No transcription.

Everything else ships in this rebuild.

## New data model (single migration; old tables dropped)

- `conversations` — `id`, `kind` (`direct` | `group`), `title` (group only), `avatar_url` (group only), `created_by`, `last_message_at` (for sorting), timestamps.
- `conversation_participants` — `conversation_id`, `user_id`, `role` (`owner` | `admin` | `member`), `joined_at`, `archived_at` (per-user archive), `muted` (bool), `last_read_at`. Unique `(conversation_id, user_id)`.
- `messages` — `id`, `conversation_id`, `sender_id`, `kind` (`text` | `image` | `video` | `audio` | `file`), `body` (text), `attachment_url`, `attachment_name`, `attachment_size`, `attachment_mime`, `attachment_duration_ms` (voice/video), `reply_to_id` (FK), `deleted_at` (soft delete), `edited_at`, `created_at`.
- `message_reactions` — `message_id`, `user_id`, `emoji`. Unique `(message_id, user_id, emoji)`.
- `message_deliveries` — `message_id`, `user_id`, `delivered_at`, `read_at`. Drives ✓ / ✓✓ / ✓✓ (blue) indicators.
- `user_presence` — `user_id` (PK), `status` (`online` | `offline`), `last_seen_at`.

Helpers (SECURITY DEFINER): `is_conversation_member(_user, _conv)`, `is_conversation_admin(_user, _conv)`, `find_or_create_direct(_other_user)` (atomic — finds the existing 1:1 conversation between caller and `_other_user`, or creates it and seeds both participants).

RLS: members see their conversation, its participants, messages, reactions, and delivery rows; only senders edit/delete their own messages; group admins/owners manage participants and group metadata; users update only their own presence, reads, and reactions.

Realtime publication: `conversations`, `conversation_participants`, `messages`, `message_reactions`, `message_deliveries`, `user_presence`.

Typing indicators and "user is online right now" use Supabase Realtime **broadcast + presence channels** (no DB writes per keystroke).

GRANTs on every new table for `authenticated` + `service_role`.

## Storage

- New private bucket `chat-attachments` with RLS scoped to conversation members. Path layout `{conversation_id}/{message_id}/{filename}`. Signed URLs for downloads.

## Routes (replace existing `/messages*`)

```
src/routes/_authenticated/chat.tsx                 # layout: conv list (left) + outlet
src/routes/_authenticated/chat.index.tsx           # empty-state ("اختر محادثة")
src/routes/_authenticated/chat.$conversationId.tsx # conversation view
```

The old `messages.tsx` and `messages.$roomId.tsx` files are deleted and `AppShell` nav swaps from "الرسائل" → "المحادثات" pointing at `/chat`.

## UI (WhatsApp-style)

**Layout** — two-pane desktop, single-pane mobile:
- **Left pane (conversation list)**: search box, "new chat" + "new group" buttons, list sorted by `last_message_at`, each row shows avatar, name, last message preview, time, unread badge, mute icon, ✓/✓✓/✓✓-blue mini-indicator on your last sent message. Long-press / kebab → archive / delete / mute.
- **Right pane (conversation view)**:
  - Header: avatar, name, presence ("online" / "last seen ...") for direct chats, or "N members" for groups; clicking opens an info drawer (members, admin controls for groups: add/remove, promote/demote, rename, change avatar).
  - Message list: bubbles right-aligned for you (gold), left for others (secondary), grouped by day with date separators, reply-quote shown above message, reactions chip under bubble, ✓ / ✓✓ / ✓✓-blue ticks on your bubbles. Long-press (or hover toolbar) → react, reply, copy, delete. Tap a reaction chip to toggle. Search bar inside the chat header filters/highlights matches.
  - Attachment rendering: image/video inline with lightbox, voice message with waveform progress + play button + duration, file with icon + name + size + download.
  - Composer: emoji picker, paperclip (image/video/file from device), camera (image capture), mic (hold-to-record voice; release to send, slide to cancel), text field, send button. Reply context strip and edit context strip render above the input.
  - Typing dots appear under header when someone in the room is typing (debounced via Realtime broadcast).
- Mobile: list and conversation are separate screens; back arrow returns to list. Sidebar `AppShell` rail stays.

**Search**: top of the conversation list searches across conversation titles, participants, and last message previews. Inside a chat, ⌘F / search icon filters messages.

**Archive view**: filter toggle at top of list ("نشطة" / "أرشيف"). Archived conversations are hidden from the main list and surface in the archive view.

**Notifications**:
- Sound + visible toast for incoming messages when window is hidden or the chat isn't focused.
- Browser `Notification` permission requested on first chat open; falls back silently if denied.
- Per-conversation mute respected.

## Implementation order (single response, multiple steps)

1. **Migration** — drop old tables/policies; create new schema, helpers, RLS, GRANTs, realtime, storage bucket policies.
2. **Storage** — create `chat-attachments` bucket (private) + RLS on `storage.objects`.
3. **Frontend primitives** — `src/lib/chat/` with hooks: `useConversations`, `useConversation`, `useMessages`, `usePresence`, `useTyping`, `useUploads`, `useNotifications`.
4. **Routes** — `chat.tsx` (layout), `chat.index.tsx`, `chat.$conversationId.tsx`, plus dialog components: `NewChatDialog`, `NewGroupDialog`, `ConversationInfoDrawer`, `EmojiPicker`, `VoiceRecorder`, `AttachmentMenu`, `MessageBubble`, `MessageList`, `Composer`.
5. **Nav swap** — update `AppShell` nav from `/messages` to `/chat`.
6. **Cleanup** — delete old `messages*.tsx`, leave migration history intact.

## Performance / scalability notes

- Messages query is paginated with infinite scroll (`limit 50` reverse chronological).
- Conversation list reads `last_message_at` + unread count derived from `last_read_at` vs `messages.created_at`.
- Realtime channels are per-conversation (`messages:conv-{id}`), torn down on unmount.
- Presence uses one global presence channel; typing uses per-conversation broadcast.
- Indexes: `messages(conversation_id, created_at desc)`, `conversation_participants(user_id)`, `message_deliveries(user_id, message_id)`.

## Out of scope (called out, not built)

- True mobile push notifications (APNs/FCM) — needs a native wrapper or paid web-push.
- End-to-end encryption.
- Calls (voice/video calling).
- Voice message transcription.

I'll execute the full plan after you approve.
