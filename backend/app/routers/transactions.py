from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=list[schemas.TransactionOut])
def list_transactions(
    month: Optional[str] = Query(None, description="Filter by month, e.g. 2026-05"),
    db: Session = Depends(get_db),
):
    """
    Return all transactions, optionally filtered by month (YYYY-MM format).
    Depends(get_db) means FastAPI automatically injects the DB session.
    """
    query = db.query(models.Transaction)

    if month:
        # Parse "2026-05" into year=2026, month=5 and filter by both
        try:
            year, mon = map(int, month.split("-"))
        except ValueError:
            raise HTTPException(status_code=400, detail="month must be in YYYY-MM format")

        from sqlalchemy import extract
        query = query.filter(
            extract("year", models.Transaction.date) == year,
            extract("month", models.Transaction.date) == mon,
        )

    return query.order_by(models.Transaction.date.desc()).all()


@router.post("/", response_model=schemas.TransactionOut, status_code=201)
def create_transaction(payload: schemas.TransactionCreate, db: Session = Depends(get_db)):
    """
    Create a new transaction. FastAPI automatically validates the request body
    against TransactionCreate and returns 422 if anything is wrong.
    """
    transaction = models.Transaction(**payload.model_dump())
    db.add(transaction)
    db.commit()            # Write to the database
    db.refresh(transaction)  # Reload so we get the generated id back
    return transaction


@router.put("/{transaction_id}", response_model=schemas.TransactionOut)
def update_transaction(
    transaction_id: int,
    payload: schemas.TransactionCreate,
    db: Session = Depends(get_db),
):
    transaction = db.query(models.Transaction).filter(
        models.Transaction.id == transaction_id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    for field, value in payload.model_dump().items():
        setattr(transaction, field, value)

    db.commit()
    db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    transaction = db.query(models.Transaction).filter(
        models.Transaction.id == transaction_id
    ).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    db.delete(transaction)
    db.commit()
    # 204 No Content — return nothing
