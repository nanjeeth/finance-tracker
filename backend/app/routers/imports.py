from datetime import date
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.csv_parser import parse_csv

router = APIRouter()


@router.post("/preview")
async def preview_csv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = (await file.read()).decode("utf-8-sig")
    result = parse_csv(content)

    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.post("/confirm")
def confirm_import(
    payload: dict,
    db: Session = Depends(get_db),
):
    transactions = payload.get("transactions", [])
    if not transactions:
        raise HTTPException(status_code=400, detail="No transactions to import")

    existing_categories = {c.name: c for c in db.query(models.Category).all()}
    imported = 0
    skipped = 0

    existing_fingerprints = set()
    for tx in db.query(models.Transaction).all():
        from app.csv_parser import make_fingerprint
        fp = make_fingerprint(tx.title, tx.amount, tx.date)
        existing_fingerprints.add(fp)

    for tx_data in transactions:
        if tx_data.get("fingerprint") in existing_fingerprints:
            skipped += 1
            continue

        category_id = None
        cat_name = tx_data.get("category_name")
        if cat_name:
            if cat_name not in existing_categories:
                new_cat = models.Category(name=cat_name)
                db.add(new_cat)
                db.flush()
                existing_categories[cat_name] = new_cat
            category_id = existing_categories[cat_name].id

        transaction = models.Transaction(
            title=tx_data["title"],
            amount=tx_data["amount"],
            type=tx_data["type"],
            date=date.fromisoformat(tx_data["date"]),
            category_id=category_id,
        )
        db.add(transaction)
        imported += 1

    db.commit()

    return {
        "imported": imported,
        "skipped": skipped,
        "total": len(transactions),
    }
