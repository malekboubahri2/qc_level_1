"""KPI computation — all queries, no business logic in routers."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from ..models import Alerte, SuiviQualiteProd, SuiviSymptome, SymptomeCatalogue
from ..models.enums import Resultat, StatutAlerte


def taux_nc(
    db: Session,
    depuis: datetime | None = None,
    client_id: int | None = None,
    produit_id: int | None = None,
) -> list[dict]:
    """Daily NOK/total ratio.  Returns [{date, total, nok, taux}, …]."""
    filters = []
    if depuis:
        filters.append(SuiviQualiteProd.date >= depuis.strftime("%Y-%m-%d"))
    if client_id:
        filters.append(SuiviQualiteProd.client_id == client_id)
    if produit_id:
        filters.append(SuiviQualiteProd.produit_id == produit_id)

    from sqlalchemy import case

    rows = db.execute(
        select(
            SuiviQualiteProd.date,
            func.count().label("total"),
            func.sum(
                case((SuiviQualiteProd.resultat == Resultat.NOK, 1), else_=0)
            ).label("nok"),
        )
        .where(and_(*filters) if filters else True)
        .group_by(SuiviQualiteProd.date)
        .order_by(SuiviQualiteProd.date)
    ).all()

    return [
        {
            "date": r.date,
            "total": r.total,
            "nok": r.nok or 0,
            "taux": round((r.nok or 0) / r.total, 3) if r.total else 0.0,
        }
        for r in rows
    ]


def precurseurs(
    db: Session,
    depuis: datetime | None = None,
    produit_id: int | None = None,
) -> list[dict]:
    """Pareto of present symptoms.  Returns [{code, libelle_fr, count}, …] desc."""
    filters = [SuiviSymptome.present.is_(True)]
    if depuis or produit_id:
        filters.append(
            SuiviSymptome.suivi_id.in_(
                select(SuiviQualiteProd.id).where(
                    and_(
                        *(
                            ([SuiviQualiteProd.date >= depuis.strftime("%Y-%m-%d")] if depuis else [])
                            + ([SuiviQualiteProd.produit_id == produit_id] if produit_id else [])
                        )
                    )
                )
            )
        )

    rows = db.execute(
        select(
            SymptomeCatalogue.code,
            SymptomeCatalogue.libelle_fr,
            func.count(SuiviSymptome.id).label("count"),
        )
        .join(SymptomeCatalogue, SuiviSymptome.symptome_id == SymptomeCatalogue.id)
        .where(and_(*filters))
        .group_by(SymptomeCatalogue.id)
        .order_by(func.count(SuiviSymptome.id).desc())
    ).all()

    return [{"code": r.code, "libelle_fr": r.libelle_fr, "count": r.count} for r in rows]


def temps_reponse(
    db: Session,
    depuis: datetime | None = None,
) -> list[dict]:
    """Response times for acknowledged/closed alertes.

    Returns [{alerte_id, severite, duree_secondes}, …] for alertes that
    were acknowledged (acknowledged_at is not null).
    """
    filters = [Alerte.acknowledged_at.is_not(None)]
    if depuis:
        filters.append(Alerte.created_at >= depuis)

    rows = db.execute(
        select(Alerte).where(and_(*filters)).order_by(Alerte.created_at)
    ).scalars().all()

    result = []
    for a in rows:
        if a.acknowledged_at and a.created_at:
            delta = (a.acknowledged_at - a.created_at).total_seconds()
            result.append(
                {
                    "alerte_id": a.id,
                    "severite": a.severite.value,
                    "duree_secondes": round(delta, 1),
                    "created_at": a.created_at.isoformat(),
                }
            )
    return result
