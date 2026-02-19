from fastapi import APIRouter

from app.api.v1.endpoints.admin import router as admin_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.profiles import router as profiles_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(profiles_router)
api_router.include_router(admin_router)

