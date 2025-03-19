'use server'

import { db } from '@/configs/db';
import { documents, users } from '@/configs/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import fs from 'fs/promises';
import path from 'path';
import { storage } from '@/configs/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
        
        // Use PDFLoader to count pages
        const loader = new PDFLoader(tempFilePath);
        const docs = await loader.load();
        const pageCount = docs.length;
        
        console.log(`Document ID: ${documentId}, Page Count: ${pageCount}`);
        
        // Import pdf-img-convert dynamically
        const pdf2img = await import("pdf-img-convert");
        
        // Process in batches of 20 pages
        const batchSize = 20;
        const batches = Math.ceil(pageCount / batchSize);
        
        // Store all image references
        const imageReferences = [];
        
        for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
          const startPage = batchIndex * batchSize + 1;
          const endPage = Math.min((batchIndex + 1) * batchSize, pageCount);
          
          console.log(`Processing batch ${batchIndex + 1}/${batches} (pages ${startPage}-${endPage})`);
          
          // Create array of page numbers for this batch
          const pageNumbers = Array.from(
            { length: endPage - startPage + 1 }, 
            (_, i) => startPage + i
          );
          
          // Convert PDF pages to images
          const images = await pdf2img.convert(tempFilePath, {
            page_numbers: pageNumbers,
            scale: 1.5 // Adjust scale for better quality
          });
          
          // Upload each image to Firebase
          for (let i = 0; i < images.length; i++) {
            const pageNumber = startPage + i;
            
            // Upload to Firebase
            const storageRef = ref(storage, `documents/${documentId}/page_${pageNumber}.png`);
            await uploadBytes(storageRef, images[i]);
            const firebaseUrl = await getDownloadURL(storageRef);
            
            console.log(`Uploaded image for page ${pageNumber} to Firebase: ${firebaseUrl}`);
            
            // Add to image references
            imageReferences.push({
              pageNumber,
              firebaseUrl
            });
          }
        }
        
        // Save image references to a JSON file
        const jsonFilePath = path.join(dataDir, `${documentId}_firebase_images.json`);
        await fs.writeFile(
          jsonFilePath,
          JSON.stringify({
            documentId,
            pageCount,
            images: imageReferences
          }, null, 2)
        );
        
        console.log(`Saved image references to ${jsonFilePath}`);
        
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