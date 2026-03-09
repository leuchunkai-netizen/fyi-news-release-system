# Supabase Setup – FYI News Release System

This project uses **Supabase** as the backend (PostgreSQL database + Auth). No separate Node server is required for the prototype. AI-related features (e.g. automatic credibility analysis) are **not** implemented per project requirements.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**, choose organization, name (e.g. `fyi-news-release`), database password, and region.
3. Wait for the project to be ready.

---

## 2. Run the database migration

### Option A: SQL Editor (quickest)

1. In the Supabase Dashboard, open **SQL Editor**.
2. Open `supabase/migrations/20250308000000_initial_schema.sql` in your repo.
3. Copy the entire file contents and paste into the SQL Editor.
4. Click **Run**. All tables, RLS policies, triggers, and seed data will be created.

3. Run the **second migration** (RLS for user interests):  
   Open `supabase/migrations/20250308100000_user_interests_rls.sql`, copy into SQL Editor, and **Run**.

4. **(Recommended)** Run the seed data so signup "interests" match database categories:  
   Open `supabase/seed_data.sql`, copy into SQL Editor, and **Run**.

### Option B: Supabase CLI (for versioned migrations)

1. Install Supabase CLI:  
   `npm install -g supabase`  
   or see [Supabase CLI docs](https://supabase.com/docs/guides/cli).
2. In the project root (where `supabase/migrations` lives), run:  
   `supabase link --project-ref YOUR_PROJECT_REF`  
   (Find **Project ref** in Dashboard → Project Settings → General.)
3. Apply migrations:  
   `supabase db push`
4. Run the seed:  
   `supabase db execute -f supabase/seed_data.sql` (or paste `seed_data.sql` into SQL Editor and Run).

---

## 3. Connect Auth to `public.users` (optional but recommended)

Supabase Auth stores users in `auth.users`. This app also keeps a **profile** in `public.users` (name, role, avatar, etc.).

- **Option 1 – App-only:** On sign-up/sign-in, the frontend calls `upsertUserProfile()` in `src/lib/api/auth.ts` to create/update the row in `public.users` with the same `id` as `auth.users.id`. No DB trigger needed.
- **Option 2 – Trigger:** To keep `public.users` in sync automatically, run this in the SQL Editor:

```sql
-- Create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'free'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, public.users.name),
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

Then in the app you can still call `upsertUserProfile()` to update name/avatar/role after sign-up.

---

## 4. Environment variables

1. In Supabase Dashboard go to **Project Settings → API**.
2. Copy **Project URL** and **anon public** key.
3. In the project root create a `.env` file (use `.env.example` as a template):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

4. Restart the dev server (`npm run dev`) so Vite picks up the new env.

---

## 5. What the backend provides (no AI)

| Area            | Description |
|-----------------|-------------|
| **Auth**        | Sign up, sign in, sign out via Supabase Auth; profile in `public.users`. |
| **Categories**  | List categories; filter articles by category. |
| **Articles**    | CRUD for articles; list published; my articles; optional featured. |
| **Credibility** | `article_credibility_analysis` table exists; you can fill it manually or leave null (no AI). |
| **Expert reviews** | Experts can approve/reject; stored in `expert_reviews` (admin/expert UI uses Supabase). |
| **Comments**    | List and add comments per article. |
| **Bookmarks**   | Add/remove/list bookmarks (premium can be enforced in UI). |
| **Testimonials**| Submit; list approved for guest landing. |
| **Guest landing** | Video section + intro slides (admin-editable). |
| **Expert applications** | Users submit; admin approves (use Dashboard or service role). |

---

## 6. Using the API in the app

- **Client:** Use the Supabase client from `src/lib/supabase.ts` (already used by `src/lib/api/*`).
- **Auth:** Call `signUp`, `signIn`, `signOut`, `getCurrentUserProfile` from `src/lib/api/auth.ts`. After sign-in, get the profile and set it in `UserContext`.
- **Data:** Use the functions in `src/lib/api/` (e.g. `getPublishedArticles`, `getArticleById`, `getCategories`, `submitTestimonial`, `getApprovedTestimonials`, etc.). Replace mock data in pages/contexts with these calls.

Example: fetch published articles and categories on the home page:

```ts
import { getPublishedArticles, getFeaturedArticles } from "@/lib/api";
import { getCategories } from "@/lib/api";

// In component or loader
const [articles, setArticles] = useState([]);
useEffect(() => {
  getPublishedArticles({ limit: 10 }).then(setArticles).catch(console.error);
}, []);
```

---

## 7. Admin / expert actions

RLS policies restrict who can do what. For **admin-only** or **expert-only** actions (e.g. approve expert applications, reject articles, edit any user), you can:

- Use the **Service role** key from a secure backend (e.g. Supabase Edge Function or your own server), or
- Add extra RLS policies that check a custom claim or a column like `public.users.role` (e.g. `role = 'admin'`). Checking `public.users.role` in RLS requires a subquery or helper function that reads from `public.users` by `auth.uid()`.

---

## 8. Troubleshooting

- **"relation does not exist"** – Run the migration (step 2) and ensure you’re connected to the correct project.
- **RLS policy errors** – Ensure the user is signed in where required and that the policy allows the operation (e.g. insert own profile, select published articles).
- **CORS** – Supabase handles CORS for the API; if you use a custom domain, configure it in Project Settings.
- **Email rate limit exceeded** – Supabase limits how many auth emails (signup, reset password) can be sent per hour. Wait an hour or sign in with an existing account. For local dev you can reduce emails by turning off **Confirm email** in Dashboard → Authentication → Providers → Email.

For more, see [Supabase Docs](https://supabase.com/docs).
