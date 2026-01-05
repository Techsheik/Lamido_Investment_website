# Server Endpoint Setup Guide

This folder contains secure server-side endpoints for sensitive admin operations that require the Supabase service role key.

## Why Server-Side?

Admin operations like creating users and investments bypass row-level security (RLS) restrictions. These must be handled server-side using the **service role key**, which should NEVER be exposed in the frontend/browser.

## Files

- `create-admin-investor.js` — Endpoint to create a new investor (user + profile + investment in one call)

## Environment Setup

1. **Get your Supabase credentials:**
   - Go to your [Supabase Dashboard](https://app.supabase.com)
   - Select your project
   - Go to **Settings → API**
   - Copy:
     - `Project URL` (SUPABASE_URL)
     - `Service Role Key` (SUPABASE_SERVICE_ROLE_KEY) — **Keep this secret!**

2. **Set environment variables** on your server:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

## Deployment Options

### Option 1: Vercel Serverless Functions (Recommended for Next.js)

If using Next.js:

1. Create `pages/api/admin/create-investor.js` with the content from `create-admin-investor.js`
2. Add environment variables to Vercel:
   - Go to **Project Settings → Environment Variables**
   - Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy: `vercel deploy`

### Option 2: Express.js Server

If using Express:

```javascript
import express from "express";
import adminInvestorHandler from "./server/create-admin-investor.js";

const app = express();
app.use(express.json());

app.post("/api/admin/create-investor", adminInvestorHandler);

app.listen(3000, () => console.log("Server running on port 3000"));
```

Then call from frontend:
```typescript
const response = await fetch("http://localhost:3000/api/admin/create-investor", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ /* investor data */ })
});
```

### Option 3: Other Serverless (AWS Lambda, Netlify, Google Cloud Functions)

Adapt the `create-admin-investor.js` to your serverless runtime. Key points:
- Must export a handler function that receives `req` and `res`
- Set the environment variables in your platform's console
- Handle CORS if calling from a different domain

## Frontend Integration

The `CreateEditInvestorDialog.tsx` now calls `/api/admin/create-investor` instead of doing the insert client-side.

**No frontend changes needed** — it already uses the correct endpoint path `/api/admin/create-investor`.

## Testing Locally

1. Copy your service role key to `.env.local`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

2. Start your server:
   ```bash
   npm run dev
   ```

3. Test the endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/admin/create-investor \
     -H "Content-Type: application/json" \
     -d '{
       "name": "John Doe",
       "email": "john@example.com",
       "amount": 5000,
       "roi_percentage": 12,
       "plan_id": "plan-uuid-here",
       "start_date": "2026-01-04"
     }'
   ```

## Security Notes

⚠️ **Never commit the service role key to Git!**

- Use `.gitignore` to exclude `.env.local` and `.env.*.local` files
- Always use environment variables on your server
- Use your Git repository's secrets manager (GitHub Secrets, GitLab CI/CD Variables, etc.) for production deployments

## Troubleshooting

**Error: "new row violates row-level security policy"**
- The frontend is still trying to insert directly. Ensure the dialog calls `/api/admin/create-investor` and not `supabase.from("investments").insert()` directly.

**Error: "Missing environment variables"**
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set on your server. Print them in the console to debug (but never log the key value in production!).

**Error: "Failed to create user: User already exists"**
- The email is already registered. Either use a different email or skip creating the auth user if it already exists.

## Next Steps

1. Set up your server runtime (Vercel, Express, etc.)
2. Deploy `create-admin-investor.js` or adapt it to your framework
3. Set the environment variables
4. Test the investor creation flow in the admin panel
