import { execSync, spawn } from "node:child_process";
import process from "node:process";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const autoSeed = (process.env.AUTO_SEED ?? "true").toLowerCase() === "true";
const retryAttempts = 20;
const retryDelayMs = 3000;

function run(command) {
  execSync(command, {
    stdio: "inherit"
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runWithRetry(command) {
  let lastError;

  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    try {
      console.log(`Starte: ${command} (Versuch ${attempt}/${retryAttempts})`);
      run(command);
      return;
    } catch (error) {
      lastError = error;
      console.error(`Befehl fehlgeschlagen: ${command}`);

      if (attempt < retryAttempts) {
        console.log(`Warte ${retryDelayMs / 1000} Sekunden und versuche erneut...`);
        await sleep(retryDelayMs);
      }
    }
  }

  throw lastError;
}

async function maybeSeed() {
  if (!autoSeed) {
    console.log("AUTO_SEED ist deaktiviert. Seed wird uebersprungen.");
    return;
  }

  const userCount = await prisma.user.count();

  if (userCount > 0) {
    console.log("Datenbank enthaelt bereits Benutzer. Seed wird uebersprungen.");
    return;
  }

  console.log("Leere Datenbank erkannt. Seed wird ausgefuehrt.");
  run("npm run db:seed");
}

async function main() {
  await runWithRetry("npx prisma migrate deploy");
  await maybeSeed();
  await prisma.$disconnect();

  const server = spawn("node", ["server.js"], {
    stdio: "inherit"
  });

  const forwardSignal = (signal) => {
    if (!server.killed) {
      server.kill(signal);
    }
  };

  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);

  server.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch(async (error) => {
  console.error("Bootstrap fehlgeschlagen:", error);
  await prisma.$disconnect();
  process.exit(1);
});
