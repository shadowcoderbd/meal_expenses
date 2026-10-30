# Meal Expenses

A mobile-friendly web app for tracking shared household meal costs. It runs entirely on GitHub
Pages. There is no server; a private GitHub repository acts as the database.

- **Periods**: track any named period ("October 2026", "Trip to Paris"). The app opens the latest one.
- **Expenses**: amount, description, quantity and unit, date, category, who paid. Meal expenses are
  split by meals eaten. Other expenses are split equally among the people you select.
- **Meals**: a list of days. Each day records breakfast, lunch and dinner per member. Days can be
  planned in advance.
- **Summary**: meal rate, each person's meal cost, shared cost, amount paid and balance, the
  fewest transfers needed to settle up, and a print option.
- **Settings**: members and logins, default meal ratio, categories, units, currency, JSON
  backup and restore, and token rotation.

## How it works

| What | Where |
| --- | --- |
| App (static files) | This repo, deployed to GitHub Pages by `.github/workflows/deploy.yml` |
| Data: `meta.json`, `periods/<id>.json` | A **private** data repo, read and written through the GitHub Contents API |
| Logins: `users.json` | The `auth` branch of this repo, publicly readable |

Every change becomes a commit in the data repo, so the full history is always available. Edits are
saved as operations and retried on conflicts, so two people editing at the same time don't
overwrite each other. Data is cached in the browser, so the app opens instantly and keeps
working offline.

**Login.** A single fine-grained GitHub token gives access to the repos. Each user has an entry in
`users.json` that contains this token encrypted with AES-GCM, using a key derived from their
password (PBKDF2-SHA256, 600k iterations). Usernames are stored only as salted hashes. A wrong
password simply fails to decrypt. When you add a member, the app generates a password for you to
send them. They can change it after logging in.

> This protects a household, not a bank. Anyone who is logged in could extract the token from
> their browser. To lock someone out completely, use **Settings → Replace token** and then revoke
> the old token on GitHub.

## Setup

1. Push this repo to GitHub. In **Settings → Pages**, set the source to **GitHub Actions**.
   On a free account, the repo must be public for Pages to work.
2. Create a **private**, empty repository for the data, e.g. `meal-data`.
3. Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new):
   - Repository access: this app repo **and** the data repo
   - Permissions: **Contents: Read and write**
   - Pick an expiry. When it expires, use *Replace token* in Settings.
4. Open the deployed site and fill in the setup form. You become the first member.
5. Add the other members in **Settings → Members** and send each person their generated password.

## Development

```bash
npm install
cp .env.example .env.local   # set VITE_GH_OWNER and VITE_GH_APP_REPO
npm run dev
npm test
```

Stack: Vite, React, TypeScript, Tailwind CSS v4, Zustand, Zod, lucide-react.
