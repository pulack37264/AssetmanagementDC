/** Check the API and SQL Server health endpoints (run with: node test-api.js). */
const BASE = process.env.BASE_URL || 'http://localhost:3001/api';

async function test() {
  for (const endpoint of ['/health', '/health/db']) {
    const response = await fetch(`${BASE}${endpoint}`);
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(`${endpoint}: ${result.error || response.statusText}`);
    console.log(`${endpoint}:`, result.data);
  }
}

test().catch((e) => {
  console.error(e);
  process.exit(1);
});
