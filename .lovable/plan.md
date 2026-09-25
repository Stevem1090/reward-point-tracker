# Add Sign Out to the Mobile Burger Navigation

## Current state (verified)
- `AuthContext` already exposes a working `signOut()` (`src/contexts/AuthContext.tsx`).
- The desktop `NavBar` already has a sign-out button using it (`src/components/NavBar.tsx`).
- The mobile burger menu (`Sheet` in `src/components/AppLayout.tsx`) lists the nav links but has no sign-out option.

## Change
In `src/components/AppLayout.tsx`, inside the burger sheet's nav, below the menu links:

1. Add a "Sign out" button styled like the existing links (icon + label, 44px+ touch target), using a `LogOut` icon from lucide-react.
2. On tap: call `signOut()` from `useAuth()`, close the sheet, and navigate to the login page (`/`).
3. No new auth code, no profile changes — purely reusing the existing sign-out.

The desktop sidebar is left unchanged; the existing desktop sign-out in the NavBar stays as is.

## Verification
- Typecheck passes.
- Playwright: open the burger menu signed in, confirm the Sign out button appears and returns to the login page.
