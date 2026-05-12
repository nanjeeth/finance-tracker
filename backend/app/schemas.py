from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from app.models import TransactionType


# ── Category schemas ──────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    """What the frontend sends when creating a category"""
    name: str
    color: str = "#6366f1"
    budget_limit: Optional[float] = None


class CategoryOut(CategoryCreate):
    """What the API returns — includes the generated id"""
    id: int

    class Config:
        from_attributes = True  # Allows converting SQLAlchemy model → Pydantic


# ── Transaction schemas ───────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    """What the frontend sends when adding a transaction"""
    title: str
    amount: float = Field(gt=0, description="Must be a positive number")
    type: TransactionType          # "income" or "expense"
    date: date
    note: Optional[str] = None
    category_id: Optional[int] = None


class TransactionOut(TransactionCreate):
    """What the API returns — includes id and the full category object"""
    id: int
    category: Optional[CategoryOut] = None

    class Config:
        from_attributes = True


# ── Summary schemas ───────────────────────────────────────────────────────────

class CategoryBreakdown(BaseModel):
    """Spending total for one category"""
    category: str
    color: str
    total: float


class MonthlySummary(BaseModel):
    """Full financial picture for a given month"""
    month: str                              # e.g. "2026-05"
    total_income: float
    total_expenses: float
    net_savings: float                      # income - expenses
    savings_rate: float                     # percentage saved
    category_breakdown: list[CategoryBreakdown]
    transaction_count: int
