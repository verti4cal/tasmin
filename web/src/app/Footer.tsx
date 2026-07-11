import { useEffect, useState } from "react";
import { versionApi } from "./versionApi.js";

const GITHUB_URL = "https://github.com/verti4cal/tasmin";

export function Footer() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    versionApi
      .get()
      .then((res) => setVersion(res.version))
      .catch(() => setVersion(null));
  }, []);

  return (
    <footer className="mt-8 pt-4 border-t text-sm text-gray-500 flex items-center justify-center gap-1.5">
      <span>
        Tasmin{version ? ` @ v${version}` : ""}
      </span>
      <span>-</span>
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 hover:text-gray-700"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.94.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.88-1.36-3.88-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.66.79.55A10.51 10.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
        </svg>
        GitHub
      </a>
    </footer>
  );
}
