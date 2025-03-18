"use client";

import { useState, useRef } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/configs/firebase";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, File, X } from "lucide-react";

interface FirebasePdfUploaderProps {
  onUploadComplete: (result: {
    url: string;
    name: string;
    size: number;
    key: string;
  }) => void;
  onUploadError: (error: Error) => void;
  onUploadBegin: () => void;
}

export function FirebasePdfUploader({
  onUploadComplete,
  onUploadError,
  onUploadBegin,
}: FirebasePdfUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/pdf") {
        setFile(droppedFile);
      } else {
        onUploadError(new Error("Only PDF files are allowed"));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile);
      } else {
        onUploadError(new Error("Only PDF files are allowed"));
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    try {
      setIsUploading(true);
      onUploadBegin();
      
      // Create a unique file path in Firebase Storage
      const timestamp = Date.now();
      const fileKey = `pdfs/${timestamp}_${file.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, fileKey);
      
      // Start the upload
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      // Listen for state changes, errors, and completion
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Update progress
          const percent = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setProgress(percent);
        },
        (error) => {
          // Handle errors
          setIsUploading(false);
          onUploadError(error);
        },
        async () => {
          // Upload completed successfully
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          
          onUploadComplete({
            url: downloadUrl,
            name: file.name,
            size: file.size,
            key: fileKey,
          });
          
          setIsUploading(false);
          setFile(null);
          setProgress(0);
        }
      );
    } catch (error) {
      setIsUploading(false);
      onUploadError(error instanceof Error ? error : new Error("Upload failed"));
    }
  };

  const clearFile = () => {
    setFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="w-full">
      {!file ? (
        <div
          className={`flex flex-col items-center justify-center border-2 ${
            dragActive ? "border-primary" : "border-dashed"
          } rounded-lg p-6 h-40 transition-colors`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
            id="pdf-upload"
          />
          <Upload className="h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop your PDF here or click to browse
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            Select PDF
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <File className="h-5 w-5 mr-2 text-muted-foreground" />
              <span className="text-sm font-medium truncate max-w-[200px]">
                {file.name}
              </span>
            </div>
            {!isUploading && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={clearFile}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {isUploading ? (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Uploading: {progress}%
              </p>
            </div>
          ) : (
            <Button
              className="w-full mt-2"
              size="sm"
              onClick={handleUpload}
            >
              Upload PDF
            </Button>
          )}
        </div>
      )}
    </div>
  );
} 