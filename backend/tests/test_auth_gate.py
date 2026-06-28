"""
test_auth_gate.py — identity-resolution gate (Firebase ID token vs X-User-Id).

Covers BLOCKER-0 / docs/AUTH-INTEGRATION.md: a verified token always wins;
the unverified `X-User-Id` header is honored ONLY when ALLOW_USER_IMPERSONATION
(dev/test); in prod (impersonation off) an unverified header is rejected (401).

Group A (unit, no GCP) — `_verify_bearer` is stubbed so no real Firebase/creds
are touched, and `_db` is None at import so auto-register is a no-op.

Run:  .venv/bin/python tests/test_auth_gate.py [unit|all]
"""

import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

import api  # noqa: E402
import profile  # noqa: E402
from fastapi import HTTPException  # noqa: E402

_results: list[tuple[str, bool]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    _results.append((name, passed))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


class _Req:
    def __init__(self, headers: dict):
        self.headers = headers


def _resolve(impers: bool, headers: dict, required: bool, token=None):
    """Run _resolve_uid with ALLOW_USER_IMPERSONATION and _verify_bearer stubbed."""
    api.ALLOW_USER_IMPERSONATION = impers
    api._verify_bearer = lambda _req: token
    try:
        return ("uid", api._resolve_uid(_Req(headers), required=required))
    except HTTPException as e:
        return ("http", e.status_code)


def group_a() -> None:
    print("\nA — identity gate (_resolve_uid)")
    seed = next(iter(profile.seed_ids()))
    orig_impers, orig_verify = api.ALLOW_USER_IMPERSONATION, api._verify_bearer
    try:
        check("A1 dev: seed X-User-Id (no token) → that uid",
              _resolve(True, {"x-user-id": seed}, True) == ("uid", seed))
        check("A2 dev: missing header (required) → 400",
              _resolve(True, {}, True) == ("http", 400))
        check("A3 dev: missing header (optional) → ''",
              _resolve(True, {}, False) == ("uid", ""))
        check("A4 dev: unknown uid (required) → 404",
              _resolve(True, {"x-user-id": "totally-unknown-xyz"}, True) == ("http", 404))
        check("A5 PROD: unverified X-User-Id (required) → 401",
              _resolve(False, {"x-user-id": seed}, True) == ("http", 401))
        check("A6 PROD: unverified X-User-Id (optional) → ''",
              _resolve(False, {"x-user-id": seed}, False) == ("uid", ""))
        check("A7 verified token wins (impersonation off)",
              _resolve(False, {"authorization": "Bearer x"}, True, token=("fb-uid-1", "Jane")) == ("uid", "fb-uid-1"))
        check("A8 verified token beats a spoofed X-User-Id (impersonation on)",
              _resolve(True, {"x-user-id": seed, "authorization": "Bearer x"}, True, token=("fb-uid-2", "")) == ("uid", "fb-uid-2"))
    finally:
        api.ALLOW_USER_IMPERSONATION, api._verify_bearer = orig_impers, orig_verify


def main() -> int:
    only = sys.argv[1] if len(sys.argv) > 1 else "all"
    print(f"auth-gate tests (scope={only})")
    group_a()
    print("\n" + "=" * 60)
    passed = sum(1 for _, ok in _results if ok)
    failed = [n for n, ok in _results if not ok]
    print(f"SUMMARY: {passed}/{len(_results)} checks passed")
    if failed:
        print("FAILED: " + "; ".join(failed))
        return 1
    print("All auth-gate checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
