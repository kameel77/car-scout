#!/bin/bash

echo "🐳 Uruchamianie PostgreSQL i Redis w Docker..."

# Sprawdź czy Docker działa
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker nie jest uruchomiony!"
    echo "Uruchom Docker Desktop i spróbuj ponownie."
    exit 1
fi

echo "✅ Docker jest uruchomiony"

# Zatrzymaj i usuń stare kontenery jeśli istnieją
echo "🧹 Czyszczenie starych kontenerów..."
docker rm -f carscout-postgres 2>/dev/null || true
docker rm -f carscout-redis 2>/dev/null || true

# Uruchom PostgreSQL
echo "🐘 Uruchamianie PostgreSQL..."
docker run --name carscout-postgres \
  -e POSTGRES_DB=carscout \
  -e POSTGRES_USER=carscout_user \
  -e POSTGRES_PASSWORD=carscout_password \
  -p 5432:5432 \
  -d postgres:16-alpine

# Uruchom Redis
echo "🔴 Uruchamianie Redis..."
docker run --name carscout-redis \
  -p 6379:6379 \
  -d redis:7-alpine

# Poczekaj chwilę na uruchomienie
echo "⏳ Czekam na uruchomienie kontenerów..."
sleep 3

# Sprawdź status
echo ""
echo "📊 Status kontenerów:"
docker ps --filter "name=carscout" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "✅ Gotowe! PostgreSQL i Redis są uruchomione."
echo ""
echo "Następne kroki:"
echo "  cd backend"
echo "  npm run prisma:migrate"
echo "  npm run prisma:seed"
echo "  npm run dev"
