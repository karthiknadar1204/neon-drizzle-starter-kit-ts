import { NextRequest, NextResponse } from "next/server";
import { db } from "@/configs/db";
import { documents, users } from "@/configs/schema";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/nextjs/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const { userId } = getAuth(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Properly await params to access documentId
    const { documentId: documentIdStr } = await params;
    const documentId = parseInt(documentIdStr);
    
    if (isNaN(documentId)) {
      return NextResponse.json(
        { error: "Invalid document ID" },
        { status: 400 }
      );
    }

    // Get the user's ID from the database
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get the document
    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });
    console.log("document", document);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Check if the document belongs to the user
    if (document.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
