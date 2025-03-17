'use server'

import { db } from '@/configs/db';
import { documents, users } from '@/configs/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import fs from 'fs/promises';
import path from 'path';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

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

    // Insert the document and get the ID using returning()
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
    
    console.log("Insert result with returning:", result);
    
    // Get the document ID from the result
    const documentId = result[0]?.id;
    console.log("Document ID from returning:", documentId);
    
    // Process the PDF after saving the document
    if (documentId) {
      try {
        console.log("Starting PDF processing for document:", documentId);
        
        // Create a temporary file path for the PDF
        const tempDir = path.join(process.cwd(), 'temp');
        
        // Ensure the temp directory exists
        try {
          await fs.mkdir(tempDir, { recursive: true });
        } catch (error) {
          console.log("Temp directory already exists or couldn't be created");
        }
        
        // Download the PDF from the URL
        const response = await fetch(documentData.fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }
        
        const pdfBuffer = await response.arrayBuffer();
        const tempFilePath = path.join(tempDir, `${documentId}.pdf`);
        
        // Write the PDF to a temporary file
        await fs.writeFile(tempFilePath, Buffer.from(pdfBuffer));
        
        // Use PDFLoader to load and process the PDF
        const loader = new PDFLoader(tempFilePath, {
          parsedItemSeparator: "",
        });
        
        const docs = await loader.load();
        
        // Count the number of pages
        const pageCount = docs.length;
        
        // Create images directory for this document
        const imagesDir = path.join(process.cwd(), 'data', 'images', documentId.toString());
        try {
          await fs.mkdir(imagesDir, { recursive: true });
        } catch (error) {
          console.log("Images directory already exists or couldn't be created");
        }
        
        // Extract images from PDF pages
        const pdf2img = await import("pdf-img-convert");
        const pdfImages = await pdf2img.convert(tempFilePath);
        
        // Save images and create references
        const imageReferences = await Promise.all(pdfImages.map(async (imageBuffer, index) => {
          const imagePath = path.join(imagesDir, `page_${index + 1}.png`);
          const relativeImagePath = path.relative(process.cwd(), imagePath);
          
          await fs.writeFile(imagePath, imageBuffer);
          
          return {
            pageNumber: index + 1,
            imagePath: relativeImagePath
          };
        }));
        
        // Extract page-wise content
        const pagesContent = docs.map((doc, index) => ({
          pageNumber: index + 1,
          content: doc.pageContent,
          metadata: doc.metadata,
          image: imageReferences.find(img => img.pageNumber === index + 1)?.imagePath || null
        }));
        
        // Create a data directory if it doesn't exist
        const dataDir = path.join(process.cwd(), 'data');
        try {
          await fs.mkdir(dataDir, { recursive: true });
        } catch (error) {
          console.log("Data directory already exists or couldn't be created");
        }
        
        // Save the page-wise content to a JSON file
        const jsonFilePath = path.join(dataDir, `${documentId}.json`);
        await fs.writeFile(
          jsonFilePath, 
          JSON.stringify({
            documentId,
            pageCount,
            pages: pagesContent,
            images: imageReferences
          }, null, 2)
        );
        
        // Clean up the temporary file
        await fs.unlink(tempFilePath);
        
        console.log(`PDF processed successfully. Page count: ${pageCount}, Images extracted: ${imageReferences.length}`);
      } catch (processingError) {
        console.error("Error processing PDF:", processingError);
        // We don't want to fail the document save if processing fails
      }
    } else {
      console.error("Document ID is undefined, cannot process PDF");
    }
    
    revalidatePath('/chat-with-pdf');
    return { 
      success: true, 
      message: "Document saved successfully",
      documentId
    };
  } catch (error) {
    console.error("Error saving document:", error);
    return { success: false, message: "Failed to save document" };
  }
} 