// pages/api/cave.js
export default async function handler(req, res) {
  const { metric } = req.body;

  if (!metric) {
    return res.status(400).json({ error: 'Missing required metric parameter' });
  }

  const LATITUDE = 51.0632;
  const LONGITUDE = -1.3080;

  // Use years 2014-2024 for historical data (exclude current/recent year for complete data)
  const historicalYears = Array.from({ length: 11 }, (_, i) => 2014 + i);

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

    // Also fetch most recent complete year for overlay option
    const overlayYears = [2023, 2024];
    const overlayData = {};

    for (const year of overlayYears) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}&longitude=${LONGITUDE}&start_date=${startDate}&end_date=${endDate}&daily=${metric}&timezone=Europe/London`;

      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          overlayData[year] = {};
          data.daily.time.forEach((date, index) => {
            const monthDay = date.substring(5);
            overlayData[year][monthDay] = data.daily[metric][index];
          });
        }
      } catch (e) {
        console.error(`Failed to fetch overlay year ${year}:`, e);
      }
    }

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
