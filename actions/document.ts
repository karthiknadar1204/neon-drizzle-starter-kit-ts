'use server'

import { db } from '@/configs/db';
import { documents, users, pdfImages } from '@/configs/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import fs from 'fs/promises';
import path from 'path';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { storage } from '@/configs/firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

type DocumentData = {
  userId: string; 
  title: string;
  fileName: string;
  fileUrl: string;
  fileKey: string;
  fileSize: number;
};

// Helper function to upload an image to Firebase Storage with retry logic
async function uploadImageToFirebase(imageBuffer: Buffer, documentId: number, pageNumber: number, maxRetries = 3): Promise<string> {
  const imageName = `page_${pageNumber}.png`;
  const storageRef = ref(storage, `documents/${documentId}/${imageName}`);
  
  // Convert Buffer to Blob for Firebase
  const blob = new Blob([imageBuffer], { type: 'image/png' });
  
  // Retry logic
  let attempt = 0;
  let lastError;
  
  while (attempt < maxRetries) {
    try {
      // Upload the image
      await uploadBytes(storageRef, blob);
      
      // Get the download URL
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (error) {
      lastError = error;
      attempt++;
      console.log(`Upload attempt ${attempt} failed for page ${pageNumber}, retrying...`);
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** attempt)));
    }
  }
  
  console.error(`All ${maxRetries} upload attempts failed for page ${pageNumber}`);
  throw lastError;
}

// Process and upload images for a single PDF page
async function processPage(pdfBuffer: Buffer, documentId: number, pageNumber: number, imagesDir: string): Promise<{pageNumber: number, firebaseUrl: string}> {
  try {
    // Convert single page with minimized settings
    const pdf2img = await import("pdf-img-convert");
    const imageOptions = {
      width: 1000,         // Further reduced for speed
      height: 1000,        // Further reduced for speed
      scale: 1.2,          // Reduced scale for faster processing
      base64: false, 
      density: 150,        // Lower density for faster processing
      outputFormat: "png",
      page: pageNumber     // Process only this specific page
    };
    
    const [imageBuffer] = await pdf2img.convert(pdfBuffer, imageOptions);
    
    // Save locally
    const imagePath = path.join(imagesDir, `page_${pageNumber}.png`);
    await fs.writeFile(imagePath, imageBuffer);
    
    // Upload to Firebase with retries
    const firebaseUrl = await uploadImageToFirebase(imageBuffer, documentId, pageNumber);
    
    // Save to database
    await db.insert(pdfImages).values({
      documentId: documentId,
      pageNumber: pageNumber,
      imageUrl: firebaseUrl,
      imageKey: `documents/${documentId}/page_${pageNumber}.png`,
      uploadedAt: new Date(),
      metadata: {}
    });
    
    return {
      pageNumber,
      firebaseUrl
    };
  } catch (error) {
    console.error(`Error processing page ${pageNumber}:`, error);
    throw error;
  }
}

// Main function to save document and initiate background processing
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
        // Download the PDF
        const response = await fetch(documentData.fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }
        
        const pdfBuffer = Buffer.from(await response.arrayBuffer());
        
        // Create necessary directories
        const tempDir = path.join(process.cwd(), 'temp');
        const imagesDir = path.join(process.cwd(), 'data', 'images', documentId.toString());
        const dataDir = path.join(process.cwd(), 'data');
        
        await Promise.all([
          fs.mkdir(tempDir, { recursive: true }),
          fs.mkdir(imagesDir, { recursive: true }),
          fs.mkdir(dataDir, { recursive: true })
        ]);
        
        // Save PDF to temp file for PDFLoader
        const tempFilePath = path.join(tempDir, `${documentId}.pdf`);
        await fs.writeFile(tempFilePath, pdfBuffer);
        
        // Extract text content with PDFLoader
        const loader = new PDFLoader(tempFilePath, {
          parsedItemSeparator: "",
        });
        
        const docs = await loader.load();
        const pageCount = docs.length;
        
        // Process pages in smaller batches with limited concurrency
        const batchSize = 2; // Process only 2 pages at a time
        const imageReferences = [];
        
        for (let i = 0; i < pageCount; i += batchSize) {
          const batch = Array.from({ length: Math.min(batchSize, pageCount - i) }, (_, idx) => i + idx + 1);
          
          // Process this batch of pages concurrently
          const batchResults = await Promise.allSettled(
            batch.map(pageNumber => processPage(pdfBuffer, documentId, pageNumber, imagesDir))
          );
          
          // Add successful results to our references array
          batchResults.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
              imageReferences.push(result.value);
            } else {
              console.error(`Failed to process page ${batch[idx]}:`, result.reason);
            }
          });
          
          // Add a delay between batches to prevent timeouts
          if (i + batchSize < pageCount) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // Create page-wise content references
        const pagesContent = docs.map((doc, index) => {
          const pageNumber = index + 1;
          const imageRef = imageReferences.find(img => img.pageNumber === pageNumber);
          
          return {
            pageNumber,
            content: doc.pageContent,
            metadata: doc.metadata,
            firebaseUrl: imageRef?.firebaseUrl || null
          };
        });
        
        // Save as JSON
        const jsonFilePath = path.join(dataDir, `${documentId}.json`);
        await fs.writeFile(
          jsonFilePath, 
          JSON.stringify({
            documentId,
            pageCount,
            pages: pagesContent,
            processedDate: new Date().toISOString()
          }, null, 2)
        );
        
        // Save just the Firebase image URLs to a separate JSON file
        const firebaseImagesFilePath = path.join(dataDir, `${documentId}_firebase_images.json`);
        await fs.writeFile(
          firebaseImagesFilePath,
          JSON.stringify({
            documentId,
            pageCount,
            images: imageReferences.map(img => ({
              pageNumber: img.pageNumber,
              firebaseUrl: img.firebaseUrl
            }))
          }, null, 2)
        );
        
        // Clean up temp file
        await fs.unlink(tempFilePath);
        
        // Update document's updatedAt timestamp to indicate processing is complete
        await db.update(documents)
          .set({ 
            updatedAt: new Date()
          })
          .where(eq(documents.id, documentId));
          
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