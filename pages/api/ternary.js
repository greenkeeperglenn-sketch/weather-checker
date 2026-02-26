// pages/api/ternary.js

// DLI conversion: PAR ≈ 45% of total shortwave, 1 MJ PAR = 4.57 mol photons
const DLI_FACTOR = 2.04; // 0.45 * 4.57

export default async function handler(req, res) {
  const { lat, lon } = req.body;
  const LATITUDE = lat || 53.8475;
  const LONGITUDE = lon || -1.8397;
  const historicalYears = Array.from({ length: 46 }, (_, i) => 1980 + i);

  const apiMetrics = 'temperature_2m_mean,et0_fao_evapotranspiration,shortwave_radiation_sum';

  try {
    // { "MM-DD": { temperature: [{year, value}], et: [...], dli: [...] } }
    const allDaysData = {};

    for (const year of historicalYears) {
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LATITUDE}&longitude=${LONGITUDE}&start_date=${year}-01-01&end_date=${year}-12-31&daily=${apiMetrics}&timezone=Europe/London`;
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch ${year}: ${response.status}`);
        continue;
      }
      const data = await response.json();

      data.daily.time.forEach((date, index) => {
        const monthDay = date.substring(5); // "MM-DD"
        if (!allDaysData[monthDay]) {
          allDaysData[monthDay] = { temperature: [], et: [], dli: [] };
        }
        const temp = data.daily.temperature_2m_mean[index];
        const et = data.daily.et0_fao_evapotranspiration[index];
        const swr = data.daily.shortwave_radiation_sum[index];
        const dli = swr !== null ? swr * DLI_FACTOR : null;

        if (temp !== null) allDaysData[monthDay].temperature.push({ year, value: temp });
        if (et !== null) allDaysData[monthDay].et.push({ year, value: et });
        if (dli !== null) allDaysData[monthDay].dli.push({ year, value: dli });
      });
    }

    // Calculate global extremes
    // Per user request: Temp 0 to max ever, ET 0 to max ever, DLI lowest ever to highest ever
    const extremes = {
      temperature: { min: 0, max: -Infinity },
      et: { min: 0, max: -Infinity },
      dli: { min: Infinity, max: -Infinity }
    };

    Object.values(allDaysData).forEach(day => {
      day.temperature.forEach(({ value }) => {
        extremes.temperature.max = Math.max(extremes.temperature.max, value);
      });
      day.et.forEach(({ value }) => {
        extremes.et.max = Math.max(extremes.et.max, value);
      });
      day.dli.forEach(({ value }) => {
        extremes.dli.min = Math.min(extremes.dli.min, value);
        extremes.dli.max = Math.max(extremes.dli.max, value);
      });
    });

    // Calculate 10-year average (2016-2025) per day
    const tenYearAvg = {};
    const tenYears = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

    Object.entries(allDaysData).forEach(([monthDay, day]) => {
      tenYearAvg[monthDay] = {};
      ['temperature', 'et', 'dli'].forEach(metric => {
        const vals = day[metric].filter(v => tenYears.includes(v.year)).map(v => v.value);
        tenYearAvg[monthDay][metric] = vals.length > 0
          ? vals.reduce((a, b) => a + b, 0) / vals.length
          : null;
      });
    });

    res.status(200).json({
      success: true,
      perDay: allDaysData,
      extremes,
      tenYearAvg
    });
  } catch (error) {
    console.error('Error fetching ternary data:', error);
    res.status(500).json({ error: error.message });
  }
}
