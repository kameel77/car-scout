#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

// Private isolation marker to ensure tests only run within this safe harness
const RUNNER_TEST_MARKER = 'EMPLOYEE_INTEGRATION_RUNNER_ACTIVE_SAFE_V1';

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function runCmd(cmd, args, options = {}) {
  return spawnSync(cmd, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    timeout: options.timeout || 30000,
    ...options,
  });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkTcpConnection(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(true);
      }
    });

    socket.on('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.on('error', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, host);
  });
}

async function main() {
  console.log('🚀 Starting safe Employee Integration Test Runner...');

  // 1. Verify Docker is running
  const dockerCheck = runCmd('docker', ['info'], { timeout: 10000 });
  if (dockerCheck.status !== 0) {
    console.error('❌ Docker daemon is not running or accessible. Please start Docker.');
    process.exit(1);
  }

  const runId = crypto.randomBytes(4).toString('hex');
  const pgContainer = `cs_pg_test_${runId}`;
  const redisContainer = `cs_redis_test_${runId}`;
  const dbName = 'carscout_employee_test';
  const dbUser = 'test_user';
  const dbPass = crypto.randomBytes(16).toString('hex');

  const pgPort = await getAvailablePort();
  const redisPort = await getAvailablePort();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `cs-emp-test-${runId}-`));

  let containersCreated = [];

  const cleanup = () => {
    console.log('\n🧹 Cleaning up test resources...');
    for (const c of containersCreated) {
      try {
        console.log(`- Removing container ${c}`);
        runCmd('docker', ['rm', '-f', '-v', c], { timeout: 15000 });
      } catch (e) {
        // ignore
      }
    }
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      // ignore
    }
    console.log('✨ Cleanup complete.');
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  try {
    // 2. Start PostgreSQL disposable container with tmpfs for data
    console.log(`📦 Starting PostgreSQL container (${pgContainer}) on 127.0.0.1:${pgPort}...`);
    const pgRun = runCmd('docker', [
      'run',
      '-d',
      '--name', pgContainer,
      '--tmpfs', '/var/lib/postgresql/data:rw,noexec,nosuid,size=256m',
      '-e', `POSTGRES_DB=${dbName}`,
      '-e', `POSTGRES_USER=${dbUser}`,
      '-e', `POSTGRES_PASSWORD=${dbPass}`,
      '-p', `127.0.0.1:${pgPort}:5432`,
      'postgres:16-alpine',
    ], { timeout: 20000 });

    if (pgRun.status !== 0) {
      throw new Error(`Failed to start postgres container: ${pgRun.stderr || pgRun.stdout}`);
    }
    containersCreated.push(pgContainer);

    // 3. Start Redis disposable container with tmpfs for /data
    console.log(`📦 Starting Redis container (${redisContainer}) on 127.0.0.1:${redisPort}...`);
    const redisRun = runCmd('docker', [
      'run',
      '-d',
      '--name', redisContainer,
      '--tmpfs', '/data:rw,noexec,nosuid,size=64m',
      '-p', `127.0.0.1:${redisPort}:6379`,
      'redis:7-alpine',
    ], { timeout: 20000 });

    if (redisRun.status !== 0) {
      throw new Error(`Failed to start redis container: ${redisRun.stderr || redisRun.stdout}`);
    }
    containersCreated.push(redisContainer);

    // 4. Wait for PostgreSQL readiness (docker exec pg_isready + host TCP port readiness)
    console.log('⏳ Waiting for PostgreSQL to become healthy...');
    let pgReady = false;
    for (let i = 0; i < 30; i++) {
      const readyCheck = runCmd('docker', [
        'exec',
        pgContainer,
        'pg_isready',
        '-U', dbUser,
        '-d', dbName,
      ], { timeout: 5000 });

      if (readyCheck.status === 0) {
        const isTcpReady = await checkTcpConnection('127.0.0.1', pgPort, 1000);
        if (isTcpReady) {
          pgReady = true;
          break;
        }
      }
      await sleep(500);
    }

    if (!pgReady) {
      throw new Error('PostgreSQL container did not become ready in time');
    }
    console.log('✅ PostgreSQL is ready.');

    // 5. Wait for Redis readiness (docker exec redis-cli ping + host TCP port readiness)
    console.log('⏳ Waiting for Redis to become healthy...');
    let redisReady = false;
    for (let i = 0; i < 20; i++) {
      const pingCheck = runCmd('docker', [
        'exec',
        redisContainer,
        'redis-cli',
        'ping',
      ], { timeout: 5000 });

      if (pingCheck.status === 0 && pingCheck.stdout.includes('PONG')) {
        const isTcpReady = await checkTcpConnection('127.0.0.1', redisPort, 1000);
        if (isTcpReady) {
          redisReady = true;
          break;
        }
      }
      await sleep(300);
    }

    if (!redisReady) {
      throw new Error('Redis container did not become ready in time');
    }
    console.log('✅ Redis is ready.');

    // 6. Setup isolated schema directory without any .env file to prevent dotenv leaks
    const origSchemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
    const tempSchemaPath = path.join(tempDir, 'schema.prisma');
    fs.copyFileSync(origSchemaPath, tempSchemaPath);

    const databaseUrl = `postgresql://${dbUser}:${dbPass}@127.0.0.1:${pgPort}/${dbName}?schema=public`;
    const redisUrl = `redis://127.0.0.1:${redisPort}`;

    const prismaCliPath = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');
    console.log('🔄 Applying Prisma schema to isolated test DB (prisma db push)...');

    // Bounded retries for prisma db push to ensure DB is accepting connection handshakes
    let pushSuccess = false;
    let pushErrorOutput = '';
    for (let attempt = 1; attempt <= 5; attempt++) {
      const prismaPush = runCmd(
        process.execPath,
        [prismaCliPath, 'db', 'push', '--schema', tempSchemaPath, '--skip-generate'],
        {
          cwd: tempDir, // Run in tempDir where no .env exists
          timeout: 45000,
          env: {
            PATH: process.env.PATH,
            DATABASE_URL: databaseUrl,
          },
        }
      );

      if (prismaPush.status === 0) {
        pushSuccess = true;
        break;
      }
      pushErrorOutput = (prismaPush.stdout || '') + '\n' + (prismaPush.stderr || '');
      await sleep(1000);
    }

    if (!pushSuccess) {
      throw new Error(`Prisma db push failed:\n${pushErrorOutput}`);
    }
    console.log('✅ Database schema pushed successfully.');

    // 7. Run Vitest with isolated environment
    console.log('🧪 Executing Vitest employee integration suite...');
    const vitestCliPath = path.join(backendDir, 'node_modules', 'vitest', 'vitest.mjs');
    const vitestArgs = [
      vitestCliPath,
      'run',
      '--config', path.join(backendDir, 'vitest.employee-integration.config.ts'),
      ...process.argv.slice(2),
    ];

    const child = spawn(process.execPath, vitestArgs, {
      cwd: backendDir,
      stdio: 'inherit',
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        DATABASE_URL: databaseUrl,
        REDIS_URL: redisUrl,
        EMPLOYEE_INTEGRATION_RUNNER_MARKER: RUNNER_TEST_MARKER,
        JWT_SECRET: 'test-jwt-secret-employee-isolated-12345678901234567890',
        TEST_DB_NAME: dbName,
        TEST_DB_PORT: String(pgPort),
        TEST_REDIS_PORT: String(redisPort),
      },
    });

    const exitCode = await new Promise((resolve) => {
      child.on('close', (code) => resolve(code ?? 1));
      child.on('error', (err) => {
        console.error('Child process error:', err);
        resolve(1);
      });
    });

    cleanup();
    process.exit(exitCode);
  } catch (err) {
    console.error('❌ Error during integration runner execution:', err.message || err);
    cleanup();
    process.exit(1);
  }
}

main();
