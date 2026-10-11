-- RLS jadval egasiga ham amal qiladi (FORCE): ilova migratsiya foydalanuvchisi bilan ulansa ham
-- boshqa mijoz qatorlarini ko'rmaydi. Faqat superuser va BYPASSRLS rollar chetlab o'tadi — ilovaga berilmaydi.
-- Yangi jadval qo'shilganda uning migratsiyasi ham FORCE qiladi; ajratish testi buni har jadval uchun tekshiradi.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
    WHERE n.nspname = current_schema() AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;
--> statement-breakpoint
-- Faoliyat jurnali o'chmas: UPDATE, DELETE va TRUNCATE taqiqlangan (panel bazasidagi kabi).
CREATE OR REPLACE FUNCTION audit_events_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events jadvalini o''zgartirish yoki o''chirish taqiqlangan';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_events_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_immutable();
--> statement-breakpoint
CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_immutable();
