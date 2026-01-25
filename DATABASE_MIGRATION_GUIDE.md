# JobShaman Paywall Database Migration Guide

## 🚨 CRITICAL DATABASE CHANGES REQUIRED

Your current JSON-based subscription system needs to be migrated to proper relational tables to support the advanced paywall features that have been implemented.

## 📋 IMMEDIATE ACTION ITEMS

### 1. Run SQL Migration
Execute `/database/migration_paywall_schema.sql` in your Supabase SQL Editor **BEFORE** deploying updated application.

### 2. Update Application Code
Replace `/services/supabaseService.ts` with `/services/supabaseServiceUpdated.ts` to use new database schema.

### 3. Test Migration Order
1. **Schema First**: Run SQL migration
2. **Code Update**: Update service functions  
3. **Test**: Verify all paywall features work
4. **Deploy**: Release to production

## 🎯 NEW SCHEMA BENEFITS

### ✅ **Proper Subscription Management**
- **Scalable**: Dedicated `subscriptions` table
- **Secure**: Stripe integration with proper webhooks
- **Flexible**: Multiple tiers (basic, business, enterprise, assessment_bundle)
- **Automated**: Monthly usage resets via triggers

### ✅ **Granular Usage Tracking**
- **Real-time**: `subscription_usage` table with period-based tracking
- **Atomic**: Prevents race conditions
- **Queryable**: Indexed for performance
- **Extensible**: Easy to add new usage metrics

### ✅ **Advanced Analytics**
- **Event-driven**: `analytics_events` table
- **Funnel tracking**: Upgrade triggers, feature usage, conversions
- **A/B testing**: Complete experiment framework
- **Performance**: Optimized indexes for fast queries

### ✅ **Enterprise Sales Workflow**
- **Lead capture**: `enterprise_leads` table
- **CRM-ready**: Status tracking and assignment
- **Automated**: New lead notifications
- **Analytics**: Sales funnel insights

## 🚨 MIGRATION WARNINGS

### High Risk Areas
- **Don't run without backup**: This changes subscription system
- **Test in staging first**: New features depend on this schema
- **Monitor after deployment**: Usage counters may need backfill

### Data Loss Prevention
- **Migration preserves data**: Existing JSON fields kept during transition
- **Backward compatibility**: Old code continues working during migration
- **Gradual cleanup**: Remove JSON fields after confirming success

## 📊 MONITORING CHECKLIST

After migration, verify these metrics:

### Usage Tracking
```sql
-- Check if usage is being recorded
SELECT COUNT(*) FROM analytics_events 
WHERE event_type = 'feature_used' 
AND created_at > NOW() - INTERVAL '1 hour';
```

### Subscription Status
```sql
-- Verify subscription management works
SELECT 
    c.name,
    s.tier,
    s.status,
    COUNT(*) as feature_usage_count
FROM companies c
LEFT JOIN subscriptions s ON c.subscription_id = s.id
LEFT JOIN analytics_events ae ON c.id = ae.company_id
WHERE ae.event_type = 'feature_used'
GROUP BY c.id, s.tier, s.status;
```

### A/B Test Assignments
```sql
-- Verify A/B testing is working
SELECT 
    test_id,
    variant_id,
    COUNT(*) as assignments
FROM ab_test_assignments
WHERE assigned_at > NOW() - INTERVAL '24 hours'
GROUP BY test_id, variant_id;
```

## 🔄 ROLLBACK PLAN

If migration fails, restore from backup using:

```sql
-- 1. Drop new tables
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_usage CASCADE;
DROP TABLE IF EXISTS analytics_events CASCADE;
DROP TABLE IF EXISTS ab_test_assignments CASCADE;
DROP TABLE IF EXISTS ab_test_conversions CASCADE;
DROP TABLE IF EXISTS enterprise_leads CASCADE;

-- 2. Restore original code
-- Revert supabaseService.ts to original version
```

## 📞 SUPPORT CONTACTS

### Technical Issues
- **Database**: Check Supabase logs for migration errors
- **Application**: Review TypeScript logs for service function errors
- **Frontend**: Monitor browser console for API call failures

### Schema Questions
- **Performance**: Query optimization for large datasets
- **Security**: Row Level Security (RLS) policy tuning
- **Scaling**: Index optimization for high-traffic scenarios

---

## 🎯 POST-MIGRATION TESTING

### Test Scenarios to Validate

1. **Subscription Limits**:
   - Try to exceed assessment limit
   - Verify upgrade modal appears correctly
   - Check usage counters increment properly

2. **A/B Testing**:
   - Test different pricing displays
   - Verify conversion tracking works
   - Check variant assignments persist

3. **Enterprise Flow**:
   - Submit enterprise signup form
   - Verify lead appears in database
   - Check analytics events are recorded

4. **Usage Analytics**:
   - Use features and check analytics events
   - Verify upgrade funnel tracking
   - Test A/B test conversion events

5. **Error Handling**:
   - Test with invalid Stripe credentials
   - Simulate network failures
   - Verify graceful degradation

## ✅ DEPLOYMENT CHECKLIST

- [ ] Migration SQL executed successfully
- [ ] Service functions updated to new schema
- [ ] All TypeScript compilation resolved
- [ ] Development testing completed
- [ ] Analytics tracking verified
- [ ] Performance benchmarks acceptable
- [ ] Backup procedures documented
- [ ] Rollback plan tested
- [ ] Production deployment approved

---

## 🚀 READY FOR PRODUCTION

Once migration is complete, you'll have:
- **Enterprise-grade** paywall system
- **Advanced analytics** and reporting  
- **Scalable subscription** management
- **Professional enterprise** sales workflow
- **A/B testing** infrastructure
- **Production-ready** monitoring

The new system supports all planned features and is designed for high-scale deployment.