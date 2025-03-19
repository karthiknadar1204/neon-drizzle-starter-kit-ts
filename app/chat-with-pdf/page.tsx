"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Calendar } from "lucide-react";
import { FirebasePdfUploader } from "@/components/firebase-pdf-uploader";
import { useUser } from "@clerk/nextjs";

import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import axios from "axios";
import { saveDocument } from "@/actions/document";

export default function ChatWithPDF() {
  const [isUploading, setIsUploading] = useState(false);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const response = await axios.get('/api/documents');
        setDocuments(response.data);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching documents:", error);
        toast({
          title: "Error",
          description: "Failed to load your documents",
          variant: "destructive",
        });
        setIsLoading(false);
      }
    };

    if (user) {
      fetchDocuments();
    }
  }, [user, toast]);

  const handleUpload = async (result: any) => {
    if (!user || !result) return;
    
    try {
      console.log("Starting document upload process with:", result);
      
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
      
      console.log("Document save response:", response);
      
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

  // Format date to a readable string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">Chat with PDF</h1>
      
      <Card className="w-full max-w-3xl mx-auto mb-10">
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
          
          <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6">
            <FirebasePdfUploader
              onUploadBegin={() => {
                setIsUploading(true);
              }}
              onUploadComplete={(result) => {
                setIsUploading(false);
                handleUpload(result);
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
          </div>
          
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Enter an optional title above and upload your PDF. You'll be automatically redirected to the chat page.
          </p>
        </CardContent>
      </Card>
      
      {/* Document Cards Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-6">Your Documents</h2>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <p className="text-muted-foreground">Loading your documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-10 border rounded-lg bg-muted/20">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">You haven't uploaded any documents yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <Card key={doc.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg truncate">{doc.title}</CardTitle>
                  <CardDescription className="truncate">{doc.fileName}</CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span>Uploaded on {formatDate(doc.createdAt)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {Math.round(doc.fileSize / 1024)} KB
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="default" 
                    className="w-full"
                    onClick={() => router.push(`/chat-with-pdf/${doc.id}`)}
                  >
                    Chat with this PDF
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 