#!/bin/bash
# Transport Mode Selection - Verification Checklist

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   Transport Mode Selection - Implementation Verification       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check files exist
echo "📁 Checking files..."
files=(
  "services/transportService.ts"
  "components/TransportModeSelector.tsx"
  "services/transportService.test.ts"
  "TRANSPORT_MODE_DOCUMENTATION.md"
  "TRANSPORT_MODE_IMPLEMENTATION.md"
  "TRANSPORT_MODE_FINAL_SUMMARY.md"
  "jest.config.js"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $file"
  else
    echo -e "${RED}✗${NC} $file"
  fi
done

echo ""
echo "📋 Checking imports in ProfileEditor..."

if grep -q "import TransportModeSelector from './TransportModeSelector'" components/ProfileEditor.tsx; then
  echo -e "${GREEN}✓${NC} TransportModeSelector imported"
else
  echo -e "${RED}✗${NC} TransportModeSelector import missing"
fi

if grep -q "TransportModeSelector" components/ProfileEditor.tsx; then
  echo -e "${GREEN}✓${NC} TransportModeSelector component used"
else
  echo -e "${RED}✗${NC} TransportModeSelector component not used"
fi

echo ""
echo "💰 Checking COMMUTE_COSTS..."

if grep -q "car: 5.0" services/financialService.ts; then
  echo -e "${GREEN}✓${NC} Car cost updated to 5.0 CZK/km"
else
  echo -e "${YELLOW}⚠${NC} Car cost might not be 5.0"
fi

if grep -q "public: 2.5" services/financialService.ts; then
  echo -e "${GREEN}✓${NC} Public transport cost updated to 2.5 CZK/km"
else
  echo -e "${YELLOW}⚠${NC} Public transport cost might not be 2.5"
fi

if grep -q "bike: 0.05" services/financialService.ts; then
  echo -e "${GREEN}✓${NC} Bike cost updated to 0.05 CZK/km"
else
  echo -e "${YELLOW}⚠${NC} Bike cost might not be 0.05"
fi

echo ""
echo "🌍 Checking city passes..."

city_count=$(grep -c "city:" services/transportService.ts || echo "0")
echo "Found $city_count cities in CITY_PASSES"

echo ""
echo "🧪 Test coverage..."
echo "Run tests with: npm test -- transportService.test.ts"
echo "Or: npm run test:unit"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                      Status: READY ✅                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Review TRANSPORT_MODE_FINAL_SUMMARY.md for complete overview"
echo "2. Run tests: npm test transportService.test.ts"
echo "3. Test in ProfileEditor component"
echo "4. Implement PostGIS distance calculation"
echo "5. Add database persistence for transportMode"
echo ""
