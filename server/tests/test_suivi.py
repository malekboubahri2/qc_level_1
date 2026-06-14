"""Tests for the suivi (offline-first) endpoints."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.conftest import auth_header


def _insp(client: TestClient) -> dict[str, str]:
    return auth_header(client, "insp", "insp-secret")


def _suivi_payload(local_uuid: str | None = None, *, resultat: str = "OK") -> dict:
    return {
        "local_uuid": local_uuid or str(uuid.uuid4()),
        "date": "2026-06-14",
        "heure": "08:30:00",
        "num_chariot": "CH-001",
        "num_porte_objet": "PO-42",
        "client_id": 1,
        "produit_id": 1,
        "resultat": resultat,
        "symptomes": [{"symptome_id": 1, "present": True, "note": None}],
    }


def test_create_suivi_returns_201(client: TestClient) -> None:
    resp = client.post("/api/v1/suivis", json=_suivi_payload(), headers=_insp(client))
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["num_chariot"] == "CH-001"
    assert body["resultat"] == "OK"
    assert len(body["symptomes"]) == 1


def test_create_suivi_idempotent_by_local_uuid(client: TestClient) -> None:
    lu = str(uuid.uuid4())
    headers = _insp(client)
    r1 = client.post("/api/v1/suivis", json=_suivi_payload(lu), headers=headers)
    r2 = client.post("/api/v1/suivis", json=_suivi_payload(lu), headers=headers)
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"]


def test_sync_batch_is_idempotent(client: TestClient) -> None:
    lu1, lu2 = str(uuid.uuid4()), str(uuid.uuid4())
    headers = _insp(client)
    payload = {"items": [_suivi_payload(lu1), _suivi_payload(lu2, resultat="NOK")]}
    r1 = client.post("/api/v1/suivis/sync", json=payload, headers=headers)
    r2 = client.post("/api/v1/suivis/sync", json=payload, headers=headers)
    assert r1.status_code == 200
    ids1 = [r["id"] for r in r1.json()]
    ids2 = [r["id"] for r in r2.json()]
    assert ids1 == ids2


def test_list_suivis(client: TestClient) -> None:
    headers = _insp(client)
    client.post("/api/v1/suivis", json=_suivi_payload(), headers=headers)
    client.post("/api/v1/suivis", json=_suivi_payload(), headers=headers)
    resp = client.get("/api/v1/suivis", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


def test_get_suivi_by_id(client: TestClient) -> None:
    headers = _insp(client)
    created = client.post("/api/v1/suivis", json=_suivi_payload(), headers=headers).json()
    resp = client.get(f"/api/v1/suivis/{created['id']}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_suivi_404(client: TestClient) -> None:
    resp = client.get("/api/v1/suivis/9999", headers=_insp(client))
    assert resp.status_code == 404


def test_inspecteur_cannot_create_suivi_without_auth(client: TestClient) -> None:
    resp = client.post("/api/v1/suivis", json=_suivi_payload())
    assert resp.status_code == 401


def test_visa_methode(client: TestClient) -> None:
    insp_h = _insp(client)
    meth_h = auth_header(client, "meth", "meth-secret")
    suivi = client.post("/api/v1/suivis", json=_suivi_payload(), headers=insp_h).json()
    resp = client.post(
        f"/api/v1/suivis/{suivi['id']}/visa",
        json={"type": "methode"},
        headers=meth_h,
    )
    assert resp.status_code == 201
    assert resp.json()["type"] == "methode"
