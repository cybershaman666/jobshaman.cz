/* global use, db */
// JCFPM Mongo playground for VS Code extension
// Update DB name below to match MONGODB_DB in backend env.

use('jobshaman');

const collection = db.getCollection('jcfpm_items');

// 1) Basic health checks
const total = collection.countDocuments({});
const active = collection.countDocuments({ status: { $in: ['active', null] } });
const distinctPool = collection.distinct('pool_key', { status: { $in: ['active', null] } }).length;

console.log({ total, active, distinctPool });

// 2) Dimension coverage
collection.aggregate([
  { $match: { status: { $in: ['active', null] } } },
  { $group: { _id: '$dimension', count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]);

// 3) Missing fields audit (should be 0)
collection.aggregate([
  {
    $match: {
      $or: [
        { id: { $exists: false } },
        { pool_key: { $exists: false } },
        { variant_index: { $exists: false } },
        { dimension: { $exists: false } },
        { prompt: { $exists: false } },
        { item_type: { $exists: false } },
        { sort_order: { $exists: false } }
      ]
    }
  },
  { $count: 'invalid_docs' }
]);

// 4) Duplicate checks
collection.aggregate([
  { $group: { _id: '$id', c: { $sum: 1 } } },
  { $match: { c: { $gt: 1 } } },
  { $limit: 20 }
]);

collection.aggregate([
  { $group: { _id: { pool_key: '$pool_key', variant_index: '$variant_index' }, c: { $sum: 1 } } },
  { $match: { c: { $gt: 1 } } },
  { $limit: 20 }
]);
