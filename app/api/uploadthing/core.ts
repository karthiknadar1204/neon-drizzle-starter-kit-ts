import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getAuth } from "@clerk/nextjs/server";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@clerk/nextjs/server";

const f = createUploadthing();

export const ourFileRouter = {
  pdfUploader: f({
    pdf: {
      maxFileSize: "128MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => {
      const { userId } = getAuth(req);
      
      if (!userId) throw new UploadThingError("Unauthorized");
      
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("PDF file URL:", file.url);
      
      return { 
        url: file.url,
        name: file.name,
        size: file.size,
        key: file.key
      };
    }),

  pdfImageUploader: f({ 
    image: { 
      maxFileSize: "32MB",
    } 
  })
    .middleware(async ({ req }) => {
      const user = auth();
      return { userId: user.userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.url, key: file.key };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter; 