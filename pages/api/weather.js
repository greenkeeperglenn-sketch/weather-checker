// pages/api/weather.js

// Calculated metrics that derive from temperature_2m_mean
const calculatedMetrics = ['gdd0', 'gdd6', 'growth_potential'];

// Growth Potential constants
const TOPT = 20;  // Optimal temperature
const S = 5.5;    // Spread parameter

// Calculate derived metrics from mean temperature
function calculateDerivedMetrics(tavg) {
  return {
    gdd0: Math.max(0, tavg),                                    // GDD base 0
    gdd6: Math.max(0, tavg - 6),                                // GDD base 6
    growth_potential: Math.exp(-0.5 * Math.pow((tavg - TOPT) / S, 2))  // Growth Potential
  };
}

export default async function handler(req, res) {
  const { startDate, endDate, years, metrics, lat, lon } = req.body;

  if (!startDate || !endDate || !years || !metrics) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Use provided coordinates or default to Bingley
  const LATITUDE = lat || 53.8475;
  const LONGITUDE = lon || -1.8397;

  // Check if date range crosses year boundary (e.g., Oct-Jan)
  const isCrossYear = endDate.month < startDate.month ||
    (endDate.month === startDate.month && endDate.day < startDate.day);

  // Separate calculated vs API metrics
  const requestedCalculated = metrics.filter(m => calculatedMetrics.includes(m));
  const apiMetrics = metrics.filter(m => !calculatedMetrics.includes(m));

  // If any calculated metrics requested, ensure we fetch temperature_2m_mean
  const needsTemp = requestedCalculated.length > 0;
  if (needsTemp && !apiMetrics.includes('temperature_2m_mean')) {
    apiMetrics.push('temperature_2m_mean');
  }

  const metricsStr = apiMetrics.join(',');

  try {
    const results = {};

    for (const year of years) {
      const filteredData = { dates: [] };
      metrics.forEach(metric => {
        filteredData[metric] = [];
      });

      const processData = (data) => {
        data.daily.time.forEach((date, index) => {
          const dateObj = new Date(date);
          const monthName = dateObj.toLocaleDateString('en-GB', { month: 'short' });
          const day = dateObj.getDate();
          filteredData.dates.push(`${monthName} ${day}`);

          // Add API metrics
          apiMetrics.forEach(metric => {
            if (metrics.includes(metric)) {
              filteredData[metric].push(data.daily[metric][index]);
            }
          });

          // Calculate derived metrics if needed
          if (requestedCalculated.length > 0) {
            const tavg = data.daily.temperature_2m_mean[index];
            const derived = calculateDerivedMetrics(tavg);
            requestedCalculated.forEach(metric => {
              filteredData[metric].push(derived[metric]);
            });
          }
        });
      };

      if (isCrossYear) {
        // Cross-year range: fetch from year (startDate to Dec 31) and year+1 (Jan 1 to endDate)

        // Part 1: Start year (e.g., Oct 1 to Dec 31 of 2023)
        const start1 = `${year}-${String(startDate.month).padStart(2, '0')}-${String(startDate.day).padStart(2, '0')}`;
        const end1 = `${year}-12-31`;

        const url1 = `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}&longitude=${LONGITUDE}&start_date=${start1}&end_date=${end1}&daily=${metricsStr}&timezone=Europe/London`;
        const response1 = await fetch(url1);

        if (!response1.ok) {
          throw new Error(`API returned ${response1.status} for first part`);
        }

        const data1 = await response1.json();
        processData(data1);

        // Part 2: Following year (e.g., Jan 1 to Jan 31 of 2024)
        const nextYear = year + 1;
        const start2 = `${nextYear}-01-01`;
        const end2 = `${nextYear}-${String(endDate.month).padStart(2, '0')}-${String(endDate.day).padStart(2, '0')}`;

        const url2 = `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}&longitude=${LONGITUDE}&start_date=${start2}&end_date=${end2}&daily=${metricsStr}&timezone=Europe/London`;
        const response2 = await fetch(url2);

        if (!response2.ok) {
          throw new Error(`API returned ${response2.status} for second part`);
        }

        const data2 = await response2.json();
        processData(data2);

      } else {
        // Normal same-year range
        const start = `${year}-${String(startDate.month).padStart(2, '0')}-${String(startDate.day).padStart(2, '0')}`;
        const end = `${year}-${String(endDate.month).padStart(2, '0')}-${String(endDate.day).padStart(2, '0')}`;

        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}&longitude=${LONGITUDE}&start_date=${start}&end_date=${end}&daily=${metricsStr}&timezone=Europe/London`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        processData(data);
      }

      results[year] = filteredData;
    }

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({ error: error.message });
  }
}
