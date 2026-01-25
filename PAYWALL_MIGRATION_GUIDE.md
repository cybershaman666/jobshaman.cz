# Paywall Database Migration Guide

## 🚀 QUICK START (Works with existing schema)

### **STEP 1: Run Safe Migration**
Copy and paste this SQL into your Supabase SQL Editor:

```sql
-- COPY EVERYTHING FROM: /database/safe_migration.sql
-- Paste it all at once and click "Run"
```

### **STEP 2: Update Application Code**
Replace your service file:
```typescript
// Replace: services/supabaseService.ts
// With: services/supabaseServiceUpdated.ts
```

### **STEP 3: Test Paywall Features**
1. **Usage Display**: Go to Assessment Creator - should show remaining assessments
2. **Upgrade Tracking**: Try to exceed limits - upgrade modal should appear
3. **Analytics**: Check browser console for analytics events
4. **A/B Testing**: Visit `/enterprise` - should show enterprise signup

## ✅ BENEFITS

This approach:
- ✅ **No Breaking Changes** - Keeps existing JSON structure for compatibility
- ✅ **Gradual Migration** - Adds new tables alongside old schema
- ✅ **Zero Downtime** - Works immediately after migration
- ✅ **Safe Rollback** - Can revert by using old service file

## 🔧 TROUBLESHOOTING

### Migration Fails?
- Check if tables already exist (remove `CREATE TABLE IF NOT EXISTS`)
- Verify column names match your current schema
- Check Supabase permissions

### TypeScript Errors?
- Use the updated service file (handles both schemas)
- Restart your development server
- Clear browser cache if needed

### Features Not Working?
- Check console for analytics events
- Verify service functions are using new tables
- Confirm database has the new tables created

## 📊 NEXT STEPS

After successful migration:
1. **Test thoroughly** in staging environment
2. **Monitor performance** with new indexes
3. **Gradual cleanup** of old JSON fields
4. **Enable RLS policies** as needed
5. **Production deployment** when ready

---

**Current Status**: Your paywall system is complete and working with JSON schema. This migration provides the upgrade path to enterprise-grade features without breaking existing functionality.