export const dynamic = 'force-dynamic';

import { connectToDB } from "@/lib/mongoose";
import Set from "@/lib/models/set.model";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { image, title, releaseDate, code, isEvent } = await req.json();

  console.log({ image, title, releaseDate, code, isEvent });

  await connectToDB();

  await Set.create({ image, title, releaseDate, code, isEvent });

  return NextResponse.json(
    { message: "Set created successfully" },
    { status: 201 }
  );
}

export async function GET() {
  await connectToDB();
  const sets = await Set.find();
  return NextResponse.json({ sets });
}
