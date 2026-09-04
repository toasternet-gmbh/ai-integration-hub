-- Phase 3 of the founder's platform-expansion roadmap: a brand-new 'productivity' category and
-- calendar.*/mail.* tool domain (nothing like this existed before — every prior tool domain acts
-- on the customer's own external business system, not their personal calendar/inbox). Two
-- platforms, one connector each covering both calendar and mail via one OAuth2 app registration:
-- Outlook (Microsoft Graph) and Google (Gmail + Calendar APIs). auth_type='oauth2' here is the
-- real thing per CLAUDE.md's own distinction -- a genuine user consent-redirect
-- (start_oauth_connection/complete_oauth_connection, see tools/oauthConnections.ts), unlike every
-- 'api_key' platform including the ones that internally use OAuth2 client-credentials.
--
-- Risk posture: calendar.list_events/search and mail.search/get are read-only, low/allow, same
-- tier as every other read tool. calendar.create_event is low/allow -- an added calendar event is
-- low-stakes and reversible. mail.send is high/require_approval -- same tier as orders.refund,
-- since sending an email as the connected user to a real recipient is consequential and
-- effectively irreversible once delivered.
--
-- Both ship enabled=false per the standard kill-switch convention, until MICROSOFT_CLIENT_ID/
-- SECRET and GOOGLE_CLIENT_ID/SECRET are configured and a real consent-redirect round-trip is
-- tested end-to-end (see .env.example).

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('outlook', 'Outlook', 'productivity', 'oauth2', false),
  ('google', 'Google', 'productivity', 'oauth2', false)
ON CONFLICT (name) DO NOTHING;

INSERT INTO hub_tool_registry (name, domain, risk, description, input_schema, supported_platforms, default_policy) VALUES
  ('calendar.list_events', 'calendar', 'low', 'List upcoming (or date-ranged) calendar events on a productivity integration.',
   '{"type":"object","required":["integration_id"],"properties":{"integration_id":{"type":"string"},"start_date":{"type":"string"},"end_date":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['outlook', 'google'], 'allow'),
  ('calendar.search', 'calendar', 'low', 'Search calendar events by text on a productivity integration.',
   '{"type":"object","required":["integration_id","query"],"properties":{"integration_id":{"type":"string"},"query":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['outlook', 'google'], 'allow'),
  ('calendar.create_event', 'calendar', 'low', 'Create a new calendar event on a productivity integration.',
   '{"type":"object","required":["integration_id","subject","start_time","end_time"],"properties":{"integration_id":{"type":"string"},"subject":{"type":"string"},"start_time":{"type":"string"},"end_time":{"type":"string"},"description":{"type":"string"},"attendees":{"type":"array","items":{"type":"string"}}}}',
   ARRAY['outlook', 'google'], 'allow'),
  ('mail.search', 'mail', 'low', 'Search email messages by text on a productivity integration.',
   '{"type":"object","required":["integration_id","query"],"properties":{"integration_id":{"type":"string"},"query":{"type":"string"},"limit":{"type":"number"}}}',
   ARRAY['outlook', 'google'], 'allow'),
  ('mail.get', 'mail', 'low', 'Get one email message by id.',
   '{"type":"object","required":["integration_id","message_id"],"properties":{"integration_id":{"type":"string"},"message_id":{"type":"string"}}}',
   ARRAY['outlook', 'google'], 'allow'),
  ('mail.send', 'mail', 'high', 'Send an email as the connected user on a productivity integration.',
   '{"type":"object","required":["integration_id","to","subject","body"],"properties":{"integration_id":{"type":"string"},"to":{"type":"array","items":{"type":"string"}},"subject":{"type":"string"},"body":{"type":"string"}}}',
   ARRAY['outlook', 'google'], 'require_approval')
ON CONFLICT (name) DO NOTHING;
