# Booking Guru Assessment

## Overview
This service exposes a `/cities` endpoint that returns the most polluted cities by country, enriched with Wikipedia descriptions. It fetches data from a mock API, normalizes and filters out invalid entries, and supports authentication and token refresh.

## How to Run Locally
```bash
npm install
npm start
```
The service will run on `http://localhost:3000`. Access the endpoint at `/cities?country=PL` (or DE, ES, FR).

## How Cities Are Determined
- The service fetches pollution data from the `/pollution` API.
- It considers an entry a city if:
  - The `name` field exists and is a string.
  - The name does not contain obvious non-city markers (e.g., "Station", "Zone", "District", "Unknown Area", "powerplant").
  - The name passes a basic regex filter for city-like names (letters, spaces, dashes, etc.).
- Further enrichment is done by fetching a Wikipedia description for each city name and country.

## Limitations & Assumptions
- Some non-city entries may still pass the filter if their names are ambiguous or Wikipedia has a matching page.
- The city filter is based on heuristics and may not catch all edge cases.
- The Wikipedia API and mock server have rate limits; results are cached in memory for 1 hour.
- Only the countries PL, DE, ES, FR are supported.
- The service assumes the mock API response format is stable.

## Authentication
- The service authenticates with `/auth/login` to get an access token and refresh token.
- It uses `/auth/refresh` to refresh the token when expired.

## Running Test Cases

Test cases are written using Jest and Supertest. To run all tests:

```bash
npm test
```

This will execute all test suites and display results in the terminal. Make sure the server is not running on the same port before running tests.

You can find and update test cases in the `cities.test.js` file.

## Example Response
```json
{
  "page": 1,
  "limit": 10,
  "totalPages": 4,
  "cities": [
    {
      "name": "Warsaw",
      "country": "PL",
      "pollution": 58,
      "description": "Warsaw is the capital of Poland."
    }
    // ...more cities
  ]
}
```

## Deployment
You can deploy this service to any Node.js-compatible environment. For local testing, use the instructions above.

---
For any questions or improvements, please contact the author or open an issue.
