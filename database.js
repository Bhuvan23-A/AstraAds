import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Render persistent disk path config (fallback to local directory on PC)
const dbFolder = fs.existsSync('/var/data') ? '/var/data' : __dirname;
const dbPath = path.resolve(dbFolder, 'astraads.db');

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

  await database.exec(`
    CREATE TABLE IF NOT EXISTS page_configs (
      page_id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      client_name TEXT NOT NULL
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
        name: 'Aditya Kumar',
        email: 'aditya.kumar@alis.tech',
        phone: '+91 98765-43210',
        campaign_name: 'ALIS Technology',
        status: 'New',
        created_at: new Date(Date.now() - 30 * 60000).toISOString(),
        platform: 'Facebook',
        client_name: 'ALIS Technology'
      },
      {
        id: 'lead_002',
        name: 'Aria Sharma',
        email: 'aria.sharma@gmail.com',
        phone: '+91 99999-88888',
        campaign_name: 'ASHIRWADA LEADS 1st may',
        status: 'Qualified',
        created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        platform: 'Facebook',
        client_name: 'Ashirwada Leads'
      },
      {
        id: 'lead_003',
        name: 'Karan Johar',
        email: 'karan@sannainnovations.com',
        phone: '+91 98888-77777',
        campaign_name: 'sanna interiors',
        status: 'Contacted',
        created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
        platform: 'Facebook',
        client_name: 'Sanna Innovations'
      },
      {
        id: 'lead_004',
        name: 'Rajesh Patel',
        email: 'rajesh@jalmahal.com',
        phone: '+91 97777-66666',
        campaign_name: 'Jal Mahal - Women\'s Day',
        status: 'Qualified',
        created_at: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
        platform: 'Instagram',
        client_name: 'Jal Mahal Resort & Spa'
      },
      {
        id: 'lead_005',
        name: 'Priya Nair',
        email: 'priya.nair@nova.co',
        phone: '+91 96666-55555',
        campaign_name: 'Nova_30th april',
        status: 'New',
        created_at: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
        platform: 'Facebook',
        client_name: 'Nova'
      },
      {
        id: 'lead_006',
        name: 'Rohan Das',
        email: 'rohan.das@gmail.com',
        phone: '+91 95555-44444',
        campaign_name: 'ALIS Technology',
        status: 'Contacted',
        created_at: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
        platform: 'Facebook',
        client_name: 'ALIS Technology'
      },
      {
        id: 'lead_007',
        name: 'Meera Sen',
        email: 'meera.sen@gmail.com',
        phone: '+91 94444-33333',
        campaign_name: 'Sanna ads 18 sep',
        status: 'Lost',
        created_at: new Date(Date.now() - 6 * 24 * 3600000).toISOString(),
        platform: 'Facebook',
        client_name: 'Sanna Innovations'
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
