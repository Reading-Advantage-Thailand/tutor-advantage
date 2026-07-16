UPDATE "learning"."books"
SET
  "book_code" = 'Reading ' || substring("book_code" from '([0-9]+(\.[0-9]+)?)'),
  "title" = 'Reading ' || substring("title" from '([0-9]+(\.[0-9]+)?)')
WHERE "book_code" ~ '^(Origins|Quest|Adventure|Hero|Legend) [0-9]+(\.[0-9]+)?$';
