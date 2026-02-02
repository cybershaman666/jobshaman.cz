-- Oprava měny pro polské inzeráty
UPDATE jobs
SET currency = 'PLN',
    salary_currency = 'PLN'
WHERE country_code = 'pl'
    OR url LIKE '%pracuj.pl%'
    OR url LIKE '%nofluffjobs.com/pl%'
    OR url LIKE '%justjoin.it%';
-- Oprava měny pro německé a rakouské inzeráty (pro jistotu)
UPDATE jobs
SET currency = 'EUR',
    salary_currency = 'EUR'
WHERE country_code IN ('de', 'at')
    OR url LIKE '%.de/%'
    OR url LIKE '%.at/%';