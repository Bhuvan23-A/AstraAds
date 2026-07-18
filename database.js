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

  // Create page_configs table with columns for SaaS OAuth connections
  await database.exec(`
    CREATE TABLE IF NOT EXISTS page_configs (
      page_id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      client_name TEXT NOT NULL,
      ad_account_id TEXT,
      user_access_token TEXT,
      page_name TEXT
    )
  `);

  // Create users table for session authentication
  await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL
    )
  `);

  // Seed default admin user if empty
  const userCount = await database.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    await database.run(
      'INSERT INTO users (username, password) VALUES (?, ?)',
      ['theastraai', 'vzo-[S&ELe&ahU.D']
    );
    console.log('Database initialized: Seeded default user accounts.');
  }

  // Migration: Add columns to page_configs if they don't exist
  const pcColumns = await database.all("PRAGMA table_info(page_configs)");
  const hasAdAccount = pcColumns.some(c => c.name === 'ad_account_id');
  const hasUserToken = pcColumns.some(c => c.name === 'user_access_token');
  const hasPageNameCol = pcColumns.some(c => c.name === 'page_name');

  if (!hasAdAccount) {
    await database.exec("ALTER TABLE page_configs ADD COLUMN ad_account_id TEXT");
    console.log('Database migrated: Added ad_account_id column to page_configs.');
  }
  if (!hasUserToken) {
    await database.exec("ALTER TABLE page_configs ADD COLUMN user_access_token TEXT");
    console.log('Database migrated: Added user_access_token column to page_configs.');
  }
  if (!hasPageNameCol) {
    await database.exec("ALTER TABLE page_configs ADD COLUMN page_name TEXT");
    console.log('Database migrated: Added page_name column to page_configs.');
  }

  // Migration: Add client_name column to leads table if it doesn't exist
  const leadColumns = await database.all("PRAGMA table_info(leads)");
  const hasLeadClientName = leadColumns.some(c => c.name === 'client_name');
  if (!hasLeadClientName) {
    await database.exec("ALTER TABLE leads ADD COLUMN client_name TEXT DEFAULT 'Sanna Innovations'");
    console.log('Database migrated: Added client_name column to leads.');
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

  // Seed page tokens config table
  const configCount = await database.get('SELECT COUNT(*) as count FROM page_configs');
  if (configCount.count === 0) {
    const pageConfigs = [
      {
        page_id: '918154964722656',
        access_token: 'EAAM6yF3UmKsBR4FtARI73plpg2IdqngQ6YQyEOZCmy0P2HZB4R3FYrZAxzZBTf3ian7UTr3KgU948JX4r3j8GLoezZBIZCufnz1QcSeuY9HUu1BtlDlNMPAAPKUyPgP9azCJ6pe2yd8pxDcBfAZBfZChp4mqXcyhBCDBX9LI7WDWc4R1IPjmzkpOgazi4PJH3WhtUYmgm1VbEl94vWnsWORPFGB6D8xuwA4xJ1iRklMZD',
        client_name: 'Ashirwada Leads'
      },
      {
        page_id: '956007024262197',
        access_token: 'EAAM6yF3UmKsBRy0C2lBZBLJfutyc9dA4RlrT4Up8WnkXTbaTOJKAYTR0GSe0Cjkw9vzVEQV7WmP3YK3khMBmit8q66LewtRX04X0N3x7fcgFDLSMfc6I3XXqKztmUwqbHpM5IDpOWkZCAopLCqJI7jOUyPtqvrUxLIlONpi0WApt33iuwDjWNbzl77ZBPuArLz0on1e0joH3KrloY2VZC1KRuN7vi8vFZAlW3BWgZD',
        client_name: 'Sanna Innovations'
      },
      {
        page_id: '825355443995473',
        access_token: 'EAAM6yF3UmKsBRyu8ZAKwXVGhzT8zEIoeerSdAV5RS2RFkljfnIuFOUkKs3CqzMhIsiMzojlFGiiElzlkDN8iTDf90qXGRZCpF1K7QFhfiZCcEatcLHx9Oax56W4cFMHzPIngCONhRlkt5iwqIODB19rdNVizxMrCmYJt5Q1dViiBNuawJ6LZCjeXgrqGSXWkC7ZCbQvzzEWGnKNyr3ytEtJgm6tBKKzeS8U20xZAkZD',
        client_name: 'Dr. Manjunath G'
      },
      {
        page_id: '730386160147641',
        access_token: 'EAAM6yF3UmKsBR0AGsBFQLdFkLac0Qr1jRI2zdi2PHNzswGMSBqM2bKnQCHWvfYkIWXGrpTNCaXeJMAzpzglqenAXRfpqRY1XY8GsZBK5ak1i1PAIApk9ZC8MctC6bVKtCvCBaJPHvFyxCAhQ0J7HzRhUHaShXld1lptfK2slJ2RlFOXs7vFXrmZCeTOjnOQrV2x4OUZBKfq1AtJxz51ntvO3UsSJLe84gIIJgvcZD',
        client_name: 'The Tiffanys House'
      },
      {
        page_id: '201036076435672',
        access_token: 'EAAM6yF3UmKsBR7jRyPogOlH7I43I5NcBZCXZA9f8OZBGpyaEV62ndQVHtzPNilDowXWZAISZA3YZA8NB0Ao5AgCe8kOfcD844xafXzquEVzQGvNCDAENGZAklii7BUr6Jrh74YUi0DNcyxrf7sKJ5r3Cg0VUQQIZC9JYWhNVubcgUdzu8M5dmm0p4L3LzpWEf7TyYDKM6jwiNKSHpZCZAC0himnjPIKsXSf7ZC9lSzSEwZDZD',
        client_name: 'Poojaris Nirantara'
      },
      {
        page_id: '1593739557565082',
        access_token: 'EAAM6yF3UmKsBRZCIqbCysC78LGojbfmYSA3DT4QJYa4SwQI9fJmqle5NXzoImZARtPpfIadJ5coTQWKceOTnQLyidJTHlqMi9UnRt2TVAKgC8EQ2AwClv7FNrMYV0idGj5u8A2e1hxOagPfTnfH6uAFbeFLpa3E6im895tZC3x0jQQxjYS1gnfvLCxZC7pblFwMhgJIMHtIjVHOZAxbxZCj42LHmXKvPw8ZADJTyWAZD',
        client_name: 'Jal Mahal Resort & Spa'
      }
    ];

    for (const config of pageConfigs) {
      await database.run(
        `INSERT OR REPLACE INTO page_configs (page_id, access_token, client_name)
         VALUES (?, ?, ?)`,
        [config.page_id, config.access_token, config.client_name]
      );
    }
    console.log('Seeded database with page configs.');
  }
}
