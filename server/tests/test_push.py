"""Tests for push subscription endpoints and VAPID key exposure."""
from __future__ import annotations

from fastapi.testclient import TestClient

from .conftest import auth_header


def test_vapid_public_key_no_auth(client: TestClient) -> None:
    resp = client.get("/api/v1/push/vapid-public-key")
    assert resp.status_code == 200
    data = resp.json()
    assert "public_key" in data
    assert len(data["public_key"]) > 10


def test_subscribe_requires_auth(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/push/subscribe",
        json={"endpoint": "https://example.com/push/1", "p256dh": "abc", "auth": "xyz"},
    )
    assert resp.status_code == 401


def test_subscribe_and_unsubscribe(client: TestClient) -> None:
    headers = auth_header(client, "insp", "insp-secret")
    payload = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/fake-token",
        "p256dh": "BFakePublicKey1234567890abcdef",
        "auth": "FakeAuth123",
    }
    resp = client.post("/api/v1/push/subscribe", json=payload, headers=headers)
    assert resp.status_code == 201
    assert "id" in resp.json()

    # Idempotent upsert — same endpoint returns 201 again.
    resp2 = client.post("/api/v1/push/subscribe", json=payload, headers=headers)
    assert resp2.status_code == 201
    assert resp2.json()["id"] == resp.json()["id"]

    # Unsubscribe.
    resp3 = client.delete(
        "/api/v1/push/subscribe",
        params={"endpoint": payload["endpoint"]},
        headers=headers,
    )
    assert resp3.status_code == 204

    # Deleting a non-existent endpoint is a no-op (204).
    resp4 = client.delete(
        "/api/v1/push/subscribe",
        params={"endpoint": "https://nonexistent.example.com/push"},
        headers=headers,
    )
    assert resp4.status_code == 204
