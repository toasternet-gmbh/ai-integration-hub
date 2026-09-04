-- Phase 5 of the founder's platform-expansion roadmap: a new 'messaging' category and messages.*
-- tool domain, connecting to Beeper via the standard Matrix Client-Server API (Beeper is a
-- Matrix homeserver under the hood -- see lib/connectors/matrix.ts's header comment). The least
-- precedented domain added this roadmap: no chat/Matrix concept existed anywhere in this codebase
-- before. Auth is a user-supplied Matrix access token (homeserverUrl + accessToken), same
-- "user pastes a long-lived token from their own account settings" shape as WordPress's
-- Application Password -- no consent-redirect, no Hub-wide secret.
--
-- Risk posture: messages.list_rooms/search/get are read-only, low/allow, same tier as every other
-- read tool. messages.send is high/require_approval -- same tier as orders.refund/mail.send,
-- since sending a message as the connected user to a real contact is consequential and
-- effectively irreversible once delivered.
--
-- Ships enabled=false per the standard kill-switch convention until tested against a real
-- Beeper/Matrix account.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('beeper', 'Beeper', 'messaging', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('messages.list_rooms', 'messages', 'low', 'List the chats/rooms the connected user has joined on a messaging integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['beeper'], 'allow'),
  ('messages.search', 'messages', 'low', 'Full-text search across message content on a messaging integration.',
   '{"type":"object","required":["integration_id","query"],"properties":{"integration_id":{"type":"string"},"query":{"type":"string"}}}',
   ARRAY['beeper'], 'allow'),
  ('messages.get', 'messages', 'low', 'Get one message by id from a specific chat/room.',
   '{"type":"object","required":["integration_id","room_id","message_id"],"properties":{"integration_id":{"type":"string"},"room_id":{"type":"string"},"message_id":{"type":"string"}}}',
   ARRAY['beeper'], 'allow'),
  ('messages.send', 'messages', 'high', 'Send a text message to a chat/room as the connected user on a messaging integration.',
   '{"type":"object","required":["integration_id","room_id","body"],"properties":{"integration_id":{"type":"string"},"room_id":{"type":"string"},"body":{"type":"string"}}}',
   ARRAY['beeper'], 'require_approval')
ON CONFLICT (name) DO NOTHING;
