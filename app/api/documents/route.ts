import { NextRequest, NextResponse } from "next/server";
import { db } from "@/configs/db";
import { documents, users } from "@/configs/schema";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    console.log("userId", userId);
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }


    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }


    const userDocuments = await db.query.documents.findMany({
      where: eq(documents.userId, user.id),
      orderBy: (documents, { desc }) => [desc(documents.createdAt)],
    });

    return NextResponse.json(userDocuments);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 