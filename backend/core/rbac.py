"""
RBAC — Role-Based Access Control.
Central registry of roles + capabilities + helper functions.
"""
from fastapi import HTTPException, Depends
from core.deps import current_user

# ═══════════════════════════════════════════════════════════════
# ROLES + CAPABILITIES
# ═══════════════════════════════════════════════════════════════
ROLES = [
    {"key": "super_admin",         "name": "\u0645\u062f\u064a\u0631 \u0623\u0639\u0644\u0649",           "color": "#EF4444", "level": 100},
    {"key": "ceo",                 "name": "\u0631\u0626\u064a\u0633 \u062a\u0646\u0641\u064a\u0630\u064a",       "color": "#8B5CF6", "level": 90},
    {"key": "marketing_manager",   "name": "\u0645\u062f\u064a\u0631 \u062a\u0633\u0648\u064a\u0642",           "color": "#D1795F", "level": 70},
    {"key": "community_manager",   "name": "\u0645\u062f\u064a\u0631 \u0645\u062c\u062a\u0645\u0639",           "color": "#F59E0B", "level": 70},
    {"key": "company",             "name": "\u0634\u0631\u0643\u0629",                 "color": "#57769D", "level": 60},
    {"key": "team_owner",          "name": "\u0642\u0627\u0626\u062f \u0641\u0631\u064a\u0642",             "color": "#06B6D4", "level": 50},
    {"key": "trainer",             "name": "\u0645\u062f\u0631\u0651\u0628",                 "color": "#C3E0A5", "level": 40},
    {"key": "creator",             "name": "\u0635\u0627\u0646\u0639 \u0645\u062d\u062a\u0648\u0649",           "color": "#D1795F", "level": 30},
    {"key": "client",              "name": "\u0639\u0645\u064a\u0644",                  "color": "#94A3B8", "level": 20},
    {"key": "student",             "name": "\u0637\u0627\u0644\u0628",                  "color": "#94A3B8", "level": 10},
]
ROLE_KEYS = [r["key"] for r in ROLES]

# Capabilities each role has
CAPABILITIES = {
    # Admin operations
    "admin.view_all_users":       ["super_admin", "ceo"],
    "admin.change_user_role":     ["super_admin"],
    "admin.ban_users":            ["super_admin"],
    "admin.view_platform_stats":  ["super_admin", "ceo"],
    "admin.view_all_leads":       ["super_admin", "marketing_manager"],
    # Community moderation
    "community.moderate":         ["super_admin", "community_manager"],
    # Marketing
    "marketing.manage_campaigns": ["super_admin", "marketing_manager", "ceo"],
    # Academy
    "academy.create_courses":     ["super_admin", "trainer", "ceo"],
    # Business tools (CRM/Content/Tasks are open to everyone but signaled here for future gating)
    "business.use_crm":           "*",   # any authenticated user
    "business.use_content_os":    "*",
    "business.use_tasks":         "*",
}


def role_meta(role_key: str) -> dict:
    for r in ROLES:
        if r["key"] == role_key:
            return r
    return {"key": role_key, "name": role_key, "color": "#94A3B8", "level": 0}


def has_capability(user_role: str, capability: str) -> bool:
    allowed = CAPABILITIES.get(capability, [])
    if allowed == "*":
        return True
    return user_role in allowed


def require_capability(capability: str):
    """FastAPI dependency: verify current user has capability."""
    async def _check(user=Depends(current_user)):
        role = user.get("role", "creator")
        if not has_capability(role, capability):
            raise HTTPException(403, f"\u063a\u064a\u0631 \u0645\u0635\u0631\u062d: \u064a\u062a\u0637\u0644\u0651\u0628 {capability}")
        return user
    return _check
