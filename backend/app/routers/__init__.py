from .admin import router as admin_router
from .auth import router as auth_router
from .crops import router as crops_router
from .gardens import router as gardens_router
from .insights import router as insights_router
from .planner import router as planner_router
from .sensors import router as sensors_router
from .tasks import router as tasks_router

__all__ = [
    "admin_router",
    "auth_router",
    "crops_router",
    "gardens_router",
    "insights_router",
    "planner_router",
    "sensors_router",
    "tasks_router",
]
