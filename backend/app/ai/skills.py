"""Shared skill vocabulary, alias normalisation and evidence search.

Keyword matching has false positives and negatives. Ambiguous names (go, r, c, express)
are only detected in prose through explicit aliases (e.g. "golang"); otherwise they can
only be verified from the recruiter-entered profile."""

import re
from functools import lru_cache

_VOCAB: dict[str, tuple[str, ...]] = {
    "python": (), "java": (), "javascript": ("js", "ecmascript"), "typescript": (),
    "c++": ("cpp",), "c#": ("csharp", "c sharp"), "go": ("golang",), "rust": (), "kotlin": (),
    "swift": (), "php": (), "ruby": (), "scala": (), "bash": ("shell scripting",),
    "r": ("r language", "r programming"), "c": ("c language", "c programming"), "sql": (),
    "html": ("html5",), "css": ("css3",), "react": ("react.js", "reactjs"),
    "next.js": ("nextjs",), "vue": ("vue.js", "vuejs"), "angular": ("angularjs",),
    "tailwind css": ("tailwind", "tailwindcss"), "redux": (), "node.js": ("nodejs", "node js"),
    "express": ("express.js", "expressjs"), "django": (), "flask": (), "fastapi": (),
    "spring boot": ("springboot",), ".net": ("dotnet", "asp.net"),
    "postgresql": ("postgres",), "mysql": (), "mongodb": ("mongo",), "redis": (), "sqlite": (),
    "elasticsearch": (), "sql server": ("mssql",),
    "docker": (), "kubernetes": ("k8s",), "terraform": (), "ansible": (),
    "aws": ("amazon web services",), "azure": (), "gcp": ("google cloud",), "linux": (),
    "git": (), "github actions": (), "jenkins": (), "ci/cd": ("cicd", "ci cd"),
    "prometheus": (), "grafana": (),
    "rest apis": ("rest api", "restful api", "restful apis"), "graphql": (), "grpc": (),
    "microservices": (),
    "machine learning": ("ml",), "deep learning": (),
    "nlp": ("natural language processing",), "scikit-learn": ("sklearn", "scikit learn"),
    "pytorch": (), "tensorflow": (), "pandas": (), "numpy": (),
    "spark": ("apache spark", "pyspark"), "airflow": ("apache airflow",), "statistics": (),
    "tableau": (), "power bi": ("powerbi",),
    "selenium": (), "cypress": (), "pytest": (), "jest": (),
    "test automation": ("automation testing", "automated testing"), "api testing": (),
    "jira": (), "agile": ("scrum",),
}

AMBIGUOUS = frozenset({"go", "r", "c", "express"})
_ALIAS_TO_CANON = {a: canon for canon, aliases in _VOCAB.items() for a in aliases}

_BEFORE = r"(?<![A-Za-z0-9+#.])"
_AFTER = r"(?![A-Za-z0-9+#])"


def canonical(skill: str) -> str:
    s = " ".join(skill.lower().split())
    return _ALIAS_TO_CANON.get(s, s)


@lru_cache(maxsize=1024)
def _pattern(canon: str) -> re.Pattern[str] | None:
    aliases = _VOCAB.get(canon, ())
    terms = list(aliases) if canon in AMBIGUOUS else [canon, *aliases]
    if not terms:
        return None
    body = "|".join(
        re.escape(t).replace(r"\ ", r"\s+") for t in sorted(terms, key=len, reverse=True)
    )
    return re.compile(f"{_BEFORE}(?:{body}){_AFTER}", re.IGNORECASE)


def snippet(text: str, start: int, end: int, pad: int = 70) -> str:
    return " ".join(text[max(0, start - pad) : end + pad].split())[:200]


def _search(text: str, skill: str) -> re.Match[str] | None:
    pattern = _pattern(canonical(skill))
    return pattern.search(text) if pattern else None


def find_skill(text: str, skill: str) -> str | None:
    """Evidence snippet if the skill (or an alias) appears in the text, else None."""
    m = _search(text, skill)
    return snippet(text, m.start(), m.end()) if m else None


def scan_vocab(text: str) -> list[tuple[str, str]]:
    """(skill, evidence) for every vocabulary skill found, ordered by first appearance."""
    hits: list[tuple[int, str, str]] = []
    for canon in _VOCAB:
        m = _search(text, canon)
        if m:
            hits.append((m.start(), canon, snippet(text, m.start(), m.end())))
    hits.sort()
    return [(canon, ev) for _, canon, ev in hits]
