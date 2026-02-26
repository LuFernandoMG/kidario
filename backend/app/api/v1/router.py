from fastapi import APIRouter

from app.api.v1.endpoints.admin import router as admin_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.bookings import router as bookings_router
from app.api.v1.endpoints.chat import router as chat_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.marketplace import router as marketplace_router
from app.api.v1.endpoints.profiles import router as profiles_router
from app.api.v1.endpoints.teacher_control import router as teacher_control_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(marketplace_router)
api_router.include_router(profiles_router)
api_router.include_router(bookings_router)
api_router.include_router(chat_router)
api_router.include_router(teacher_control_router)
api_router.include_router(admin_router)
