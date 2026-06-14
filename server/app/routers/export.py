"""PDF export — GET /export/suivi.pdf."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user
from ..models import Utilisateur
from ..services.pdf import generate_suivi_pdf

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/suivi.pdf", response_class=Response)
def export_suivi_pdf(
    depuis: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    client_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _: Utilisateur = Depends(get_current_user),
) -> Response:
    d: Optional[datetime] = datetime.fromisoformat(depuis) if depuis else None
    pdf_bytes = generate_suivi_pdf(db, d, client_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="suivi.pdf"'},
    )
