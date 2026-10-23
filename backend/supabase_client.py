"""
ShelfSense — Supabase Backend Database & Authentication Service
==============================================================
Provides production-ready integration with Supabase:
- User Authentication (Sign Up, Sign In, Profile Persona Retrieval)
- Inventory Synchronizer (Stock levels & Multi-Pack counts)
- Misplacement Incident Logging (Neighbor context & Resolution status)
- Audit Trail Ledger (Compliance history)
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

# Load root .env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://tokzyzqmvpnvqvrzwbzn.supabase.co")
SUPABASE_ANON_KEY = os.getenv(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRva3p5enFtdnBudnF2cnp3YnpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2ODM1NzIsImV4cCI6MjEwODI1OTU3Mn0.XCFxOBmQFB35g9d9jpA7F7MwKD-6E_7sV60xGKEVH7c",
)

try:
    from supabase import create_client, Client
    supabase: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    SUPABASE_READY = True
except Exception as e:
    print(f"[Supabase] Warning: Could not initialize Supabase client: {e}")
    supabase = None
    SUPABASE_READY = False


# ====================================================================
# 1. AUTHENTICATION SERVICES
# ====================================================================

def sign_up_user(email: str, password: str, role: str = "staff", name: str = "Retail Operator") -> Dict[str, Any]:
    """Registers a new user in Supabase Auth and stores their persona role in user_metadata."""
    if not supabase:
        return {"success": False, "error": "Supabase client not initialized"}

    try:
        response = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "role": role,
                    "name": name,
                    "created_at": "now()"
                }
            }
        })
        return {
            "success": True,
            "user_id": response.user.id if response.user else None,
            "email": response.user.email if response.user else email,
            "role": role,
            "session": bool(response.session)
        }
    except Exception as err:
        return {"success": False, "error": str(err)}


def sign_in_user(email: str, password: str) -> Dict[str, Any]:
    """Authenticates user with Supabase Auth and returns access session token & persona profile."""
    if not supabase:
        return {"success": False, "error": "Supabase client not initialized"}

    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        user = response.user
        metadata = user.user_metadata if user else {}
        role = metadata.get("role", "staff")
        name = metadata.get("name", "Store Associate")

        return {
            "success": True,
            "access_token": response.session.access_token if response.session else None,
            "user": {
                "id": user.id if user else None,
                "email": user.email if user else email,
                "role": role,
                "name": name
            }
        }
    except Exception as err:
        return {"success": False, "error": str(err)}


def get_current_user(access_token: str) -> Dict[str, Any]:
    """Validates JWT access token with Supabase and returns user profile."""
    if not supabase:
        return {"success": False, "error": "Supabase client not initialized"}

    try:
        user_res = supabase.auth.get_user(access_token)
        user = user_res.user
        metadata = user.user_metadata if user else {}
        return {
            "success": True,
            "user": {
                "id": user.id if user else None,
                "email": user.email if user else None,
                "role": metadata.get("role", "staff"),
                "name": metadata.get("name", "Operator")
            }
        }
    except Exception as err:
        return {"success": False, "error": str(err)}


LOCAL_PROFILES_FILE = Path(__file__).resolve().parent.parent / "models" / "user_profiles.json"


def _read_local_profiles() -> Dict[str, Any]:
    if LOCAL_PROFILES_FILE.is_file():
        try:
            import json
            with open(LOCAL_PROFILES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _write_local_profiles(data: Dict[str, Any]) -> None:
    try:
        import json
        LOCAL_PROFILES_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LOCAL_PROFILES_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"[SupabaseClient] Warning: Could not save local profile: {e}")


def get_user_profile(email: str) -> Dict[str, Any]:
    """Retrieves locked persona profile for the given email from Supabase or local backup."""
    clean_email = email.strip().lower()
    if supabase:
        try:
            res = supabase.table("user_profiles").select("*").eq("email", clean_email).execute()
            if res.data and len(res.data) > 0:
                row = res.data[0]
                return {
                    "exists": True,
                    "email": row["email"],
                    "full_name": row.get("full_name", "Operator"),
                    "role": row["role"]
                }
        except Exception:
            pass

    # Fallback to local persistent cache
    local = _read_local_profiles()
    if clean_email in local:
        return {"exists": True, **local[clean_email]}

    return {"exists": False, "email": clean_email}


def assign_user_persona(email: str, full_name: str, requested_role: str) -> Dict[str, Any]:
    """
    Assigns or validates the user's persona:
    - If user already exists: verifies requested_role == assigned_role.
      If it differs, REJECTS the assignment with an explicit error.
    - If user is new: registers the persona permanently in Supabase.
    """
    clean_email = email.strip().lower()
    existing = get_user_profile(clean_email)

    if existing.get("exists"):
        locked_role = existing.get("role")
        if locked_role != requested_role:
            return {
                "success": False,
                "error": f"Email '{clean_email}' is already permanently registered with persona '{locked_role}'. Access to '{requested_role}' is denied."
            }
        return {
            "success": True,
            "email": clean_email,
            "full_name": existing.get("full_name", full_name),
            "role": locked_role,
            "locked": True
        }

    # Brand new registration for this email
    new_profile = {
        "email": clean_email,
        "full_name": full_name or "Retail Associate",
        "role": requested_role
    }

    if supabase:
        try:
            supabase.table("user_profiles").insert(new_profile).execute()
        except Exception as err:
            print(f"[Supabase] Could not insert user_profile table (may need schema migration): {err}")

    # Save to local persistent store as well
    local = _read_local_profiles()
    local[clean_email] = new_profile
    _write_local_profiles(local)

    return {
        "success": True,
        "email": clean_email,
        "full_name": new_profile["full_name"],
        "role": requested_role,
        "locked": True
    }


# ====================================================================
# 2. DATABASE: INVENTORY SERVICES
# ====================================================================

def get_inventory_from_db() -> Dict[str, Any]:
    """Fetches all SKU stock levels from Supabase inventory table."""
    if not supabase:
        return {"success": False, "error": "Supabase not connected", "data": []}

    try:
        res = supabase.table("inventory").select("*").execute()
        return {"success": True, "data": res.data}
    except Exception as err:
        return {"success": False, "error": str(err), "data": []}


def sync_inventory_to_db(products: Dict[str, int]) -> Dict[str, Any]:
    """
    Upserts current detected unit counts (including decomposed KitKat stack)
    into the Supabase inventory table.
    """
    if not supabase:
        return {"success": False, "error": "Supabase not connected"}

    try:
        records = [
            {
                "sku": sku,
                "unit_count": count,
                "designated_zone": "Top-Left Deck" if sku == "Lays" else ("Top-Right Deck" if sku == "CocaCola" else ("Bottom-Left Shelf" if sku == "KitKat" else "Bottom-Right Shelf")),
                "status": "OK" if count > 0 else "OUT_OF_STOCK"
            }
            for sku, count in products.items()
        ]
        res = supabase.table("inventory").upsert(records, on_conflict="sku").execute()
        return {"success": True, "updated": len(records), "data": res.data}
    except Exception as err:
        return {"success": False, "error": str(err)}


# ====================================================================
# 3. DATABASE: MISPLACEMENT SERVICES
# ====================================================================

def log_misplacement_to_db(item: Dict[str, Any]) -> Dict[str, Any]:
    """Logs a planogram misplacement incident with triangulated neighbor context into Supabase."""
    if not supabase:
        return {"success": False, "error": "Supabase not connected"}

    try:
        record = {
            "product": item.get("class_name") or item.get("product"),
            "current_zone": item.get("actual_zone_name") or item.get("current_zone"),
            "expected_zone": item.get("expected_zone_name") or item.get("expected_zone"),
            "neighbor_sku": item.get("neighbor_sku"),
            "message": item.get("message"),
            "severity": item.get("severity", "WARNING"),
            "resolved": False
        }
        res = supabase.table("misplacements").insert(record).execute()
        return {"success": True, "data": res.data}
    except Exception as err:
        return {"success": False, "error": str(err)}


def get_active_misplacements_from_db() -> Dict[str, Any]:
    """Retrieves all unresolved misplacement incidents from Supabase."""
    if not supabase:
        return {"success": False, "error": "Supabase not connected", "data": []}

    try:
        res = supabase.table("misplacements").select("*").eq("resolved", False).order("created_at", desc=True).execute()
        return {"success": True, "data": res.data}
    except Exception as err:
        return {"success": False, "error": str(err), "data": []}


def resolve_misplacement_in_db(incident_id: int) -> Dict[str, Any]:
    """Marks a misplacement incident as resolved by floor staff."""
    if not supabase:
        return {"success": False, "error": "Supabase not connected"}

    try:
        res = supabase.table("misplacements").update({"resolved": True, "resolved_at": "now()"}).eq("id", incident_id).execute()
        return {"success": True, "data": res.data}
    except Exception as err:
        return {"success": False, "error": str(err)}


# ====================================================================
# 4. DATABASE: AUDIT TRAIL LOGGING
# ====================================================================

def log_audit_event_to_db(event: Dict[str, Any]) -> Dict[str, Any]:
    """Inserts a forensic audit trail entry into Supabase."""
    if not supabase:
        return {"success": False, "error": "Supabase not connected"}

    try:
        record = {
            "event_id": event.get("event_id", f"EVT-{os.urandom(2).hex()}"),
            "event_type": event.get("event_type", "COMPLIANCE_CHECK"),
            "product": event.get("product"),
            "zone": event.get("zone"),
            "message": event.get("message"),
            "severity": event.get("severity", "NORMAL"),
            "compliance_pct": event.get("compliance_pct", 100.0)
        }
        res = supabase.table("audit_logs").insert(record).execute()
        return {"success": True, "data": res.data}
    except Exception as err:
        return {"success": False, "error": str(err)}

