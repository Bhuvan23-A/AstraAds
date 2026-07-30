import { Client } from 'ssh2';
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('C:\\Users\\adith.ADITHYA\\.gemini\\antigravity\\brain\\03d7cb84-8f43-4731-8ea2-dab953081faa\\scratch\\deploy_config.json', 'utf8'));
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH connection established. Deploying Phase 3 Reliability improvements...');
  conn.exec('cd ~/AstraAds && git pull && docker-compose up -d --build && sleep 2 && docker logs astraads-app --tail=20', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      console.log('Deploy completed successfully.');
      conn.end();
    }).on('data', (data) => process.stdout.write(data))
      .stderr.on('data', (data) => process.stderr.write(data));
  });
}).connect({
  host: config.host,
  port: 22,
  username: config.username,
  password: config.password
});
