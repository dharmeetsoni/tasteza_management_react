-- Fix: salary_id was NOT NULL but staff are now linked by user_id directly.
-- salary_profiles are optional legacy — make salary_id nullable.

ALTER TABLE recipe_salary_staff
  MODIFY COLUMN salary_id INT NULL DEFAULT NULL;

-- Also ensure user_id column exists (in case of older schema)
-- ALTER TABLE recipe_salary_staff ADD COLUMN IF NOT EXISTS user_id INT NULL DEFAULT NULL;
