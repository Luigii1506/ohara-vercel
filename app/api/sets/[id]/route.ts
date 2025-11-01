export const dynamic = 'force-dynamic';

import { connectToDB } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";
import Set from "@/lib/models/set.model";

type Params = {
    id: string;
};

export async function PUT(req: NextRequest, { params }: { params: Params }) {
    const { id } = params;
    const { image, title, releaseDate, code, isEvent } = await req.json();

    await connectToDB();
    await Set.findByIdAndUpdate(id, { image, title, releaseDate, code, isEvent });
    return NextResponse.json({ message: "Set updated successfully" }, { status: 200 });
}


export async function GET(req: NextRequest, { params }: { params: Params }) {
    const { id } = params;

    await connectToDB();
    const set = await Set.findOne({ _id: id });
    return NextResponse.json({ set }, { status: 200 });
}


export async function DELETE(req: NextRequest, { params }: { params: Params }) {
    const { id } = params;

    await connectToDB();
    await Set.findByIdAndDelete(id);
    return NextResponse.json({ message: "Set deleted successfully" }, { status: 200 });
}