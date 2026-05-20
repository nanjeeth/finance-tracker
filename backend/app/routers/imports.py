import os
from datetime import date, datetime
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.csv_parser import parse_csv

router = APIRouter()

UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", "./uploads"))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def save_upload(filename: str, content: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = "".join(c if c.isalnum() or c in ".-_" else "_" for c in filename)
    saved_name = f"{timestamp}_{safe_name}"
    (UPLOADS_DIR / saved_name).write_text(content, encoding="utf-8")
    return saved_name


@router.post("/preview")
async def preview_csv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = (await file.read()).decode("utf-8-sig")
    result = parse_csv(content)

    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    saved_name = save_upload(file.filename, content)
    result["saved_file"] = saved_name

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


@router.get("/uploads")
def list_uploads():
    files = sorted(UPLOADS_DIR.glob("*.csv"), reverse=True)
    return [
        {
            "filename": f.name,
            "original_name": "_".join(f.stem.split("_")[2:]) + ".csv",
            "uploaded_at": f.stem[:15].replace("_", " ").strip(),
            "size_kb": round(f.stat().st_size / 1024, 1),
        }
        for f in files
    ]


@router.get("/uploads/{filename}")
def download_upload(filename: str):
    filepath = UPLOADS_DIR / filename
    if not filepath.exists() or not filepath.is_relative_to(UPLOADS_DIR):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath, filename=filename, media_type="text/csv")
