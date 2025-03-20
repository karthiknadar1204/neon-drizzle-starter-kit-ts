'use server'

import { db } from '@/configs/db';
import { documents, users, pdfPages } from '@/configs/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import fs from 'fs/promises';
import path from 'path';
import { storage } from '@/configs/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

type DocumentData = {
  userId: string; 
  title: string;
  fileName: string;
  fileUrl: string;
  fileKey: string;
  fileSize: number;
};

// Main function to save document and process pages in batches
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
    
    // Return early with success status
    revalidatePath('/chat-with-pdf');
    
    // Start processing in a non-blocking way
    (async () => {
      try {
        console.log("Document URL:", documentData.fileUrl);
        
        // Download the PDF
        const response = await fetch(documentData.fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }
        
        const pdfBuffer = Buffer.from(await response.arrayBuffer());
        
        // Create temporary directory and data directory
        const tempDir = path.join(process.cwd(), 'temp');
        const dataDir = path.join(process.cwd(), 'data');
        
        await fs.mkdir(tempDir, { recursive: true });
        await fs.mkdir(dataDir, { recursive: true });
        
        // Save PDF to temp file for PDFLoader
        const tempFilePath = path.join(tempDir, `${documentId}.pdf`);
        await fs.writeFile(tempFilePath, pdfBuffer);
        
        // Use PDFLoader to extract text content
        const loader = new PDFLoader(tempFilePath, {
          parsedItemSeparator: "",
        });
        const docs = await loader.load();
        const pageCount = docs.length;
        
        console.log(`Document ID: ${documentId}, Page Count: ${pageCount}`);
        
        // Create text splitter for chunking
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
          separators: ["\n\n", "\n", ". ", " ", ""]
        });
        
        // Extract page-wise content with chunks
        const pagesContent = await Promise.all(docs.map(async (doc, index) => {
          // Create chunks for this page's content
          const chunks = await textSplitter.createDocuments([doc.pageContent]);
          const chunkTexts = chunks.map(chunk => chunk.pageContent);
          
          return {
            pageNumber: index + 1,
            content: doc.pageContent,
            chunks: chunkTexts,
            metadata: doc.metadata
          };
        }));
        
        // Combine page content (without images)
        const combinedData = {
          documentId,
          pageCount,
          pages: pagesContent.map(page => ({
            ...page,
            image: null // No image references
          }))
        };
        
        // Save combined data to a JSON file
        const jsonFilePath = path.join(dataDir, `${documentId}.json`);
        await fs.writeFile(
          jsonFilePath,
          JSON.stringify(combinedData, null, 2)
        );
        
        console.log(`Saved content to ${jsonFilePath}`);
        
        // Clean up temp file
        await fs.unlink(tempFilePath);
        
        // Update document's updatedAt timestamp
        await db.update(documents)
          .set({ 
            updatedAt: new Date()
          })
          .where(eq(documents.id, documentId));
          
        console.log(`Document ${documentId} processing completed successfully`);
        
      } catch (error) {
        console.error("=== ERROR PROCESSING PDF ===", error);
        
        // Just update the timestamp to indicate something happened
        await db.update(documents)
          .set({ 
            updatedAt: new Date()
          })
          .where(eq(documents.id, documentId));
      }
    })();
    
    // Return success immediately
    return { 
      success: true, 
      message: "Document saved successfully. Processing started in background.",
      documentId
    };
    
  } catch (error) {
    console.error("=== ERROR SAVING DOCUMENT ===", error);
    return { success: false, message: "Failed to save document" };
  }
}

// Function to save PDF page images to the database
// Kept for compatibility but will not be used in the current flow
// async function savePdfPageImages(documentId: number, imageReferences: Array<{
//   pageNumber: number,
//   firebaseUrl: string,
//   imageKey: string,
//   metadata?: any
// }>) {
//   // Format the images array for storage
//   const imagesData = imageReferences.map(img => ({
//     pageNumber: img.pageNumber,
//     imageUrl: img.firebaseUrl,
//     imageKey: img.imageKey || `documents/${documentId}/page_${img.pageNumber}.png`,
//     metadata: img.metadata || null,
//     uploadedAt: new Date()
//   }));


//   const existingRecord = await db.query.pdfPages.findFirst({
//     where: eq(pdfPages.documentId, documentId)
//   });

//   if (existingRecord) {

//     await db.update(pdfPages)
//       .set({ 
//         images: imagesData,
//         updatedAt: new Date()
//       })
//       .where(eq(pdfPages.documentId, documentId));
//   } else {

//     await db.insert(pdfPages)
//       .values({
//         documentId,
//         images: imagesData,
//         uploadedAt: new Date(),
//         updatedAt: new Date()
//       });
//   }
  
//   return imagesData;
// }