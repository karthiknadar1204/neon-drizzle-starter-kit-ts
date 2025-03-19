'use server'

import { db } from '@/configs/db';
import { documents, users } from '@/configs/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { pdfProcessingQueue } from '@/workers/pdf-processor.worker';

type DocumentData = {
  userId: string; 
  title: string;
  fileName: string;
  fileUrl: string;
  fileKey: string;
  fileSize: number;
};

// Main function to save document and queue processing
export async function saveDocument(documentData: DocumentData) {
  console.log("=== DOCUMENT SAVE PROCESS STARTED ===");
  
  try {
    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, documentData.userId),
    });

    if (!user) {
      return { success: false, message: "User not found" };
    }

    // Insert document and get ID
    const result = await db.insert(documents)
      .values({
        userId: user.id,
        title: documentData.title,
        fileName: documentData.fileName,
        fileUrl: documentData.fileUrl,
        fileKey: documentData.fileKey,
        fileSize: documentData.fileSize,
      })
      .returning({ id: documents.id });
    
    const documentId = result[0]?.id;
    
    if (!documentId) {
      return { success: false, message: "Failed to get document ID" };
    }
    
    // Revalidate path
    revalidatePath('/chat-with-pdf');
    
    // Add document processing to the queue
    await pdfProcessingQueue.add('processPdf', {
      documentId,
      fileUrl: documentData.fileUrl,
      fileName: documentData.fileName
    });
    
    console.log(`Document ${documentId} added to processing queue`);
    
    // Return success immediately
    return { 
      success: true, 
      message: "Document saved successfully. Processing queued in background.",
      documentId
    };
    
  } catch (error) {
    console.error("=== ERROR SAVING DOCUMENT ===", error);
    return { success: false, message: "Failed to save document" };
  }
}