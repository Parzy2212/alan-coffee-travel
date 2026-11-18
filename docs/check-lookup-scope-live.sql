-- Read-only, after migration 067 and a few customer lookups that found nobody at the POS:
-- is the miss counter keyed by caller address (good) or by 'lookup:unknown' (everyone shares one
-- counter, so guessing from elsewhere could pause the shop)? ONE query, one row, no addresses shown.
SELECT count(*) FILTER (WHERE scope = 'lookup:unknown')  AS misses_without_address,
       count(*) FILTER (WHERE scope <> 'lookup:unknown') AS misses_with_address,
       count(DISTINCT scope)                             AS distinct_callers
FROM public.customer_lookup_misses;
