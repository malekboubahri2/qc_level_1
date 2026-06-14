from __future__ import annotations

import pytest

from fastapi.testclient import TestClient


@pytest.mark.parametrize("path", ["/health", "/api/v1/health"])
def test_health_ok(client: TestClient, path: str) -> None:
    resp = client.get(path)
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
