# Nice2Meetya! — Deployment Guide

The stack: **React + Vite → GitHub → Vercel** with **Supabase** for realtime sync.

---

## Step 1 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Name it `nice2meetya`, choose a region close to Lagos (Europe West is fine)
3. Wait for it to provision (~1 min)
4. Go to **SQL Editor** → paste the entire contents of `supabase-schema.sql` → click **Run**
5. Then run the seed query at the bottom of the file to create your first event:
   ```sql
   insert into events (edition, active, guest_code, host_code, table_count)
   values ('Edition VI', true, 'N2MY', 'HOST24', 6);
   ```
6. Go to **Project Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key

---

## Step 2 — Set up the GitHub repo

1. Go to [github.com](https://github.com) → New repository
2. Name it `nice2meetya`, set to **Public** (Vercel free tier works better with public repos)
3. On your computer, open Terminal and run:

```bash
# Navigate to wherever you keep your projects
cd ~/Documents   # or wherever you keep code

# Clone the repo you just created
git clone https://github.com/YOUR-USERNAME/nice2meetya.git
cd nice2meetya
```

4. Copy all the files from this folder into that cloned folder
5. Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

6. Open `.env` and fill in your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

7. Push to GitHub:
```bash
git add .
git commit -m "initial commit"
git push origin main
```

---

## Step 3 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → Add New Project
2. Import your `nice2meetya` GitHub repo
3. Framework preset: **Vite** (Vercel detects this automatically)
4. Before deploying, click **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` → your anon key
5. Click **Deploy**
6. Your site is live at `nice2meetya.vercel.app` (or set a custom domain)

---

## Every event night — what to do

### Before guests arrive:
1. Go to your Supabase SQL Editor and run:
```sql
-- Deactivate last event
update events set active = false;

-- Create tonight's event (change the code each time)
insert into events (edition, active, guest_code, host_code, table_count)
values ('Edition VII', true, 'YOUR4CODE', 'HOSTPASS', 6);
```
2. Open the site → Host Panel → add your guest list → assign tables

### On the night:
- Open **Host Panel** on your phone/tablet — use it as your remote control
- Guests go to the site URL and enter their access code
- You push phases and prompts; they see it immediately on their phones
- When you call a rotation, tap the new round in Phase Control — guest table cards update automatically

---

## Local development (optional)

```bash
cd nice2meetya
npm install
npm run dev
```

Site runs at `http://localhost:5173`

---

## Changing access codes per event

Either do it via SQL (above) or log into the Host Panel → Settings tab → update Guest Code → Save.

---

## Custom domain (optional)

In Vercel → your project → Settings → Domains → add `nice2meetya.com` or whatever you have.
