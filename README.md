# Xavier Haughton Studios

Static portfolio site with a local content management system (CMS).

## Running the CMS

Requires [Node.js](https://nodejs.org) (v18+).

```bash
npm install   # one-time setup
npm start     # starts the server on http://localhost:3000
```

Then open:

- Public site: http://localhost:3000
- Admin: http://localhost:3000/admin

> If port 3000 is already in use (another dev server, etc.), start on a
> different port: `PORT=4000 npm start`.

On first run, a default admin account is created and printed in the terminal:

```
username: admin
password: changeme
```

Log in, then go to **Access Control** to change the password (or add your own user
and remove the default one).

## How it works

- Content is stored as JSON in `data/` (`series.json`, `works.json`, `users.json`).
- Uploaded images are processed with Sharp and stored in `uploads/works/`.
- The public `archive.html` loads content from the API and falls back to its
  built-in placeholder content when the server isn't running.

## Backup

Copy these folders for a full backup of your content:

- `data/` — all series, works, and users
- `uploads/` — all images

## Structure

```
admin/    Admin UI (login, dashboard, forms, access control)
server/   Express backend (server.js, auth.js, routes/)
data/     JSON storage (auto-created)
uploads/  Images (auto-created)
```

Configure the port with the `PORT` environment variable and the session secret
with `SESSION_SECRET` (a random one is generated per run if unset).
