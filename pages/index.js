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
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function Home() {
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('temperature_2m_mean');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState('line');
  const [grayedYears, setGrayedYears] = useState(new Set());

  const months = [
    { name: 'January', num: 1 },
    { name: 'February', num: 2 },
    { name: 'March', num: 3 },
    { name: 'April', num: 4 },
    { name: 'May', num: 5 },
    { name: 'June', num: 6 },
    { name: 'July', num: 7 },
    { name: 'August', num: 8 },
    { name: 'September', num: 9 },
    { name: 'October', num: 10 },
    { name: 'November', num: 11 },
    { name: 'December', num: 12 }
  ];

  const metrics = [
    { id: 'temperature_2m_mean', name: 'Mean Temperature', unit: '°C' },
    { id: 'temperature_2m_max', name: 'Max Temperature', unit: '°C' },
    { id: 'temperature_2m_min', name: 'Min Temperature', unit: '°C' },
    { id: 'precipitation_sum', name: 'Precipitation', unit: 'mm' },
    { id: 'sunshine_duration', name: 'Sunshine Duration', unit: 'seconds' },
    { id: 'wind_speed_10m_max', name: 'Max Wind Speed', unit: 'km/h' },
  ];

  const years = Array.from({ length: 12 }, (_, i) => 2014 + i); // 2014-2025 (archive API doesn't have current year data)

  const yearColors = [
    '#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a',
    '#feca57', '#ff6b6b', '#48dbfb', '#ff9ff3', '#54a0ff',
    '#5f27cd', '#00d2d3', '#1dd1a1'
  ];

  const toggleMonth = (monthNum) => {
    setSelectedMonths(prev =>
      prev.includes(monthNum)
        ? prev.filter(m => m !== monthNum)
        : [...prev, monthNum].sort((a, b) => a - b)
    );
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
    if (selectedMonths.length === 0 || selectedYears.length === 0) {
      alert('Please select at least one month and one year');
      return;
    }

    setLoading(true);
    setGrayedYears(new Set());

    try {
      const response = await fetch('/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          months: selectedMonths,
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
    const labels = data[firstYear][selectedMetric].map((_, i) => `Day ${i + 1}`);

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

  const toggleYearGray = (year) => {
    setGrayedYears(prev => {
      const newSet = new Set(prev);
      if (newSet.has(year)) {
        newSet.delete(year);
      } else {
        newSet.add(year);
      }
      return newSet;
    });
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
    const monthNames = selectedMonths.map(m => months[m - 1].name).join('+');
    
    let csv = `Winchester Weather Daily Data - ${monthNames}\n`;
    csv += `Metric: ${metric.name} (${metric.unit})\n\n`;
    csv += 'Day,' + selectedYears.join(',') + '\n';
    
    const numDays = chartData.rawData[selectedYears[0]][selectedMetric].length;
    for (let i = 0; i < numDays; i++) {
      const values = selectedYears.map(year => 
        chartData.rawData[year][selectedMetric][i]
      );
      csv += `Day ${i + 1},` + values.join(',') + '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `winchester_${selectedMetric}_${monthNames}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ChartComponent = chartType === 'line' ? Line : Bar;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '30px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5em', marginBottom: '10px' }}>📈 Winchester Weather - Daily Charts</h1>
          <p>Visualize daily weather patterns across months and years</p>
          <p style={{ fontSize: '0.9em', marginTop: '10px' }}>Location: 51.0632°N, 1.3080°W | Winchester, UK</p>
        </div>

        {/* Controls */}
        <div style={{ padding: '30px', background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
          
          {/* Months */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#2d3748' }}>
              📅 Select Months:
              <span style={{ marginLeft: '10px', color: '#a0aec0', fontWeight: '400', fontSize: '0.9em' }}>
                {selectedMonths.length === 0 ? 'None selected' : selectedMonths.map(m => months[m - 1].name).join(', ')}
              </span>
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {months.map(month => (
                <button
                  key={month.num}
                  onClick={() => toggleMonth(month.num)}
                  style={{
                    padding: '8px 16px',
                    border: '2px solid #e2e8f0',
                    background: selectedMonths.includes(month.num) ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                    color: selectedMonths.includes(month.num) ? 'white' : 'black',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {month.name}
                </button>
              ))}
            </div>
          </div>

          {/* Years */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#2d3748' }}>
              📆 Select Years:
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

          {/* Metrics */}
          <div style={{ marginBottom: '25px' }}>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#2d3748' }}>
              📊 Select ONE Metric:
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
              {loading ? 'Loading...' : '📊 Generate Daily Chart'}
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
                💾 Download CSV
              </button>
            )}
          </div>
        </div>

        {/* Chart */}
        {chartData && (
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
                📈 Line Chart
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
                📊 Bar Chart
              </button>
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginBottom: '15px' }}>
                {metrics.find(m => m.id === selectedMetric)?.name} - {selectedMonths.map(m => months[m - 1].name).join(' + ')}
              </h3>
              <div style={{ position: 'relative', height: '400px' }}>
                <ChartComponent data={chartData} options={getChartOptions()} />
              </div>
            </div>

            <div style={{ background: '#e6f7ff', borderLeft: '4px solid #1890ff', padding: '20px', margin: '20px 0', borderRadius: '8px' }}>
              <h3 style={{ color: '#0050b3', marginBottom: '10px' }}>💡 Tip</h3>
              <p style={{ color: '#0050b3' }}>
                Click any year in the legend to toggle it gray. Click again to restore its color. Toggle as many years as you like to focus on specific data.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
