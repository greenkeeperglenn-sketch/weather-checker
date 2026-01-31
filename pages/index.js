// pages/index.js
import { useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

export default function Home() {
  const [startDate, setStartDate] = useState({ month: 1, day: 1 });
  const [endDate, setEndDate] = useState({ month: 12, day: 31 });
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('temperature_2m_mean');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState('line');
  const [grayedYears, setGrayedYears] = useState(new Set());

  // Cave graph state
  const [caveMode, setCaveMode] = useState(false);
  const [caveData, setCaveData] = useState(null);
  const [caveOverlayYear, setCaveOverlayYear] = useState(2024);
  const [caveLoading, setCaveLoading] = useState(false);
  const [availableOverlayYears, setAvailableOverlayYears] = useState([]);

  const months = [
    { name: 'Jan', num: 1, days: 31 },
    { name: 'Feb', num: 2, days: 29 },
    { name: 'Mar', num: 3, days: 31 },
    { name: 'Apr', num: 4, days: 30 },
    { name: 'May', num: 5, days: 31 },
    { name: 'Jun', num: 6, days: 30 },
    { name: 'Jul', num: 7, days: 31 },
    { name: 'Aug', num: 8, days: 31 },
    { name: 'Sep', num: 9, days: 30 },
    { name: 'Oct', num: 10, days: 31 },
    { name: 'Nov', num: 11, days: 30 },
    { name: 'Dec', num: 12, days: 31 }
  ];

  const metrics = [
    { id: 'temperature_2m_mean', name: 'Mean Temperature', unit: '°C' },
    { id: 'temperature_2m_max', name: 'Max Temperature', unit: '°C' },
    { id: 'temperature_2m_min', name: 'Min Temperature', unit: '°C' },
    { id: 'precipitation_sum', name: 'Precipitation', unit: 'mm' },
    { id: 'sunshine_duration', name: 'Sunshine Duration', unit: 'seconds' },
    { id: 'wind_speed_10m_max', name: 'Max Wind Speed', unit: 'km/h' },
  ];

  const years = Array.from({ length: 12 }, (_, i) => 2014 + i);

  const yearColors = [
    '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a',
    '#feca57', '#ff6b6b', '#48dbfb', '#ff9ff3', '#54a0ff',
    '#5f27cd', '#00d2d3', '#1dd1a1'
  ];

  const getDaysInMonth = (month) => {
    return months.find(m => m.num === month)?.days || 31;
  };

  const formatDateRange = () => {
    const startMonth = months.find(m => m.num === startDate.month)?.name;
    const endMonth = months.find(m => m.num === endDate.month)?.name;
    return `${startMonth} ${startDate.day} - ${endMonth} ${endDate.day}`;
  };

  const toggleYear = (year) => {
    setSelectedYears(prev =>
      prev.includes(year)
        ? prev.filter(y => y !== year)
        : [...prev, year].sort()
    );
  };

  const selectAllYears = () => {
    setSelectedYears(years);
  };

  const clearAllYears = () => {
    setSelectedYears([]);
  };

  const generateChart = async () => {
    if (selectedYears.length === 0) {
      alert('Please select at least one year');
      return;
    }

    setLoading(true);
    setGrayedYears(new Set());

    try {
      const response = await fetch('/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          years: selectedYears,
          metrics: [selectedMetric]
        })
      });

      const result = await response.json();

      if (result.success) {
        processChartData(result.data);
      } else {
        alert('Error fetching data: ' + result.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (data) => {
    const firstYear = selectedYears[0];
    const labels = data[firstYear].dates;

    const datasets = selectedYears.map((year, index) => ({
      label: year.toString(),
      data: data[year][selectedMetric],
      borderColor: yearColors[index % yearColors.length],
      backgroundColor: yearColors[index % yearColors.length] + '40',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.1
    }));

    setChartData({ labels, datasets, rawData: data });
  };

  const generateCaveGraph = async () => {
    setCaveLoading(true);

    try {
      const response = await fetch('/api/cave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric: selectedMetric })
      });

      const result = await response.json();

      if (result.success) {
        processCaveData(result);
      } else {
        alert('Error fetching cave data: ' + result.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setCaveLoading(false);
    }
  };

  const processCaveData = (result) => {
    const { data, overlayData, overlayYears, forecastData, recentData } = result;

    // Store available overlay years for the UI
    setAvailableOverlayYears(overlayYears);

    // Default to most recent year if current selection isn't available
    if (!overlayYears.includes(caveOverlayYear)) {
      setCaveOverlayYear(overlayYears[overlayYears.length - 1]);
    }

    // Get today's date info for positioning
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    // Create rolling year view: 6 months back, 6 months forward
    const startMonth = ((currentMonth - 7 + 12) % 12) + 1; // 6 months back
    const orderedMonths = [];
    for (let i = 0; i < 12; i++) {
      const m = ((startMonth - 1 + i) % 12) + 1;
      orderedMonths.push(m);
    }

    // Build labels and data arrays in rolling order
    const labels = [];
    const minData = [];
    const p25Data = [];
    const p75Data = [];
    const maxData = [];
    const overlayDataPoints = {};
    const forecastDataPoints = [];
    const recentDataPoints = [];

    overlayYears.forEach(year => {
      overlayDataPoints[year] = [];
    });

    let todayIndex = -1;
    let dayCounter = 0;

    orderedMonths.forEach((month, monthIndex) => {
      const daysInMonth = getDaysInMonth(month);
      for (let day = 1; day <= daysInMonth; day++) {
        const monthDay = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // Add label only for 1st of each month
        if (day === 1) {
          labels.push(months[month - 1].name);
        } else {
          labels.push('');
        }

        if (data[monthDay]) {
          minData.push(data[monthDay].min);
          p25Data.push(data[monthDay].p25);
          p75Data.push(data[monthDay].p75);
          maxData.push(data[monthDay].max);
        } else {
          minData.push(null);
          p25Data.push(null);
          p75Data.push(null);
          maxData.push(null);
        }

        overlayYears.forEach(year => {
          if (overlayData[year] && overlayData[year][monthDay] !== undefined) {
            overlayDataPoints[year].push(overlayData[year][monthDay]);
          } else {
            overlayDataPoints[year].push(null);
          }
        });

        // Add forecast data points
        if (forecastData && forecastData[monthDay] !== undefined) {
          forecastDataPoints.push(forecastData[monthDay]);
        } else {
          forecastDataPoints.push(null);
        }

        // Add recent actual data points
        if (recentData && recentData[monthDay] !== undefined) {
          recentDataPoints.push(recentData[monthDay]);
        } else {
          recentDataPoints.push(null);
        }

        // Track today's position
        if (month === currentMonth && day === currentDay) {
          todayIndex = dayCounter;
        }
        dayCounter++;
      }
    });

    setCaveData({
      labels,
      minData,
      p25Data,
      p75Data,
      maxData,
      overlayDataPoints,
      overlayYears,
      todayIndex,
      forecastDataPoints,
      recentDataPoints
    });
  };

  const getCaveChartData = () => {
    if (!caveData) return null;

    const { labels, minData, p25Data, p75Data, maxData, overlayDataPoints, forecastDataPoints, recentDataPoints } = caveData;

    return {
      labels,
      datasets: [
        // Max area (grey top band)
        {
          label: 'Max',
          data: maxData,
          borderColor: 'transparent',
          backgroundColor: 'rgba(128, 128, 128, 0.6)',
          fill: '+1',
          pointRadius: 0,
          tension: 0.3,
          order: 6
        },
        // 75th percentile line
        {
          label: '75th Percentile',
          data: p75Data,
          borderColor: 'transparent',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          fill: '+1',
          pointRadius: 0,
          tension: 0.3,
          order: 5
        },
        // 25th percentile line
        {
          label: '25th Percentile',
          data: p25Data,
          borderColor: 'transparent',
          backgroundColor: 'rgba(128, 128, 128, 0.6)',
          fill: '+1',
          pointRadius: 0,
          tension: 0.3,
          order: 4
        },
        // Min line (bottom of grey band)
        {
          label: 'Min',
          data: minData,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          fill: false,
          pointRadius: 0,
          tension: 0.3,
          order: 3
        },
        // Recent actual weather (solid yellow line)
        {
          label: 'Recent Actual',
          data: recentDataPoints || [],
          borderColor: '#ffff00',
          backgroundColor: 'transparent',
          borderWidth: 3,
          fill: false,
          pointRadius: 0,
          tension: 0.3,
          order: 1
        },
        // Forecast (dashed cyan line)
        {
          label: 'Forecast',
          data: forecastDataPoints || [],
          borderColor: '#00ffff',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [8, 4],
          fill: false,
          pointRadius: 0,
          tension: 0.3,
          order: 0
        },
        // Overlay year
        {
          label: `${caveOverlayYear}`,
          data: overlayDataPoints[caveOverlayYear] || [],
          borderColor: '#00ff00',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
          tension: 0.3,
          order: 2
        }
      ]
    };
  };

  const getCaveChartOptions = () => {
    const metric = metrics.find(m => m.id === selectedMetric);
    const todayIndex = caveData?.todayIndex ?? -1;

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#ffffff',
            filter: (item) => item.text === `${caveOverlayYear}` || item.text === 'Normal Range'
          },
          onClick: () => {} // Disable legend click
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              if (context.dataset.label === `${caveOverlayYear}`) {
                return `${caveOverlayYear}: ${context.parsed.y?.toFixed(1)} ${metric.unit}`;
              }
              return null;
            }
          }
        },
        annotation: todayIndex >= 0 ? {
          annotations: {
            todayLine: {
              type: 'line',
              xMin: todayIndex,
              xMax: todayIndex,
              borderColor: '#ff0000',
              borderWidth: 2,
              borderDash: [6, 6],
              label: {
                display: true,
                content: 'Today',
                position: 'start',
                backgroundColor: '#ff0000',
                color: '#ffffff',
                font: { size: 11 }
              }
            }
          }
        } : {}
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#ffffff',
            maxRotation: 0,
            callback: function(val, index) {
              const label = this.getLabelForValue(val);
              return label || null;
            }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#ffffff'
          },
          title: {
            display: true,
            text: `${metric.name} (${metric.unit})`,
            color: '#ffffff'
          }
        }
      }
    };
  };

  const getChartOptions = () => {
    const metric = metrics.find(m => m.id === selectedMetric);

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            generateLabels: (chart) => {
              return chart.data.datasets.map((dataset, index) => {
                const year = parseInt(dataset.label);
                const isGrayed = grayedYears.has(year);
                return {
                  text: dataset.label,
                  fillStyle: isGrayed ? 'rgba(200, 200, 200, 0.3)' : yearColors[index % yearColors.length],
                  strokeStyle: isGrayed ? 'rgba(200, 200, 200, 0.3)' : yearColors[index % yearColors.length],
                  lineWidth: 2,
                  hidden: false,
                  index: index
                };
              });
            }
          },
          onClick: (e, legendItem, legend) => {
            const year = parseInt(legendItem.text);
            const newGrayedYears = new Set(grayedYears);
            if (newGrayedYears.has(year)) {
              newGrayedYears.delete(year);
            } else {
              newGrayedYears.add(year);
            }
            setGrayedYears(newGrayedYears);

            const chart = legend.chart;
            chart.data.datasets.forEach((dataset, index) => {
              const datasetYear = parseInt(dataset.label);
              const isGrayed = newGrayedYears.has(datasetYear);

              dataset.borderColor = isGrayed
                ? 'rgba(200, 200, 200, 0.3)'
                : yearColors[index % yearColors.length];
              dataset.backgroundColor = isGrayed
                ? 'rgba(200, 200, 200, 0.1)'
                : yearColors[index % yearColors.length] + '40';
              dataset.borderWidth = 2;
            });

            chart.update();
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ${metric.unit}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: selectedMetric === 'precipitation_sum',
          title: {
            display: true,
            text: metric.unit
          }
        }
      }
    };
  };

  const downloadCSV = () => {
    if (!chartData) return;

    const metric = metrics.find(m => m.id === selectedMetric);
    const dateRange = formatDateRange().replace(/ /g, '_');

    let csv = `Winchester Weather Daily Data - ${formatDateRange()}\n`;
    csv += `Metric: ${metric.name} (${metric.unit})\n\n`;
    csv += 'Date,' + selectedYears.join(',') + '\n';

    const dates = chartData.rawData[selectedYears[0]].dates;
    for (let i = 0; i < dates.length; i++) {
      const values = selectedYears.map(year =>
        chartData.rawData[year][selectedMetric][i]
      );
      csv += `${dates[i]},` + values.join(',') + '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `winchester_${selectedMetric}_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ChartComponent = chartType === 'line' ? Line : Bar;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '30px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5em', marginBottom: '10px' }}>Winchester Weather - Daily Charts</h1>
          <p>Visualize daily weather patterns across months and years</p>
          <p style={{ fontSize: '0.9em', marginTop: '10px' }}>Location: 51.0632°N, 1.3080°W | Winchester, UK</p>
        </div>

        {/* Mode Toggle */}
        <div style={{ padding: '20px 30px', background: '#f0f0f0', borderBottom: '2px solid #e0e0e0' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setCaveMode(false)}
              style={{
                padding: '12px 24px',
                background: !caveMode ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                color: !caveMode ? 'white' : '#333',
                border: '2px solid #667eea',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '15px'
              }}
            >
              Standard Chart
            </button>
            <button
              onClick={() => setCaveMode(true)}
              style={{
                padding: '12px 24px',
                background: caveMode ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'white',
                color: caveMode ? 'white' : '#333',
                border: '2px solid #1a1a2e',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '15px'
              }}
            >
              Cave Graph (Climate Envelope)
            </button>
          </div>
        </div>

        {/* Controls */}
        <div style={{ padding: '30px', background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>

          {!caveMode ? (
            <>
              {/* Standard Chart Controls */}
              {/* Date Range */}
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#2d3748' }}>
                  Select Date Range:
                  <span style={{ marginLeft: '10px', color: '#a0aec0', fontWeight: '400', fontSize: '0.9em' }}>
                    {formatDateRange()}
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: '500', color: '#4a5568' }}>From:</span>
                    <select
                      value={startDate.month}
                      onChange={(e) => {
                        const newMonth = parseInt(e.target.value);
                        const maxDay = getDaysInMonth(newMonth);
                        setStartDate({ month: newMonth, day: Math.min(startDate.day, maxDay) });
                      }}
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '2px solid #e2e8f0', fontSize: '14px' }}
                    >
                      {months.map(m => <option key={m.num} value={m.num}>{m.name}</option>)}
                    </select>
                    <select
                      value={startDate.day}
                      onChange={(e) => setStartDate({ ...startDate, day: parseInt(e.target.value) })}
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '2px solid #e2e8f0', fontSize: '14px' }}
                    >
                      {Array.from({ length: getDaysInMonth(startDate.month) }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: '500', color: '#4a5568' }}>To:</span>
                    <select
                      value={endDate.month}
                      onChange={(e) => {
                        const newMonth = parseInt(e.target.value);
                        const maxDay = getDaysInMonth(newMonth);
                        setEndDate({ month: newMonth, day: Math.min(endDate.day, maxDay) });
                      }}
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '2px solid #e2e8f0', fontSize: '14px' }}
                    >
                      {months.map(m => <option key={m.num} value={m.num}>{m.name}</option>)}
                    </select>
                    <select
                      value={endDate.day}
                      onChange={(e) => setEndDate({ ...endDate, day: parseInt(e.target.value) })}
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '2px solid #e2e8f0', fontSize: '14px' }}
                    >
                      {Array.from({ length: getDaysInMonth(endDate.month) }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Years */}
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#2d3748' }}>
                  Select Years:
                  <span style={{ marginLeft: '10px', color: '#a0aec0', fontWeight: '400', fontSize: '0.9em' }}>
                    {selectedYears.length === 0 ? 'None selected' :
                      selectedYears.length <= 5 ? selectedYears.join(', ') :
                        `${selectedYears[0]} - ${selectedYears[selectedYears.length - 1]} (${selectedYears.length} years)`}
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <button onClick={selectAllYears} style={{ padding: '8px 16px', background: '#48bb78', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    Select All Years
                  </button>
                  <button onClick={clearAllYears} style={{ padding: '8px 16px', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    Clear All
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {years.map(year => (
                    <button
                      key={year}
                      onClick={() => toggleYear(year)}
                      style={{
                        padding: '8px 16px',
                        border: '2px solid #e2e8f0',
                        background: selectedYears.includes(year) ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                        color: selectedYears.includes(year) ? 'white' : 'black',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px'
                      }}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Cave Graph Controls */}
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#2d3748' }}>
                  Overlay Year (shown as dotted green line):
                  <span style={{ marginLeft: '10px', color: '#a0aec0', fontWeight: '400', fontSize: '0.9em' }}>
                    {caveOverlayYear}
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={caveOverlayYear}
                    onChange={(e) => setCaveOverlayYear(parseInt(e.target.value))}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '6px',
                      border: '2px solid #1a1a2e',
                      fontSize: '14px',
                      fontWeight: '600',
                      background: 'white',
                      cursor: 'pointer',
                      minWidth: '100px'
                    }}
                  >
                    {(availableOverlayYears.length > 0 ? availableOverlayYears : [2024]).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <span style={{ color: '#666', fontSize: '0.9em' }}>
                    {availableOverlayYears.length > 0
                      ? `(${availableOverlayYears.length} years available: ${availableOverlayYears[0]}-${availableOverlayYears[availableOverlayYears.length - 1]})`
                      : '(generate graph to see available years)'}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Metrics (shared) */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#2d3748' }}>
              Select Metric:
              <span style={{ marginLeft: '10px', color: '#a0aec0', fontWeight: '400', fontSize: '0.9em' }}>
                {metrics.find(m => m.id === selectedMetric)?.name}
              </span>
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {metrics.map(metric => (
                <button
                  key={metric.id}
                  onClick={() => setSelectedMetric(metric.id)}
                  style={{
                    padding: '8px 16px',
                    border: '2px solid #e2e8f0',
                    background: selectedMetric === metric.id ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                    color: selectedMetric === metric.id ? 'white' : 'black',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {metric.name}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
            {!caveMode ? (
              <>
                <button
                  onClick={generateChart}
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '12px 30px',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Loading...' : 'Generate Daily Chart'}
                </button>
                {chartData && (
                  <button
                    onClick={downloadCSV}
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      padding: '12px 30px',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Download CSV
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={generateCaveGraph}
                disabled={caveLoading}
                style={{
                  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 30px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: caveLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {caveLoading ? 'Loading Historical Data...' : 'Generate Cave Graph'}
              </button>
            )}
          </div>
        </div>

        {/* Standard Chart Display */}
        {!caveMode && chartData && (
          <div style={{ padding: '30px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button
                onClick={() => setChartType('line')}
                style={{
                  padding: '10px 20px',
                  background: chartType === 'line' ? '#667eea' : 'white',
                  color: chartType === 'line' ? 'white' : '#667eea',
                  border: '2px solid #667eea',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Line Chart
              </button>
              <button
                onClick={() => setChartType('bar')}
                style={{
                  padding: '10px 20px',
                  background: chartType === 'bar' ? '#667eea' : 'white',
                  color: chartType === 'bar' ? 'white' : '#667eea',
                  border: '2px solid #667eea',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Bar Chart
              </button>
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginBottom: '15px' }}>
                {metrics.find(m => m.id === selectedMetric)?.name} - {formatDateRange()}
              </h3>
              <div style={{ position: 'relative', height: '400px' }}>
                <ChartComponent data={chartData} options={getChartOptions()} />
              </div>
            </div>

            <div style={{ background: '#e6f7ff', borderLeft: '4px solid #1890ff', padding: '20px', margin: '20px 0', borderRadius: '8px' }}>
              <h3 style={{ color: '#0050b3', marginBottom: '10px' }}>Tip</h3>
              <p style={{ color: '#0050b3' }}>
                Click any year in the legend to toggle it gray. Click again to restore its color. Toggle as many years as you like to focus on specific data.
              </p>
            </div>
          </div>
        )}

        {/* Cave Graph Display */}
        {caveMode && caveData && (
          <div style={{ padding: '30px' }}>
            <div style={{ background: '#1a1a2e', padding: '30px', borderRadius: '12px' }}>
              <h3 style={{ color: 'white', marginBottom: '20px', textAlign: 'center' }}>
                Climate Envelope: {metrics.find(m => m.id === selectedMetric)?.name}
                <span style={{ display: 'block', fontSize: '0.8em', color: '#aaa', marginTop: '5px' }}>
                  Historical range ({availableOverlayYears[0] || 1980}-{availableOverlayYears[availableOverlayYears.length - 1] || 2025}) with {caveOverlayYear} overlay
                </span>
              </h3>
              <div style={{ position: 'relative', height: '500px' }}>
                <Line data={getCaveChartData()} options={getCaveChartOptions()} />
              </div>
            </div>

            <div style={{ background: '#2d2d44', borderLeft: '4px solid #00ff00', padding: '20px', margin: '20px 0', borderRadius: '8px' }}>
              <h3 style={{ color: '#00ff00', marginBottom: '10px' }}>Understanding the Cave Graph</h3>
              <ul style={{ color: '#ccc', lineHeight: '1.8' }}>
                <li><strong style={{ color: 'white' }}>White band (middle 50%):</strong> Normal range - values between 25th and 75th percentile</li>
                <li><strong style={{ color: '#888' }}>Grey bands (outer 25%):</strong> Unusual range - below 25th or above 75th percentile</li>
                <li><strong style={{ color: '#ffff00' }}>Yellow solid line:</strong> Recent actual weather (last 7 days)</li>
                <li><strong style={{ color: '#00ffff' }}>Cyan dashed line:</strong> Weather forecast (next 16 days)</li>
                <li><strong style={{ color: '#00ff00' }}>Green dotted line:</strong> Selected year ({caveOverlayYear}) for comparison</li>
                <li><strong style={{ color: '#ff0000' }}>Red dashed line:</strong> Today's date</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
