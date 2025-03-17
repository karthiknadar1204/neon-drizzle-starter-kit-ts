import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UTApi } from "uploadthing/server";

// Create an instance of the UploadThing API
export const utapi = new UTApi();

// For client-side components
const f = createUploadthing();
export { f }; 