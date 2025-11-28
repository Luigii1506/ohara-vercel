const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const quoteIdent = (value) => `"${String(value).replace(/"/g, '""')}"`;

async function syncSequences() {
  try {
    const sequences = await prisma.$queryRaw`
      SELECT
        table_schema,
        table_name,
        column_name,
        pg_get_serial_sequence(format('"%s"."%s"', table_schema, table_name), column_name) AS sequence_name
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND pg_get_serial_sequence(format('"%s"."%s"', table_schema, table_name), column_name) IS NOT NULL
    `;

    for (const seq of sequences) {
      if (!seq.sequence_name) continue;

      const tableName = `${quoteIdent(seq.table_schema)}.${quoteIdent(seq.table_name)}`;
      const columnName = quoteIdent(seq.column_name);
      const sequenceLiteral = seq.sequence_name.replace(/'/g, "''");

      const query = `SELECT setval('${sequenceLiteral}', COALESCE((SELECT MAX(${columnName}) FROM ${tableName}), 0) + 1, false) AS value;`;

      await prisma.$executeRawUnsafe(query);
      console.log(`Synchronized sequence ${seq.sequence_name}`);
    }

    console.log("✅ Sequences synchronized successfully");
  } catch (error) {
    console.error("❌ Failed to synchronize sequences:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

syncSequences();
