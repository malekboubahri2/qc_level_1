"""Model registry — every import here registers the table with Base.metadata."""
from .alerte import Alerte, Decision
from .base import Base, TimestampMixin, utcnow
from .client import Client
from .enums import Resultat, Role, Severite, StatutAlerte, TypeTraitement, TypeVisa
from .produit import Produit
from .suivi import SuiviQualiteProd, SuiviSymptome, Visa
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
    "SuiviQualiteProd",
    "SuiviSymptome",
    "Visa",
    "Alerte",
    "Decision",
    "Role",
    "TypeTraitement",
    "Resultat",
    "Severite",
    "StatutAlerte",
    "TypeVisa",
]
