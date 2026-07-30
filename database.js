import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

import fs from 'fs';
import bcrypt from 'bcryptjs';

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
      password TEXT NOT NULL,
      client_name TEXT,
      role TEXT DEFAULT 'client'
    )
  `);

  // Create google_configs table for client-specific Google Ads connections
  await database.exec(`
    CREATE TABLE IF NOT EXISTS google_configs (
      client_name TEXT PRIMARY KEY,
      refresh_token TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      account_name TEXT,
      updated_at TEXT NOT NULL
    )
  `);

  // Migration: Add columns to users if they don't exist
  const userColumns = await database.all("PRAGMA table_info(users)");
  const hasUserClientName = userColumns.some(c => c.name === 'client_name');
  const hasUserRole = userColumns.some(c => c.name === 'role');
  if (!hasUserClientName) {
    await database.exec("ALTER TABLE users ADD COLUMN client_name TEXT");
    console.log('Database migrated: Added client_name column to users.');
  }
  if (!hasUserRole) {
    await database.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'client'");
    console.log('Database migrated: Added role column to users.');
  }

  // Seed default admin user if empty
  const userCount = await database.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('vzo-[S&ELe&ahU.D', salt);
    await database.run(
      'INSERT INTO users (username, password, client_name, role) VALUES (?, ?, ?, ?)',
      ['theastraai', hashedPassword, null, 'admin']
    );

    // Seed test client user
    const clientHashedPassword = bcrypt.hashSync('jalmahal123', salt);
    await database.run(
      'INSERT INTO users (username, password, client_name, role) VALUES (?, ?, ?, ?)',
      ['jalmahal', clientHashedPassword, 'Jal Mahal Resort & Spa', 'client']
    );
    console.log('Database initialized: Seeded default user accounts.');
  } else {
    // Migration: Update existing plain text user passwords to hashed passwords and verify roles
    const users = await database.all('SELECT username, password, role FROM users');
    for (const u of users) {
      if (u.username === 'theastraai' && u.role !== 'admin') {
        await database.run("UPDATE users SET role = 'admin' WHERE username = 'theastraai'");
        console.log('Database migrated: Set admin role for theastraai.');
      }

      if (!u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
        const salt = bcrypt.genSaltSync(10);
        const hashed = bcrypt.hashSync(u.password, salt);
        await database.run('UPDATE users SET password = ? WHERE username = ?', [hashed, u.username]);
        console.log(`Database migrated: Hashed plain text password for user ${u.username}`);
      }
    }

    // Seed test client user if it doesn't exist
    const testUser = await database.get('SELECT * FROM users WHERE username = ?', ['jalmahal']);
    if (!testUser) {
      const salt = bcrypt.genSaltSync(10);
      const clientHashedPassword = bcrypt.hashSync('jalmahal123', salt);
      await database.run(
        'INSERT INTO users (username, password, client_name, role) VALUES (?, ?, ?, ?)',
        ['jalmahal', clientHashedPassword, 'Jal Mahal Resort & Spa', 'client']
      );
      console.log('Database migrated: Seeded jalmahal client user accounts.');
    }
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

}
