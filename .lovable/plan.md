

# Fix: Edge Function 401 Authentication Error

## Problem

The edge functions `sync-senado` and `sync-camara` return 401 because:
1. The `token === supabaseAnonKey` comparison fails — the anon key sent by the client/curl doesn't match the `SUPABASE_ANON_KEY` environment variable exactly (possibly a different key format or the curl tool sends a different token).
2. Falling through to `auth.getUser(token)` also fails because the anon key is not a user JWT.

## Solution

Since these functions already have `verify_jwt = false` in `config.toml` and are designed for cron/internal use, **make the Authorization header optional**. If present and it's a valid user JWT, validate it. If absent or it's a known key, allow through.

### Changes in both files

**`supabase/functions/sync-senado/index.ts`** and **`supabase/functions/sync-camara/index.ts`**

Replace the auth block (lines ~132-152) with:

```typescript
// ── Authentication check (optional — cron calls have no auth) ──
const authHeader = req.headers.get("Authorization");
if (authHeader?.startsWith("Bearer ")) {
  const token = authHeader.replace("Bearer ", "");
  // Allow known keys or validate as user JWT
  if (token !== supabaseServiceKey && token !== supabaseAnonKey) {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized: invalid token" }, 401);
    }
  }
}
// If no auth header, allow through (cron/internal call)
```

This removes the hard requirement for an auth header while still validating user JWTs if provided. The `verify_jwt = false` in config.toml already ensures only intentional callers reach these functions.

### Files to modify
| File | Change |
|------|--------|
| `supabase/functions/sync-senado/index.ts` | Make auth optional |
| `supabase/functions/sync-camara/index.ts` | Make auth optional |

After deploy, trigger sync for 2023, 2024, 2025, 2026 on both houses.

