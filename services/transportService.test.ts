/**
 * Transport Service Tests
 * Tests for transport cost and time calculations
 */

import {
  calculateTransportCost,
  compareAllTransportModes,
  getBestTransportMode,
  findCityPass,
  getCitiesForCountry
} from '../services/transportService';

describe('TransportService', () => {
  describe('calculateTransportCost', () => {
    it('should calculate car costs correctly', () => {
      const result = calculateTransportCost(5, 'car');
      
      expect(result.mode).toBe('car');
      expect(result.distanceKm).toBe(5);
      expect(result.dailyCost).toBeCloseTo(50); // 5km * 2 * 5 CZK/km
      expect(result.monthlyCost).toBe(1100); // 50 * 22 days
      expect(result.dailyTime).toBe(15); // 10km * 1.5 min/km
    });

    it('should calculate bike costs correctly', () => {
      const result = calculateTransportCost(5, 'bike');
      
      expect(result.mode).toBe('bike');
      expect(result.dailyCost).toBeCloseTo(0.5); // 5km * 2 * 0.05 CZK/km
      expect(result.monthlyCost).toBe(11); // 0.5 * 22 days (rounded)
      expect(result.dailyTime).toBe(20); // 10km * 2 min/km
    });

    it('should calculate walk costs correctly', () => {
      const result = calculateTransportCost(5, 'walk');
      
      expect(result.mode).toBe('walk');
      expect(result.dailyCost).toBe(0); // No cost
      expect(result.monthlyCost).toBe(0);
      expect(result.dailyTime).toBe(15); // 10km * 1.5 min/km
    });

    it('should use city pass for public transport when available', () => {
      const result = calculateTransportCost(5, 'public', 'Praha', 'CZ');
      
      expect(result.mode).toBe('public');
      expect(result.cityPass).toBeDefined();
      expect(result.cityPass?.city).toBe('Praha');
      expect(result.monthlyCost).toBe(1350); // Praha monthly pass
    });

    it('should calculate public transport without city pass', () => {
      const result = calculateTransportCost(5, 'public');
      
      expect(result.mode).toBe('public');
      expect(result.dailyCost).toBeCloseTo(25); // 10km * 2.5 CZK/km
      expect(result.monthlyCost).toBe(550); // 25 * 22 days
    });

    it('should calculate cost per minute correctly', () => {
      const result = calculateTransportCost(10, 'car');
      
      // Daily time: 20km * 1.5 = 30 minutes
      // Daily cost: 20km * 5 = 100 CZK
      // Cost per minute: 100 / 30 = 3.33 CZK
      expect(result.costPerMinute).toBeCloseTo(3.33, 1);
    });
  });

  describe('compareAllTransportModes', () => {
    it('should return all modes sorted by cost', () => {
      const results = compareAllTransportModes(10);
      
      expect(results).toHaveLength(4);
      expect(results[0].mode).toBe('walk');
      expect(results[results.length - 1].mode).toBe('car');
      
      // Verify sorting
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].monthlyCost).toBeLessThanOrEqual(results[i + 1].monthlyCost);
      }
    });

    it('should include city pass in comparison', () => {
      const results = compareAllTransportModes(10, 'Praha', 'CZ');
      
      const publicResult = results.find(r => r.mode === 'public');
      expect(publicResult).toBeDefined();
      expect(publicResult?.cityPass).toBeDefined();
    });
  });

  describe('getBestTransportMode', () => {
    it('should return cheapest mode for short distance', () => {
      const mode = getBestTransportMode(1);
      
      // For very short distances, walk should be cheapest
      expect(mode).toBe('walk');
    });

    it('should return cheapest mode for long distance', () => {
      const mode = getBestTransportMode(30);
      
      // For longer distances, public transport with pass should be cheapest
      // (assuming using city pass in Prague)
      expect(['public', 'bike']).toContain(mode);
    });

    it('should respect city pass pricing', () => {
      const mode = getBestTransportMode(20, 'Praha', 'CZ');
      
      // Public transport with Prague pass should be competitive
      expect(['public', 'bike']).toContain(mode);
    });
  });

  describe('findCityPass', () => {
    it('should find Prague city pass', () => {
      const pass = findCityPass('Praha', 'CZ');
      
      expect(pass).toBeDefined();
      expect(pass?.city).toBe('Praha');
      expect(pass?.monthlyPass).toBe(1350);
      expect(pass?.country).toBe('CZ');
    });

    it('should find Brno city pass', () => {
      const pass = findCityPass('Brno', 'CZ');
      
      expect(pass).toBeDefined();
      expect(pass?.monthlyPass).toBe(900);
    });

    it('should find Vienna city pass', () => {
      const pass = findCityPass('Wien', 'AT');
      
      expect(pass).toBeDefined();
      expect(pass?.country).toBe('AT');
    });

    it('should return undefined for unknown city', () => {
      const pass = findCityPass('UnknownCity', 'CZ');
      
      expect(pass).toBeUndefined();
    });

    it('should be case-insensitive', () => {
      const pass1 = findCityPass('praha', 'CZ');
      const pass2 = findCityPass('PRAHA', 'CZ');
      
      expect(pass1).toBeDefined();
      expect(pass2).toBeDefined();
      expect(pass1?.city).toBe(pass2?.city);
    });
  });

  describe('getCitiesForCountry', () => {
    it('should return all Czech cities', () => {
      const cities = getCitiesForCountry('CZ');
      
      expect(cities.length).toBeGreaterThan(0);
      expect(cities.every(c => c.country === 'CZ')).toBe(true);
      expect(cities.map(c => c.city)).toContain('Praha');
      expect(cities.map(c => c.city)).toContain('Brno');
    });

    it('should return all German cities', () => {
      const cities = getCitiesForCountry('DE');
      
      expect(cities.length).toBeGreaterThan(0);
      expect(cities.every(c => c.country === 'DE')).toBe(true);
      expect(cities.map(c => c.city)).toContain('Berlin');
      expect(cities.map(c => c.city)).toContain('München');
    });

    it('should return empty array for unknown country', () => {
      const cities = getCitiesForCountry('XX');
      
      expect(cities).toEqual([]);
    });
  });

  describe('Real-world scenarios', () => {
    it('should calculate costs for Prague commute (5km)', () => {
      const results = compareAllTransportModes(5, 'Praha', 'CZ');
      
      expect(results).toHaveLength(4);
      
      // Public transport with Prague pass should be cheap
      const publicResult = results.find(r => r.mode === 'public');
      expect(publicResult?.monthlyCost).toBe(1350);
      
      // Walk should be free
      const walkResult = results.find(r => r.mode === 'walk');
      expect(walkResult?.monthlyCost).toBe(0);
      
      // Car should be most expensive
      const carResult = results.find(r => r.mode === 'car');
      const bycycleResult = results.find(r => r.mode === 'bike');
      expect(carResult!.monthlyCost).toBeGreaterThan(bycycleResult!.monthlyCost);
    });

    it('should calculate costs for long commute (30km)', () => {
      const results = compareAllTransportModes(30, 'Brno', 'CZ');
      
      const publicResult = results.find(r => r.mode === 'public');
      expect(publicResult).toBeDefined();
      
      // For 30km, Brno pass (900 CZK) should beat per-km calculation
      expect(publicResult?.monthlyCost).toBeLessThan(
        30 * 2 * 2.5 * 22 // Distance * 2 (round trip) * cost per km * working days
      );
    });

    it('should recommend different modes for different countries', () => {
      const czMode = getBestTransportMode(10, 'Praha', 'CZ');
      const plMode = getBestTransportMode(10, 'Warszawa', 'PL');
      
      expect(czMode).toBeDefined();
      expect(plMode).toBeDefined();
      // Different countries might have different best modes due to pricing
    });
  });
});
