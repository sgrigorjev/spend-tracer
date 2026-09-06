# Metabase dashboard for the spend-tracer database

Runs [Metabase](https://www.metabase.com) against the bot's SQLite database (`../data/spend-tracer.db`). Metabase reads the live DB file, so charts update as the bot writes new expenses; there is no import step. SQLite has no network server, so the `data/` directory is mounted into the container and the data source points at the file inside it.

One container, no helpers: Metabase keeps its own metadata (users, dashboards, saved questions) in an embedded database stored in the `metabase-data` volume. Your expenses never leave `data/`.

The host port is `3005` because `3000` is taken on this machine by another service; change the left side of the `ports` mapping if you prefer a different one. The mapping binds to `127.0.0.1`, so the instance is reachable only from this machine. To reach it from elsewhere, put it behind an SSH tunnel or a reverse proxy with TLS, not by removing the loopback bind.

This stack assumes the bot uses the default `DB_PATH` (`data/spend-tracer.db`). If you run the bot with a custom `DB_PATH`, update the `../data` mount and the Filename below to match.

## Starting

```sh
docker compose up -d
```

Run from this directory, or from anywhere with `docker compose -f metabase/docker-compose.yml up -d`. The instance listens on http://localhost:3005.

## Connecting the SQLite database

1. Open http://localhost:3005 and create the admin account on first visit.
2. Click the grid icon (top right) → **Admin settings** → **Databases** → **Add a database**.
3. Database type **SQLite**, **Filename** `/data/spend-tracer.db` (the path inside the container).
4. Save. Metabase syncs the schema and shows two tables: `messages` (raw log) and `expenses` (structured rows).

## Example queries

`time` is stored as `DD.MM.YYYY HH:MM:SS`, so convert it to ISO for date grouping:

```sql
SELECT substr(time, 7, 4) || '-' || substr(time, 4, 2) || '-' || substr(time, 1, 2) AS day,
       sum(amount) AS total,
       count(*)    AS purchases
FROM expenses
WHERE status = 'confirmed'
GROUP BY day
ORDER BY day;
```

Spend by category, current month:

```sql
SELECT category,
       count(*)    AS purchases,
       sum(amount) AS total
FROM expenses
WHERE status = 'confirmed'
  AND substr(time, 7, 4) || substr(time, 4, 2) = strftime('%Y%m', 'now')
GROUP BY category
ORDER BY total DESC;
```

## Notes

- Stop with `docker compose down`; add `-v` to also delete the Metabase metadata volume. `data/` is never touched.
- The JVM heap is capped at 768 MB with `JAVA_OPTS=-Xmx768m`; raise it if Metabase feels slow. This limits the heap only, not the whole container.
- The data directory is mounted read-write because Metabase opens the SQLite file without the read-only flag.
