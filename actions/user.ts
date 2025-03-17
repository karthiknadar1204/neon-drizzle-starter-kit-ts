'use server'

import { db } from '@/configs/db';
import { users } from '@/configs/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

type UserData = {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
};


export async function createOrUpdateUser(userData: UserData) {
  try {

    const existingUser = await db.query.users.findFirst({
      where: eq(users.clerkId, userData.id),
    });

    if (existingUser) {

      await db
        .update(users)
        .set({
          email: userData.email,
          username: userData.username || null,
          firstName: userData.firstName || null,
          lastName: userData.lastName || null,
          profileImageUrl: userData.imageUrl || null,
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, userData.id));
      
      return { success: true, message: "User updated successfully" };
    } else {

      await db.insert(users).values({
        clerkId: userData.id,
        email: userData.email,
        username: userData.username || null,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        profileImageUrl: userData.imageUrl || null,
      });
      
      return { success: true, message: "User created successfully" };
    }
  } catch (error) {
    console.error("Error creating/updating user:", error);
    return { success: false, message: "Failed to create/update user" };
  }
} 