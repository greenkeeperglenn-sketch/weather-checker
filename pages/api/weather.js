// pages/api/weather.js
export default async function handler(req, res) {
  const { startDate, endDate, years, metrics, lat, lon } = req.body;

  if (!startDate || !endDate || !years || !metrics) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Use provided coordinates or default to Bingley
  const LATITUDE = lat || 53.8475;
  const LONGITUDE = lon || -1.8397;

  try {
    const results = {};

    for (const year of years) {
      const start = `${year}-${String(startDate.month).padStart(2, '0')}-${String(startDate.day).padStart(2, '0')}`;
      const end = `${year}-${String(endDate.month).padStart(2, '0')}-${String(endDate.day).padStart(2, '0')}`;

      const metricsStr = metrics.join(',');
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}&longitude=${LONGITUDE}&start_date=${start}&end_date=${end}&daily=${metricsStr}&timezone=Europe/London`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      const filteredData = { dates: [] };
      data.daily.time.forEach((date, index) => {
        // Store date as "Mon D" format (e.g., "Jan 15")
        const dateObj = new Date(date);
        const monthName = dateObj.toLocaleDateString('en-GB', { month: 'short' });
        const day = dateObj.getDate();
        filteredData.dates.push(`${monthName} ${day}`);

        metrics.forEach(metric => {
          if (!filteredData[metric]) filteredData[metric] = [];
          filteredData[metric].push(data.daily[metric][index]);
        });
      });

      results[year] = filteredData;
    }

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({ error: error.message });
  }
}
