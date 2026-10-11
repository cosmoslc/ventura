-- Audit jurnali o'chmas (SPEC 10-bo'lim): UPDATE, DELETE va TRUNCATE taqiqlangan.
-- 1) Panel foydalanuvchisidan huquq olinadi (bo'lsa).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ventura_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM ventura_app;
  END IF;
END $$;
--> statement-breakpoint
-- 2) Trigger — hatto huquqi bor foydalanuvchi ham o'zgartira olmaydi.
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
