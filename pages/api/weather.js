// pages/api/weather.js

// Map each calculated metric to the API field it depends on
const calculatedMetricDeps = {
  gdd0: 'temperature_2m_mean',
  gdd6: 'temperature_2m_mean',
  growth_potential: 'temperature_2m_mean',
  dli: 'shortwave_radiation_sum',
};
const calculatedMetrics = Object.keys(calculatedMetricDeps);

// Growth Potential constants
const TOPT = 20;  // Optimal temperature
const S = 5.5;    // Spread parameter

// DLI conversion: PAR ≈ 45% of total shortwave, 1 MJ PAR = 4.57 mol photons
const DLI_FACTOR = 2.04; // 0.45 * 4.57

// Calculate derived metrics from source data
function calculateDerivedMetrics(dataRow) {
  const tavg = dataRow.temperature_2m_mean;
  const swr = dataRow.shortwave_radiation_sum;
  return {
    gdd0: tavg != null ? Math.max(0, tavg) : null,
    gdd6: tavg != null ? Math.max(0, tavg - 6) : null,
    growth_potential: tavg != null ? Math.exp(-0.5 * Math.pow((tavg - TOPT) / S, 2)) : null,
    dli: swr != null ? swr * DLI_FACTOR : null,
  };
}

// Define decade year ranges
const decadeRanges = {
  '2020s': [2020, 2021, 2022, 2023, 2024, 2025],
  '2010s': [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019],
  '2000s': [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009],
  '1990s': [1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999],
  '1980s': [1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989],
};

export default async function handler(req, res) {
  const { startDate, endDate, years, metrics, lat, lon, averages } = req.body;

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

  // Ensure we fetch the dependency for each requested calculated metric
  requestedCalculated.forEach(m => {
    const dep = calculatedMetricDeps[m];
    if (dep && !apiMetrics.includes(dep)) {
      apiMetrics.push(dep);
    }
  });

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
            const dataRow = {};
            for (const dep of new Set(requestedCalculated.map(m => calculatedMetricDeps[m]))) {
              dataRow[dep] = data.daily[dep] ? data.daily[dep][index] : null;
            }
            const derived = calculateDerivedMetrics(dataRow);
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

    // Calculate averages if requested
    const avgResults = {};
    if (averages) {
      const { allTime, decades } = averages;

      // Helper to fetch a year's data and return metric values by day index
      const fetchYearData = async (year) => {
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

            apiMetrics.forEach(metric => {
              if (metrics.includes(metric)) {
                filteredData[metric].push(data.daily[metric][index]);
              }
            });

            if (requestedCalculated.length > 0) {
              const dataRow = {};
              for (const dep of new Set(requestedCalculated.map(m => calculatedMetricDeps[m]))) {
                dataRow[dep] = data.daily[dep] ? data.daily[dep][index] : null;
              }
              const derived = calculateDerivedMetrics(dataRow);
              requestedCalculated.forEach(metric => {
                filteredData[metric].push(derived[metric]);
              });
            }
          });
        };

        try {
          if (isCrossYear) {
            const start1 = `${year}-${String(startDate.month).padStart(2, '0')}-${String(startDate.day).padStart(2, '0')}`;
            const end1 = `${year}-12-31`;
            const url1 = `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}&longitude=${LONGITUDE}&start_date=${start1}&end_date=${end1}&daily=${metricsStr}&timezone=Europe/London`;
            const response1 = await fetch(url1);
            if (response1.ok) {
              const data1 = await response1.json();
              processData(data1);
            }

            const nextYear = year + 1;
            const start2 = `${nextYear}-01-01`;
            const end2 = `${nextYear}-${String(endDate.month).padStart(2, '0')}-${String(endDate.day).padStart(2, '0')}`;
            const url2 = `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}&longitude=${LONGITUDE}&start_date=${start2}&end_date=${end2}&daily=${metricsStr}&timezone=Europe/London`;
            const response2 = await fetch(url2);
            if (response2.ok) {
              const data2 = await response2.json();
              processData(data2);
            }
          } else {
            const start = `${year}-${String(startDate.month).padStart(2, '0')}-${String(startDate.day).padStart(2, '0')}`;
            const end = `${year}-${String(endDate.month).padStart(2, '0')}-${String(endDate.day).padStart(2, '0')}`;
            const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}&longitude=${LONGITUDE}&start_date=${start}&end_date=${end}&daily=${metricsStr}&timezone=Europe/London`;
            const response = await fetch(url);
            if (response.ok) {
              const data = await response.json();
              processData(data);
            }
          }
          return filteredData;
        } catch (e) {
          return null;
        }
      };

      // Calculate average across years
      const calculateAverage = (yearDataArray, metric) => {
        if (yearDataArray.length === 0) return [];
        const numDays = yearDataArray[0][metric]?.length || 0;
        const avgValues = [];

        for (let i = 0; i < numDays; i++) {
          let sum = 0;
          let count = 0;
          yearDataArray.forEach(yd => {
            if (yd[metric] && yd[metric][i] !== null && yd[metric][i] !== undefined) {
              sum += yd[metric][i];
              count++;
            }
          });
          avgValues.push(count > 0 ? sum / count : null);
        }
        return avgValues;
      };

      // All-time average (1980-2025)
      if (allTime) {
        const allYears = [];
        for (let y = 1980; y <= 2025; y++) {
          allYears.push(y);
        }
        const allYearData = await Promise.all(allYears.map(y => fetchYearData(y)));
        const validData = allYearData.filter(d => d && d.dates.length > 0);

        if (validData.length > 0) {
          avgResults['allTime'] = { dates: validData[0].dates };
          metrics.forEach(metric => {
            avgResults['allTime'][metric] = calculateAverage(validData, metric);
          });
        }
      }

      // Decade averages
      if (decades && decades.length > 0) {
        for (const decade of decades) {
          const decadeYears = decadeRanges[decade] || [];
          const decadeData = await Promise.all(decadeYears.map(y => fetchYearData(y)));
          const validData = decadeData.filter(d => d && d.dates.length > 0);

          if (validData.length > 0) {
            avgResults[decade] = { dates: validData[0].dates };
            metrics.forEach(metric => {
              avgResults[decade][metric] = calculateAverage(validData, metric);
            });
          }
        }
      }
    }

    res.status(200).json({ success: true, data: results, averages: avgResults });
  } catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({ error: error.message });
  }
}
