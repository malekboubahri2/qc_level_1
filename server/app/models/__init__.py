"""Model registry. Importing this package populates `Base.metadata` with every
table, which Alembic's `env.py` targets for autogenerate/verification.

Phase 0 ships the reference entities only. Operational tables (suivi, alerte,
decision, visa, push_subscription) arrive in later phases via new migrations.
"""
from .base import Base, TimestampMixin, utcnow
from .client import Client
from .enums import Role, TypeTraitement
from .produit import Produit
from .symptome import SymptomeCatalogue
from .utilisateur import Utilisateur

__all__ = [
    "Base",
    "TimestampMixin",
    "utcnow",
    "Client",
    "Produit",
    "Utilisateur",
    "SymptomeCatalogue",
    "Role",
    "TypeTraitement",
]
