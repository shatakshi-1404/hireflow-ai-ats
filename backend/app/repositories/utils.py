def like_pattern(q: str) -> str:
    """Escape LIKE wildcards so user input is matched literally."""
    escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"
