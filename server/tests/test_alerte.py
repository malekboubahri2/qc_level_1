"""Tests for the alerte state machine + escalation loop."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from tests.conftest import auth_header


def _insp(client: TestClient) -> dict[str, str]:
    return auth_header(client, "insp", "insp-secret")


def _meth(client: TestClient) -> dict[str, str]:
    return auth_header(client, "meth", "meth-secret")


def _make_suivi(client: TestClient) -> int:
    import uuid as _u
    payload = {
        "local_uuid": str(_u.uuid4()),
        "date": "2026-06-14",
        "heure": "09:00:00",
        "num_chariot": "CH-002",
        "num_porte_objet": "PO-01",
        "client_id": 1,
        "produit_id": 1,
        "resultat": "NOK",
        "symptomes": [],
    }
    resp = client.post("/api/v1/suivis", json=payload, headers=_insp(client))
    assert resp.status_code == 201
    return resp.json()["id"]


def _alerte_payload(suivi_id: int, responsable_cible_id: int = 3) -> dict:
    return {
        "local_uuid": str(uuid.uuid4()),
        "suivi_id": suivi_id,
        "produit_id": 1,
        "num_chariot": "CH-002",
        "severite": "normale",
        "responsable_cible_id": responsable_cible_id,
    }


def test_create_alerte(client: TestClient) -> None:
    suivi_id = _make_suivi(client)
    resp = client.post(
        "/api/v1/alertes",
        json=_alerte_payload(suivi_id),
        headers=_insp(client),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["statut"] == "ouverte"
    assert body["num_chariot"] == "CH-002"


def test_create_alerte_idempotent(client: TestClient) -> None:
    suivi_id = _make_suivi(client)
    lu = str(uuid.uuid4())
    payload = {**_alerte_payload(suivi_id), "local_uuid": lu}
    headers = _insp(client)
    r1 = client.post("/api/v1/alertes", json=payload, headers=headers)
    r2 = client.post("/api/v1/alertes", json=payload, headers=headers)
    assert r1.json()["id"] == r2.json()["id"]


def test_ack_alerte(client: TestClient) -> None:
    suivi_id = _make_suivi(client)
    alerte_id = client.post(
        "/api/v1/alertes", json=_alerte_payload(suivi_id), headers=_insp(client)
    ).json()["id"]

    resp = client.patch(f"/api/v1/alertes/{alerte_id}/ack", headers=_meth(client))
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["statut"] == "acquittee"
    assert body["acknowledged_at"] is not None
    assert body["acknowledged_by"] is not None


def test_ack_alerte_twice_returns_409(client: TestClient) -> None:
    suivi_id = _make_suivi(client)
    alerte_id = client.post(
        "/api/v1/alertes", json=_alerte_payload(suivi_id), headers=_insp(client)
    ).json()["id"]
    client.patch(f"/api/v1/alertes/{alerte_id}/ack", headers=_meth(client))
    resp = client.patch(f"/api/v1/alertes/{alerte_id}/ack", headers=_meth(client))
    assert resp.status_code == 409


def test_record_decision_closes_alerte(client: TestClient) -> None:
    suivi_id = _make_suivi(client)
    alerte_id = client.post(
        "/api/v1/alertes", json=_alerte_payload(suivi_id), headers=_insp(client)
    ).json()["id"]
    client.patch(f"/api/v1/alertes/{alerte_id}/ack", headers=_meth(client))

    resp = client.post(
        f"/api/v1/alertes/{alerte_id}/decision",
        json={"action_text": "Retouche pigment effectuée", "resultat_text": "Conforme"},
        headers=_meth(client),
    )
    assert resp.status_code == 201, resp.text
    decision = resp.json()
    assert decision["action_text"] == "Retouche pigment effectuée"

    alerte = client.get(f"/api/v1/alertes/{alerte_id}", headers=_meth(client)).json()
    assert alerte["statut"] == "cloturee"
    assert alerte["closed_at"] is not None
    assert alerte["decision_id"] == decision["id"]


def test_decision_without_ack_still_closes(client: TestClient) -> None:
    """Decision is allowed on ouverte alertes (direct close path)."""
    suivi_id = _make_suivi(client)
    alerte_id = client.post(
        "/api/v1/alertes", json=_alerte_payload(suivi_id), headers=_insp(client)
    ).json()["id"]
    resp = client.post(
        f"/api/v1/alertes/{alerte_id}/decision",
        json={"action_text": "Action directe"},
        headers=_meth(client),
    )
    assert resp.status_code == 201
    alerte = client.get(f"/api/v1/alertes/{alerte_id}", headers=_meth(client)).json()
    assert alerte["statut"] == "cloturee"


def test_expire_due(client: TestClient) -> None:
    """expire_due marks stale ouverte alertes as expiree."""
    from app.db import get_db
    from app.models import Alerte
    from app.services.alerte import expire_due

    suivi_id = _make_suivi(client)
    alerte_id = client.post(
        "/api/v1/alertes", json=_alerte_payload(suivi_id), headers=_insp(client)
    ).json()["id"]

    db = next(get_db.__wrapped__() if hasattr(get_db, "__wrapped__") else iter([None]))

    # Manipulate created_at directly via the test DB session.
    from app.main import app
    from app.db import get_db as _get_db

    override = app.dependency_overrides.get(_get_db)
    if override:
        db = next(override())
    else:
        from app.db import SessionLocal
        db = SessionLocal()

    try:
        alerte = db.get(Alerte, alerte_id)
        alerte.created_at = datetime.now(timezone.utc) - timedelta(seconds=200)
        db.commit()

        count = expire_due(db, timeout_seconds=120)
        assert count == 1

        db.refresh(alerte)
        assert alerte.statut.value == "expiree"
    finally:
        db.close()


def test_list_alertes_filter_by_statut(client: TestClient) -> None:
    suivi_id = _make_suivi(client)
    client.post(
        "/api/v1/alertes", json=_alerte_payload(suivi_id), headers=_insp(client)
    )
    resp = client.get("/api/v1/alertes?statut=ouverte", headers=_insp(client))
    assert resp.status_code == 200
    assert all(a["statut"] == "ouverte" for a in resp.json())


def test_inspecteur_cannot_ack(client: TestClient) -> None:
    suivi_id = _make_suivi(client)
    alerte_id = client.post(
        "/api/v1/alertes", json=_alerte_payload(suivi_id), headers=_insp(client)
    ).json()["id"]
    resp = client.patch(f"/api/v1/alertes/{alerte_id}/ack", headers=_insp(client))
    assert resp.status_code == 403
