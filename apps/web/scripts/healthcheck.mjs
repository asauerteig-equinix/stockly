import process from "node:process";

function normalizeBasePath(input) {
  const trimmed = input?.trim();

  if (!trimmed || trimmed === "/") {
    return "";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

async function request(pathname) {
  const port = process.env.PORT ?? "3000";
  const url = `http://127.0.0.1:${port}${pathname}`;
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(4000)
  });

  return response.status;
}

async function main() {
  const basePath = normalizeBasePath(process.env.BASE_PATH);
  const candidates = Array.from(
    new Set(
      [
        basePath ? `${basePath}/api/health` : null,
        "/api/health",
        basePath || null,
        "/"
      ].filter(Boolean)
    )
  );

  for (const candidate of candidates) {
    try {
      const status = await request(candidate);

      if (status > 0 && status < 500) {
        process.exit(0);
      }
    } catch {
      // Try the next fallback path.
    }
  }

  process.exit(1);
}

main();
