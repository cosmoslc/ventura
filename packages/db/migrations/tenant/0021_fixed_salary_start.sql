ALTER TABLE "teachers" ADD COLUMN "salary_start_date" date;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "teacher_salary_from" date;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_salary_start_fixed" CHECK ("teachers"."salary_start_date" is null or "teachers"."salary_type" = 'fixed');--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_salary_from_fixed" CHECK ("groups"."teacher_salary_from" is null or "groups"."teacher_salary_type" = 'fixed');