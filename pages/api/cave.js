// pages/api/cave.js

// Calculated metrics that derive from temperature_2m_mean
const calculatedMetrics = ['gdd0', 'gdd6', 'growth_potential'];

// Growth Potential constants
const TOPT = 20;  // Optimal temperature
const S = 5.5;    // Spread parameter

// Calculate derived metric value from mean temperature
function calculateDerivedValue(metric, tavg) {
  switch (metric) {
    case 'gdd0':
      return Math.max(0, tavg);
    case 'gdd6':
      return Math.max(0, tavg - 6);
    case 'growth_potential':
      return Math.exp(-0.5 * Math.pow((tavg - TOPT) / S, 2));
    default:
      return null;
  }
}

export default async function handler(req, res) {
  const { metric, lat, lon } = req.body;

  if (!metric) {
    return res.status(400).json({ error: 'Missing required metric parameter' });
  }

  // Use provided coordinates or default to Bingley
  const LATITUDE = lat || 53.8475;
  const LONGITUDE = lon || -1.8397;

  // Check if this is a calculated metric
  const isCalculated = calculatedMetrics.includes(metric);
  const apiMetric = isCalculated ? 'temperature_2m_mean' : metric;

  // Map archive metrics to forecast metrics (they use slightly different names)
  const forecastMetricMap = {
    'temperature_2m_mean': 'temperature_2m_max,temperature_2m_min', // Calculate mean from max/min
    'temperature_2m_max': 'temperature_2m_max',
    'temperature_2m_min': 'temperature_2m_min',
    'precipitation_sum': 'precipitation_sum',
    'sunshine_duration': 'sunshine_duration',
    'wind_speed_10m_max': 'wind_speed_10m_max'
  };

  // Use years 1980-2025 for historical data (45 years - ERA5 data available from 1940)
  const historicalYears = Array.from({ length: 46 }, (_, i) => 1980 + i);

  try {
    const allYearsData = {};

    // Fetch full year data for each historical year
    for (const year of historicalYears) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}&longitude=${LONGITUDE}&start_date=${startDate}&end_date=${endDate}&daily=${apiMetric}&timezone=Europe/London`;

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
        let value = data.daily[apiMetric][index];

        // Calculate derived value if needed
        if (isCalculated && value !== null) {
          value = calculateDerivedValue(metric, value);
        }

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
          values: allYearsData[monthDay]
        };
      }
    });

    // Build overlay data from the historical data we already have
    const overlayData = {};
    const availableOverlayYears = [];

    Object.keys(allYearsData).forEach(monthDay => {
      allYearsData[monthDay].forEach(({ year, value }) => {
        if (!overlayData[year]) {
          overlayData[year] = {};
          availableOverlayYears.push(year);
        }
        overlayData[year][monthDay] = value;
      });
    });

    const overlayYears = [...new Set(availableOverlayYears)].sort((a, b) => a - b);

    // Fetch recent 6 months data from archive API
    let recentData = {};
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentStartDate = sixMonthsAgo.toISOString().split('T')[0];
    const recentEndDate = today.toISOString().split('T')[0];

    try {
      const recentUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}&longitude=${LONGITUDE}&start_date=${recentStartDate}&end_date=${recentEndDate}&daily=${apiMetric}&timezone=Europe/London`;
      const recentResponse = await fetch(recentUrl);

      if (recentResponse.ok) {
        const recent = await recentResponse.json();
        recent.daily.time.forEach((date, index) => {
          const monthDay = date.substring(5);
          let value = recent.daily[apiMetric][index];

          // Calculate derived value if needed
          if (isCalculated && value !== null) {
            value = calculateDerivedValue(metric, value);
          }

          if (value !== null) {
            recentData[monthDay] = value;
          }
        });
      }
    } catch (e) {
      console.error('Failed to fetch recent data:', e);
    }

    // Fetch forecast data (up to 16 days ahead)
    const forecastMetrics = forecastMetricMap[apiMetric] || apiMetric;
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&daily=${forecastMetrics}&timezone=Europe/London&forecast_days=16`;

    let forecastData = {};

    try {
      const forecastResponse = await fetch(forecastUrl);
      if (forecastResponse.ok) {
        const forecast = await forecastResponse.json();

        forecast.daily.time.forEach((date, index) => {
          const monthDay = date.substring(5);
          let value;

          // Handle mean temperature calculation from forecast
          if (apiMetric === 'temperature_2m_mean') {
            const max = forecast.daily.temperature_2m_max[index];
            const min = forecast.daily.temperature_2m_min[index];
            value = (max + min) / 2;
          } else {
            value = forecast.daily[apiMetric][index];
          }

          // Calculate derived value if needed
          if (isCalculated && value !== null) {
            value = calculateDerivedValue(metric, value);
          }

          if (value !== null) {
            forecastData[monthDay] = value;
          }
        });
      }
    } catch (e) {
      console.error('Failed to fetch forecast:', e);
    }

    // Calculate averages for each day of year
    const decadeRanges = {
      '2020s': [2020, 2021, 2022, 2023, 2024, 2025],
      '2010s': [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019],
      '2000s': [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009],
      '1990s': [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999],
      '1980s': [1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989],
    };

    const averagesData = {
      allTime: {},
      '2020s': {},
      '2010s': {},
      '2000s': {},
      '1990s': {},
      '1980s': {},
    };

    // Calculate averages for each day
    Object.keys(allYearsData).forEach(monthDay => {
      const dayData = allYearsData[monthDay];

      // All-time average
      const allValues = dayData.map(d => d.value);
      if (allValues.length > 0) {
        averagesData.allTime[monthDay] = allValues.reduce((a, b) => a + b, 0) / allValues.length;
      }

      // Decade averages
      Object.keys(decadeRanges).forEach(decade => {
        const decadeYears = decadeRanges[decade];
        const decadeValues = dayData.filter(d => decadeYears.includes(d.year)).map(d => d.value);
        if (decadeValues.length > 0) {
          averagesData[decade][monthDay] = decadeValues.reduce((a, b) => a + b, 0) / decadeValues.length;
        }
      });
    });

    res.status(200).json({
      success: true,
      data: caveData,
      overlayData,
      historicalYears,
      overlayYears,
      forecastData,
      recentData,
      averagesData
    });
  } catch (error) {
    console.error('Error fetching cave data:', error);
    res.status(500).json({ error: error.message });
  }
}
