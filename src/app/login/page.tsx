'use client'

import React, { useState, useId, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useTheme } from '@/components/theme-provider'
import { Moon, Sun } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('dummy@cute.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(searchParams.get('error'))
  const [isLoading, setIsLoading] = useState(false)
  const { theme, setTheme } = useTheme()
  const id = useId(); // For unique form element IDs
  const [dialogOpen, setDialogOpen] = useState(true)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null) // Clear previous errors
    setIsLoading(true) // Start loading state

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      })

      const data = await res.json()

      console.log("[Login Page] Login data:", data)

      if (!res.ok || data.error) {
        throw new Error(data.message || 'Login failed')
      }

      const redirectUrl = searchParams.get('redirect') || '/'
      router.push(redirectUrl)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setIsLoading(false) // End loading state
    }
  }

  // This ensures dialog is always open and prevents it from being closed
  // by clicking outside or pressing escape
  useEffect(() => {
    if (!dialogOpen) {
      setDialogOpen(true);
    }
  }, [dialogOpen]);

  // Enhanced animation variants for the shallow-to-solid emerge effect
  const overlayVariants = {
    hidden: {
      opacity: 0,
      backdropFilter: "blur(0px) brightness(1)",
    },
    visible: {
      opacity: 1,
      backdropFilter: "blur(4px) brightness(1.2)",
      transition: {
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1] // Custom easing for smoother animation
      }
    },
    exit: {
      opacity: 0,
      backdropFilter: "blur(0px) brightness(1)",
      transition: {
        duration: 0.3,
        ease: "easeIn"
      }
    }
  };

  const contentVariants = {
    hidden: {
      opacity: 0.2,
      scale: 0.97,
      y: 20,
      filter: "blur(8px)",
      boxShadow: "0 0 0 rgba(0,0,0,0)",
      backgroundColor: "rgba(255,255,255,0.8)",
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      filter: "blur(0px)",
      boxShadow: "0 10px 50px rgba(0,0,0,0.15)",
      backgroundColor: "rgba(255,255,255,1)",
      transition: {
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
        staggerChildren: 0.1,
        delayChildren: 0.2,
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      filter: "blur(4px)",
      transition: {
        duration: 0.25,
        ease: "easeIn"
      }
    }
  };

  // For dark mode
  const contentVariantsDark = {
    hidden: {
      opacity: 0.2,
      scale: 0.97,
      y: 20,
      filter: "blur(8px)",
      boxShadow: "0 0 0 rgba(0,0,0,0)",
      backgroundColor: "rgba(20,20,20,0.8)",
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      filter: "blur(0px)",
      boxShadow: "0 10px 50px rgba(0,0,0,0.4)",
      backgroundColor: "rgba(20,20,20,1)",
      transition: {
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
        staggerChildren: 0.1,
        delayChildren: 0.2,
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      filter: "blur(4px)",
      transition: {
        duration: 0.25,
        ease: "easeIn"
      }
    }
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 15,
      filter: "blur(4px)"
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-4 rounded-full"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="h-[1.2rem] w-[1.2rem]" /> : <Moon className="h-[1.2rem] w-[1.2rem]" />}
      </Button>

      <AnimatePresence>
        {dialogOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Custom overlay with enhanced animation */}
            <motion.div
              className="fixed inset-0 bg-black/20 dark:bg-black/50 bg-dots-pattern dark:bg-dots-pattern-dark [background-size:4px_4px]"
              variants={overlayVariants}
              onClick={(e) => e.preventDefault()}
            />

            {/* Custom dialog content with enhanced animation */}
            <motion.div
              className="fixed z-50 w-full max-w-md rounded-xl border bg-background p-6 shadow-lg backdrop-blur-[2px] backdrop-saturate-[1.8]"
              variants={theme === 'dark' ? contentVariantsDark : contentVariants}
              style={{
                transformOrigin: 'center center',
              }}
            >
              {/* Logo with animation */}
              <motion.div
                className="flex flex-col items-center gap-2 pt-4"
                variants={itemVariants}
              >
                <motion.div
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border"
                  aria-hidden="true"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    transition: {
                      delay: 0.4,
                      duration: 0.5,
                      ease: [0.22, 1, 0.36, 1]
                    }
                  }}
                >
                  <svg
                    className="stroke-zinc-800 dark:stroke-zinc-100"
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 32 32"
                    aria-hidden="true"
                  >
                    <circle cx="16" cy="16" r="12" fill="none" strokeWidth="8" />
                  </svg>
                </motion.div>
                <motion.div className="text-center" variants={itemVariants}>
                  <h2 className="text-lg font-semibold leading-none tracking-tight">Welcome back</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter your credentials to login to your account.
                  </p>
                </motion.div>
              </motion.div>

              {/* Error alert */}
              {/* {error && (
                <motion.div 
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="mt-4"
                >
                  <Alert variant="destructive">
                    <AlertDescription>
                      {error}
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )} */}

              {/* Form with enhanced animation */}
              <motion.form
                onSubmit={onSubmit}
                className="space-y-5 pt-4"
                variants={itemVariants}
              >
                <motion.div className="space-y-4" variants={itemVariants}>
                  <motion.div className="space-y-2" variants={itemVariants}>
                    <Label htmlFor={`${id}-email`}>Email</Label>
                    <Input
                      id={`${id}-email`}
                      placeholder="hi@yourcompany.com"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </motion.div>
                  <motion.div className="space-y-2" variants={itemVariants}>
                    <Label htmlFor={`${id}-password`}>Password</Label>
                    <Input
                      id={`${id}-password`}
                      placeholder="Enter your password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </motion.div>
                </motion.div>
                <motion.div
                  className="flex justify-between gap-2 items-center"
                  variants={itemVariants}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox id={`${id}-remember`} disabled={isLoading} />
                    <Label htmlFor={`${id}-remember`} className="font-normal text-sm text-muted-foreground">
                      Remember me
                    </Label>
                  </div>
                  <a className="text-sm underline hover:no-underline text-muted-foreground" href="#">
                    Forgot password?
                  </a>
                </motion.div>
                <motion.div variants={itemVariants}>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign in'}
                  </Button>
                </motion.div>
              </motion.form>

              <motion.div
                className="flex items-center gap-3 py-2 mt-2 before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"
                variants={itemVariants}
              >
                <span className="text-xs text-muted-foreground">Or</span>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Button variant="outline" className="w-full" disabled={isLoading}>
                  Login with Google
                </Button>
              </motion.div>

              {/* Close button */}
              <motion.button
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
                onClick={(e) => e.preventDefault()}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 0.7,
                  transition: { delay: 0.8, duration: 0.3 }
                }}
                whileHover={{ opacity: 1 }}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                  <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
                </svg>
                <span className="sr-only">Close</span>
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
} 