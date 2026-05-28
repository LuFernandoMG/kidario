from fastapi import APIRouter


router = APIRouter(tags=["v2-health"])


@router.get("/health")
def get_health() -> dict[str, str]:
    return {"status": "ok"}
