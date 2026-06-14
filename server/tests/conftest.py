from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import get_db
from app.main import app
from app.models import Base, Utilisateur
from app.models.enums import Role
from app.security import hash_secret


@pytest.fixture
def client() -> Iterator[TestClient]:
    # In-memory SQLite shared across connections via StaticPool, isolated per test.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(
        bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
    )

    def override_get_db() -> Iterator[Session]:
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    seed = TestingSession()
    seed.add_all(
        [
            Utilisateur(
                nom="admin", role=Role.admin, secret_hash=hash_secret("admin-secret"), actif=True
            ),
            Utilisateur(
                nom="insp", role=Role.inspecteur, secret_hash=hash_secret("insp-secret"), actif=True
            ),
        ]
    )
    seed.commit()
    seed.close()

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)


def auth_header(client: TestClient, nom: str, secret: str) -> dict[str, str]:
    resp = client.post("/api/v1/auth/login", json={"nom": nom, "secret": secret})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}
