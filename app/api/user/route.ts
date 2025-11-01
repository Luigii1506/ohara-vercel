export const dynamic = 'force-dynamic';

import { connectToDB } from "@/lib/mongoose";
import User from "@/lib/models/user.model";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import mongoose from "mongoose";

export async function POST(req: NextRequest) {
    try {
        const {
            name, email
        } = await req.json();

        await connectToDB();
        await User.create({ name, email });

        return NextResponse.json({ message: "User Registered" }, { status: 201 });
    } catch (error) {
        console.error("Error creating card:", error);
        return NextResponse.json({ message: "Failed to create card" }, { status: 500 });
    }
}

