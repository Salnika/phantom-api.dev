import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import './database';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const metaDir = path.join(__dirname, '../meta');
const seedsDir = path.join(__dirname, '../seeds');

interface ResourceMeta {
  fields: Record<string, any>;
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
    if ((_error as any).code === 'ENOENT') {
      return null;
    }
    throw _error;
  }
}

/**
 * Generates seed data files based on existing resource metadata.
 * It creates a TypeScript file containing functions to seed data for each resource.
 * @returns A Promise that resolves when the seed data files have been generated.
 */
export async function generateSeedData() {
  console.log('Generating seed data...');

  const metaFiles = await fs.readdir(metaDir);
  const seedData: Record<string, any[]> = {};

  for (const file of metaFiles) {
    if (file.endsWith('.json')) {
      const resourceName = path.basename(file, '.json');
      const meta = await loadResourceMeta(resourceName);

      if (!meta) continue;

      console.log(`Generating data for resource: ${resourceName}`);

      // Simplified data generation for demonstration
      const numRecords = 5; // Generate 5 records per resource
      const records = [];

      for (let i = 0; i < numRecords; i++) {
        const record: Record<string, any> = {
          id: `${resourceName.toLowerCase()}_${Date.now()}_${i}`
        };
        for (const [fieldName, field] of Object.entries(meta.fields)) {
          if (fieldName === 'id') continue;
          const typedField = field as { type: string; target?: string };
          switch (typedField.type) {
            case 'string':
              record[fieldName] = `Test ${fieldName} ${i}`;
              break;
            case 'text':
              record[fieldName] = `Long text for ${fieldName} ${i}. This is a sample paragraph.`;
              break;
            case 'number':
              record[fieldName] = Math.floor(Math.random() * 100);
              break;
            case 'integer':
              record[fieldName] = Math.floor(Math.random() * 100);
              break;
            case 'boolean':
              record[fieldName] = Math.random() > 0.5;
              break;
            case 'date':
              record[fieldName] = new Date().toISOString();
              break;
            case 'relation':
              record[fieldName] = `${typedField.target?.toLowerCase() || 'unknown'}_${Math.floor(Math.random() * numRecords)}`;
              break;
            default:
              record[fieldName] = `Default ${fieldName} value`;
          }
        }
        records.push(record);
      }
      seedData[resourceName] = records;
    }
  }

  const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
  const seedFileName = `${timestamp}_generated_seed.ts`;
  const seedContent = `\nexport const seed = async (tableManager: any) => {\n  console.log('Applying generated seed data...');\n\n  ${Object.entries(seedData).map(([resourceName, records]) => `\n  // Seeding ${resourceName}\n  for (const record of ${JSON.stringify(records, null, 2)}) {\n    try {\n      await tableManager.create('${resourceName}', record);\n      console.log('  Created ${resourceName} with ID: ' + record.id);\n    } catch (error) {\n      console.error('  Failed to create ${resourceName} record ' + record.id + ': ' + (error && (error as any).message));\n    }\n  }\n  `).join('\n')}\n\n  console.log('Generated seed data applied.');\n};\n`;

  await fs.writeFile(path.join(seedsDir, seedFileName), seedContent);
  console.log(`Generated seed file: ${seedFileName}`);
  console.log('Seed data generation complete.');
}