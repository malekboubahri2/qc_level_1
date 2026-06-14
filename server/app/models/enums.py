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


class Resultat(str, enum.Enum):
    OK = "OK"
    NOK = "NOK"


class Severite(str, enum.Enum):
    normale = "normale"
    urgente = "urgente"


class StatutAlerte(str, enum.Enum):
    ouverte = "ouverte"
    acquittee = "acquittee"
    cloturee = "cloturee"
    expiree = "expiree"


class TypeVisa(str, enum.Enum):
    qualite = "qualite"
    prod = "prod"
    methode = "methode"
