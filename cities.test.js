const request = require('supertest');
const express = require('express');
const citiesRouter = require('./routes/cities');
const axios = require('axios');
jest.mock('axios');

const app = express();
app.use('/', citiesRouter);

describe('GET /cities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return only valid cities with Wikipedia descriptions in new response format', async () => {
    // Mock pollution API response (new format)
    axios.get.mockImplementationOnce(() => Promise.resolve({
      data: {
        meta: { page: 1, totalPages: 1 },
        results: [
          { name: 'Warsaw', pollution: 58 },
          { name: 'Station 104 - Silesia (District)', pollution: 55 }, // not a city
          { name: 'Kraków', pollution: 57 },
          { name: 'Unknown Area 22', pollution: 51 }, // not a city
          { name: 'London', pollution: 120 },
        ]
      }
    }));
    // Mock Wikipedia API responses
    axios.get.mockImplementation((url) => {
      if (url.includes('Warsaw')) return Promise.resolve({ data: { extract: 'Warsaw is the capital of Poland.' } });
      if (url.includes('Kraków')) return Promise.resolve({ data: { extract: 'Kraków is a city in Poland.' } });
      if (url.includes('London')) return Promise.resolve({ data: { extract: 'London is the capital of UK.' } });
      return Promise.resolve({ data: {} });
    });

    const res = await request(app).get('/cities?country=PL');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('cities');
    expect(Array.isArray(res.body.cities)).toBe(true);
    // Only valid cities should be returned (filter out non-cities)
    const cities = res.body.cities.map(c => c.name);
    expect(cities).toEqual(expect.arrayContaining(['Warsaw', 'Kraków', 'London']));
    expect(cities).not.toEqual(expect.arrayContaining(['Station 104 - Silesia (District)', 'Unknown Area 22']));
    // Descriptions should be present and contain city info
    res.body.cities.forEach(cityObj => {
      expect(typeof cityObj.description).toBe('string');
    });
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit');
    expect(res.body).toHaveProperty('totalPages', 1);
  });

  it('should handle API errors gracefully', async () => {
    axios.get.mockImplementationOnce(() => Promise.reject(new Error('API error')));
    const res = await request(app).get('/cities');
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Failed to fetch cities');
  });
});
