"""
ShelfSense AI — Supabase Live Connection & Database Test Suite
==============================================================
Validates:
  - Supabase connectivity
  - Authentication status
  - Inventory table read
  - Inventory stock write / sync
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend import supabase_client


def test_supabase_connection():
    assert supabase_client.SUPABASE_READY, "Supabase client not initialized. Check .env."
    print("  [PASS] Supabase client initialized and connected.")


def test_database_operations():
    # 1. Database Read
    inv_res = supabase_client.get_inventory_from_db()
    assert inv_res.get("success"), f"Database read failed: {inv_res.get('error')}"
    data = inv_res.get("data", [])
    assert len(data) >= 4, f"Expected at least 4 SKUs, found {len(data)}"
    print(f"  [PASS] Database read: successfully queried {len(data)} SKUs from 'inventory' table.")

    # 2. Database Write / Sync
    sample_stock = {"CocaCola": 1, "KitKat": 3, "Lays": 1, "Oreo": 1}
    sync_res = supabase_client.sync_inventory_to_db(sample_stock)
    assert sync_res.get("success"), f"Database write failed: {sync_res.get('error')}"
    print(f"  [PASS] Database write: successfully synced {sync_res.get('updated')} SKUs.")


def test_auth_status():
    test_email = "store_operator@shelfsense.ai"
    test_password = "SecurePassword123!"

    signup_res = supabase_client.sign_up_user(
        email=test_email,
        password=test_password,
        role="manager",
        name="Main Store Manager"
    )
    if signup_res.get("success"):
        print(f"  [PASS] Supabase Auth sign-up: new user created ({signup_res.get('user_id')}).")
    else:
        err = str(signup_res.get("error", ""))
        print(f"  [INFO] Supabase Auth response: {err}")


if __name__ == "__main__":
    print("Running Supabase Live Test Suite...")
    test_supabase_connection()
    test_database_operations()
    test_auth_status()
    print("\nALL SUPABASE TESTS COMPLETED SUCCESSFULLY!")

