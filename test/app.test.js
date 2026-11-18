import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { getDatabase, initializeDatabase } from '../database.js';

let serverProcess;
let baseUrl;
let cookieJar = {};

// Helper for making HTTP requests with cookie support
async function request(method, path, body = null, headers = {}, cookie = '') {
  const url = `${baseUrl}${path}`;
  const reqHeaders = { ...headers };
  if (cookie) {
    reqHeaders['Cookie'] = cookie;
  }
  if (body && typeof body === 'object') {
    reqHeaders['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: (method !== 'GET' && method !== 'HEAD') ? body : undefined,
    redirect: 'manual'
  });

  const setCookie = res.headers.get('set-cookie');
  let responseBody;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    responseBody = await res.json();
  } else {
    responseBody = await res.text();
  }

  return {
    status: res.status,
    headers: res.headers,
    setCookie,
    body: responseBody
  };
}

describe('AstraAds Integration & Completeness Test Suite', () => {
  before(async () => {
    // Dynamically import server to get it running on an ephemeral or test port
    process.env.PORT = '3099';
    process.env.NODE_ENV = 'test';
    
    // Initialize DB
    await initializeDatabase();
    
    // Import and start server
    await import('../server.js');
    baseUrl = 'http://localhost:3099';

    // Wait a brief moment for the express server to start listening
    await new Promise(resolve => setTimeout(resolve, 600));
  });

  // 1. Database & Migrations
  describe('Database and Seed Integrity', () => {
    test('database contains admin user and no hardcoded mock leads', async () => {
      const db = await getDatabase();
      const users = await db.all('SELECT username, role, client_name FROM users');
      assert.strictEqual(users.length, 1, 'Should have only admin user by default');
      
      const admin = users.find(u => u.username === 'admin');
      assert.ok(admin, 'Admin user must exist');
      assert.strictEqual(admin.role, 'admin');

      const mockLeads = await db.all("SELECT * FROM leads WHERE id LIKE 'lead_00%'");
      assert.strictEqual(mockLeads.length, 0, 'No hardcoded mock leads should exist in database');
    });
  });

  // 2. Authentication Flow
  describe('Authentication & Session Management', () => {
    let adminCookie = '';
    let clientCookie = '';

    test('rejects login with invalid credentials', async () => {
      const res = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: 'wrong-password'
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.error, 'Invalid username or password.');
    });

    test('authenticates admin user with valid password', async () => {
      const res = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.role, 'admin');
      assert.ok(res.setCookie, 'Should set session cookie');
      adminCookie = res.setCookie.split(';')[0];
    });

    test('verifies admin session', async () => {
      const res = await request('GET', '/api/auth/session', null, {}, adminCookie);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.loggedIn, true);
      assert.strictEqual(res.body.user.username, 'admin');
      assert.strictEqual(res.body.user.role, 'admin');
    });

    test('authenticates client user with valid password after admin creates account', async () => {
      // Admin creates client user
      await request('POST', '/api/admin/users', {
        username: 'jalmahal',
        password: 'jalmahal123',
        client_name: 'Jal Mahal Resort & Spa'
      }, {}, adminCookie);

      const res = await request('POST', '/api/auth/login', {
        username: 'jalmahal',
        password: 'jalmahal123'
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.role, 'client');
      assert.strictEqual(res.body.client_name, 'Jal Mahal Resort & Spa');
      clientCookie = res.setCookie.split(';')[0];
    });

    test('verifies client session', async () => {
      const res = await request('GET', '/api/auth/session', null, {}, clientCookie);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.loggedIn, true);
      assert.strictEqual(res.body.user.username, 'jalmahal');
      assert.strictEqual(res.body.user.client_name, 'Jal Mahal Resort & Spa');
    });

    test('logs out successfully', async () => {
      const res = await request('POST', '/api/auth/logout', {}, {}, clientCookie);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      // Session should now be false
      const checkRes = await request('GET', '/api/auth/session', null, {}, clientCookie);
      assert.strictEqual(checkRes.body.loggedIn, false);
    });
  });

  // 3. Multi-Tenancy & Access Control
  describe('Tenant Isolation & Role Authorization', () => {
    let adminCookie = '';
    let clientCookie = '';

    before(async () => {
      const adminRes = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      });
      adminCookie = adminRes.setCookie.split(';')[0];

      const clientRes = await request('POST', '/api/auth/login', {
        username: 'jalmahal',
        password: 'jalmahal123'
      });
      clientCookie = clientRes.setCookie.split(';')[0];
    });

    test('client user can only view their own client name in client list', async () => {
      const res = await request('GET', '/api/clients', null, {}, clientCookie);
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.body, ['Jal Mahal Resort & Spa']);
    });

    test('admin user can view all clients in client list', async () => {
      const res = await request('GET', '/api/clients', null, {}, adminCookie);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length > 1);
    });

    test('client user cannot access another client leads (403 Forbidden)', async () => {
      const res = await request('GET', '/api/leads?client=ALIS%20Technology', null, {}, clientCookie);
      assert.strictEqual(res.status, 403);
      assert.ok(res.body.error.includes('Access denied'));
    });

    test('user creates manual lead via user input (POST /api/leads)', async () => {
      const res = await request('POST', '/api/leads', {
        name: 'Rajesh Patel',
        email: 'rajesh@jalmahal.com',
        phone: '+91 97777-66666',
        campaign_name: "Jal Mahal - Women's Day",
        platform: 'Instagram',
        client_name: 'Jal Mahal Resort & Spa',
        status: 'Qualified'
      }, {}, adminCookie);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.lead.name, 'Rajesh Patel');
    });

    test('client user can access their own leads', async () => {
      const res = await request('GET', '/api/leads?client=Jal%20Mahal%20Resort%20%26%20Spa', null, {}, clientCookie);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length > 0);
      res.body.forEach(lead => {
        assert.strictEqual(lead.client_name, 'Jal Mahal Resort & Spa');
      });
    });

    test('client user cannot access admin user management endpoint (403 Forbidden)', async () => {
      const res = await request('GET', '/api/admin/users', null, {}, clientCookie);
      assert.strictEqual(res.status, 403);
    });

    test('admin user can access admin user management endpoint', async () => {
      const res = await request('GET', '/api/admin/users', null, {}, adminCookie);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.some(u => u.username === 'admin'));
    });

    test('client user cannot add new client workspace (403 Forbidden)', async () => {
      const res = await request('POST', '/api/clients', { client_name: 'Unauthorized Client' }, {}, clientCookie);
      assert.strictEqual(res.status, 403);
    });

    test('admin user rejects adding client without client_name (400 Bad Request)', async () => {
      const res = await request('POST', '/api/clients', { client_name: '   ' }, {}, adminCookie);
      assert.strictEqual(res.status, 400);
    });

    test('admin user adds new client successfully (201 Created)', async () => {
      const res = await request('POST', '/api/clients', { client_name: 'Apex Innovation Studio' }, {}, adminCookie);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.client_name, 'Apex Innovation Studio');
    });

    test('admin user cannot add duplicate client name (409 Conflict)', async () => {
      const res = await request('POST', '/api/clients', { client_name: 'apex innovation studio' }, {}, adminCookie);
      assert.strictEqual(res.status, 409);
    });

    test('newly added client appears in GET /api/clients for admin', async () => {
      const res = await request('GET', '/api/clients', null, {}, adminCookie);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.includes('Apex Innovation Studio'));
    });
  });

  // 4. AI Campaign Generation
  describe('Campaign Generation Pipeline', () => {
    let adminCookie = '';

    before(async () => {
      const res = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      });
      adminCookie = res.setCookie.split(';')[0];
    });

    test('rejects campaign generation with missing fields', async () => {
      const res = await request('POST', '/api/campaigns/generate', {
        businessName: 'Incomplete Test'
      }, {}, adminCookie);
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error.includes('Missing required onboarding parameters'));
    });

    test('generates complete campaign structure with fallback/live AI engine', async () => {
      const res = await request('POST', '/api/campaigns/generate', {
        businessName: 'Artisan Cafe',
        products: 'Specialty coffee and organic pastries',
        targetAudience: 'Local coffee lovers and commuters',
        monthlyBudget: 6000,
        primaryGoal: 'Lead Generation',
        platforms: ['Google Search', 'Facebook / Instagram']
      }, {}, adminCookie);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.campaign_name, 'Campaign should have a name');
      assert.ok(res.body.budget_allocation, 'Campaign should have budget allocation');
      assert.ok(res.body.budget_allocation.daily_budget > 0);
      assert.ok(Array.isArray(res.body.targeting?.keywords));
      assert.ok(res.body.targeting.keywords.length >= 5);
      assert.ok(Array.isArray(res.body.ad_creative?.headlines));
      assert.strictEqual(res.body.ad_creative.headlines.length, 3);
      assert.ok(Array.isArray(res.body.ad_creative?.descriptions));
      assert.strictEqual(res.body.ad_creative.descriptions.length, 2);
      assert.ok(res.body.ad_creative?.primary_text);
      assert.ok(res.body.ad_creative?.call_to_action);
      assert.ok(res.body.strategic_rationale);
    });
  });

  // 5. Campaign Launch Pipeline & History
  describe('Campaign Launch Pipeline & Audit History', () => {
    let adminCookie = '';

    before(async () => {
      const res = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      });
      adminCookie = res.setCookie.split(';')[0];
    });

    test('rejects campaign launch without linked accounts', async () => {
      const res = await request('POST', '/api/campaigns/launch', {
        campaign_name: 'No Accounts Campaign',
        budget_allocation: { daily_budget: 150 },
        linked_accounts: {}
      }, {}, adminCookie);
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error.includes('No linked destination selected'));
    });

    test('successfully launches campaign in sandbox mode and logs deployment receipt', async () => {
      const campaignName = `Automated Launch Test ${Date.now()}`;
      const res = await request('POST', '/api/campaigns/launch', {
        campaign_name: campaignName,
        client_name: 'Sanna Innovations',
        businessName: 'Sanna Innovations',
        budget_allocation: { daily_budget: 200, strategy: 'Multi-platform' },
        targeting: {
          keywords: ['sanna interiors', 'luxury design', 'interior architect'],
          audience_interests: ['Home improvement', 'Interior design']
        },
        ad_creative: {
          headlines: ['Luxury Home Interiors', 'Modern Architecture', 'Book Consultation'],
          descriptions: ['Transform your living space today with award-winning designs.', 'Free 3D consultation.'],
          primary_text: 'Award-winning interior design for modern homes.',
          call_to_action: 'Get Free Quote'
        },
        linked_accounts: {
          meta: 'act_meta_sandbox_999',
          google: 'act_google_sandbox_888',
          linkedin: 'act_linkedin_sandbox_777'
        },
        primaryGoal: 'Lead Generation',
        useLeadForm: true
      }, {}, adminCookie);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.status, 'Active & Live');
      assert.ok(res.body.receipt, 'Receipt should be returned');
      assert.strictEqual(res.body.receipt.campaign_name, campaignName);
      assert.ok(Array.isArray(res.body.deployment_log));

      // Verify campaign launch audit was written to SQLite database
      const historyRes = await request('GET', '/api/campaigns/history?client=Sanna%20Innovations', null, {}, adminCookie);
      assert.strictEqual(historyRes.status, 200);
      assert.ok(Array.isArray(historyRes.body));
      const found = historyRes.body.find(h => h.campaign_name === campaignName);
      assert.ok(found, 'Launched campaign should appear in audit history table');
      assert.strictEqual(found.client_name, 'Sanna Innovations');
    });
  });

  // 6. Leads Pipeline & Status Updates & Deletion
  describe('Leads Management Operations', () => {
    let adminCookie = '';
    let testLeadId = '';

    before(async () => {
      const res = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      });
      adminCookie = res.setCookie.split(';')[0];
    });

    test('rejects manual lead creation without name', async () => {
      const res = await request('POST', '/api/leads', {
        email: 'noname@example.com'
      }, {}, adminCookie);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'Lead full name is required.');
    });

    test('creates manual lead via user input (POST /api/leads)', async () => {
      const res = await request('POST', '/api/leads', {
        name: 'Ananya Roy',
        email: 'ananya@example.com',
        phone: '+91 91234-56789',
        campaign_name: 'Summer Promo 2026',
        platform: 'Direct Input',
        client_name: 'Sanna Innovations',
        status: 'New'
      }, {}, adminCookie);

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.lead.name, 'Ananya Roy');
      assert.strictEqual(res.body.lead.status, 'New');
    });

    test('ingests new lead via Webhook endpoint', async () => {
      const res = await request('POST', '/api/webhooks/leads', {
        name: 'Jordan Lee',
        email: 'jordan.lee@example.com',
        phone: '+1 555-019-2831',
        campaign_name: 'Summer Promo Test',
        platform: 'Facebook',
        client_name: 'Sanna Innovations'
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.message, 'Lead ingested successfully');
      assert.ok(res.body.lead.id);
      testLeadId = res.body.lead.id;
    });

    test('fetches leads list including the ingested lead', async () => {
      const res = await request('GET', '/api/leads?client=Sanna%20Innovations', null, {}, adminCookie);
      assert.strictEqual(res.status, 200);
      const found = res.body.find(l => l.id === testLeadId);
      assert.ok(found);
      assert.strictEqual(found.status, 'New');
    });

    test('updates lead status to Contacted and Qualified', async () => {
      // Update to Contacted
      const res1 = await request('PUT', `/api/leads/${testLeadId}/status`, {
        status: 'Contacted'
      }, {}, adminCookie);
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res1.body.status, 'Contacted');

      // Update to Qualified
      const res2 = await request('PUT', `/api/leads/${testLeadId}/status`, {
        status: 'Qualified'
      }, {}, adminCookie);
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.body.status, 'Qualified');
    });

    test('rejects invalid lead status update', async () => {
      const res = await request('PUT', `/api/leads/${testLeadId}/status`, {
        status: 'InvalidStatus'
      }, {}, adminCookie);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, 'Invalid status');
    });

    test('deletes lead by ID', async () => {
      const res = await request('DELETE', `/api/leads/${testLeadId}`, null, {}, adminCookie);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      // Verify deletion
      const checkRes = await request('GET', '/api/leads', null, {}, adminCookie);
      const found = checkRes.body.find(l => l.id === testLeadId);
      assert.strictEqual(found, undefined, 'Deleted lead should no longer exist');
    });
  });

  // 7. Webhooks & Integrations
  describe('Webhooks & Verification', () => {
    test('Meta Webhook GET verification handles correct token', async () => {
      const verifyToken = process.env.META_VERIFY_TOKEN || 'astraads_verify_token_secret';
      const challenge = 'test_challenge_code_9918';
      const res = await request('GET', `/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${challenge}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body, challenge);
    });

    test('Meta Webhook GET verification rejects invalid token', async () => {
      const res = await request('GET', `/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=123`);
      assert.strictEqual(res.status, 403);
    });

    test('generates client-isolated test webhook lead', async () => {
      const res = await request('POST', '/api/webhooks/test', {
        client_name: 'Jal Mahal Resort & Spa'
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.message, 'Test lead injected successfully');
      assert.strictEqual(res.body.lead.client_name, 'Jal Mahal Resort & Spa');
    });

    test('ingests Google Ads Webhook payload', async () => {
      const res = await request('POST', '/api/webhooks/google?client=Jal%20Mahal%20Resort%20%26%20Spa', {
        lead_id: 'goog_test_001',
        campaign_id: '12345678',
        google_key: 'astraads_google_key_secret',
        user_column_data: [
          { column_id: 'FULL_NAME', string_value: 'Pooja Hegde' },
          { column_id: 'EMAIL', string_value: 'pooja@example.com' },
          { column_id: 'PHONE_NUMBER', string_value: '+91 9123456780' }
        ]
      });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.lead.name, 'Pooja Hegde');
      assert.strictEqual(res.body.lead.email, 'pooja@example.com');
      assert.strictEqual(res.body.lead.platform, 'Google');
    });
  });

  // 8. Analytics & Statistics Calculation
  describe('Analytics & Stats Calculation', () => {
    let adminCookie = '';

    before(async () => {
      const res = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      });
      adminCookie = res.setCookie.split(';')[0];
    });

    test('calculates analytics metrics accurately', async () => {
      const res = await request('GET', '/api/stats', null, {}, adminCookie);
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.body.total === 'number');
      assert.ok(res.body.total > 0);
      assert.ok(res.body.byStatus);
      assert.ok(typeof res.body.byStatus.New === 'number');
      assert.ok(typeof res.body.byStatus.Qualified === 'number');
      assert.ok(typeof res.body.conversionRate === 'number');
      assert.ok(Array.isArray(res.body.byCampaign));
      assert.ok(Array.isArray(res.body.byPlatform));
    });

    test('calculates client-scoped statistics', async () => {
      const res = await request('GET', '/api/stats?client=Jal%20Mahal%20Resort%20%26%20Spa', null, {}, adminCookie);
      assert.strictEqual(res.status, 200);
      assert.ok(typeof res.body.total === 'number');
    });
  });

  // 9. Admin User Account Lifecycle
  describe('Admin User Account Lifecycle', () => {
    let adminCookie = '';
    const tempUser = `client_test_${Date.now()}`;

    before(async () => {
      const res = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      });
      adminCookie = res.setCookie.split(';')[0];
    });

    test('admin creates a new client user account', async () => {
      const res = await request('POST', '/api/admin/users', {
        username: tempUser,
        password: 'TempPassword123!',
        client_name: 'Test Client Inc'
      }, {}, adminCookie);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });

    test('newly created client user can log in', async () => {
      const loginRes = await request('POST', '/api/auth/login', {
        username: tempUser,
        password: 'TempPassword123!'
      });
      assert.strictEqual(loginRes.status, 200);
      assert.strictEqual(loginRes.body.role, 'client');
      assert.strictEqual(loginRes.body.client_name, 'Test Client Inc');
    });

    test('admin cannot delete their own account', async () => {
      const res = await request('DELETE', '/api/admin/users/admin', null, {}, adminCookie);
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.error.includes('cannot delete your own admin account'));
    });

    test('admin deletes the newly created client user account', async () => {
      const res = await request('DELETE', `/api/admin/users/${tempUser}`, null, {}, adminCookie);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      // Verify user can no longer log in
      const loginRes = await request('POST', '/api/auth/login', {
        username: tempUser,
        password: 'TempPassword123!'
      });
      assert.strictEqual(loginRes.status, 401);
    });
  });

  // 10. Ad Accounts Connection & Sandbox OAuth Management
  describe('Ad Accounts Connection & OAuth Management', () => {
    let adminCookie = '';

    before(async () => {
      const res = await request('POST', '/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      });
      adminCookie = res.setCookie.split(';')[0];
    });

    test('Meta OAuth start serves sandbox connection page when live app ID is unconfigured', async () => {
      const res = await request('GET', '/api/auth/facebook?client=Sanna%20Innovations', null, {}, adminCookie);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('Meta Ads Connection'));
      assert.ok(res.body.includes('Link Sandbox Meta Account'));
    });

    test('saves Meta ad account asset linkage and verifies status', async () => {
      // Connect Meta
      const saveRes = await request('POST', '/api/auth/facebook/save', {
        client_name: 'Sanna Innovations',
        user_access_token: 'sandbox_user_token_abc',
        page_id_json: JSON.stringify({ id: '9988776655', name: 'Sanna Innovations FB Page' }),
        ad_account_id_json: JSON.stringify({ id: '1122334455', name: 'Sanna Ad Account' }),
        page_tokens: JSON.stringify({ '9988776655': 'sandbox_page_token_abc' })
      }, {}, adminCookie);

      assert.strictEqual(saveRes.status, 200);
      assert.ok(saveRes.body.includes('Connection Successful'));

      // Verify connection endpoint reports connected
      const connRes = await request('GET', '/api/clients/connections?client=Sanna%20Innovations', null, {}, adminCookie);
      assert.strictEqual(connRes.status, 200);
      assert.strictEqual(connRes.body.connected, true);
      assert.strictEqual(connRes.body.ads_ready, true);
      assert.strictEqual(connRes.body.ad_account_id, 'act_1122334455');
    });

    test('disconnects Meta ad account connection', async () => {
      const discRes = await request('DELETE', '/api/clients/connections/facebook?client=Sanna%20Innovations', null, {}, adminCookie);
      assert.strictEqual(discRes.status, 200);
      assert.strictEqual(discRes.body.success, true);

      // Verify connection is now false
      const connRes = await request('GET', '/api/clients/connections?client=Sanna%20Innovations', null, {}, adminCookie);
      assert.strictEqual(connRes.status, 200);
      assert.strictEqual(connRes.body.connected, false);
      assert.strictEqual(connRes.body.ads_ready, false);
    });

    test('Google OAuth start serves sandbox connection page when live client ID is unconfigured', async () => {
      const res = await request('GET', '/api/auth/google?client=Sanna%20Innovations', null, {}, adminCookie);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('Google Ads Connection'));
      assert.ok(res.body.includes('Link Sandbox Google Account'));
    });

    test('saves Google Ads account linkage and verifies status', async () => {
      // Connect Google
      const saveRes = await request('POST', '/api/auth/google/save', {
        client_name: 'Sanna Innovations',
        refresh_token: 'sandbox_google_refresh_token',
        customer_id: '555-444-3333',
        account_name: 'Sanna Innovations Google Ads'
      }, {}, adminCookie);

      assert.strictEqual(saveRes.status, 200);
      assert.ok(saveRes.body.includes('Connection Successful'));

      // Verify connection endpoint reports connected
      const connRes = await request('GET', '/api/clients/connections/google?client=Sanna%20Innovations', null, {}, adminCookie);
      assert.strictEqual(connRes.status, 200);
      assert.strictEqual(connRes.body.connected, true);
      assert.strictEqual(connRes.body.ads_ready, true);
      assert.strictEqual(connRes.body.customer_id, '5554443333');
    });

    test('disconnects Google Ads account connection', async () => {
      const discRes = await request('DELETE', '/api/clients/connections/google?client=Sanna%20Innovations', null, {}, adminCookie);
      assert.strictEqual(discRes.status, 200);
      assert.strictEqual(discRes.body.success, true);

      // Verify connection is now false
      const connRes = await request('GET', '/api/clients/connections/google?client=Sanna%20Innovations', null, {}, adminCookie);
      assert.strictEqual(connRes.status, 200);
      assert.strictEqual(connRes.body.connected, false);
      assert.strictEqual(connRes.body.ads_ready, false);
    });
  });

  after(() => {
    // Graceful teardown
    setTimeout(() => process.exit(0), 100);
  });
});

