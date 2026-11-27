"""cure_oracle/security.py — Transparent security layer.

RBAC roles, SELinux-compatible path management, error sanitization,
and a Keccak-256 chained audit log for full operational transparency.

Environment variables
---------------------
CURE_API_TOKENS   JSON object {"<bearer_token>": "<role>"}  (default: {})
CURE_CERT_DIR     Directory for birth certificates           (default: cure_certs)
CURE_AUDIT_DIR    Directory for audit.jsonl                  (default: cure_audit)
"""

from __future__ import annotations

import json
import logging
import os
import re
import stat
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable, ClassVar, Optional

from fastapi import Depends, Header, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_log = logging.getLogger(__name__)

# ── Keccak-256 (via meshmeta_v2) ──────────────────────────────────────────────

def _keccak256_hex(data: str) -> str:
    """Return '0x' + 64-hex keccak256 of UTF-8 encoded data."""
    try:
        from meshmeta_v2 import keccak256 as _k
        raw = _k(data.encode("utf-8"))
        return "0x" + raw.hex()
    except Exception:
        # fallback: SHA-3 256 (not identical to Keccak-256 but safe for audit chain)
        import hashlib
        raw = hashlib.sha3_256(data.encode("utf-8")).digest()
        return "0x" + raw.hex()


# ── RBAC roles ────────────────────────────────────────────────────────────────

class Role(str, Enum):
    VIEWER    = "viewer"     # read-only: GET shapes, GET audit chain
    OPERATOR  = "operator"   # run benchmark / round / MENTE check
    QPU_ADMIN = "qpu_admin"  # ibm mode (real QPU)


_ROLE_ORDER = {Role.VIEWER: 0, Role.OPERATOR: 1, Role.QPU_ADMIN: 2}


def _load_token_map() -> dict[str, Role]:
    raw = os.getenv("CURE_API_TOKENS", "{}")
    try:
        mapping = json.loads(raw)
        return {k: Role(v) for k, v in mapping.items() if isinstance(k, str)}
    except Exception:
        _log.warning("CURE_API_TOKENS could not be parsed; using empty map")
        return {}


def get_current_role(authorization: Optional[str] = Header(None)) -> Role:
    """Extract Bearer token from Authorization header and resolve Role.

    Returns Role.VIEWER when no token is provided (unauthenticated read-only
    access to public GET endpoints).  Raises 401 for an unrecognised token.
    """
    if authorization is None:
        return Role.VIEWER
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")
    token = authorization[7:].strip()
    token_map = _load_token_map()
    if not token_map:
        # No tokens configured — treat any bearer as OPERATOR (dev mode)
        return Role.OPERATOR
    role = token_map.get(token)
    if role is None:
        raise HTTPException(status_code=401, detail="Invalid or unknown token")
    return role


def require_role(min_role: Role) -> Callable:
    """Dependency factory: raise 403 when caller's role is below min_role.
    Usage: role: Role = Depends(require_role(Role.OPERATOR))
    """
    def _check(role: Role = Depends(get_current_role)) -> Role:
        if _ROLE_ORDER[role] < _ROLE_ORDER[min_role]:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{role.value}' insufficient; '{min_role.value}' required",
            )
        return role
    return _check


# ── Path management (SELinux-compatible) ──────────────────────────────────────

CERT_BASE_DIR = Path(os.getenv("CURE_CERT_DIR",  "cure_certs"))
AUDIT_LOG_DIR = Path(os.getenv("CURE_AUDIT_DIR", "cure_audit"))

_SAFE_FILENAME_RE = re.compile(r"^[\w\-. ]+\.json$")


def safe_cert_path(filename: str) -> Path:
    """Resolve *filename* inside CERT_BASE_DIR.

    Raises ValueError when:
    - filename contains path separators ('/', '\\', '..')
    - extension is not '.json'
    - filename is empty
    - resolved path escapes CERT_BASE_DIR
    """
    if not filename:
        raise ValueError("cert filename must not be empty")
    if "/" in filename or "\\" in filename or ".." in filename:
        raise ValueError(f"cert filename must not contain path separators: {filename!r}")
    if not filename.lower().endswith(".json"):
        raise ValueError(f"cert filename must end with .json: {filename!r}")
    if not _SAFE_FILENAME_RE.match(filename):
        raise ValueError(f"cert filename contains disallowed characters: {filename!r}")

    CERT_BASE_DIR.mkdir(parents=True, exist_ok=True)
    resolved = (CERT_BASE_DIR / filename).resolve()
    base_resolved = CERT_BASE_DIR.resolve()

    # Ensure the resolved path is strictly inside the base directory
    try:
        resolved.relative_to(base_resolved)
    except ValueError:
        raise ValueError(f"cert_path escapes base directory: {filename!r}")

    return resolved


def secure_write_json(path: Path, data: dict) -> None:
    """Write JSON to *path* and set owner-only permissions (chmod 0o600).

    Compatible with SELinux file labelling: file is written then chmod'd.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)  # 0o600
    except OSError:
        pass  # Windows / container without ownership control


# ── Error sanitization ────────────────────────────────────────────────────────

_SECRET_PATTERNS: list[re.Pattern] = [
    re.compile(r"[A-Za-z0-9\-_]{40,}"),                                    # API key / JWT
    re.compile(r"crn:[^\s\"']+"),                                           # IBM Cloud CRN
    re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"),     # email address
]


def sanitize_error(exc: Exception, *, context: str = "") -> str:
    """Return a safe error string with secrets redacted.

    Removes tokens, CRNs and email addresses from the exception message.
    Falls back to 'internal server error' for unexpected types.
    """
    try:
        message = str(exc)
    except Exception:
        return "internal server error"

    for pattern in _SECRET_PATTERNS:
        message = pattern.sub("[REDACTED]", message)

    if context:
        return f"{context}: {message}"
    return message


# ── Audit event & logger ──────────────────────────────────────────────────────

_GENESIS_HASH = "0x" + "0" * 64


@dataclass
class AuditEvent:
    event_id:  str
    timestamp: str
    role:      str
    action:    str
    resource:  str
    outcome:   str
    detail:    dict
    prev_hash: str
    sig:       str


class AuditLogger:
    """Thread-safe, Keccak-256 chained audit log.

    Each event's ``sig`` is computed over the concatenation of its
    core fields plus ``prev_hash``, forming a tamper-evident chain.
    Events are appended to ``AUDIT_LOG_DIR/audit.jsonl``.
    """

    _instance: ClassVar[Optional["AuditLogger"]] = None
    _init_lock: ClassVar[threading.Lock] = threading.Lock()

    def __init__(self) -> None:
        self._lock = threading.Lock()
        AUDIT_LOG_DIR.mkdir(parents=True, exist_ok=True)
        self._log_path = AUDIT_LOG_DIR / "audit.jsonl"
        self._last_sig: str = self._load_last_sig()

    # ── singleton ─────────────────────────────────────────────────────────────

    @classmethod
    def get(cls) -> "AuditLogger":
        if cls._instance is None:
            with cls._init_lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        """Reset singleton (used in tests)."""
        with cls._init_lock:
            cls._instance = None

    # ── internal ──────────────────────────────────────────────────────────────

    def _load_last_sig(self) -> str:
        if not self._log_path.exists():
            return _GENESIS_HASH
        try:
            lines = self._log_path.read_text(encoding="utf-8").strip().splitlines()
            if not lines:
                return _GENESIS_HASH
            last = json.loads(lines[-1])
            return last.get("sig", _GENESIS_HASH)
        except Exception:
            return _GENESIS_HASH

    @staticmethod
    def _compute_sig(
        event_id: str, timestamp: str, role: str, action: str,
        resource: str, outcome: str, prev_hash: str,
    ) -> str:
        payload = event_id + timestamp + role + action + resource + outcome + prev_hash
        return _keccak256_hex(payload)

    # ── public API ────────────────────────────────────────────────────────────

    def log(
        self,
        role: str,
        action: str,
        resource: str,
        outcome: str,
        detail: Optional[dict] = None,
    ) -> AuditEvent:
        """Append one event to the chain and return it."""
        with self._lock:
            event_id  = str(uuid.uuid4())
            timestamp = datetime.now(timezone.utc).isoformat()
            prev_hash = self._last_sig
            sig = self._compute_sig(
                event_id, timestamp, role, action, resource, outcome, prev_hash,
            )
            event = AuditEvent(
                event_id=event_id,
                timestamp=timestamp,
                role=str(role),
                action=action,
                resource=resource,
                outcome=outcome,
                detail=detail or {},
                prev_hash=prev_hash,
                sig=sig,
            )
            line = json.dumps(asdict(event), ensure_ascii=False)
            with self._log_path.open("a", encoding="utf-8") as fh:
                fh.write(line + "\n")
            try:
                os.chmod(self._log_path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP)  # 0o640
            except OSError:
                pass
            self._last_sig = sig
        return event

    def get_chain(self, limit: int = 50) -> list[AuditEvent]:
        """Return the most recent *limit* events in chronological order."""
        if not self._log_path.exists():
            return []
        try:
            lines = self._log_path.read_text(encoding="utf-8").strip().splitlines()
        except Exception:
            return []
        events: list[AuditEvent] = []
        for line in lines[-limit:]:
            try:
                events.append(AuditEvent(**json.loads(line)))
            except Exception:
                continue
        return events


# ── FastAPI middleware ────────────────────────────────────────────────────────

class SecurityAuditMiddleware(BaseHTTPMiddleware):
    """Record every HTTP request/response in the audit chain.

    Request bodies are never logged to prevent secret leakage.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Determine role from Authorization header (best-effort; no 401 raised here)
        auth = request.headers.get("Authorization")
        try:
            role = get_current_role(auth)
        except HTTPException:
            role = Role.VIEWER  # type: ignore[assignment]

        response = await call_next(request)
        status_code = response.status_code

        if status_code >= 500:
            outcome = "failure"
        elif status_code in (401, 403):
            outcome = "denied"
        else:
            outcome = "success"

        AuditLogger.get().log(
            role=str(role.value) if isinstance(role, Role) else str(role),
            action=f"{request.method} {request.url.path}",
            resource=str(request.url.path),
            outcome=outcome,
            detail={"status_code": status_code},
        )
        return response
