-- Add Quicken to the bookkeeping category. Ships disabled per unverified platform convention.

INSERT INTO hub_platform_types (name, label, category, auth_type, enabled) VALUES
  ('quicken', 'Quicken', 'bookkeeping', 'api_key', false)
ON CONFLICT (name) DO NOTHING;

UPDATE hub_tool_registry SET supported_platforms = supported_platforms || ARRAY['quicken']
WHERE name IN (
  'contacts.search', 'contacts.get', 'contacts.create', 'contacts.update',
  'contacts.addresses.search', 'contacts.addresses.create',
  'invoices.search', 'invoices.get', 'invoices.create', 'invoices.finalize', 'invoices.record_payment', 'invoices.void',
  'credit_notes.search', 'credit_notes.get', 'credit_notes.create',
  'vouchers.create_from_file'
)
  AND NOT ('quicken' = ANY(supported_platforms));

UPDATE hub_platform_types SET verification_note =
  'Quicken connector is implemented as a stub. Needs direct vendor access to real API docs and a real account to verify.'
  WHERE name = 'quicken';
