'use server'

import { cookies, headers } from 'next/headers'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import config from '@/payload.config'
import { User } from '@/payload-types'

/**
 * Get the currently authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const headersList = await headers()
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    
    const { user } = await payload.auth({ headers: headersList })
    return user as User
  } catch (error) {
    console.error('Error fetching current user:', error)
    return null
  }
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: number, 
  data: Partial<User>
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const headersList = await headers()
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    
    // Authenticate to ensure we have permission to update
    const { user } = await payload.auth({ headers: headersList })
    
    if (!user || (user.id !== userId && user.role !== 'admin')) {
      return {
        success: false,
        error: 'Not authorized to update this user'
      }
    }
    
    // Update the user
    const updatedUser = await payload.update({
      collection: 'users',
      id: userId,
      data,
    })
    
    if (!updatedUser) {
      return {
        success: false,
        error: 'Failed to update user'
      }
    }
    
    // Revalidate to refresh content
    revalidatePath('/')
    
    return {
      success: true,
      message: 'User settings updated successfully'
    }
  } catch (error) {
    console.error('Error updating user settings:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }
  }
}

/**
 * Logout the current user
 */
export async function logoutUser(): Promise<{ success: boolean; error?: string }> {
  try {
    const payloadConfig = await config
    const payload = await getPayload({ config: payloadConfig })
    
    // Call the REST API endpoint to logout instead of directly using payload.logout()
    // This is needed because Payload doesn't expose logout() in the node API
    const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })
    
    if (!res.ok) {
      throw new Error('Failed to logout')
    }
    
    // Revalidate pages that depend on auth state
    revalidatePath('/', 'layout')
    
    return { success: true }
  } catch (error) {
    console.error('Error logging out user:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    }
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return !!user
}

/**
 * Redirect to login if not authenticated
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }
  
  return user
}
