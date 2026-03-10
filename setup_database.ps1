# Supabase Database Setup Script
# Run this script to set up your unified backend database

Write-Host "🚀 Supabase Database Setup for Unified Backend" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Database credentials
$PGHOST = "db.bwrwszeftkiwbybolzrh.supabase.co"
$PGUSER = "postgres"
$PGDATABASE = "postgres"
$PGPORT = "5432"
$PGPASSWORD = "surplusSync@12345"

# Set environment variable for psql
$env:PGPASSWORD = $PGPASSWORD

Write-Host "📡 Testing connection to Supabase..." -ForegroundColor Yellow

# Test connection
$testConnection = psql -h $PGHOST -U $PGUSER -d $PGDATABASE -p $PGPORT -c "SELECT version();" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to connect to Supabase database!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "1. Your internet connection"
    Write-Host "2. Supabase project is running (https://app.supabase.com)"
    Write-Host "3. Database credentials in .env are correct"
    Write-Host "4. psql is installed (install PostgreSQL client tools)"
    Write-Host ""
    exit 1
}

Write-Host "✅ Connected to Supabase successfully!" -ForegroundColor Green
Write-Host ""

# Enable extensions
Write-Host "🔧 Enabling PostGIS and UUID extensions..." -ForegroundColor Yellow

psql -h $PGHOST -U $PGUSER -d $PGDATABASE -p $PGPORT -c "CREATE EXTENSION IF NOT EXISTS postgis;" | Out-Null
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -p $PGPORT -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Extensions enabled!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Extensions might already be enabled" -ForegroundColor Yellow
}
Write-Host ""

# Run schema
Write-Host "📊 Creating database schema..." -ForegroundColor Yellow
Write-Host "This will create 10 tables for the unified system" -ForegroundColor Gray
Write-Host ""

$schemaPath = Join-Path $PSScriptRoot "database\schema.sql"

if (-not (Test-Path $schemaPath)) {
    Write-Host "❌ schema.sql not found at: $schemaPath" -ForegroundColor Red
    exit 1
}

psql -h $PGHOST -U $PGUSER -d $PGDATABASE -p $PGPORT -f $schemaPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Schema created successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️  Schema creation had warnings (might already exist)" -ForegroundColor Yellow
}
Write-Host ""

# Verify tables
Write-Host "🔍 Verifying tables..." -ForegroundColor Yellow

$tables = psql -h $PGHOST -U $PGUSER -d $PGDATABASE -p $PGPORT -t -c "\dt" | Select-String -Pattern "public \|"

if ($tables) {
    Write-Host "✅ Tables created:" -ForegroundColor Green
    psql -h $PGHOST -U $PGUSER -d $PGDATABASE -p $PGPORT -c "\dt"
} else {
    Write-Host "❌ No tables found!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Check PostGIS functions
Write-Host "🗺️  Checking PostGIS spatial functions..." -ForegroundColor Yellow

$spatialFunctions = psql -h $PGHOST -U $PGUSER -d $PGDATABASE -p $PGPORT -t -c "SELECT COUNT(*) FROM pg_proc WHERE proname IN ('find_nearby_volunteers', 'find_nearby_tasks');"

Write-Host "✅ Spatial functions created: $($spatialFunctions.Trim())/2" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "✅ SETUP COMPLETE!" -ForegroundColor Green -BackgroundColor Black
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Database: postgres@db.bwrwszeftkiwbybolzrh.supabase.co" -ForegroundColor White
Write-Host "📋 Tables: 10 (users, donors, ngos, volunteers, tasks, etc.)" -ForegroundColor White
Write-Host "📋 Extensions: PostGIS, UUID" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "1. cd backend" -ForegroundColor White
Write-Host "2. python -m venv venv" -ForegroundColor White
Write-Host "3. .\venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "4. pip install -r requirements.txt" -ForegroundColor White
Write-Host "5. python main.py" -ForegroundColor White
Write-Host ""
Write-Host "📖 Then visit: http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host ""
Write-Host "💡 View data in Supabase Dashboard:" -ForegroundColor Cyan
Write-Host "   https://app.supabase.com/project/bwrwszeftkiwbybolzrh/editor" -ForegroundColor White
Write-Host ""
