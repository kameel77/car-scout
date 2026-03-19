#!/bin/bash

# Upewnij się, że serwer działa na porcie 3000 (npm run dev w folderze backend)
# Wymagane ustawienie zmiennej środowiskowej OTOMOTO_EMULATOR_API_KEY w serwerze
# Użyjemy domyślnego tokena do testów w skrypcie

TOKEN="test_token_123"
URL="http://localhost:3000/api/otomoto/open/account/adverts"
VIN="WBA0000TESTTEST$(date +%s)"

echo "Wysyłanie testowego ogłoszenia (POST) do emulatora..."
curl -s -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "make": "BMW",
    "model": "Seria 3",
    "version": "320d",
    "vin": "'"$VIN"'",
    "year": 2020,
    "mileage": 55000,
    "fuel_type": "diesel",
    "price": {
      "value": 115000,
      "currency": "PLN"
    },
    "body_type": "sedan",
    "color": "black",
    "apple_carplay": true,
    "bluetooth": true
  }' | jq .

echo ""
echo "Oczekiwano statusu active i jakiegoś ID..."
