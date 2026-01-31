// pages/api/cave.js
export default async function handler(req, res) {
  const { metric } = req.body;

  if (!metric) {
    return res.status(400).json({ error: 'Missing required metric parameter' });
  }

  const LATITUDE = 51.0632;
  const LONGITUDE = -1.3080;

  // Use years 1980-2025 for historical data (45 years - ERA5 data available from 1940)
  // Note: 2025 may have partial data depending on current date
  const historicalYears = Array.from({ length: 46 }, (_, i) => 1980 + i);

  try {
    const allYearsData = {};

    // Fetch full year data for each historical year
    for (const year of historicalYears) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}&longitude=${LONGITUDE}&start_date=${startDate}&end_date=${endDate}&daily=${metric}&timezone=Europe/London`;

      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Failed to fetch ${year}: ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Store data indexed by month-day (MM-DD) to align across years
      data.daily.time.forEach((date, index) => {
        const monthDay = date.substring(5); // "MM-DD"
        if (!allYearsData[monthDay]) {
          allYearsData[monthDay] = [];
        }
        const value = data.daily[metric][index];
        if (value !== null) {
          allYearsData[monthDay].push({ year, value });
        }
      });
    }

    // Calculate percentiles for each day
    const percentile = (arr, p) => {
      const sorted = arr.slice().sort((a, b) => a - b);
      const index = (p / 100) * (sorted.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      if (lower === upper) return sorted[lower];
      return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]);
    };

    const caveData = {};

    // Process each day of year
    Object.keys(allYearsData).sort().forEach(monthDay => {
      const values = allYearsData[monthDay].map(d => d.value);
      if (values.length >= 3) {
        caveData[monthDay] = {
          min: Math.min(...values),
          p25: percentile(values, 25),
          p75: percentile(values, 75),
          max: Math.max(...values),
          values: allYearsData[monthDay] // Keep individual year values for overlay
        };
      }
    });

    // Build overlay data from the historical data we already have
    const overlayData = {};
    const availableOverlayYears = [];

    // Extract individual year data for overlay from allYearsData
    Object.keys(allYearsData).forEach(monthDay => {
      allYearsData[monthDay].forEach(({ year, value }) => {
        if (!overlayData[year]) {
          overlayData[year] = {};
          availableOverlayYears.push(year);
        }
        overlayData[year][monthDay] = value;
      });
    });

    // Sort and dedupe overlay years
    const overlayYears = [...new Set(availableOverlayYears)].sort((a, b) => a - b);

    res.status(200).json({
      success: true,
      data: caveData,
      overlayData,
      historicalYears,
      overlayYears
    });
  } catch (error) {
    console.error('Error fetching cave data:', error);
    res.status(500).json({ error: error.message });
  }
}
