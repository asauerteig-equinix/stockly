import { execSync, spawn } from "node:child_process";
import process from "node:process";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const autoSeed = (process.env.AUTO_SEED ?? "true").toLowerCase() === "true";

function run(command) {
  execSync(command, {
    stdio: "inherit"
  });
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
  run("npx prisma migrate deploy");
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
