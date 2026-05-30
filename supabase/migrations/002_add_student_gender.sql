-- Add gender column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female'));
