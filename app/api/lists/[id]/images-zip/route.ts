export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/lists/[id]/images-zip
 * Descarga un ZIP con las imágenes de todas las cartas de la lista.
 * Construye el ZIP a mano (método "stored", sin compresión — las imágenes ya
 * vienen comprimidas) para no depender de ninguna librería.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);
    const size = f.data.length;

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // UTF-8 filenames
    lh.writeUInt16LE(0, 8); // stored
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(size, 18);
    lh.writeUInt32LE(size, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    local.push(lh, nameBuf, f.data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(size, 20);
    cd.writeUInt32LE(size, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += lh.length + nameBuf.length + f.data.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...local, centralBuf, eocd]);
}

const slug = (s: string) =>
  (s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const extOf = (url: string) => {
  const m = url.split("?")[0].match(/\.(webp|png|jpe?g|gif)$/i);
  return m ? `.${m[1].toLowerCase()}` : ".webp";
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const listId = Number(params.id);
    if (!Number.isFinite(listId)) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    const rows = await prisma.userListCard.findMany({
      where: { listId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        card: {
          select: { code: true, src: true, alternateArt: true },
        },
      },
    });

    const withImg = rows
      .map((r) => r.card)
      .filter((c): c is NonNullable<typeof c> => Boolean(c?.src));
    if (withImg.length === 0) {
      return NextResponse.json(
        { error: "La lista no tiene imágenes" },
        { status: 404 }
      );
    }

    // Nombres únicos por carta.
    const usedNames = new Map<string, number>();
    const nameFor = (code: string, alt: string | null, ext: string) => {
      let base = code || "carta";
      if (alt) base += `-${slug(alt)}`;
      const n = (usedNames.get(base) ?? 0) + 1;
      usedNames.set(base, n);
      return n > 1 ? `${base}-${n}${ext}` : `${base}${ext}`;
    };

    // Descarga las imágenes en lotes (concurrencia acotada).
    const files: { name: string; data: Buffer }[] = [];
    const CONCURRENCY = 8;
    for (let i = 0; i < withImg.length; i += CONCURRENCY) {
      const batch = withImg.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (c) => {
          try {
            const res = await fetch(c.src, {
              headers: { "User-Agent": "Mozilla/5.0" },
            });
            if (!res.ok) return null;
            const buf = Buffer.from(await res.arrayBuffer());
            return {
              name: nameFor(c.code, c.alternateArt, extOf(c.src)),
              data: buf,
            };
          } catch {
            return null;
          }
        })
      );
      for (const r of results) if (r) files.push(r);
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No se pudo descargar ninguna imagen" },
        { status: 502 }
      );
    }

    const zip = buildZip(files);
    return new NextResponse(zip as any, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="lista-${listId}-imagenes.zip"`,
        "Content-Length": String(zip.length),
      },
    });
  } catch (error: any) {
    console.error("[lists/images-zip] failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
