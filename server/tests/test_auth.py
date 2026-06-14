from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import auth_header


def test_login_returns_tokens(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/auth/login", json={"nom": "admin", "secret": "admin-secret"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"] and body["refresh_token"]
    assert body["token_type"] == "bearer"


def test_login_bad_secret_rejected(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/auth/login", json={"nom": "admin", "secret": "wrong"}
    )
    assert resp.status_code == 401


def test_me_returns_current_user(client: TestClient) -> None:
    headers = auth_header(client, "admin", "admin-secret")
    resp = client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["nom"] == "admin"
    assert body["role"] == "admin"


def test_me_without_token_rejected(client: TestClient) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401


def test_refresh_issues_new_access_token(client: TestClient) -> None:
    login = client.post(
        "/api/v1/auth/login", json={"nom": "admin", "secret": "admin-secret"}
    ).json()
    resp = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": login["refresh_token"]}
    )
    assert resp.status_code == 200
    assert resp.json()["access_token"]


def test_access_token_cannot_be_used_to_refresh(client: TestClient) -> None:
    login = client.post(
        "/api/v1/auth/login", json={"nom": "admin", "secret": "admin-secret"}
    ).json()
    resp = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": login["access_token"]}
    )
    assert resp.status_code == 401
