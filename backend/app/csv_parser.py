import csv
import io
import hashlib
from datetime import datetime, date
from dataclasses import dataclass

BANK_PROFILES: list[dict] = [
    {
        "name": "Chase",
        "detect": ["Transaction Date", "Post Date", "Description", "Category", "Type", "Amount"],
        "date_col": "Transaction Date",
        "desc_col": "Description",
        "amount_col": "Amount",
        "category_col": "Category",
        "date_formats": ["%m/%d/%Y"],
        "negate_expenses": True,
    },
    {
        "name": "Bank of America",
        "detect": ["Date", "Description", "Amount", "Running Bal."],
        "date_col": "Date",
        "desc_col": "Description",
        "amount_col": "Amount",
        "date_formats": ["%m/%d/%Y"],
        "negate_expenses": True,
    },
    {
        "name": "Amex",
        "detect": ["Date", "Description", "Amount"],
        "date_col": "Date",
        "desc_col": "Description",
        "amount_col": "Amount",
        "date_formats": ["%m/%d/%Y", "%m/%d/%y"],
        "negate_expenses": False,
    },
    {
        "name": "Capital One",
        "detect": ["Transaction Date", "Posted Date", "Card No.", "Description", "Category", "Debit", "Credit"],
        "date_col": "Transaction Date",
        "desc_col": "Description",
        "amount_col": None,
        "debit_col": "Debit",
        "credit_col": "Credit",
        "category_col": "Category",
        "date_formats": ["%Y-%m-%d"],
        "negate_expenses": False,
    },
    {
        "name": "Citi",
        "detect": ["Status", "Date", "Description", "Debit", "Credit"],
        "date_col": "Date",
        "desc_col": "Description",
        "amount_col": None,
        "debit_col": "Debit",
        "credit_col": "Credit",
        "date_formats": ["%m/%d/%Y"],
        "negate_expenses": False,
    },
    {
        "name": "Discover",
        "detect": ["Trans. Date", "Post Date", "Description", "Amount", "Category"],
        "date_col": "Trans. Date",
        "desc_col": "Description",
        "amount_col": "Amount",
        "category_col": "Category",
        "date_formats": ["%m/%d/%Y"],
        "negate_expenses": False,
    },
    {
        "name": "Wells Fargo",
        "detect": ["Date", "Amount", "Description"],
        "date_col": "Date",
        "desc_col": "Description",
        "amount_col": "Amount",
        "date_formats": ["%m/%d/%Y"],
        "negate_expenses": True,
    },
    {
        "name": "Apple Card",
        "detect": ["Transaction Date", "Clearing Date", "Description", "Merchant", "Category", "Type", "Amount (USD)"],
        "date_col": "Transaction Date",
        "desc_col": "Description",
        "amount_col": "Amount (USD)",
        "category_col": "Category",
        "date_formats": ["%m/%d/%Y"],
        "negate_expenses": False,
    },
]

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Groceries": ["walmart", "target", "kroger", "costco", "safeway", "trader joe", "whole foods", "aldi", "publix", "grocery", "market"],
    "Dining": ["restaurant", "mcdonald", "starbucks", "chipotle", "subway", "doordash", "uber eats", "grubhub", "pizza", "cafe", "diner", "taco bell", "wendy", "burger"],
    "Transport": ["uber", "lyft", "gas", "shell", "chevron", "exxon", "bp ", "parking", "transit", "metro", "toll"],
    "Shopping": ["amazon", "ebay", "apple.com", "best buy", "nike", "nordstrom", "macy", "kohls", "home depot", "lowes", "ikea"],
    "Entertainment": ["netflix", "spotify", "hulu", "disney", "hbo", "youtube", "cinema", "movie", "gaming", "steam", "playstation", "xbox"],
    "Utilities": ["electric", "water", "gas bill", "internet", "comcast", "verizon", "at&t", "t-mobile", "phone bill", "utility"],
    "Health": ["pharmacy", "cvs", "walgreens", "doctor", "hospital", "medical", "dental", "health", "gym", "fitness"],
    "Rent": ["rent", "mortgage", "lease"],
    "Insurance": ["insurance", "geico", "progressive", "state farm", "allstate"],
    "Subscriptions": ["subscription", "membership", "recurring", "annual fee"],
}


@dataclass
class ParsedTransaction:
    title: str
    amount: float
    type: str
    date: date
    suggested_category: str | None
    fingerprint: str


def detect_bank(headers: list[str]) -> dict | None:
    normalized = [h.strip() for h in headers]
    for profile in BANK_PROFILES:
        if all(col in normalized for col in profile["detect"]):
            return profile
    return None


def parse_date(date_str: str, formats: list[str]) -> date:
    date_str = date_str.strip()
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Could not parse date: {date_str}")


def guess_category(description: str) -> str | None:
    desc_lower = description.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in desc_lower for kw in keywords):
            return category
    return None


def make_fingerprint(title: str, amount: float, tx_date: date) -> str:
    raw = f"{title}|{amount}|{tx_date.isoformat()}"
    return hashlib.md5(raw.encode()).hexdigest()


def parse_csv(content: str) -> dict:
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        return {"error": "Empty or invalid CSV file", "transactions": [], "bank": None}

    headers = list(reader.fieldnames)
    profile = detect_bank(headers)

    if not profile:
        return {
            "error": f"Unrecognized bank format. Headers found: {headers}",
            "transactions": [],
            "bank": None,
        }

    transactions: list[dict] = []
    errors: list[str] = []

    for i, row in enumerate(reader, start=2):
        try:
            tx_date = parse_date(row[profile["date_col"]], profile["date_formats"])
            title = row[profile["desc_col"]].strip()

            if profile.get("amount_col"):
                raw_amount = float(row[profile["amount_col"]].replace(",", "").replace("$", ""))
                if profile.get("negate_expenses"):
                    tx_type = "income" if raw_amount > 0 else "expense"
                    amount = abs(raw_amount)
                else:
                    tx_type = "expense" if raw_amount > 0 else "income"
                    amount = abs(raw_amount)
            else:
                debit = row.get(profile.get("debit_col", ""), "").replace(",", "").replace("$", "").strip()
                credit = row.get(profile.get("credit_col", ""), "").replace(",", "").replace("$", "").strip()
                if debit:
                    amount = abs(float(debit))
                    tx_type = "expense"
                elif credit:
                    amount = abs(float(credit))
                    tx_type = "income"
                else:
                    continue

            if amount == 0:
                continue

            suggested_category = None
            if profile.get("category_col") and row.get(profile["category_col"]):
                suggested_category = row[profile["category_col"]].strip()
            if not suggested_category:
                suggested_category = guess_category(title)

            fingerprint = make_fingerprint(title, amount, tx_date)

            transactions.append({
                "title": title,
                "amount": round(amount, 2),
                "type": tx_type,
                "date": tx_date.isoformat(),
                "suggested_category": suggested_category,
                "fingerprint": fingerprint,
            })

        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")

    return {
        "bank": profile["name"],
        "transactions": transactions,
        "total_parsed": len(transactions),
        "errors": errors,
    }
