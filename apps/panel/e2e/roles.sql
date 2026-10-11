-- E2E test bazasi uchun panel roli. Baza egasi (ventura) nomidan, migratsiyalardan OLDIN ishga tushiriladi.
-- Haqiqiy bazadagi kabi: ventura_app jadvallarga yozadi, lekin audit_events da UPDATE/DELETE huquqi yo'q
-- (uni 0001_audit_immutable migratsiyasi olib qo'yadi). Parol faqat test uchun.
CREATE ROLE ventura_app LOGIN PASSWORD 'e2e';
GRANT USAGE ON SCHEMA public TO ventura_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ventura IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ventura_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ventura IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ventura_app;
