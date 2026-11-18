-- Read-only: the real columns of leave_requests. ONE query, one row, column names only.
SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) AS leave_requests_columns
FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'leave_requests';
