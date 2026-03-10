import requests


def test_stats():
    url = "http://localhost:8000/api/v1/admin/stats"
    token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbkBmb29kcmVzY3VlLmNvbSIsInVzZXJfaWQiOiIwZmNiY2U1OC01ZDhlLTRjMDAtOTQ1MC1iYjE1OTIxYTgwOTUiLCJyb2xlIjoiQURNSU4iLCJleHAiOjE3NzA3NTA0NTl9.93loo965TuOkbxdRe05nIBLct8WdQB0qOr6cvxjA_RA"  # noqa: E501

    headers = {
        "Authorization": f"Bearer {token}"
    }

    print(f"Testing stats endpoint: {url}")

    try:
        response = requests.get(url, headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    test_stats()
