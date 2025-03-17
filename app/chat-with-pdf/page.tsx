"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import { UploadDropzone } from "@/utils/uploadthing";
import { useUser } from "@clerk/nextjs";
import { saveDocument } from "@/actions/document";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function ChatWithPDF() {
  const [isUploading, setIsUploading] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  const handleUpload = async (result: any) => {
    if (!user || !result) return;
    
    try {
      // Use the document title or fallback to the filename without extension
      const title = documentTitle.trim() || result.name.replace(/\.[^/.]+$/, "") || "Untitled Document";
      
      const response = await saveDocument({
        userId: user.id,
        title: title,
        fileName: result.name,
        fileUrl: result.url,
        fileKey: result.key,
        fileSize: result.size,
      });
      
      if (response.success && response.documentId) {
        toast({
          title: "Success",
          description: "Document uploaded successfully",
        });
        
        // Automatically redirect to the chat page
        router.push(`/chat-with-pdf/${response.documentId}`);
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to save document",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving document:", error);
      toast({
        title: "Error",
        description: "Failed to save document",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">Chat with PDF</h1>
      
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
          <CardDescription>
            Upload a PDF to start chatting with it
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label htmlFor="documentTitle" className="block text-sm font-medium mb-1">
              Document Title (optional)
            </label>
            <Input
              id="documentTitle"
              placeholder="Enter a title for your document"
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              className="mb-4"
            />
          </div>
          
          <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 h-40">
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Upload className="h-10 w-10 text-muted-foreground animate-pulse mb-2" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </div>
            ) : (
              <UploadDropzone
                endpoint="pdfUploader"
                onUploadBegin={() => {
                  setIsUploading(true);
                }}
                onClientUploadComplete={async (res) => {
                  setIsUploading(false);
                  if (res && res[0]) {
                    console.log("Upload completed:", res[0]);
                    // Automatically handle the upload and redirect
                    await handleUpload(res[0]);
                  }
                }}
                onUploadError={(error) => {
                  setIsUploading(false);
                  console.error("Upload error:", error.message);
                  toast({
                    title: "Upload Error",
                    description: error.message,
                    variant: "destructive",
                  });
                }}
              />
            )}
          </div>
          
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Enter an optional title above and upload your PDF. You'll be automatically redirected to the chat page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 