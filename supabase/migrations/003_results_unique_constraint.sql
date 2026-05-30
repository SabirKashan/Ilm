-- Needed so upsert on (exam_id, student_id, subject_id) works correctly
ALTER TABLE results
  ADD CONSTRAINT results_exam_student_subject_key
  UNIQUE (exam_id, student_id, subject_id);
