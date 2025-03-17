'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { createOrUpdateUser } from '@/actions/user';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthCallback() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [hasProcessed, setHasProcessed] = useState(false);

  useEffect(() => {
    const syncUserWithDatabase = async () => {
      if (isLoaded && user && !hasProcessed) {
        const userData = {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress || '',
          username: user.username || undefined,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          imageUrl: user.imageUrl || undefined,
        };

        await createOrUpdateUser(userData);
        setHasProcessed(true);
        
        // Only redirect to home if we're on the sign-in or sign-up pages
        if (pathname.includes('/sign-in') || pathname.includes('/sign-up')) {
          router.push('/');
        }
      }
    };

    syncUserWithDatabase();
  }, [isLoaded, user, router, pathname, hasProcessed]);

  return null; 
} 