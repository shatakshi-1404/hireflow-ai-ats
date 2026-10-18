"""Scans git-tracked files for committed secrets and files that should never be tracked."""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SELF = Path(__file__).resolve()

PATTERNS = {
    "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "AWS access key id": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "API key (sk-...)": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}"),
    "database URL with password": re.compile(r"postgres(?:ql)?(?:\+\w+)?://[^:\s/]+:[^@\s]+@"),
    "hard-coded SECRET_KEY": re.compile(r"SECRET_KEY\s*[=:]\s*[\"']?[A-Za-z0-9_\-+/=]{20,}"),
}
# Lines containing these are known-safe placeholders or the local dev credentials.
ALLOW = ("hireflow_dev_password", "change-me", "test-secret", "<your", "placeholder")
FORBIDDEN = re.compile(r"(^|/)(\.env(\..+)?|uploads/|node_modules/|\.venv/|dist/)")


def tracked_files() -> list[str]:
    out = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout
    return [line for line in out.splitlines() if line]


def main() -> int:
    problems: list[str] = []
    for rel in tracked_files():
        if FORBIDDEN.search(rel) and not rel.endswith(".env.example"):
            problems.append(f"{rel}: this path should not be tracked")
            continue
        path = ROOT / rel
        if path.resolve() == SELF or not path.is_file() or path.stat().st_size > 1_000_000:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for number, line in enumerate(text.splitlines(), start=1):
            if any(token in line for token in ALLOW):
                continue
            for label, pattern in PATTERNS.items():
                if pattern.search(line):
                    problems.append(f"{rel}:{number}: possible {label}")
    if problems:
        print("Possible secrets or unsafe tracked files:")
        print("\n".join(f"  - {p}" for p in problems))
        print("\nIf any of these is real: remove it, rotate the secret, and rewrite history if it was pushed.")
        return 1
    print("No obvious secrets found in tracked files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
