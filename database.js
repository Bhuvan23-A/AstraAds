import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, 'astraads.db');

let db = null;

export async function getDatabase() {
  if (db) return db;
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  return db;
}

export async function initializeDatabase() {
  const database = await getDatabase();
  await database.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      campaign_name TEXT,
      status TEXT DEFAULT 'New',
      created_at TEXT NOT NULL,
      platform TEXT DEFAULT 'Facebook',
      client_name TEXT DEFAULT 'Sanna Innovations'
    )
  `);

  // Migration check for existing databases
  const tableInfo = await database.all("PRAGMA table_info(leads)");
  const hasClientName = tableInfo.some(column => column.name === 'client_name');
  if (!hasClientName) {
    await database.exec("ALTER TABLE leads ADD COLUMN client_name TEXT DEFAULT 'Sanna Innovations'");
    console.log('Database migrated: Added client_name column to leads table.');
  }

  // Insert some default mock leads if database is empty
  const count = await database.get('SELECT COUNT(*) as count FROM leads');
  if (count.count === 0) {
    const mockLeads = [
      {
        id: 'lead_001',
        name: 'Sarah Connor',
        email: 'sarah.c@cyberdyne.com',
        phone: '+1 (555) 019-2834',
        campaign_name: 'Summer Promo 2026',
        status: 'New',
        created_at: new Date(Date.now() - 30 * 60000).toISOString(),
        platform: 'Facebook',
        client_name: 'Sanna Innovations'
      },
      {
        id: 'lead_002',
        name: 'John Doe',
        email: 'john.doe@gmail.com',
        phone: '+1 (555) 349-8234',
        campaign_name: 'AI Automation Leads',
        status: 'Contacted',
        created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        platform: 'Instagram',
        client_name: 'Apex Marketing'
      },
      {
        id: 'lead_003',
        name: 'Alice Johnson',
        email: 'alice.j@enterprise.co',
        phone: '+1 (555) 987-6543',
        campaign_name: 'Summer Promo 2026',
        status: 'Qualified',
        created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
        platform: 'Facebook',
        client_name: 'Sanna Innovations'
      },
      {
        id: 'lead_004',
        name: 'Bob Smith',
        email: 'bob.smith@outlook.com',
        phone: '+1 (555) 123-4567',
        campaign_name: 'Retargeting Q3',
        status: 'Lost',
        created_at: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
        platform: 'Facebook',
        client_name: 'Cyberdyne Systems'
      }
    ];

    for (const lead of mockLeads) {
      await database.run(
        `INSERT INTO leads (id, name, email, phone, campaign_name, status, created_at, platform, client_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [lead.id, lead.name, lead.email, lead.phone, lead.campaign_name, lead.status, lead.created_at, lead.platform, lead.client_name]
      );
    }
    console.log('Database initialized with mock leads.');
  } else {
    console.log('Database already exists.');
  }
}
