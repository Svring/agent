import { getPayload } from 'payload';
import configPromise from '@payload-config'; 
import { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';

/**
 * Retrieves the authenticated user's ID from the request headers using Payload CMS auth.
 * This function can be used in Next.js API Routes or Server Actions.
 * @param requestHeaders The Headers object from NextRequest or next/headers().
 * @returns The user's ID as a string if authenticated, otherwise null.
 */
export async function getAuthenticatedUserId(
  requestHeaders: Headers | ReadonlyHeaders
): Promise<string | null> {
  try {
    const resolvedConfig = await configPromise;
    // console.log("[Auth Utils] Using resolved Payload config. Attempting to get Payload instance.");
    const payload = await getPayload({ config: resolvedConfig });
    // console.log("[Auth Utils] Payload instance obtained. Calling payload.auth(). Relevant Headers (cookie subset):");
    // const cookieHeader = requestHeaders.get('cookie');
    // console.log(cookieHeader ? cookieHeader.substring(0, 100) + '...' : 'No cookie header');

    const { user } = await payload.auth({ headers: requestHeaders });
    
    if (user && user.id) {
      // console.log("[Auth Utils] User authenticated by payload.auth():", user.id);
      return String(user.id); // Ensure ID is a string
    }
    // console.log("[Auth Utils] No authenticated user returned by payload.auth(). User object was:", user);
    return null;
  } catch (error) {
    // console.error("[Auth Utils] Error during user authentication (getPayload or payload.auth):", error);
    return null;
  }
} 