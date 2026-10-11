-- Vazifalar navbati (pg-boss) o'z jadvallarini alohida `pgboss` sxemasida saqlaydi va navbat
-- yaratilganda yangi jadval ochadi. Shuning uchun panel foydalanuvchisiga bazada sxema yaratish
-- huquqi beriladi: u `pgboss` sxemasini o'zi yaratadi va unga o'zi egalik qiladi.
-- `public` sxemasidagi huquqlar o'zgarmaydi: audit_events avvalgidek himoyalangan.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ventura_app') THEN
    EXECUTE format('GRANT CREATE ON DATABASE %I TO ventura_app', current_database());
  END IF;
END $$;
