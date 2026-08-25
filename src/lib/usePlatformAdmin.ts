import { useEffect, useState } from "react";
import { mcp } from "./mcp";
import { useSession } from "./useSession";

/** Whether the signed-in user is a Hub platform admin (superadmin) — null while unknown/signed out. */
export function usePlatformAdmin() {
  const signedIn = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    // `signedIn` is null while useSession() is still checking — stay in the loading state (null)
    // rather than reporting "not an admin" and letting a caller redirect away prematurely.
    if (signedIn === null) return;
    if (signedIn === false) { setIsAdmin(false); return; }
    mcp<{ is_admin: boolean }>("am_i_platform_admin", {})
      .then((r) => setIsAdmin(r.is_admin))
      .catch(() => setIsAdmin(false));
  }, [signedIn]);

  return isAdmin;
}
