

# Add Profile Link Back to Navigation Menu

## What changed
The Profile page still exists and is accessible at `/profile`, but the link was removed from the navigation menu at some point, making it unreachable without typing the URL manually.

## Fix
Add a Profile menu item to the sidebar and mobile menu in `src/components/AppLayout.tsx`.

## Technical details

**File: `src/components/AppLayout.tsx`**
- Import the `UserCircle` icon from `lucide-react`
- Add a new entry to the `menuLinks` array:
  ```
  { name: 'Profile', path: '/profile', icon: <UserCircle /> }
  ```

This is a one-line addition (plus import update) that restores access to the Profile page where notification settings live.

