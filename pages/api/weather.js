// pages/api/weather.js
export default async function handler(req, res) {
  const { months, years, metrics } = req.body;

  if (!months || !years || !metrics) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const LATITUDE = 51.0632;
  const LONGITUDE = -1.3080;

  try {
    const results = {};

    for (const year of years) {
      const firstMonth = Math.min(...months);
      const lastMonth = Math.max(...months);
      
      const startDate = `${year}-${String(firstMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(year, lastMonth, 0).getDate();
      const endDate = `${year}-${String(lastMonth).padStart(2, '0')}-${lastDay}`;
      
      const metricsStr = metrics.join(',');
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}&longitude=${LONGITUDE}&start_date=${startDate}&end_date=${endDate}&daily=${metricsStr}&timezone=Europe/London`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      
      // Filter to only selected months
      const filteredData = { dates: [] };
      data.daily.time.forEach((date, index) => {
        const month = parseInt(date.substring(5, 7));
        if (months.includes(month)) {
          // Store date as "Mon D" format (e.g., "Jan 15")
          const dateObj = new Date(date);
          const monthName = dateObj.toLocaleDateString('en-GB', { month: 'short' });
          const day = dateObj.getDate();
          filteredData.dates.push(`${monthName} ${day}`);

          metrics.forEach(metric => {
            if (!filteredData[metric]) filteredData[metric] = [];
            filteredData[metric].push(data.daily[metric][index]);
          });
        }
      });

      results[year] = filteredData;
    }

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({ error: error.message });
  }
}
