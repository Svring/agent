import React from 'react';
import { ProjectCreateForm } from '@/components/projects-display/projects-create';
import { getCurrentUser } from '@/db/actions/users-actions';
import { redirect } from 'next/navigation';

export default async function CreateProjectPage() {
    // Optional: Add authentication check if needed
    const user = await getCurrentUser();
    if (!user) {
        redirect('/login');
    }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-white to-gray-100 dark:from-gray-950 dark:to-black p-4">
      <ProjectCreateForm />
    </div>
  );
}
