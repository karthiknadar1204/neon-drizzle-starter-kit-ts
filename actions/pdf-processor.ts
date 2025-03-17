'use server'

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import fs from 'fs/promises';
import path from 'path';

type PDFProcessingResult = {
  success: boolean;
  message: string;
  pageCount?: number;
  documentId?: string;
}

export async function processPDF(fileUrl: string, documentId: string): Promise<PDFProcessingResult> {
  try {
    // Create a temporary file path for the PDF
    const tempDir = path.join(process.cwd(), 'temp');
    
    // Ensure the temp directory exists
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      console.log("Temp directory already exists or couldn't be created");
    }
    
    // Download the PDF from the URL
    const response = await fetch(fileUrl);
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
    
    // Extract page-wise content
    const pagesContent = docs.map((doc, index) => ({
      pageNumber: index + 1,
      content: doc.pageContent,
      metadata: doc.metadata
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
        pages: pagesContent
      }, null, 2)
    );
    
    // Clean up the temporary file
    await fs.unlink(tempFilePath);
    
    return {
      success: true,
      message: "PDF processed successfully",
      pageCount,
      documentId
    };
  } catch (error) {
    console.error("Error processing PDF:", error);
    return {
      success: false,
      message: `Failed to process PDF: ${error instanceof Error ? error.message : String(error)}`,
      documentId
    };
  }
} 