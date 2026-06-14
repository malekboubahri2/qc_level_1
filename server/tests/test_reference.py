from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import auth_header


def test_list_clients_requires_auth(client: TestClient) -> None:
    assert client.get("/api/v1/clients").status_code == 401


def test_admin_can_create_and_list_client(client: TestClient) -> None:
    admin = auth_header(client, "admin", "admin-secret")
    created = client.post(
        "/api/v1/clients", json={"code": "ACME", "nom": "Acme SA"}, headers=admin
    )
    assert created.status_code == 201, created.text
    assert created.json()["code"] == "ACME"

    listing = client.get("/api/v1/clients", headers=admin)
    assert listing.status_code == 200
    assert any(c["code"] == "ACME" for c in listing.json())


def test_inspecteur_cannot_create_client(client: TestClient) -> None:
    insp = auth_header(client, "insp", "insp-secret")
    resp = client.post(
        "/api/v1/clients", json={"code": "X", "nom": "Nope"}, headers=insp
    )
    assert resp.status_code == 403


def test_duplicate_client_code_conflicts(client: TestClient) -> None:
    admin = auth_header(client, "admin", "admin-secret")
    payload = {"code": "DUP", "nom": "First"}
    assert client.post("/api/v1/clients", json=payload, headers=admin).status_code == 201
    again = client.post("/api/v1/clients", json=payload, headers=admin)
    assert again.status_code == 409


def test_inspecteur_can_read_symptomes(client: TestClient) -> None:
    admin = auth_header(client, "admin", "admin-secret")
    client.post(
        "/api/v1/symptomes",
        json={"code": "APPLICATION", "libelle_fr": "Application", "ordre": 1},
        headers=admin,
    )
    insp = auth_header(client, "insp", "insp-secret")
    resp = client.get("/api/v1/symptomes", headers=insp)
    assert resp.status_code == 200
    assert resp.json()[0]["code"] == "APPLICATION"


def test_produit_rejects_unknown_client(client: TestClient) -> None:
    admin = auth_header(client, "admin", "admin-secret")
    resp = client.post(
        "/api/v1/produits",
        json={"reference": "R-1", "libelle": "Piece", "client_id": 9999},
        headers=admin,
    )
    assert resp.status_code == 422


def test_utilisateurs_listing_is_admin_only(client: TestClient) -> None:
    insp = auth_header(client, "insp", "insp-secret")
    assert client.get("/api/v1/utilisateurs", headers=insp).status_code == 403
    admin = auth_header(client, "admin", "admin-secret")
    resp = client.get("/api/v1/utilisateurs", headers=admin)
    assert resp.status_code == 200
    noms = {u["nom"] for u in resp.json()}
    assert {"admin", "insp"}.issubset(noms)
