import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "UploadThing API is deprecated. Use Firebase Storage directly." }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ message: "UploadThing API is deprecated. Use Firebase Storage directly." }, { status: 410 });
} 