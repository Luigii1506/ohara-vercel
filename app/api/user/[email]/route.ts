export const dynamic = 'force-dynamic';

import { connectToDB } from "@/lib/mongoose";
import User from "@/lib/models/user.model";
import { NextResponse, NextRequest } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { email: string } }
) {
  try {
    const { email } = params;

    await connectToDB();

    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ userId: user._id }, { status: 200 });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { message: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
