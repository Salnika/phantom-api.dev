import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { sqliteRaw, tableManager } from './database';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const metaDir = path.join(__dirname, '../meta');
const migrationsDir = path.join(__dirname, '../migrations');

interface ResourceMeta {
  fields: Record<string, any>;
  permissions: {
    create: string[];
    read: string[];
    update: string[];
    delete: string[];
  };
}

/**
 * Loads the resource metadata from a JSON file.
 * @param resource The name of the resource.
 * @returns A Promise that resolves to the ResourceMeta object or null if the file does not exist.
 * @throws An error if reading or parsing the file fails for reasons other than not found.
 */
async function loadResourceMeta(resource: string): Promise<ResourceMeta | null> {
  try {
    const metaPath = path.join(metaDir, `${resource}.json`);
    const metaContent = await fs.readFile(metaPath, 'utf8');
    return JSON.parse(metaContent);
  } catch (_error) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    if ((_error as any).code === 'ENOENT') {
      return null;
    }
    throw _error;
  }
}

/**
 * Generates new migration files based on existing resource metadata and current database tables.
 * It creates migration files for new tables that are defined in meta files but do not exist in the database.
 * @returns A Promise that resolves when the migrations have been generated.
 */
export async function pullMigrations() {
  console.log('Generating migrations...');

  const metaFiles = await fs.readdir(metaDir);
  const currentTables = tableManager.getAllTables();

  for (const file of metaFiles) {
    if (file.endsWith('.json')) {
      const resourceName = path.basename(file, '.json');
      const meta = await loadResourceMeta(resourceName);

      if (!meta) continue;

      console.log(`Processing resource: ${resourceName}`);

      if (!currentTables.includes(resourceName)) {
        const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
        const migrationFileName = `${timestamp}_create_${resourceName.toLowerCase()}_table.ts`;
        const createTableSQL = `CREATE TABLE ${resourceName} (id TEXT PRIMARY KEY);`;

        const migrationContent = `\nexport const up = async (db: any) => {\n  await db.exec(\`${createTableSQL}\`);\n};\n\nexport const down = async (db: any) => {\n  await db.exec(\`DROP TABLE IF EXISTS ${resourceName};\`);\n};\n`;
        await fs.writeFile(path.join(migrationsDir, migrationFileName), migrationContent);
        console.log(`Generated migration: ${migrationFileName}`);
      }
    }
  }

  console.log('Migrations generated.');
}

/**
 * Applies a specific migration file to the database.
 * @param fileName The name of the migration file to apply.
 * @returns A Promise that resolves when the migration has been applied.
 */
export async function applyMigration(fileName: string) {
  console.log(`Applying migration: ${fileName}`);
  const migrationPath = path.join(migrationsDir, fileName);
  const migration = await import(migrationPath);

  if (migration.up) {
    await migration.up(sqliteRaw); // Utilise l'instance SQLite native
    console.log(`Migration ${fileName} applied successfully.`);
  } else {
    console.warn(`Migration ${fileName} has no 'up' function.`);
  }
}
