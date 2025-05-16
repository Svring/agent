import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { User } from '@/payload-types'; // Assuming User type is correct

interface BrowserStatus {
  initialized: boolean;
  viewport: { width: number; height: number } | null;
  url: string | null; // Though not explicitly set by status endpoint, keeping for potential future use
}

export function useBrowserManager(currentUser: User | null, authLoading: boolean) {
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus>({ 
    initialized: false, 
    viewport: null, 
    url: null 
  });
  const [isBrowserLoading, setIsBrowserLoading] = useState(false);

  const userIdForPlaywright = currentUser?.id?.toString();

  const fetchBrowserStatus = useCallback(async () => {
    if (!userIdForPlaywright || authLoading) return;
    // No need to set isBrowserLoading here as this is often a background check
    try {
      const statusRes = await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getStatus' })
      });
      let initialized = false;
      let viewport = null;
      let currentUrl = null; // Placeholder for URL if status endpoint ever returns it

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.success && statusData.status) {
          initialized = statusData.status.userContextExists;
          viewport = statusData.status.userViewport || null;
          // currentUrl = statusData.status.currentPageUrl || null; // Example if API changes
        }
      }
      setBrowserStatus({ initialized, viewport, url: currentUrl });
    } catch (error) {
      console.error('[useBrowserManager] Error fetching browser status:', error);
      // Avoid toast spam for background checks, consider logging or minimal UI feedback if critical
      setBrowserStatus(prev => ({ ...prev, initialized: false })); // Assume not initialized on error
    }
  }, [userIdForPlaywright, authLoading]);

  const handleBrowserInit = useCallback(async () => {
    if (!userIdForPlaywright || authLoading) {
      toast.error(authLoading ? "Authenticating..." : "User ID not available for browser init.");
      return;
    }
    setIsBrowserLoading(true);
    try {
      // Use current viewport if available, otherwise default
      const width = browserStatus.viewport?.width || 1024;
      const height = browserStatus.viewport?.height || 768;
      
      console.log(`[useBrowserManager] Initializing browser for user ${userIdForPlaywright} with viewport ${width}x${height}`);
      await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init', width, height })
      });
      await fetchBrowserStatus(); // Refresh status after init
      toast.success("Browser initialized for your session.");
    } catch (error) {
      toast.error("Failed to initialize browser.");
      console.error('[useBrowserManager] Error initializing browser:', error);
    } finally {
      setIsBrowserLoading(false);
    }
  }, [userIdForPlaywright, authLoading, fetchBrowserStatus, browserStatus.viewport]);

  const handleBrowserCleanup = useCallback(async () => {
    if (!userIdForPlaywright || authLoading) {
      toast.error(authLoading ? "Authenticating..." : "User ID not available for browser cleanup.");
      return;
    }
    setIsBrowserLoading(true);
    try {
      console.log(`[useBrowserManager] Closing browser context for user ${userIdForPlaywright}`);
      await fetch('/api/playwright', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'closeUserContext' })
      });
      await fetchBrowserStatus(); // Refresh status after cleanup
      toast.info("Browser session closed.");
    } catch (error) {
      toast.error("Failed to close browser session.");
      console.error('[useBrowserManager] Error closing browser session:', error);
    } finally {
      setIsBrowserLoading(false);
    }
  }, [userIdForPlaywright, authLoading, fetchBrowserStatus]);

  useEffect(() => {
    if (userIdForPlaywright && !authLoading && !browserStatus.initialized && !isBrowserLoading) {
      console.log("[useBrowserManager] Attempting initial browser initialization for user:", userIdForPlaywright);
      // Call handleBrowserInit directly instead of fetchBrowserStatus then init
      handleBrowserInit(); 
    }

    // Setup interval for status check regardless of initial state, clear on unmount
    if (userIdForPlaywright && !authLoading) {
      const intervalId = setInterval(fetchBrowserStatus, 5000); // Check every 5 seconds
      return () => clearInterval(intervalId);
    }
  }, [userIdForPlaywright, authLoading, browserStatus.initialized, isBrowserLoading, handleBrowserInit, fetchBrowserStatus]);

  return { 
    browserStatus, 
    isBrowserLoading, 
    handleBrowserInit, 
    handleBrowserCleanup, 
    fetchBrowserStatus // Expose fetch for manual refresh if needed
  };
} 