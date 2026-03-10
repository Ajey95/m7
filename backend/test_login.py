import requests


def test_login():
    url = "http://localhost:8000/api/v1/auth/login"
    payload = {
        "username": "admin@foodrescue.com",
        "password": "any_password"
    }

    print(f"Testing login to {url} with {payload['username']}")

    try:
        response = requests.post(url, data=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")

        if response.status_code == 200:
            print("✅ Login Successful!")
            print(f"Token: {response.json().get('access_token')}")
        else:
            print("❌ Login Failed")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    test_login()
