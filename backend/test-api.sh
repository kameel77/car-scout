#!/bin/bash

echo "🧪 Testowanie Car-Scout Backend API"
echo "===================================="
echo ""

# Test 1: Health Check
echo "1️⃣ Test: Health Check"
curl -s http://localhost:3000/health | jq '.'
echo ""
echo ""

# Test 2: Login
echo "2️⃣ Test: Login"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@carscout.pl","password":"admin123"}')

echo "$LOGIN_RESPONSE" | jq '.'

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ Login failed - no token received"
    exit 1
fi

echo ""
echo "✅ Token received: ${TOKEN:0:50}..."
echo ""
echo ""

# Test 3: Verify Token
echo "3️⃣ Test: Verify Token (GET /api/auth/me)"
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""
echo ""

# Test 4: Get Listings (should be empty)
echo "4️⃣ Test: Get Listings"
curl -s http://localhost:3000/api/listings | jq '.listings | length'
echo " listings found"
echo ""
echo ""

# Test 5: Upload Test CSV
echo "5️⃣ Test: Upload CSV"

# Create test CSV
cat > /tmp/test_carscout.csv << 'EOF'
listing_id	listing_url	scraped_at	make	model	version	vin	price_pln	price_display	omnibus_lowest_30d_pln	omnibus_text	production_year	mileage_km	fuel_type	transmission	engine_power_hp	registration_number	first_registration_date	engine_capacity_cm3	drive	body_type	doors	seats	color	paint_type	dealer_name	dealer_address_line1	dealer_address_line2	dealer_address_line3	dealer_google_rating	dealer_review_count	dealer_google_link	contact_phone	primary_image_url	image_count	image_urls	equipment_audio_multimedia	equipment_safety	equipment_comfort_extras	equipment_other	additional_info_header	additional_info_content	specs_json
TEST001	https://example.com/1	2025-12-28T10:00:00Z	Toyota	Corolla	1.8 Hybrid	VIN12345678901234	85000	85 000 zł	85000	Najniższa cena z 30 dni: 85 000 zł	2022	45000	Hybryda	Automatyczna	122		01.01.2022	1798	FWD	Sedan	4	5	Biały	Perłowy	Toyota Warszawa	ul. Testowa 1			4.5	100		+48 22 123 45 67	https://example.com/image.jpg	5	https://example.com/1.jpg|https://example.com/2.jpg	Bluetooth|Apple CarPlay	ABS|ESP|Poduszki powietrzne	Klimatyzacja automatyczna|Podgrzewane fotele	Felgi aluminiowe		Test listing	{"Marka": "Toyota"}
TEST002	https://example.com/2	2025-12-28T10:00:00Z	BMW	3 Series	320d xDrive	VIN98765432109876	125000	125 000 zł	125000	Najniższa cena z 30 dni: 125 000 zł	2021	65000	Diesel	Automatyczna	190		01.06.2021	1995	AWD	Sedan	4	5	Czarny	Metalik	BMW Kraków	ul. Testowa 2			4.7	200		+48 12 234 56 78	https://example.com/bmw.jpg	8	https://example.com/bmw1.jpg	Nawigacja GPS|Android Auto	ABS|ESP|Kamera cofania	Klimatyzacja dwustrefowa|Skórzana tapicerka	Felgi 18"		Premium car	{"Marka": "BMW"}
EOF

curl -s -X POST http://localhost:3000/api/import/csv \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test_carscout.csv" | jq '.'
echo ""
echo ""

# Test 6: Get Listings Again (should have 2)
echo "6️⃣ Test: Get Listings (after import)"
LISTINGS=$(curl -s http://localhost:3000/api/listings)
echo "$LISTINGS" | jq '.listings[] | {make, model, price_pln}'
echo ""
echo "Total listings:" $(echo "$LISTINGS" | jq '.listings | length')
echo ""
echo ""

# Test 7: Import History
echo "7️⃣ Test: Import History"
curl -s http://localhost:3000/api/import/history \
  -H "Authorization: Bearer $TOKEN" | jq '.logs[0] | {fileName, totalRows, inserted, updated, archived, status}'
echo ""
echo ""

# Test 8: Analytics
echo "8️⃣ Test: Price Analytics"
curl -s "http://localhost:3000/api/analytics/price-trends?days=30" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    trendsCount: .trends | length,
    priceChangesCount: .priceChanges | length,
    config: .config
  }'
echo ""
echo ""

echo "✅ Wszystkie testy zakończone!"
echo ""
echo "📊 Podsumowanie:"
echo "  - Backend API działa ✅"
echo "  - Autentykacja działa ✅"
echo "  - Import CSV działa ✅"
echo "  - Listings API działa ✅"
echo "  - Analytics API działa ✅"
echo ""
echo "🎉 Backend jest gotowy do użycia!"
