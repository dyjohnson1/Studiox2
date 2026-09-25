# Xavier Haughton Studios - Local CMS Plan

## What We're Building

A localhost admin system that lets you manage your portfolio without touching code.

---

## Architecture

```
xavier-site/
├── public/              (your current HTML/CSS/JS - unchanged)
├── admin/               (new admin UI)
│   ├── login.html
│   ├── dashboard.html
│   ├── series-form.html
│   ├── work-form.html
│   └── access-control.html
├── server/              (new backend)
│   ├── server.js        (Express API)
│   ├── auth.js          (login logic)
│   └── routes/
│       ├── series.js
│       ├── works.js
│       └── users.js
├── data/                (JSON storage - auto-created)
│   ├── series.json
│   ├── works.json
│   └── users.json
├── uploads/             (images - auto-created)
│   └── works/
└── package.json         (dependencies)
```

---

## Backend (Node.js + Express)

### What it does:
- Serves your public site at `http://localhost:3000`
- Serves admin interface at `http://localhost:3000/admin`
- Provides API endpoints for CRUD operations
- Handles image uploads with processing (resize, crop)
- Protects admin routes with session-based auth

### Key endpoints:
- `POST /api/login` - authenticate admin
- `GET /api/series` - list all series
- `POST /api/series` - create new series
- `POST /api/works` - add work to series
- `PUT /api/works/:id` - edit existing work
- `DELETE /api/works/:id` - remove work
- `POST /api/upload` - handle image uploads

### Data storage (JSON):

```json
// data/series.json
{
  "series": [
    {
      "id": "uuid",
      "title": "After the Light",
      "description": "...",
      "year": 2026,
      "heroImage": "/uploads/works/hero-123.jpg",
      "order": 1
    }
  ]
}

// data/works.json
{
  "works": [
    {
      "id": "uuid",
      "seriesId": "uuid-or-null",
      "title": "Untitled (After the Light)",
      "materials": ["oil", "mixed media", "linen"],
      "images": [
        {
          "path": "/uploads/works/work-456-1.jpg",
          "order": 1,
          "isHero": true
        }
      ],
      "year": 2026,
      "dimensions": {"height": 48, "width": 60, "depth": null},
      "description": "...",
      "collectionStatus": "in private collection",
      "mediumType": "painting",
      "order": 1
    }
  ]
}
```

---

## Admin UI (Simple HTML Forms)

### 1. Login Page (`/admin/login.html`)
- Username/password fields
- Creates session on success
- Redirects to dashboard

### 2. Dashboard (`/admin/dashboard.html`)
- Two tabs: "View Live Site" | "Admin"
- Admin tab shows:
  - Upload Series
  - Upload Work
  - Access Controls

### 3. Series Form (`/admin/series-form.html`)
- Title (text)
- Description (textarea with character count)
- Year (dropdown 1950-2026)
- Hero image upload
- Save button

### 4. Work Form (`/admin/work-form.html`)
- **Series selection** (dropdown of existing series + "Create New" + "No Series/Solo Work")
- Title (text)
- Materials (multi-select checkboxes: oil, watercolor, metals, glass, charcoal, mixed media, etc.)
- **Image upload** (max 3, drag to reorder, select hero)
  - Upload preview
  - Crop tool (aspect ratio selector)
  - Quality validation
  - Drag handles to reorder
  - Radio button for hero selection
- Year (dropdown)
- Dimensions (3 inputs: H/W/D - hides depth if empty)
- Description (textarea with 500 char limit + live count)
- Collection status (radio buttons):
  - In private collection
  - In exhibition
  - Available for purchase
- Medium type (radio buttons):
  - Painting
  - Sculpture
  - Works on paper
- Save button

### 5. Access Control (`/admin/access-control.html`)
- List current admin users
- Add new user (username/password)
- Remove user
- Change password

---

## Public Site Integration

Your existing pages will fetch data from the backend instead of hardcoded HTML.

### Example - Archive page:
```javascript
// Fetches from /api/series and /api/works
// Renders dynamically based on JSON data
fetch('/api/series')
  .then(r => r.json())
  .then(series => renderArchive(series));
```

**Your current HTML stays mostly the same** - we just swap hardcoded content for dynamic data loading.

---

## Image Processing

Using Sharp library:
- Auto-resize to web-optimized dimensions
- Generate thumbnails
- Apply crops from admin UI
- Compress to reasonable file sizes while maintaining quality
- Support formats: JPG, PNG, WebP

---

## Security (Local Only)

- Simple password hashing (bcrypt)
- Session-based auth (no tokens needed)
- Middleware to protect `/admin` routes
- CSRF protection for forms
- File upload validation (type, size)

---

## Workflow Example

### Adding a new work:
1. Go to `localhost:3000/admin` → login
2. Click "Upload Work"
3. Select existing series or create new
4. Fill form (title, materials, etc.)
5. Upload 1-3 images
6. Crop each image to desired frame
7. Drag to reorder, select hero
8. Click Save
9. Work appears on public site immediately at `localhost:3000/archive.html`

---

## What You'll Need Installed

- Node.js (you'll need to install this - it's free)
- That's it

---

## Running It

```bash
npm install           # one-time setup
npm start            # starts server
```

Then visit:
- Public site: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`

---

## Backup Strategy

Everything in 3 folders:
- `data/` - all your content (JSON)
- `uploads/` - all images
- `admin/` - the admin UI

Just copy these folders = full backup. Can commit to Git for version history.

---

## Timeline

- Backend setup: 30 min
- Admin UI (series + work forms): 45 min
- Image upload/crop: 30 min
- Public site integration: 30 min
- Testing: 15 min

**Total: ~2.5 hours**

---

## Benefits

✅ 100% free  
✅ All local, no external services  
✅ Works offline  
✅ Full control  
✅ Can still push to GitHub later if needed  

⚠️ Only accessible from your computer  
⚠️ Manual backups (but just copy the folder)
