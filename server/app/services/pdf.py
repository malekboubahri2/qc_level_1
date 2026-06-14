"""PDF export — reproduces the SVI-COQ-03 Fiche Suivi Qualité Prod layout.

Uses fpdf2 (pure-Python, no system deps).  Returns raw PDF bytes so the
router can stream it directly.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import (
    Client,
    Produit,
    SuiviQualiteProd,
    SuiviSymptome,
    SymptomeCatalogue,
    Utilisateur,
)


def generate_suivi_pdf(
    db: Session,
    depuis: datetime | None = None,
    client_id: int | None = None,
) -> bytes:
    from fpdf import FPDF

    # ── data ────────────────────────────────────────────────────────────────
    q = (
        select(SuiviQualiteProd)
        .options(selectinload(SuiviQualiteProd.symptomes))
        .order_by(SuiviQualiteProd.date, SuiviQualiteProd.heure)
    )
    if depuis:
        q = q.where(SuiviQualiteProd.date >= depuis.strftime("%Y-%m-%d"))
    if client_id:
        q = q.where(SuiviQualiteProd.client_id == client_id)
    suivis = db.execute(q).scalars().all()

    # lookup maps
    clients = {r.id: r for r in db.execute(select(Client)).scalars()}
    produits = {r.id: r for r in db.execute(select(Produit)).scalars()}
    utilisateurs = {r.id: r for r in db.execute(select(Utilisateur)).scalars()}
    symptomes_cat = {r.id: r for r in db.execute(select(SymptomeCatalogue)).scalars()}

    # ── PDF layout ───────────────────────────────────────────────────────────
    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()

    # Title
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 8, "Fiche Suivi Qualite Prod - SVI-COQ-03", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(
        0,
        5,
        f"Genere le {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC",
        new_x="LMARGIN",
        new_y="NEXT",
        align="C",
    )
    pdf.ln(4)

    # Column widths (landscape A4 = 297 mm usable ≈ 277 mm with 10 mm margins)
    COL = {
        "date": 22, "heure": 16, "chariot": 22, "po": 22,
        "client": 30, "produit": 40, "resultat": 18, "symptomes": 60, "inspecteur": 35,
    }
    headers = {
        "date": "Date", "heure": "Heure", "chariot": "Chariot",
        "po": "Porte-Obj.", "client": "Client", "produit": "Reference",
        "resultat": "Resultat", "symptomes": "Defauts", "inspecteur": "Inspecteur",
    }

    def header_row() -> None:
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_fill_color(26, 85, 96)
        pdf.set_text_color(250, 238, 227)
        for key, w in COL.items():
            pdf.cell(w, 7, headers[key], border=1, fill=True, align="C")
        pdf.ln()
        pdf.set_text_color(0, 0, 0)

    header_row()

    for i, s in enumerate(suivis):
        if pdf.get_y() > 185:
            pdf.add_page()
            header_row()

        fill = i % 2 == 0
        pdf.set_fill_color(245, 232, 220) if fill else pdf.set_fill_color(255, 255, 255)
        pdf.set_font("Helvetica", "", 8)

        symptome_labels = ", ".join(
            symptomes_cat[ss.symptome_id].code
            for ss in s.symptomes
            if ss.present and ss.symptome_id in symptomes_cat
        ) or "-"

        insp = utilisateurs.get(s.inspecteur_id)
        client = clients.get(s.client_id)
        produit = produits.get(s.produit_id)

        pdf.set_font("Helvetica", "B" if s.resultat.value == "NOK" else "", 8)
        if s.resultat.value == "NOK":
            pdf.set_text_color(184, 69, 69)

        row_data = {
            "date": s.date,
            "heure": s.heure[:5],
            "chariot": s.num_chariot,
            "po": s.num_porte_objet,
            "client": (client.nom[:18] if client else "-").encode("latin-1", "replace").decode("latin-1"),
            "produit": (produit.reference[:22] if produit else "-").encode("latin-1", "replace").decode("latin-1"),
            "resultat": s.resultat.value,
            "symptomes": symptome_labels[:40],
            "inspecteur": (insp.nom[:20] if insp else "-").encode("latin-1", "replace").decode("latin-1"),
        }
        for key, w in COL.items():
            pdf.cell(w, 6, row_data[key], border=1, fill=fill, align="C" if key == "resultat" else "L")
        pdf.ln()
        pdf.set_text_color(0, 0, 0)
        pdf.set_font("Helvetica", "", 8)

    pdf.ln(4)
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 5, f"Total : {len(suivis)} entrees", new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())
