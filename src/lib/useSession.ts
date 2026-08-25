import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/** Whether a user is currently signed in — used by public pages to swap "Sign in" for "Go to app". */
export function useSession() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return signedIn;
}
