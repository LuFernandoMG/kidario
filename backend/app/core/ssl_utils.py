import ssl

import certifi


def build_ssl_context(ca_bundle_path: str | None = None) -> ssl.SSLContext:
    normalized_path = (ca_bundle_path or "").strip()
    candidate_paths: list[str | None] = []

    if normalized_path:
        candidate_paths.append(normalized_path)

    certifi_bundle = certifi.where()
    if certifi_bundle not in candidate_paths:
        candidate_paths.append(certifi_bundle)

    candidate_paths.append(None)

    for cafile in candidate_paths:
        try:
            return ssl.create_default_context(cafile=cafile)
        except FileNotFoundError:
            continue
        except OSError:
            continue

    return ssl.create_default_context()
