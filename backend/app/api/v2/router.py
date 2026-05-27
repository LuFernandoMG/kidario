from fastapi import APIRouter

from app.api.v2.endpoints.bookings import router as bookings_router
from app.api.v2.endpoints.explore import router as explore_router
from app.api.v2.endpoints.notifications import router as notifications_router
from app.api.v2.endpoints.packages import router as packages_router
from app.api.v2.endpoints.payments import router as payments_router
from app.api.v2.endpoints.profiles import router as profiles_router
from app.api.v2.endpoints.reviews import router as reviews_router

api_router = APIRouter()
api_router.include_router(profiles_router)
api_router.include_router(explore_router)
api_router.include_router(bookings_router)
api_router.include_router(payments_router)
api_router.include_router(packages_router)
api_router.include_router(reviews_router)
api_router.include_router(notifications_router)
