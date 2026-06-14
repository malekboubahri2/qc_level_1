"""Domain enums. Member name == value so DB storage is the lowercase string,
which keeps the SQLAlchemy models and the hand-written migration in lockstep.
"""
from __future__ import annotations

import enum


class Role(str, enum.Enum):
    inspecteur = "inspecteur"
    methode = "methode"
    qualite = "qualite"
    prod = "prod"
    admin = "admin"


class TypeTraitement(str, enum.Enum):
    peinture = "peinture"
    metallisation = "metallisation"
    les_deux = "les_deux"
