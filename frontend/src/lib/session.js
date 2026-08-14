import { useEffect, useState } from "react";

const KEY = "araxyss.session.v1";

export function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null");
  } catch (e) {
    return null;
  }
}

export function useSession() {
  const [session, setSession] = useState(() => readSession());
  const write = (s) => {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
    setSession(s);
  };
  useEffect(() => {
    const on = () => setSession(readSession());
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);
  return [session, write];
}

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
