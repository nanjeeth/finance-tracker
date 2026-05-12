from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from app.database import get_db
from app import models, schemas

router = APIRouter()


@router.get("/", response_model=schemas.MonthlySummary)
def get_monthly_summary(
    month: str = Query(..., description="Month to summarise, e.g. 2026-05"),
    db: Session = Depends(get_db),
):
    """
    Return the full financial picture for a given month:
    - Total income and expenses
    - Net savings and savings rate
    - Spending breakdown per category
    """
    try:
        year, mon = map(int, month.split("-"))
    except ValueError:
        raise HTTPException(status_code=400, detail="month must be in YYYY-MM format")

    # Filter all transactions for this month
    transactions = (
        db.query(models.Transaction)
        .filter(
            extract("year", models.Transaction.date) == year,
            extract("month", models.Transaction.date) == mon,
        )
        .all()
    )

    # Calculate totals
    total_income = sum(t.amount for t in transactions if t.type == "income")
    total_expenses = sum(t.amount for t in transactions if t.type == "expense")
    net_savings = total_income - total_expenses
    savings_rate = (net_savings / total_income * 100) if total_income > 0 else 0.0

    # Group expenses by category for the breakdown chart
    category_totals: dict[str, dict] = {}
    for t in transactions:
        if t.type == "expense":
            cat_name = t.category.name if t.category else "Uncategorized"
            cat_color = t.category.color if t.category else "#94a3b8"

            if cat_name not in category_totals:
                category_totals[cat_name] = {"color": cat_color, "total": 0.0}
            category_totals[cat_name]["total"] += t.amount

    breakdown = [
        schemas.CategoryBreakdown(category=name, color=data["color"], total=data["total"])
        for name, data in sorted(category_totals.items(), key=lambda x: -x[1]["total"])
    ]

    return schemas.MonthlySummary(
        month=month,
        total_income=round(total_income, 2),
        total_expenses=round(total_expenses, 2),
        net_savings=round(net_savings, 2),
        savings_rate=round(savings_rate, 1),
        category_breakdown=breakdown,
        transaction_count=len(transactions),
    )
