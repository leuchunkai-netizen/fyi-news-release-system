-- Allow long comma-separated expertise lists per application (varchar(255) could truncate or reject inserts).
ALTER TABLE public.expert_applications
  ALTER COLUMN expertise TYPE text;
