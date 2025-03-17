'use server'

import { db } from '@/configs/db';
import { documents, users } from '@/configs/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

type DocumentData = {
  userId: string; 
  title: string;
  fileName: string;
  fileUrl: string;
  fileKey: string;
  fileSize: number;
};

export async function saveDocument(documentData: DocumentData) {
  try {

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, documentData.userId),
    });

    if (!user) {
      return { success: false, message: "User not found" };
    }


    const result = await db.insert(documents).values({
      userId: user.id,
      title: documentData.title,
      fileName: documentData.fileName,
      fileUrl: documentData.fileUrl,
      fileKey: documentData.fileKey,
      fileSize: documentData.fileSize,
    });
    
    revalidatePath('/chat-with-pdf');
    return { 
      success: true, 
      message: "Document saved successfully",
      documentId: result[0]?.id
    };
  } catch (error) {
    console.error("Error saving document:", error);
    return { success: false, message: "Failed to save document" };
  }
} 