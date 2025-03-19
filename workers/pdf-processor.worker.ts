import 'dotenv/config';
// or to specifically load from .env.local:
import { config } from 'dotenv';
config({ path: '.env.local' });

import { Worker, Queue } from 'bullmq';
import { redisConnection } from '@/configs/redis';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import fs from 'fs/promises';
import path from 'path';
import { storage } from '@/configs/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '@/configs/db';
import { documents } from '@/configs/schema';
import { eq } from 'drizzle-orm';
import pLimit from 'p-limit';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

// Create a queue for PDF processing
export const pdfProcessingQueue = new Queue('pdfProcessing', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: 1000,
  },
});

// Create a worker to process the queue
const worker = new Worker(
  'pdfProcessing',
  async (job) => {
    const { documentId, fileUrl } = job.data;
    
    try {
      console.log(`Processing document ${documentId} from ${fileUrl}`);
      
      // Download the PDF
      const response = await fetch(fileUrl);
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
      
      // Update job progress
      await job.updateProgress(10);
      
      // Use PDFLoader to count pages
      const loader = new PDFLoader(tempFilePath);
      const docs = await loader.load();
      const pageCount = docs.length;
      
      console.log(`Document ID: ${documentId}, Page Count: ${pageCount}`);
      await job.updateProgress(15);
      
      // Store all image references
      const imageReferences = [];
      
      // Create a concurrency limiter - process 2 pages at a time
      const limit = pLimit(2);
      
      // Process pages with concurrency limit
      const processPage = async (pageNumber) => {
        try {
          console.log(`Processing page ${pageNumber}/${pageCount}`);
          
          // Load the PDF document
          const pdfDoc = await PDFDocument.load(pdfBuffer);
          
          // Create a new document with just this page
          const singlePageDoc = await PDFDocument.create();
          const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageNumber - 1]);
          singlePageDoc.addPage(copiedPage);
          
          // Save the single page PDF
          const singlePagePdfBytes = await singlePageDoc.save();
          const singlePagePdfPath = path.join(tempDir, `${documentId}_page_${pageNumber}.pdf`);
          await fs.writeFile(singlePagePdfPath, singlePagePdfBytes);
          
          // Convert PDF to PNG using sharp with higher DPI
          const pngBuffer = await sharp(singlePagePdfPath, { density: 300 })
            .toFormat('png')
            .toBuffer();
          
          // Upload to Firebase
          const storageRef = ref(storage, `documents/${documentId}/page_${pageNumber}.png`);
          await uploadBytes(storageRef, pngBuffer);
          const firebaseUrl = await getDownloadURL(storageRef);
          
          console.log(`Uploaded image for page ${pageNumber} to Firebase: ${firebaseUrl}`);
          
          // Clean up single page PDF
          await fs.unlink(singlePagePdfPath);
          
          // Update progress
          const progressPerPage = 80 / pageCount;
          const progress = Math.min(95, 15 + progressPerPage * pageNumber);
          
          await db.update(documents)
            .set({ 
              updatedAt: new Date(),
              processingProgress: Math.round(progress)
            })
            .where(eq(documents.id, documentId));
          
          return { pageNumber, firebaseUrl };
        } catch (error) {
          console.error(`Error processing page ${pageNumber}:`, error);
          throw error;
        }
      };
      
      // Create an array of page numbers
      const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);
      
      // Process pages with concurrency limit
      const results = await Promise.allSettled(
        pageNumbers.map(pageNumber => 
          limit(() => processPage(pageNumber))
        )
      );
      
      // Filter successful results
      const successfulResults = results
        .filter((result): result is PromiseFulfilledResult<{pageNumber: number, firebaseUrl: string}> => 
          result.status === 'fulfilled')
        .map(result => result.value);
      
      // Log failed pages
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Failed to process page ${index + 1}:`, result.reason);
        }
      });
      
      // Update progress after processing all pages
      await job.updateProgress(95);
      
      // Save image references to a JSON file
      const jsonFilePath = path.join(dataDir, `${documentId}_firebase_images.json`);
      await fs.writeFile(
        jsonFilePath,
        JSON.stringify({
          documentId,
          pageCount,
          images: successfulResults.sort((a, b) => a.pageNumber - b.pageNumber)
        }, null, 2)
      );
      
      console.log(`Saved image references to ${jsonFilePath}`);
      
      // Clean up temp file
      await fs.unlink(tempFilePath);
      
      // Update document's updatedAt timestamp and mark as complete
      await db.update(documents)
        .set({ 
          updatedAt: new Date(),
          processingProgress: 100,
          processingComplete: true
        })
        .where(eq(documents.id, documentId));
        
      console.log(`Document ${documentId} processing completed successfully`);
      await job.updateProgress(100);
      
      return { success: true, documentId, pageCount };
    } catch (error) {
      console.error("=== ERROR PROCESSING PDF ===", error);
      
      // Update the document to indicate an error
      await db.update(documents)
        .set({ 
          updatedAt: new Date(),
          processingError: error instanceof Error ? error.message : String(error)
        })
        .where(eq(documents.id, documentId));
        
      throw error; // Re-throw to let BullMQ handle the failure
    }
  },
  {
    connection: redisConnection,
    concurrency: 2, // Process 2 PDFs at a time
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  }
);

// Handle worker events
worker.on('completed', job => {
  console.log(`Job ${job.id} completed for document ${job.data.documentId}`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed for document ${job?.data.documentId}:`, err);
});

export default worker; 