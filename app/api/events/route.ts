export const dynamic = 'force-dynamic';

import { connectToDB } from "@/lib/mongoose";
import Event from "@/lib/models/event.model";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import mongoose from "mongoose";

export async function POST(req: NextRequest) {

    const { name, date, location, sets } = await req.json();

    await connectToDB();

    const processedSet = Array.isArray(sets)
        ? sets.map(id => mongoose.Types.ObjectId.isValid(id) ? id : null).filter(id => id !== null)
        : [];


    await Event.create({ name, eventDate: date, location, sets: processedSet });

    return NextResponse.json({ message: "Set created successfully" }, { status: 201 });

}
