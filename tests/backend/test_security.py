"""Tests for cure_oracle/security.py.

31 tests covering:
  TestSafeCertPath    (8)  — path traversal prevention
  TestSanitizeError   (6)  — secret redaction
  TestAuditEvent      (5)  — Keccak-256 chain integrity
  TestRoleAuth        (6)  — RBAC roles / HTTP errors
  TestQpuRouterSecurity (6) — integration with FastAPI test client
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


# ── import helpers ────────────────────────────────────────────────────────────

from cure_oracle.security import (
    AuditLogger,
    Role,
    _keccak256_hex,
    get_current_role,
    require_role,
    safe_cert_path,
    sanitize_error,
    secure_write_json,
    CERT_BASE_DIR,
)


# ── TestSafeCertPath ──────────────────────────────────────────────────────────

class TestSafeCertPath:
    def test_valid_filename_resolves(self, tmp_path, monkeypatch):
        monkeypatch.setenv("CURE_CERT_DIR", str(tmp_path))
        import importlib, cure_oracle.security as sec
        importlib.reload(sec)
        from cure_oracle.security import safe_cert_path as scp
        result = scp("cert.json")
        assert result.name == "cert.json"

    def test_rejects_path_separator_slash(self, tmp_path, monkeypatch):
        monkeypatch.setenv("CURE_CERT_DIR", str(tmp_path))
        with pytest.raises(ValueError, match="path separator"):
            safe_cert_path("../etc/passwd.json")

    def test_rejects_backslash(self, tmp_path, monkeypatch):
        with pytest.raises(ValueError, match="path separator"):
            safe_cert_path("sub\\file.json")

    def test_rejects_non_json_extension(self):
        with pytest.raises(ValueError, match=".json"):
            safe_cert_path("cert.txt")

    def test_rejects_empty_filename(self):
        with pytest.raises(ValueError, match="empty"):
            safe_cert_path("")

    def test_rejects_dotdot_in_name(self):
        with pytest.raises(ValueError, match="path separator"):
            safe_cert_path("..cert.json")

    def test_rejects_disallowed_chars(self):
        with pytest.raises(ValueError):
            safe_cert_path("cer;t.json")

    def test_allows_hyphens_and_dots(self, tmp_path, monkeypatch):
        monkeypatch.setenv("CURE_CERT_DIR", str(tmp_path))
        import importlib, cure_oracle.security as sec
        importlib.reload(sec)
        from cure_oracle.security import safe_cert_path as scp
        result = scp("my-cert.v1.json")
        assert result.name == "my-cert.v1.json"


# ── TestSanitizeError ─────────────────────────────────────────────────────────

class TestSanitizeError:
    def test_strips_long_api_key(self):
        exc = ValueError("token=LIFzb09aD3iJ_GqKDpQqh5xtiuQijzWkfEvvtkWFiBpu failed")
        result = sanitize_error(exc)
        assert "LIFzb09aD3iJ" not in result
        assert "[REDACTED]" in result

    def test_strips_crn(self):
        exc = RuntimeError("crn:v1:bluemix:public:quantum:us-south:a/abc123::instance1 unreachable")
        result = sanitize_error(exc)
        assert "crn:" not in result
        assert "[REDACTED]" in result

    def test_strips_email(self):
        exc = Exception("user@example.com not authorized")
        result = sanitize_error(exc)
        assert "@example.com" not in result
        assert "[REDACTED]" in result

    def test_preserves_non_secret_message(self):
        exc = ValueError("unknown shape 'XYZ'")
        result = sanitize_error(exc)
        assert "unknown shape" in result

    def test_adds_context_prefix(self):
        exc = RuntimeError("oops")
        result = sanitize_error(exc, context="benchmark")
        assert result.startswith("benchmark:")

    def test_handles_unstringifiable_exc(self):
        class Bad:
            def __str__(self):
                raise RuntimeError("can't str me")
        result = sanitize_error(Bad())  # type: ignore[arg-type]
        assert result == "internal server error"


# ── TestAuditEvent ────────────────────────────────────────────────────────────

class TestAuditEvent:
    @pytest.fixture(autouse=True)
    def _reset(self, tmp_path, monkeypatch):
        import cure_oracle.security as _sec
        monkeypatch.setattr(_sec, "AUDIT_LOG_DIR", tmp_path)
        AuditLogger.reset()
        yield
        AuditLogger.reset()

    def test_first_event_has_genesis_prev_hash(self):
        logger = AuditLogger.get()
        event = logger.log("viewer", "test.action", "resource", "success")
        assert event.prev_hash == "0x" + "0" * 64

    def test_sig_is_hex_string(self):
        event = AuditLogger.get().log("operator", "run", "cpu", "success")
        assert event.sig.startswith("0x")
        assert len(event.sig) == 66

    def test_chain_links_events(self):
        logger = AuditLogger.get()
        e1 = logger.log("viewer", "a1", "r1", "success")
        e2 = logger.log("viewer", "a2", "r2", "success")
        assert e2.prev_hash == e1.sig

    def test_get_chain_returns_events(self):
        logger = AuditLogger.get()
        for i in range(3):
            logger.log("viewer", f"action{i}", "res", "success")
        chain = logger.get_chain(10)
        assert len(chain) == 3

    def test_get_chain_honours_limit(self):
        logger = AuditLogger.get()
        for i in range(10):
            logger.log("viewer", f"a{i}", "r", "success")
        chain = logger.get_chain(5)
        assert len(chain) == 5


# ── TestRoleAuth ──────────────────────────────────────────────────────────────

class TestRoleAuth:
    def test_no_header_returns_viewer(self):
        role = get_current_role(None)
        assert role == Role.VIEWER

    def test_bad_format_raises_401(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            get_current_role("Token abc")
        assert exc_info.value.status_code == 401

    def test_unknown_token_raises_401_when_map_set(self, monkeypatch):
        from fastapi import HTTPException
        monkeypatch.setenv("CURE_API_TOKENS", json.dumps({"good_token": "operator"}))
        with pytest.raises(HTTPException) as exc_info:
            get_current_role("Bearer bad_token")
        assert exc_info.value.status_code == 401

    def test_known_operator_token(self, monkeypatch):
        monkeypatch.setenv("CURE_API_TOKENS", json.dumps({"tok": "operator"}))
        role = get_current_role("Bearer tok")
        assert role == Role.OPERATOR

    def test_known_qpu_admin_token(self, monkeypatch):
        monkeypatch.setenv("CURE_API_TOKENS", json.dumps({"admin": "qpu_admin"}))
        role = get_current_role("Bearer admin")
        assert role == Role.QPU_ADMIN

    def test_no_token_map_gives_operator(self, monkeypatch):
        monkeypatch.setenv("CURE_API_TOKENS", "{}")
        role = get_current_role("Bearer anything")
        assert role == Role.OPERATOR


# ── TestQpuRouterSecurity ─────────────────────────────────────────────────────

class TestQpuRouterSecurity:
    @pytest.fixture()
    def client(self):
        from cure_oracle.qpu_router import router
        app = FastAPI()
        app.include_router(router)
        return TestClient(app, raise_server_exceptions=False)

    def test_shapes_endpoint_accessible_without_auth(self, client):
        with patch("cure_oracle.qpu_router.SHAPE_CIRCUIT_MAP", {"LINE": "linear"}), \
             patch("cure_oracle.qpu_router.CAMPAIGN_SHAPES",
                   [{"shape": "LINE", "theta_disp": "√.414"}]), \
             patch("cure_oracle.qpu_router.get_eps_code", return_value="ε.014"):
            resp = client.get("/api/v1/qpu/benchmark/shapes")
        assert resp.status_code == 200

    def test_benchmark_requires_operator_role(self, client, monkeypatch):
        monkeypatch.setenv("CURE_API_TOKENS", json.dumps({"v": "viewer"}))
        resp = client.post(
            "/api/v1/qpu/benchmark",
            json={"shape": "LINE", "n_qubits": 4, "theta_disp": "√.414",
                  "shots": 100, "mode": "local"},
            headers={"Authorization": "Bearer v"},
        )
        assert resp.status_code == 403

    def test_benchmark_bad_shape_returns_422(self, client, monkeypatch):
        monkeypatch.setenv("CURE_API_TOKENS", json.dumps({"op": "operator"}))
        resp = client.post(
            "/api/v1/qpu/benchmark",
            json={"shape": "INVALID", "n_qubits": 4, "theta_disp": "√.414",
                  "shots": 100, "mode": "local"},
            headers={"Authorization": "Bearer op"},
        )
        assert resp.status_code == 422

    def test_shots_limit_local_mode(self, client, monkeypatch):
        monkeypatch.setenv("CURE_API_TOKENS", json.dumps({"op": "operator"}))
        resp = client.post(
            "/api/v1/qpu/benchmark",
            json={"shape": "LINE", "n_qubits": 4, "theta_disp": "√.414",
                  "shots": 200_000, "mode": "local"},
            headers={"Authorization": "Bearer op"},
        )
        assert resp.status_code == 422
        assert "100,000" in resp.json()["detail"]

    def test_cert_path_traversal_rejected(self, client, monkeypatch):
        monkeypatch.setenv("CURE_API_TOKENS", json.dumps({"op": "operator"}))
        resp = client.post(
            "/api/v1/qpu/mente/birth",
            json={
                "triangles": [{"q": 0.5, "label": "A"}],
                "round_result": {},
                "cert_path": "../evil.json",
            },
            headers={"Authorization": "Bearer op"},
        )
        assert resp.status_code == 422

    def test_audit_chain_requires_operator(self, client, monkeypatch):
        monkeypatch.setenv("CURE_API_TOKENS", json.dumps({"v": "viewer"}))
        resp = client.get(
            "/api/v1/qpu/audit/chain",
            headers={"Authorization": "Bearer v"},
        )
        assert resp.status_code == 403
