const absoluteUrlPattern = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

export function normalizeBasePath(input?: string | null) {
  const trimmed = input?.trim();

  if (!trimmed || trimmed === "/") {
    return "";
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

export const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_PATH);

export function withBasePath(path: string) {
  if (!path) {
    return basePath || "/";
  }

  if (absoluteUrlPattern.test(path) || path.startsWith("//")) {
    return path;
  }

  if (!path.startsWith("/")) {
    return path;
  }

  if (!basePath || path === basePath || path.startsWith(`${basePath}/`)) {
    return path || "/";
  }

  return path === "/" ? basePath : `${basePath}${path}`;
}

export function stripBasePath(path: string) {
  if (!basePath) {
    return path || "/";
  }

  if (path === basePath) {
    return "/";
  }

  if (path.startsWith(`${basePath}/`)) {
    return path.slice(basePath.length) || "/";
  }

  return path || "/";
}

export function getCookiePath() {
  return basePath || "/";
}
