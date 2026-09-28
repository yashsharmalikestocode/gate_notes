# Exam Atlas

Exam Atlas is a private, multi-user study-notes app for learning **how exam questions are solved**, not merely storing final answers. It keeps the simplicity of the original JAM Notes app and adds progress tracking, interactive trend charts, explicit note connections, and an Obsidian-style knowledge graph.

## What is included

- Email/password sign-up, sign-in, password reset, session persistence, and sign-out
- A separate private workspace for every user, enforced by Supabase Row Level Security
- Create, edit, search, filter, group, and delete structured question notes
- Question IDs, exam/year metadata, topics, difficulty, mastery status, solution path, key insight, traps, formulae, references, and related-note links
- Automatic notes-added-per-day tracking based on note creation dates
- Daily logs for questions solved, study time, and a short reflection
- Interactive 14/30/90-day charts and a 12-week activity heatmap
- A zoomable, draggable knowledge graph with note/topic nodes, hover expansion, search highlighting, and explicit connections
- Complete JSON export/import for portable backups
- Realtime updates between open devices
- A responsive dark interface for desktop, tablet, and mobile
- One-click GitHub Pages deployment workflow

## One-time setup

### 1. Create or update the database

This project is already pointed at the same Supabase project used by the supplied JAM Notes app. In that Supabase project:

1. Open **SQL Editor**.
2. Create a new query.
3. Paste the complete contents of [`supabase/schema.sql`](supabase/schema.sql).
4. Click **Run**.

The script is safe to run on the existing project: it preserves the old `notes` data and adds the new columns, progress table, indexes, realtime configuration, and account privacy rules.

In **Authentication → URL Configuration**, add both your local URL and eventual GitHub Pages URL to the allowed redirect URLs. For example:

```text
http://localhost:8000/**
https://YOUR-GITHUB-NAME.github.io/YOUR-REPOSITORY/**
```

### 2. Preview locally

Serve this folder with any static web server. For example, with Python installed:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

If the page was already open while files were updated, press **Ctrl + Shift + R** once to force a fresh copy. If the sign-in button says “Account service unavailable,” make sure a browser extension or network filter is not blocking `unpkg.com` and `cdn.jsdelivr.net`.

### 3. Publish on GitHub Pages

1. Create an empty GitHub repository.
2. Upload/push the **contents of this `exam-atlas` folder** to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **GitHub Actions**.
5. Push to the `main` branch. The included workflow publishes the site automatically.

## Project structure

```text
exam-atlas/
├── index.html                    Main application markup
├── css/
│   └── styles.css                Complete visual system and responsive layout
├── js/
│   ├── config.js                 Public Supabase browser configuration
│   ├── api.js                    Authentication, database, realtime, import/export API
│   ├── charts.js                 Trend aggregation and Chart.js visualizations
│   ├── graph.js                  D3 knowledge-graph engine
│   └── app.js                    UI state, forms, navigation, rendering, and interactions
├── supabase/
│   └── schema.sql                Database schema, upgrade, security, and realtime setup
├── docs/
│   └── DATA_FORMAT.md            JSON backup format and data dictionary
└── .github/workflows/
    └── deploy-pages.yml          Automatic GitHub Pages deployment
```

## Why this architecture

GitHub Pages hosts the interface for free. Supabase handles accounts, cloud database storage, automatic backups, secure per-user access, and realtime sync. There is no server for you to maintain, and friends can create their own accounts from the sign-up screen.

The Supabase anon key in `js/config.js` is intentionally public, like a Firebase web config. The security boundary is the Row Level Security policy in `supabase/schema.sql`; never place a Supabase **service role** key in this project.

## Important production settings

- Keep **Confirm email** enabled in Supabase Authentication if you want verified accounts.
- Consider enabling CAPTCHA under Supabase Authentication before sharing the site widely.
- Add your final GitHub Pages address to Supabase's allowed redirect URLs so confirmations and password resets return to the app.
- Export a JSON backup occasionally even though Supabase stores the live data.

## Future-friendly additions

The schema and interface are ready to grow. Natural next additions include spaced-repetition review queues, attachment uploads through Supabase Storage, collaborative shared collections, exam-syllabus coverage, formula cards, and AI-assisted topic suggestions.
