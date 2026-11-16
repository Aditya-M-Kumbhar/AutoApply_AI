import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';
import { computeTFIDF } from './matchingEngine.js';
import redisManager from '../config/redis.js';

// Load environmental parameters
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function runDiagnostics() {
  console.log('================================================================');
  console.log('         TALENTRADAR DIAGNOSTICS & SYSTEM INTEGRITY RUN');
  console.log('================================================================\n');

  // 1. Environment Variable Validation
  console.log('[1/4] Checking Environment Variables...');
  const keyMap = {
    MONGO_URI: process.env.MONGODB_URI || process.env.MONGO_URI,
    REDIS_URL: process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    ADZUNA_APP_ID: process.env.ADZUNA_APP_ID,
    ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY,
    MUSE_API_KEY: process.env.MUSE_API_KEY,
  };

  let missingCount = 0;
  for (const [key, val] of Object.entries(keyMap)) {
    if (val) {
      console.log(`  ✓ ${key}: Configured (${key.includes('KEY') || key.includes('URL') || key.includes('SECRET') || key.includes('URI') ? '********' : val})`);
    } else {
      console.warn(`  ✗ ${key}: MISSING!`);
      missingCount++;
    }
  }
  if (missingCount === 0) {
    console.log('  ✓ All critical environment variables are correctly set.\n');
  } else {
    console.warn(`  ! Warning: ${missingCount} configuration parameters are missing.\n`);
  }

  // 2. TF-IDF Local Matching Engine Test
  console.log('[2/4] Testing Algorithmic TF-IDF Matching Engine...');
  const mockUserSkills = ['React', 'Node.js', 'Redis', 'JavaScript'];
  const mockJobDesc = 'Looking for a Senior Software Engineer with expertise in React, Node.js, and Redis caching. Experience with Javascript development is required.';
  
  try {
    const score = computeTFIDF(mockUserSkills, mockJobDesc);
    console.log(`  ✓ Match Score computed: ${score}% (Expected ~100% since matching key skills React, Node.js, Redis, JavaScript)`);
    if (score > 0) {
      console.log('  ✓ TF-IDF similarity calculation operates successfully in pure server-side JS.\n');
    } else {
      throw new Error('Match score was zero, logic check failed.');
    }
  } catch (err) {
    console.error(`  ✗ TF-IDF Test failed: ${err.message}\n`);
  }

  // 3. Upstash Redis Cloud Connection Test
  console.log('[3/4] Connecting to Redis...');
  try {
    const redis = redisManager.getClient();
    const reply = await redis.ping();
    console.log(`  ✓ Redis connection established: received PING response -> ${reply}`);
    console.log('  ✓ Upstash Redis Cloud connectivity verified successfully.\n');
  } catch (err) {
    console.error(`  ✗ Redis Connection failed: ${err.message}\n`);
  }

  // 4. API Endpoints Connectivity Audit
  console.log('[4/4] Auditing External Job API Endpoints...');
  
  // Adzuna API
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (appId && appKey) {
    try {
      const adzunaUrl = `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=1&what=software+engineer`;
      console.log(`  - Pinging Adzuna India endpoint: ${adzunaUrl.replace(appKey, '********')}`);
      const adzunaRes = await axios.get(adzunaUrl);
      if (adzunaRes.status === 200) {
        console.log(`  ✓ Adzuna endpoint online. Returned ${adzunaRes.data?.results?.length || 0} results.`);
      } else {
        console.warn(`  ! Adzuna returned status: ${adzunaRes.status}`);
      }
    } catch (err) {
      console.error(`  ✗ Adzuna ping failed: ${err.message}`);
    }
  } else {
    console.warn('  - Skipping Adzuna ping (keys missing)');
  }

  // The Muse API
  const museKey = process.env.MUSE_API_KEY;
  try {
    const museUrl = `https://www.themuse.com/api/public/jobs?page=1&descending=true${museKey ? `&api_key=${museKey}` : ''}`;
    console.log(`  - Pinging The Muse unified endpoint: ${museUrl.replace(museKey || 'none', '********')}`);
    const museRes = await axios.get(museUrl);
    if (museRes.status === 200) {
      console.log(`  ✓ The Muse endpoint online. Returned ${museRes.data?.results?.length || 0} jobs.`);
    } else {
      console.warn(`  ! The Muse returned status: ${museRes.status}`);
    }
  } catch (err) {
    console.error(`  ✗ The Muse ping failed: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log('              INTEGRITY AUDIT RUN COMPLETED');
  console.log('================================================================');
  
  // Exit script execution cleanly
  process.exit(0);
}

runDiagnostics().catch(err => {
  console.error('Critical diagnostics failure:', err);
  process.exit(1);
});
