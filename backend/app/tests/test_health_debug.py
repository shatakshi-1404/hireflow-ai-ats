from app.tests.helpers import API, add_user


def test_client_key_endpoint_is_admin_only(admin, make_client):
    assert make_client().get(f"{API}/health/client-key").status_code == 401
    body = admin.get(f"{API}/health/client-key").json()
    assert set(body) == {"key", "x_forwarded_for", "trusted_proxy_count"}
    rec = add_user(admin, make_client, "rec@acme.test", "RECRUITER")
    assert rec.get(f"{API}/health/client-key").status_code == 403
