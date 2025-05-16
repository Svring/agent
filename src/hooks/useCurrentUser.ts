import { useState, useEffect } from 'react';
import { User } from '@/payload-types';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchMe = async () => {
      try {
        setAuthLoading(true);
        const response = await fetch('/api/users/me');
        if (!response.ok) {
          if (response.status === 401) {
            toast.error("Authentication required. Redirecting to login...");
            // Ensure window is defined for client-side routing
            if (typeof window !== 'undefined') {
              router.push('/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
            }
            setCurrentUser(null);
          } else {
            throw new Error(`Failed to fetch user: ${response.status} ${response.statusText}`);
          }
        } else {
          const userData: { user: User | null } = await response.json();
          if (userData.user) {
            setCurrentUser(userData.user);
            console.log("[useCurrentUser] Current user ID:", userData.user.id);
          } else {
            toast.error("No active user session. Redirecting to login...");
             if (typeof window !== 'undefined') {
              router.push('/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search));
            }
            setCurrentUser(null);
          }
        }
      } catch (error) {
        console.error("[useCurrentUser] Error fetching current user:", error);
        toast.error(`Error fetching user: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };
    fetchMe();
  }, [router]);

  return { currentUser, authLoading };
} 