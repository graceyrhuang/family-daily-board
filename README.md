# 日常 · 家庭看板

Read-only, mobile-friendly meal plan, shopping list and pantry snapshots. Public content is limited to meal and supply information. No personal contacts, order IDs, addresses or source household records are included.

GitHub Pages publishes on pushes to main. The page checks for updated data every minute and when reopened. Dates use America/Los_Angeles. Missing days show an empty state; historical inventory is labeled as a snapshot.

The local exporter reads only selected table fields from the household records. The assistant post-update hook exports data, commits data.json if changed, and pushes. Local scripts are excluded from this repository. A local computer must be awake and online for that hook to run. Changes do not automatically invent inventory quantities or rewrite meals.

Search-engine exclusion is advisory; this site is public.

Background filesystem watching is disabled: macOS denied Documents access. The assistant invokes the sync script after record changes; manual file edits require running it explicitly.
