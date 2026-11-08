import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

// One /api/current_user request per page load, shared by every page and the nav.
let cachedUser = null;
let pending = null;

export function fetchCurrentUser() {
  if (!pending) {
    pending = axios.get(`${API_URL}/api/current_user`, { withCredentials: true })
      .then(res => { cachedUser = res.data || null; return cachedUser; })
      .catch(err => { pending = null; throw err; });
  }
  return pending;
}

// Returns the signed-in user, or sends the visitor to the sign-in page.
export function useCurrentUser() {
  const [user, setUser] = useState(cachedUser);
  useEffect(() => {
    let alive = true;
    fetchCurrentUser()
      .then(u => {
        if (!u) { window.location.href = '/'; return; }
        if (alive) setUser(u);
      })
      .catch(() => { window.location.href = '/'; });
    return () => { alive = false; };
  }, []);
  return user;
}
