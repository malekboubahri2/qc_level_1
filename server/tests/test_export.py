"""Tests for PDF export endpoint."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from .conftest import auth_header


def _create_suivi(client: TestClient, headers: dict) -> None:
    payload = {
        "local_uuid": str(uuid.uuid4()),
        "date": "2025-01-15",
        "heure": "08:30:00",
        "num_chariot": "CH-001",
        "num_porte_objet": "PO-001",
        "client_id": 1,
        "produit_id": 1,
        "resultat": "NOK",
        "symptomes": [{"symptome_id": 1, "present": True}],
    }
    resp = client.post("/api/v1/suivis", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text


def test_export_requires_auth(client: TestClient) -> None:
    resp = client.get("/api/v1/export/suivi.pdf")
    assert resp.status_code == 401


def test_export_returns_pdf(client: TestClient) -> None:
    headers = auth_header(client, "insp", "insp-secret")
    _create_suivi(client, headers)

    resp = client.get("/api/v1/export/suivi.pdf", headers=headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"


def test_export_empty_pdf(client: TestClient) -> None:
    """PDF generation with zero rows should still return a valid PDF."""
    headers = auth_header(client, "admin", "admin-secret")
    resp = client.get("/api/v1/export/suivi.pdf", headers=headers)
    assert resp.status_code == 200
    assert resp.content[:4] == b"%PDF"
