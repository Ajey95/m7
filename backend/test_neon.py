import psycopg

# Test 1: pooler on port 6543 via URL (NeonDB pgBouncer port)
try:
    url = "postgresql://neondb_owner:npg_3RKAaNkpMnL9@ep-super-flower-adtvik0t-pooler.c-2.us-east-1.aws.neon.tech:6543/neondb?sslmode=require"
    conn = psycopg.connect(url, connect_timeout=15)
    r = conn.execute("SELECT current_database(), version()").fetchone()
    print(f"[POOLER:6543] CONNECTED - DB={r[0]}")
    conn.close()
except Exception as e:
    print(f"[POOLER:6543] FAIL: {e}")

# Test 2: pooler on port 5432 via URL
try:
    url = "postgresql://neondb_owner:npg_3RKAaNkpMnL9@ep-super-flower-adtvik0t-pooler.c-2.us-east-1.aws.neon.tech:5432/neondb?sslmode=require"
    conn = psycopg.connect(url, connect_timeout=15)
    r = conn.execute("SELECT current_database(), version()").fetchone()
    print(f"[POOLER:5432] CONNECTED - DB={r[0]}")
    conn.close()
except Exception as e:
    print(f"[POOLER:5432] FAIL: {e}")

# Test 3: direct endpoint (no -pooler) on port 5432
try:
    url = "postgresql://neondb_owner:npg_3RKAaNkpMnL9@ep-super-flower-adtvik0t.c-2.us-east-1.aws.neon.tech:5432/neondb?sslmode=require"
    conn = psycopg.connect(url, connect_timeout=15)
    r = conn.execute("SELECT current_database(), version()").fetchone()
    print(f"[DIRECT:5432] CONNECTED - DB={r[0]}")
    conn.close()
except Exception as e:
    print(f"[DIRECT:5432] FAIL: {e}")

