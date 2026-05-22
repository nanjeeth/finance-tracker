import re
import io
import hashlib
from datetime import datetime, date
from typing import Optional

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

from app.csv_parser import guess_category, make_fingerprint


def parse_pdf(content: bytes) -> dict:
    if pdfplumber is None:
        return {"error": "pdfplumber is not installed", "transactions": [], "bank": None}

    try:
        pdf = pdfplumber.open(io.BytesIO(content))
    except Exception:
        return {"error": "Could not open PDF file", "transactions": [], "bank": None}

    all_text = ""
    all_tables = []
    for page in pdf.pages:
        text = page.extract_text() or ""
        all_text += text + "\n"
        tables = page.extract_tables() or []
        all_tables.extend(tables)

    pdf.close()

    bank = detect_bank_pdf(all_text)
    if not bank:
        return {
            "error": "Could not detect bank format from this PDF. Try downloading a CSV statement instead.",
            "transactions": [],
            "bank": None,
        }

    transactions = []
    errors = []

    if bank == "Chase":
        transactions, errors = parse_chase_pdf(all_tables, all_text)
    elif bank == "Bank of America":
        transactions, errors = parse_bofa_pdf(all_tables, all_text)
    elif bank == "Amex":
        transactions, errors = parse_amex_pdf(all_tables, all_text)
    elif bank == "Capital One":
        transactions, errors = parse_capital_one_pdf(all_tables, all_text)
    elif bank == "Citi":
        transactions, errors = parse_citi_pdf(all_tables, all_text)
    elif bank == "Discover":
        transactions, errors = parse_discover_pdf(all_tables, all_text)
    elif bank == "Wells Fargo":
        transactions, errors = parse_wells_fargo_pdf(all_tables, all_text)
    else:
        transactions, errors = parse_generic_pdf(all_tables, all_text)

    return {
        "bank": bank,
        "transactions": transactions,
        "total_parsed": len(transactions),
        "errors": errors,
    }


def detect_bank_pdf(text: str) -> Optional[str]:
    text_lower = text.lower()
    if "chase" in text_lower and ("jpmorgan" in text_lower or "card" in text_lower):
        return "Chase"
    if "bank of america" in text_lower:
        return "Bank of America"
    if "american express" in text_lower or "amex" in text_lower:
        return "Amex"
    if "capital one" in text_lower:
        return "Capital One"
    if "citibank" in text_lower or "citi " in text_lower:
        return "Citi"
    if "discover" in text_lower and ("card" in text_lower or "bank" in text_lower):
        return "Discover"
    if "wells fargo" in text_lower:
        return "Wells Fargo"
    # Try generic parsing if no bank matched but we can find transaction patterns
    if re.search(r'\d{2}/\d{2}\s+.+\s+\-?\$?[\d,]+\.\d{2}', text):
        return "Generic"
    return None


DATE_PATTERNS = [
    (r'(\d{2}/\d{2}/\d{4})', "%m/%d/%Y"),
    (r'(\d{2}/\d{2}/\d{2})', "%m/%d/%y"),
    (r'(\d{2}/\d{2})', None),  # needs year inference
]


def parse_date_str(date_str: str, year_hint: int = 2026) -> Optional[date]:
    date_str = date_str.strip()
    for pattern, fmt in DATE_PATTERNS:
        m = re.match(pattern, date_str)
        if m:
            matched = m.group(1)
            if fmt:
                try:
                    return datetime.strptime(matched, fmt).date()
                except ValueError:
                    continue
            else:
                try:
                    return datetime.strptime(f"{matched}/{year_hint}", "%m/%d/%Y").date()
                except ValueError:
                    continue
    return None


def parse_amount(amount_str: str) -> Optional[float]:
    if not amount_str:
        return None
    cleaned = amount_str.replace("$", "").replace(",", "").replace(" ", "").strip()
    cleaned = re.sub(r'[^\d.\-]', '', cleaned)
    try:
        return float(cleaned)
    except ValueError:
        return None


def extract_transactions_from_text(text: str, negate_expenses: bool = True) -> tuple[list[dict], list[str]]:
    """Generic line-by-line parser for PDF text."""
    transactions = []
    errors = []
    lines = text.split("\n")

    tx_pattern = re.compile(
        r'(\d{2}/\d{2}(?:/\d{2,4})?)\s+'
        r'(.+?)\s+'
        r'(-?\$?[\d,]+\.\d{2})\s*$'
    )

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue

        m = tx_pattern.search(line)
        if not m:
            continue

        date_str, description, amount_str = m.group(1), m.group(2).strip(), m.group(3)
        tx_date = parse_date_str(date_str)
        amount = parse_amount(amount_str)

        if not tx_date or amount is None or amount == 0:
            continue

        # Skip header-like lines
        desc_lower = description.lower()
        if any(skip in desc_lower for skip in ["opening balance", "closing balance", "previous balance", "new balance", "payment due", "minimum payment"]):
            continue

        if negate_expenses:
            tx_type = "income" if amount > 0 else "expense"
        else:
            tx_type = "expense" if amount > 0 else "income"

        amount = abs(amount)
        category = guess_category(description)
        fingerprint = make_fingerprint(description, amount, tx_date)

        transactions.append({
            "title": description,
            "amount": round(amount, 2),
            "type": tx_type,
            "date": tx_date.isoformat(),
            "suggested_category": category,
            "fingerprint": fingerprint,
        })

    return transactions, errors


def parse_chase_pdf(tables: list, text: str) -> tuple[list[dict], list[str]]:
    return extract_transactions_from_text(text, negate_expenses=True)


def parse_bofa_pdf(tables: list, text: str) -> tuple[list[dict], list[str]]:
    return extract_transactions_from_text(text, negate_expenses=True)


def parse_amex_pdf(tables: list, text: str) -> tuple[list[dict], list[str]]:
    return extract_transactions_from_text(text, negate_expenses=False)


def parse_capital_one_pdf(tables: list, text: str) -> tuple[list[dict], list[str]]:
    return extract_transactions_from_text(text, negate_expenses=False)


def parse_citi_pdf(tables: list, text: str) -> tuple[list[dict], list[str]]:
    return extract_transactions_from_text(text, negate_expenses=False)


def parse_discover_pdf(tables: list, text: str) -> tuple[list[dict], list[str]]:
    return extract_transactions_from_text(text, negate_expenses=False)


def parse_wells_fargo_pdf(tables: list, text: str) -> tuple[list[dict], list[str]]:
    return extract_transactions_from_text(text, negate_expenses=True)


def parse_generic_pdf(tables: list, text: str) -> tuple[list[dict], list[str]]:
    return extract_transactions_from_text(text, negate_expenses=True)
