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
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )
  `);

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

  // Create campaign_launches table for audit trail
  await database.exec(`
    CREATE TABLE IF NOT EXISTS campaign_launches (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      campaign_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      platform_campaign_id TEXT,
      budget REAL,
      status TEXT,
      launched_at TEXT NOT NULL
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

  // Ensure primary admin user ('admin' / 'admin123') exists with hashed password
  const salt = bcrypt.genSaltSync(10);
  const adminHashedPassword = bcrypt.hashSync('admin123', salt);

  const adminUser = await database.get('SELECT * FROM users WHERE username = ?', ['admin']);
  if (!adminUser) {
    await database.run(
      'INSERT INTO users (username, password, client_name, role) VALUES (?, ?, ?, ?)',
      ['admin', adminHashedPassword, null, 'admin']
    );
  } else {
    await database.run(
      'UPDATE users SET password = ?, role = ? WHERE username = ?',
      [adminHashedPassword, 'admin', 'admin']
    );
  }

  // Remove all other seed/legacy users to keep only admin
  await database.run("DELETE FROM users WHERE username != 'admin'");
  console.log('Database initialized: Admin user (admin) configured. Removed rest of credentials.');

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

  // Remove all legacy hardcoded mock leads to ensure Leads Manager is strictly user-input based
  await database.run("DELETE FROM leads WHERE id LIKE 'lead_00%'");
  console.log('Database initialized: Hardcoded mock leads removed. Leads Manager is user-input based only.');
}
