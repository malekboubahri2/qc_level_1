"""Tests for KPI endpoints."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from .conftest import auth_header


def _create_suivi(client: TestClient, headers: dict, resultat: str = "NOK") -> dict:
    payload = {
        "local_uuid": str(uuid.uuid4()),
        "date": "2025-01-15",
        "heure": "08:30:00",
        "num_chariot": "CH-001",
        "num_porte_objet": "PO-001",
        "client_id": 1,
        "produit_id": 1,
        "resultat": resultat,
        "symptomes": [{"symptome_id": 1, "present": True}],
    }
    resp = client.post("/api/v1/suivis", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_taux_nc_empty(client: TestClient) -> None:
    headers = auth_header(client, "admin", "admin-secret")
    resp = client.get("/api/v1/kpis/taux-nc", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_taux_nc_with_data(client: TestClient) -> None:
    headers = auth_header(client, "insp", "insp-secret")
    _create_suivi(client, headers, "NOK")
    _create_suivi(client, headers, "OK")
    _create_suivi(client, headers, "NOK")

    resp = client.get("/api/v1/kpis/taux-nc", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    row = data[0]
    assert row["date"] == "2025-01-15"
    assert row["total"] == 3
    assert row["nok"] == 2
    assert abs(row["taux"] - 0.667) < 0.01


def test_precurseurs_empty(client: TestClient) -> None:
    headers = auth_header(client, "admin", "admin-secret")
    resp = client.get("/api/v1/kpis/precurseurs", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_precurseurs_with_data(client: TestClient) -> None:
    headers = auth_header(client, "insp", "insp-secret")
    _create_suivi(client, headers, "NOK")
    _create_suivi(client, headers, "NOK")

    resp = client.get("/api/v1/kpis/precurseurs", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["code"] == "POUSSIERE"
    assert data[0]["count"] == 2


def test_temps_reponse_empty(client: TestClient) -> None:
    headers = auth_header(client, "admin", "admin-secret")
    resp = client.get("/api/v1/kpis/temps-reponse", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_kpis_require_auth(client: TestClient) -> None:
    for path in ["/api/v1/kpis/taux-nc", "/api/v1/kpis/precurseurs", "/api/v1/kpis/temps-reponse"]:
        assert client.get(path).status_code == 401
