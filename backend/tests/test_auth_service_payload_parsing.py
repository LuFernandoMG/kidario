from app.services import auth_service


def test_extract_signup_user_payload_from_nested_user() -> None:
    payload = {
        "user": {"id": "3f03f5fc-d2c2-4f79-ac10-53dbd2258f41", "identities": [{"id": "a"}]},
        "session": {"access_token": "at", "refresh_token": "rt"},
    }

    user = auth_service._extract_signup_user_payload(payload)

    assert user["id"] == "3f03f5fc-d2c2-4f79-ac10-53dbd2258f41"


def test_extract_signup_user_payload_from_top_level_user_schema() -> None:
    payload = {
        "id": "3f03f5fc-d2c2-4f79-ac10-53dbd2258f41",
        "email": "parent@example.com",
        "identities": [{"id": "a"}],
    }

    user = auth_service._extract_signup_user_payload(payload)

    assert user["id"] == "3f03f5fc-d2c2-4f79-ac10-53dbd2258f41"


def test_extract_signup_session_payload_from_top_level_token_fields() -> None:
    payload = {
        "access_token": "at",
        "refresh_token": "rt",
        "expires_in": 3600,
        "token_type": "bearer",
    }

    session = auth_service._extract_signup_session_payload(payload)

    assert session == payload
