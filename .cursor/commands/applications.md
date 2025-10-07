UPDATE candidates c
SET created_by = j.created_by
FROM applications a
JOIN jobs j ON j.id = a.job_id
WHERE a.candidate_id = c.id
  AND (c.created_by IS NULL OR c.created_by <> j.created_by);
