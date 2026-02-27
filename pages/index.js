// pages/index.js
import { useState, useRef, useEffect } from 'react';
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
  const [activeTab, setActiveTab] = useState('standard');
  const [caveData, setCaveData] = useState(null);
  const [caveOverlayYear, setCaveOverlayYear] = useState('current'); // 'current' or a year number
  const [caveLoading, setCaveLoading] = useState(false);
  const [availableOverlayYears, setAvailableOverlayYears] = useState([]);

  // Ternary graph state
  const [ternaryData, setTernaryData] = useState(null);
  const [ternaryLoading, setTernaryLoading] = useState(false);
  const [ternaryDayIndex, setTernaryDayIndex] = useState(0);
  const [ternaryPlaying, setTernaryPlaying] = useState(false);
  const [ternarySelectedYear, setTernarySelectedYear] = useState(2024);
  const [showAverage, setShowAverage] = useState(true);
  const [avgAsLine, setAvgAsLine] = useState(false);
  const [visibleMonths, setVisibleMonths] = useState(new Set([0,1,2,3,4,5,6,7,8,9,10,11])); // all months on

  // Location state
  const [selectedLocation, setSelectedLocation] = useState('bingley');

  // Accumulated chart state
  const [accumulatedMode, setAccumulatedMode] = useState(false);
  const [thresholdAmount, setThresholdAmount] = useState('');
  const [accStartDate, setAccStartDate] = useState({ month: 1, day: 1 });
  const [useAccStartDate, setUseAccStartDate] = useState(false);

  // Average lines state
  const [showAllTimeAvg, setShowAllTimeAvg] = useState(false);
  const [selectedDecadeAvgs, setSelectedDecadeAvgs] = useState([]);
  const availableDecades = ['2020s', '2010s', '2000s', '1990s', '1980s'];

  // Chart container refs for copy-to-clipboard
  const standardChartRef = useRef(null);
  const caveChartRef = useRef(null);
  const ternaryChartRef = useRef(null);
  const scatter3dRef = useRef(null);
  const plotlyInitRef = useRef(false);
  const cameraRef = useRef(null);
  const [copiedChart, setCopiedChart] = useState(null);

  const copyChartToClipboard = async (containerRef, chartName) => {
    const el = containerRef.current;
    if (!el) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, {
        useCORS: true,
        scale: 2,
        ignoreElements: (element) => element.dataset?.htmlToCanvasIgnore === 'true'
      });
      canvas.toBlob(async (blob) => {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopiedChart(chartName);
        setTimeout(() => setCopiedChart(null), 2000);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to copy chart:', err);
    }
  };

  const locations = {
    bingley: {
      name: 'Bingley',
      region: 'West Yorkshire',
      lat: 53.8475,
      lon: -1.8397,
      mapX: 145,  // Position on UK map
      mapY: 120
    },
    winchester: {
      name: 'Winchester',
      region: 'Hampshire',
      lat: 51.0632,
      lon: -1.3080,
      mapX: 160,
      mapY: 220
    }
  };

  const currentLocation = locations[selectedLocation];

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
    { id: 'et0_fao_evapotranspiration', name: 'Evapotranspiration (ET₀)', unit: 'mm' },
    { id: 'gdd0', name: 'GDD (Base 0°C)', unit: '°C days', calculated: true },
    { id: 'gdd6', name: 'GDD (Base 6°C)', unit: '°C days', calculated: true },
    { id: 'growth_potential', name: 'Growth Potential', unit: 'GP', calculated: true },
    { id: 'dli', name: 'Daily Light Integral', unit: 'mol/m²/day', calculated: true },
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

  // Check if date range crosses year boundary (e.g., Oct-Jan)
  const isCrossYearRange = () => {
    return endDate.month < startDate.month ||
           (endDate.month === startDate.month && endDate.day < startDate.day);
  };

  const formatDateRange = () => {
    const startMonth = months.find(m => m.num === startDate.month)?.name;
    const endMonth = months.find(m => m.num === endDate.month)?.name;
    const crossYear = isCrossYearRange();
    return `${startMonth} ${startDate.day} - ${endMonth} ${endDate.day}${crossYear ? ' (spans year)' : ''}`;
  };

  // Format year label for cross-year ranges (e.g., "23/24" for Oct 2023 - Jan 2024)
  const formatYearLabel = (year) => {
    if (isCrossYearRange()) {
      return `${String(year).slice(-2)}/${String(year + 1).slice(-2)}`;
    }
    return year.toString();
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
    if (selectedYears.length === 0 && !showAllTimeAvg && selectedDecadeAvgs.length === 0) {
      alert('Please select at least one year or average');
      return;
    }

    setLoading(true);
    setGrayedYears(new Set());

    try {
      // Build averages parameter if any selected
      const averagesParam = (showAllTimeAvg || selectedDecadeAvgs.length > 0) ? {
        allTime: showAllTimeAvg,
        decades: selectedDecadeAvgs
      } : null;

      const response = await fetch('/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          years: selectedYears.length > 0 ? selectedYears : [2024], // Need at least one year for structure
          metrics: [selectedMetric],
          lat: currentLocation.lat,
          lon: currentLocation.lon,
          averages: averagesParam
        })
      });

      const result = await response.json();

      if (result.success) {
        processChartData(result.data, result.averages);
      } else {
        alert('Error fetching data: ' + result.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (data, averages = {}) => {
    // Get labels from first available data source
    const firstYear = selectedYears[0] || Object.keys(data)[0];
    const labels = data[firstYear]?.dates || [];

    // Find the start index for accumulation based on accStartDate
    const findAccStartIndex = () => {
      if (!useAccStartDate) return 0;
      const dates = data[firstYear].dates;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      // Also handle "Sept" variant for September
      const monthAliases = { 'Sept': 8 }; // Sept -> index 8 (September)
      const targetMonthName = monthNames[accStartDate.month - 1];
      const targetDay = accStartDate.day;

      for (let i = 0; i < dates.length; i++) {
        const parts = dates[i].split(' ');
        if (parts.length === 2) {
          const monthStr = parts[0];
          const day = parseInt(parts[1]);
          // Check direct match
          let monthIdx = monthNames.findIndex(m => m.toLowerCase() === monthStr.toLowerCase());
          // Check aliases (e.g., "Sept" for September)
          if (monthIdx === -1 && monthAliases[monthStr] !== undefined) {
            monthIdx = monthAliases[monthStr];
          }
          if (monthIdx + 1 === accStartDate.month && day === targetDay) return i;
        }
      }
      return 0;
    };
    const accStartIndex = findAccStartIndex();

    // Calculate cumulative sum for accumulated mode
    const calculateCumulative = (values) => {
      let sum = 0;
      return values.map((v, idx) => {
        if (idx < accStartIndex) {
          return 0; // Don't accumulate before start date
        }
        if (v !== null && v !== undefined) {
          sum += v;
        }
        return sum;
      });
    };

    const datasets = selectedYears.map((year, index) => {
      const rawValues = data[year][selectedMetric];
      const displayValues = accumulatedMode ? calculateCumulative(rawValues) : rawValues;

      return {
        label: formatYearLabel(year),
        data: displayValues,
        borderColor: yearColors[index % yearColors.length],
        backgroundColor: yearColors[index % yearColors.length] + '40',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.1,
        yearNum: year // Store original year for legend click handling
      };
    });

    // Add average datasets
    const avgColors = {
      allTime: '#000000',  // Black for all-time
      '2020s': '#e74c3c',  // Red
      '2010s': '#9b59b6',  // Purple
      '2000s': '#3498db',  // Blue
      '1990s': '#1abc9c',  // Teal
      '1980s': '#f39c12',  // Orange
    };

    if (averages) {
      // All-time average
      if (averages.allTime && averages.allTime[selectedMetric]) {
        const rawValues = averages.allTime[selectedMetric];
        const displayValues = accumulatedMode ? calculateCumulative(rawValues) : rawValues;
        datasets.push({
          label: 'All-Time Avg',
          data: displayValues,
          borderColor: avgColors.allTime,
          backgroundColor: 'transparent',
          borderWidth: 3,
          borderDash: [8, 4],
          pointRadius: 0,
          tension: 0.3,
          isAverage: true
        });
      }

      // Decade averages
      availableDecades.forEach(decade => {
        if (averages[decade] && averages[decade][selectedMetric]) {
          const rawValues = averages[decade][selectedMetric];
          const displayValues = accumulatedMode ? calculateCumulative(rawValues) : rawValues;
          datasets.push({
            label: `${decade} Avg`,
            data: displayValues,
            borderColor: avgColors[decade],
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 3],
            pointRadius: 0,
            tension: 0.3,
            isAverage: true
          });
        }
      });
    }

    // Calculate threshold crossings for markers
    let thresholdMarkers = [];
    if (accumulatedMode && thresholdAmount && parseFloat(thresholdAmount) > 0) {
      const threshold = parseFloat(thresholdAmount);
      selectedYears.forEach((year, yearIndex) => {
        const rawValues = data[year][selectedMetric];
        const cumulative = calculateCumulative(rawValues);
        let lastMarker = 0;
        let markerCount = 1; // Start at 1 for the initial application marker
        let lastDayIndex = accStartIndex; // Track last marker position for days calculation

        // Add marker 1 at the start date (first application)
        if (useAccStartDate && accStartIndex < cumulative.length) {
          thresholdMarkers.push({
            year,
            yearIndex,
            dayIndex: accStartIndex,
            value: 0, // Start value
            date: labels[accStartIndex],
            count: 1,
            isStartMarker: true,
            daysSinceLast: 0
          });
        }

        cumulative.forEach((value, dayIndex) => {
          if (dayIndex < accStartIndex) return; // Skip before start date
          const nextMarker = lastMarker + threshold;
          if (value >= nextMarker) {
            // Find how many thresholds we've crossed
            while (value >= lastMarker + threshold) {
              lastMarker += threshold;
              markerCount++;
              const daysSinceLast = dayIndex - lastDayIndex;
              thresholdMarkers.push({
                year,
                yearIndex,
                dayIndex,
                value: lastMarker,
                date: labels[dayIndex],
                count: markerCount,
                daysSinceLast
              });
              lastDayIndex = dayIndex;
            }
          }
        });
      });
    }

    setChartData({ labels, datasets, rawData: data, thresholdMarkers });
  };

  const generateCaveGraph = async () => {
    setCaveLoading(true);

    try {
      const response = await fetch('/api/cave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: selectedMetric,
          lat: currentLocation.lat,
          lon: currentLocation.lon
        })
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
    const { data, overlayData, overlayYears, forecastData, recentData, averagesData } = result;

    // Get today's date info for positioning
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    const currentYear = today.getFullYear();

    // Calculate optimal start month to center today in the 12-month window
    const daysPerMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let startMonth = ((currentMonth - 7 + 12) % 12) + 1; // default
    let bestDiff = Infinity;
    for (let offset = 5; offset <= 8; offset++) {
      const tryStart = ((currentMonth - offset - 1 + 12) % 12) + 1;
      let days = 0;
      let m = tryStart;
      while (m !== currentMonth) {
        days += daysPerMonth[m - 1];
        m = (m % 12) + 1;
      }
      days += currentDay;
      const diff = Math.abs(days - 182.5);
      if (diff < bestDiff) {
        bestDiff = diff;
        startMonth = tryStart;
      }
    }

    // Determine which year the start month falls in
    // If startMonth > currentMonth, it's in the previous year
    const startYearOffset = startMonth > currentMonth ? -1 : 0;

    const orderedMonths = [];
    for (let i = 0; i < 12; i++) {
      const m = ((startMonth - 1 + i) % 12) + 1;
      orderedMonths.push(m);
    }

    // Create spanning year pairs (e.g., "23/24" means Aug 2023 - Jul 2024)
    // The first year in the pair is where the "back" months come from
    const spanningYears = [];
    for (let i = 0; i < overlayYears.length - 1; i++) {
      const year1 = overlayYears[i];
      const year2 = overlayYears[i + 1];
      if (year2 === year1 + 1) {
        spanningYears.push({
          label: `${String(year1).slice(-2)}/${String(year2).slice(-2)}`,
          year1,
          year2
        });
      }
    }

    // Store available spanning years for the UI
    setAvailableOverlayYears(spanningYears);

    // Default to 'current' if not a valid selection
    const isValidAverage = caveOverlayYear.startsWith('avg_');
    if (caveOverlayYear !== 'current' && !isValidAverage && !spanningYears.some(sy => sy.label === caveOverlayYear)) {
      setCaveOverlayYear('current');
    }

    // Build labels and data arrays in rolling order
    const labels = [];
    const minData = [];
    const p25Data = [];
    const p75Data = [];
    const maxData = [];
    const overlayDataPoints = {};
    const currentDataPoints = []; // Combined recent + forecast

    // Initialize overlay data for each spanning year
    spanningYears.forEach(sy => {
      overlayDataPoints[sy.label] = [];
    });
    overlayDataPoints['current'] = [];

    // Initialize average overlay data
    const avgKeys = ['avg_allTime', 'avg_2020s', 'avg_2010s', 'avg_2000s', 'avg_1990s', 'avg_1980s'];
    avgKeys.forEach(key => {
      overlayDataPoints[key] = [];
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

        // For each spanning year pair, determine which year to use based on month
        // If month >= startMonth (in the "back" portion), use year1
        // If month < startMonth (in the "forward" portion after year rollover), use year2
        spanningYears.forEach(sy => {
          const useYear = month >= startMonth ? sy.year1 : sy.year2;
          if (overlayData[useYear] && overlayData[useYear][monthDay] !== undefined) {
            overlayDataPoints[sy.label].push(overlayData[useYear][monthDay]);
          } else {
            overlayDataPoints[sy.label].push(null);
          }
        });

        // Add average data points
        if (averagesData) {
          // All-time average
          overlayDataPoints['avg_allTime'].push(averagesData.allTime?.[monthDay] ?? null);
          // Decade averages
          overlayDataPoints['avg_2020s'].push(averagesData['2020s']?.[monthDay] ?? null);
          overlayDataPoints['avg_2010s'].push(averagesData['2010s']?.[monthDay] ?? null);
          overlayDataPoints['avg_2000s'].push(averagesData['2000s']?.[monthDay] ?? null);
          overlayDataPoints['avg_1990s'].push(averagesData['1990s']?.[monthDay] ?? null);
          overlayDataPoints['avg_1980s'].push(averagesData['1980s']?.[monthDay] ?? null);
        }

        // Add current data (recent actual + forecast combined)
        // Recent data takes priority, then forecast
        if (recentData && recentData[monthDay] !== undefined) {
          currentDataPoints.push({ value: recentData[monthDay], type: 'recent' });
        } else if (forecastData && forecastData[monthDay] !== undefined) {
          currentDataPoints.push({ value: forecastData[monthDay], type: 'forecast' });
        } else {
          currentDataPoints.push(null);
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
      spanningYears,
      todayIndex,
      currentDataPoints
    });
  };

  const getCaveChartData = () => {
    if (!caveData) return null;

    const { labels, minData, p25Data, p75Data, maxData, overlayDataPoints, currentDataPoints, todayIndex } = caveData;

    // Separate recent (actual) and forecast data for different line styles
    const recentValues = currentDataPoints.map(d => d && d.type === 'recent' ? d.value : null);
    const forecastValues = currentDataPoints.map(d => d && d.type === 'forecast' ? d.value : null);

    // Get overlay data - either spanning year, current, or average
    const isCurrentSelected = caveOverlayYear === 'current';
    const isAverageSelected = caveOverlayYear.startsWith('avg_');

    // Map average keys to display labels
    const avgLabels = {
      'avg_allTime': 'All-Time Avg',
      'avg_2020s': '2020s Avg',
      'avg_2010s': '2010s Avg',
      'avg_2000s': '2000s Avg',
      'avg_1990s': '1990s Avg',
      'avg_1980s': '1980s Avg',
    };

    const overlayLabel = isCurrentSelected ? 'Current' :
                         isAverageSelected ? avgLabels[caveOverlayYear] :
                         caveOverlayYear;
    const overlayValues = isCurrentSelected
      ? currentDataPoints.map(d => d ? d.value : null)
      : (overlayDataPoints[caveOverlayYear] || []);

    const datasets = [
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
      }
    ];

    if (isCurrentSelected) {
      // Solid orange line for recent actual data (up to today only)
      const recentTruncated = recentValues.map((v, i) => i <= todayIndex ? v : null);
      datasets.push({
        label: 'Current',
        data: recentTruncated,
        borderColor: '#ff6b35',
        backgroundColor: 'transparent',
        borderWidth: 3,
        fill: false,
        pointRadius: 0,
        tension: 0.3,
        order: 0
      });
      // Solid orange line for forecast data (after today)
      // Bridge from last recent point so the lines connect seamlessly
      const forecastWithBridge = [...forecastValues];
      if (todayIndex >= 0 && recentTruncated[todayIndex] != null) {
        forecastWithBridge[todayIndex] = recentTruncated[todayIndex];
      }
      datasets.push({
        label: 'Forecast',
        data: forecastWithBridge,
        borderColor: '#ff6b35',
        backgroundColor: 'transparent',
        borderWidth: 3,
        fill: false,
        pointRadius: 0,
        tension: 0.3,
        order: 0
      });
    } else if (isAverageSelected) {
      // Show average as dashed line with specific color
      const avgColors = {
        'avg_allTime': '#ffffff',  // White for all-time
        'avg_2020s': '#e74c3c',    // Red
        'avg_2010s': '#9b59b6',    // Purple
        'avg_2000s': '#3498db',    // Blue
        'avg_1990s': '#1abc9c',    // Teal
        'avg_1980s': '#f39c12',    // Orange
      };
      datasets.push({
        label: overlayLabel,
        data: overlayValues,
        borderColor: avgColors[caveOverlayYear] || '#ffffff',
        backgroundColor: 'transparent',
        borderWidth: 3,
        borderDash: [8, 4],
        fill: false,
        pointRadius: 0,
        tension: 0.3,
        order: 0
      });
    } else {
      // Show historical year as solid line - use STRI accent green
      datasets.push({
        label: overlayLabel,
        data: overlayValues,
        borderColor: '#8dc63f',  // STRI accent lime green
        backgroundColor: 'transparent',
        borderWidth: 3,
        fill: false,
        pointRadius: 0,
        tension: 0.3,
        order: 0
      });
    }

    return { labels, datasets };
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
            font: { family: "'Montserrat', sans-serif", weight: '500' },
            filter: (item) => item.text !== 'Forecast' && (item.text === `${caveOverlayYear}` || item.text === 'Current' || item.text === 'Normal Range')
          },
          onClick: () => {} // Disable legend click
        },
        tooltip: {
          titleFont: { family: "'Montserrat', sans-serif" },
          bodyFont: { family: "'Montserrat', sans-serif" },
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
                font: { size: 11, family: "'Montserrat', sans-serif" }
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
            font: { family: "'Montserrat', sans-serif" },
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
            color: '#ffffff',
            font: { family: "'Montserrat', sans-serif" }
          },
          title: {
            display: true,
            text: `${metric.name} (${metric.unit})`,
            color: '#ffffff',
            font: { family: "'Montserrat', sans-serif", weight: '500' }
          }
        }
      }
    };
  };

  const getChartOptions = () => {
    const metric = metrics.find(m => m.id === selectedMetric);

    // Build threshold annotations if in accumulated mode with threshold
    const annotations = {};
    if (accumulatedMode && chartData?.thresholdMarkers?.length > 0) {
      chartData.thresholdMarkers.forEach((marker, idx) => {
        const color = yearColors[marker.yearIndex % yearColors.length];

        if (marker.isStartMarker) {
          // Start marker (application 1) - just show the count circle at the line
          // Get the actual y value from the dataset at this point
          const datasetIndex = marker.yearIndex;
          const yValue = chartData.datasets[datasetIndex]?.data[marker.dayIndex] || 0;

          annotations[`start_marker_${idx}`] = {
            type: 'point',
            xValue: marker.dayIndex,
            yValue: yValue,
            backgroundColor: color,
            borderColor: '#fff',
            borderWidth: 3,
            radius: 10,
          };
          annotations[`start_count_${idx}`] = {
            type: 'label',
            xValue: marker.dayIndex,
            yValue: yValue,
            content: '1',
            color: color,
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderColor: color,
            borderWidth: 2,
            borderRadius: 10,
            font: { size: 12, weight: 'bold', family: "'Montserrat', sans-serif" },
            padding: { x: 7, y: 4 },
            yAdjust: -25,
          };
        } else {
          // Regular threshold marker with accumulated value
          annotations[`threshold_${idx}`] = {
            type: 'label',
            xValue: marker.dayIndex,
            yValue: marker.value,
            content: marker.value.toString(),
            color: '#fff',
            backgroundColor: color,
            borderColor: '#fff',
            borderWidth: 2,
            borderRadius: 4,
            font: { size: 10, weight: 'bold', family: "'Montserrat', sans-serif" },
            padding: { x: 6, y: 4 },
          };
          // Count number above the marker
          annotations[`threshold_count_${idx}`] = {
            type: 'label',
            xValue: marker.dayIndex,
            yValue: marker.value,
            content: marker.count.toString(),
            color: color,
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderColor: color,
            borderWidth: 2,
            borderRadius: 10,
            font: { size: 11, weight: 'bold', family: "'Montserrat', sans-serif" },
            padding: { x: 6, y: 3 },
            yAdjust: -28,
          };
          // Days since last marker (below the value box)
          if (marker.daysSinceLast !== undefined) {
            annotations[`threshold_days_${idx}`] = {
              type: 'label',
              xValue: marker.dayIndex,
              yValue: marker.value,
              content: `${marker.daysSinceLast}d`,
              color: '#666',
              backgroundColor: 'rgba(255,255,255,0.85)',
              borderRadius: 3,
              font: { size: 9, weight: '500', family: "'Montserrat', sans-serif" },
              padding: { x: 4, y: 2 },
              yAdjust: 22,
            };
          }
        }
      });
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: "'Montserrat', sans-serif", weight: '500' },
            generateLabels: (chart) => {
              return chart.data.datasets.map((dataset, index) => {
                const year = dataset.yearNum || parseInt(dataset.label);
                const isGrayed = grayedYears.has(year);
                return {
                  text: dataset.label,
                  fillStyle: isGrayed ? 'rgba(200, 200, 200, 0.3)' : yearColors[index % yearColors.length],
                  strokeStyle: isGrayed ? 'rgba(200, 200, 200, 0.3)' : yearColors[index % yearColors.length],
                  lineWidth: 2,
                  hidden: false,
                  index: index,
                  yearNum: year
                };
              });
            }
          },
          onClick: (e, legendItem, legend) => {
            const year = legendItem.yearNum || parseInt(legendItem.text);
            const newGrayedYears = new Set(grayedYears);
            if (newGrayedYears.has(year)) {
              newGrayedYears.delete(year);
            } else {
              newGrayedYears.add(year);
            }
            setGrayedYears(newGrayedYears);

            const chart = legend.chart;
            chart.data.datasets.forEach((dataset, index) => {
              const datasetYear = dataset.yearNum || parseInt(dataset.label);
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
          titleFont: { family: "'Montserrat', sans-serif" },
          bodyFont: { family: "'Montserrat', sans-serif" },
          callbacks: {
            label: (context) => {
              const suffix = accumulatedMode ? ' (accumulated)' : '';
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ${metric.unit}${suffix}`;
            }
          }
        },
        annotation: {
          annotations
        }
      },
      scales: {
        x: {
          ticks: {
            font: { family: "'Montserrat', sans-serif" }
          }
        },
        y: {
          beginAtZero: selectedMetric === 'precipitation_sum',
          ticks: {
            font: { family: "'Montserrat', sans-serif" }
          },
          title: {
            display: true,
            text: accumulatedMode ? `Accumulated ${metric.unit}` : metric.unit,
            font: { family: "'Montserrat', sans-serif", weight: '500' }
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
    a.download = `${currentLocation.name.toLowerCase()}_${selectedMetric}_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Ternary graph helpers
  const dayIndexToMonth = (index) => {
    const daysInMonths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let remaining = index;
    for (let m = 0; m < 12; m++) {
      if (remaining < daysInMonths[m]) return m;
      remaining -= daysInMonths[m];
    }
    return 11;
  };

  const dayIndexToMonthDay = (index) => {
    const daysInMonths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let remaining = index;
    for (let m = 0; m < 12; m++) {
      if (remaining < daysInMonths[m]) {
        return `${String(m + 1).padStart(2, '0')}-${String(remaining + 1).padStart(2, '0')}`;
      }
      remaining -= daysInMonths[m];
    }
    return '12-31';
  };

  const dayIndexToLabel = (index) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const daysInMonths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let remaining = index;
    for (let m = 0; m < 12; m++) {
      if (remaining < daysInMonths[m]) return `${monthNames[m]} ${remaining + 1}`;
      remaining -= daysInMonths[m];
    }
    return 'Dec 31';
  };

  const generateTernaryGraph = async () => {
    setTernaryLoading(true);
    try {
      const response = await fetch('/api/ternary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: currentLocation.lat, lon: currentLocation.lon })
      });
      const result = await response.json();
      if (result.success) {
        setTernaryData(result);
      } else {
        alert('Error fetching ternary data: ' + result.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setTernaryLoading(false);
    }
  };

  useEffect(() => {
    if (!ternaryPlaying) return;
    const interval = setInterval(() => {
      setTernaryDayIndex(prev => {
        if (prev >= 365) {
          setTernaryPlaying(false);
          return 365;
        }
        return prev + 1;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [ternaryPlaying]);

  // 3D scatter plot rendering via Plotly
  useEffect(() => {
    if (!scatter3dRef.current || !ternaryData) return;
    const { perDay, extremes, tenYearAvg } = ternaryData;

    import('plotly.js-gl3d-dist-min').then(Plotly => {
      const PlotlyLib = Plotly.default || Plotly;

      // Build all 365 days for selected year (filtered by visible months)
      const allTemp = [], allEt = [], allDli = [], allText = [], allColors = [], allDayIndices = [];
      for (let i = 0; i <= 365; i++) {
        if (!visibleMonths.has(dayIndexToMonth(i))) continue;
        const md = dayIndexToMonthDay(i);
        const dd = perDay[md];
        if (!dd) continue;
        const tv = dd.temperature.find(v => v.year === ternarySelectedYear)?.value;
        const ev = dd.et.find(v => v.year === ternarySelectedYear)?.value;
        const dv = dd.dli.find(v => v.year === ternarySelectedYear)?.value;
        if (tv == null || ev == null || dv == null) continue;
        allTemp.push(tv);
        allEt.push(ev);
        allDli.push(dv);
        allText.push(dayIndexToLabel(i));
        allColors.push(i);
        allDayIndices.push(i);
      }

      // Build 10-year average (filtered by visible months)
      const avgTemp = [], avgEt = [], avgDli = [], avgText = [];
      for (let i = 0; i <= 365; i++) {
        if (!visibleMonths.has(dayIndexToMonth(i))) continue;
        const md = dayIndexToMonthDay(i);
        const avg = tenYearAvg[md];
        if (!avg || avg.temperature == null || avg.et == null || avg.dli == null) continue;
        avgTemp.push(avg.temperature);
        avgEt.push(avg.et);
        avgDli.push(avg.dli);
        avgText.push(dayIndexToLabel(i));
      }

      // Current day data
      const monthDay = dayIndexToMonthDay(ternaryDayIndex);
      const dayData = perDay[monthDay];
      const yearTemp = dayData?.temperature.find(v => v.year === ternarySelectedYear)?.value;
      const yearEt = dayData?.et.find(v => v.year === ternarySelectedYear)?.value;
      const yearDli = dayData?.dli.find(v => v.year === ternarySelectedYear)?.value;
      const hasYear = yearTemp != null && yearEt != null && yearDli != null;

      const avgEntry = tenYearAvg[monthDay];
      const hasAvg = avgEntry && avgEntry.temperature != null && avgEntry.et != null && avgEntry.dli != null;

      const traces = [];

      // Trace 1: All days of selected year
      traces.push({
        type: 'scatter3d',
        mode: 'markers',
        x: allTemp, y: allEt, z: allDli,
        text: allText,
        marker: {
          size: 3,
          color: allColors,
          colorscale: [[0, '#6b3fa0'], [0.25, '#4fc3f7'], [0.5, '#66bb6a'], [0.75, '#ff9800'], [1, '#e91e63']],
          opacity: 0.6
        },
        hovertemplate: '%{text}<br>Temp: %{x:.1f}\u00B0C<br>ET: %{y:.2f}mm<br>DLI: %{z:.1f}<extra></extra>',
        name: ternarySelectedYear + ' (all days)',
        showlegend: true
      });

      // Trace 2: 10-year average trajectory (dots or line, toggled by user)
      if (showAverage) {
        if (avgAsLine) {
          traces.push({
            type: 'scatter3d',
            mode: 'lines',
            x: avgTemp, y: avgEt, z: avgDli,
            text: avgText,
            line: { color: 'rgba(255,255,255,0.5)', width: 3 },
            hovertemplate: '%{text}<br>Avg Temp: %{x:.1f}\u00B0C<br>Avg ET: %{y:.2f}mm<br>Avg DLI: %{z:.1f}<extra></extra>',
            name: '10-Year Avg (line)',
            showlegend: true
          });
        } else {
          traces.push({
            type: 'scatter3d',
            mode: 'markers',
            x: avgTemp, y: avgEt, z: avgDli,
            text: avgText,
            marker: { size: 2, color: 'rgba(255,255,255,0.25)' },
            hovertemplate: '%{text}<br>Avg Temp: %{x:.1f}\u00B0C<br>Avg ET: %{y:.2f}mm<br>Avg DLI: %{z:.1f}<extra></extra>',
            name: '10-Year Avg',
            showlegend: true
          });
        }
      }

      // Trace 3: Highlighted current day
      if (hasYear) {
        traces.push({
          type: 'scatter3d',
          mode: 'markers',
          x: [yearTemp], y: [yearEt], z: [yearDli],
          text: [dayIndexToLabel(ternaryDayIndex)],
          marker: { size: 10, color: '#e91e63', line: { color: 'white', width: 2 } },
          hovertemplate: '%{text}<br>Temp: %{x:.1f}\u00B0C<br>ET: %{y:.2f}mm<br>DLI: %{z:.1f}<extra></extra>',
          name: dayIndexToLabel(ternaryDayIndex) + ' ' + ternarySelectedYear,
          showlegend: true
        });
      }

      // Trace 4: Highlighted average for same day
      if (showAverage && hasAvg) {
        traces.push({
          type: 'scatter3d',
          mode: 'markers',
          x: [avgEntry.temperature], y: [avgEntry.et], z: [avgEntry.dli],
          marker: { size: 8, color: 'rgba(255,255,255,0.3)', symbol: 'diamond', line: { color: 'white', width: 2 } },
          hovertemplate: dayIndexToLabel(ternaryDayIndex) + ' Avg<br>Temp: %{x:.1f}\u00B0C<br>ET: %{y:.2f}mm<br>DLI: %{z:.1f}<extra></extra>',
          name: dayIndexToLabel(ternaryDayIndex) + ' Avg',
          showlegend: true
        });
      }

      // Trace 5: Connecting line between current year and average
      if (showAverage && hasYear && hasAvg) {
        traces.push({
          type: 'scatter3d',
          mode: 'lines',
          x: [yearTemp, avgEntry.temperature], y: [yearEt, avgEntry.et], z: [yearDli, avgEntry.dli],
          line: { color: 'rgba(255,255,255,0.4)', width: 3, dash: 'dash' },
          showlegend: false, hoverinfo: 'skip'
        });
      }

      const layout = {
        scene: {
          xaxis: {
            title: { text: 'Temperature (\u00B0C)', font: { color: '#ff9800', family: 'Montserrat', size: 12 } },
            range: [extremes.temperature.min, extremes.temperature.max],
            gridcolor: 'rgba(255,152,0,0.15)', color: 'rgba(255,152,0,0.6)',
            backgroundcolor: 'rgba(0,0,0,0)'
          },
          yaxis: {
            title: { text: 'ET (mm)', font: { color: '#66bb6a', family: 'Montserrat', size: 12 } },
            range: [extremes.et.min, extremes.et.max],
            gridcolor: 'rgba(102,187,106,0.15)', color: 'rgba(102,187,106,0.6)',
            backgroundcolor: 'rgba(0,0,0,0)'
          },
          zaxis: {
            title: { text: 'DLI (mol/m\u00B2/day)', font: { color: '#4fc3f7', family: 'Montserrat', size: 12 } },
            range: [extremes.dli.min, extremes.dli.max],
            gridcolor: 'rgba(79,195,247,0.15)', color: 'rgba(79,195,247,0.6)',
            backgroundcolor: 'rgba(0,0,0,0)'
          },
          bgcolor: 'rgba(0,0,0,0)',
          dragmode: 'orbit'
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Montserrat, sans-serif', color: 'white' },
        legend: { x: 0, y: -0.05, orientation: 'h', font: { color: 'white', size: 11 }, bgcolor: 'rgba(0,0,0,0)' },
        margin: { l: 0, r: 0, t: 0, b: 0 },
        autosize: true
      };

      const config = { responsive: true, displayModeBar: false };

      // Restore saved camera position if we have one
      if (cameraRef.current) {
        layout.scene.camera = cameraRef.current;
      }

      if (plotlyInitRef.current) {
        PlotlyLib.react(scatter3dRef.current, traces, layout, config);
      } else {
        PlotlyLib.newPlot(scatter3dRef.current, traces, layout, config);
        plotlyInitRef.current = true;
      }

      // Save camera whenever the user rotates/zooms
      scatter3dRef.current.removeAllListeners('plotly_relayout');
      scatter3dRef.current.on('plotly_relayout', (relayoutData) => {
        if (relayoutData['scene.camera']) {
          cameraRef.current = relayoutData['scene.camera'];
        } else if (relayoutData['scene.camera.eye'] || relayoutData['scene.camera.center'] || relayoutData['scene.camera.up']) {
          cameraRef.current = {
            ...(cameraRef.current || {}),
            ...(relayoutData['scene.camera.eye'] && { eye: relayoutData['scene.camera.eye'] }),
            ...(relayoutData['scene.camera.center'] && { center: relayoutData['scene.camera.center'] }),
            ...(relayoutData['scene.camera.up'] && { up: relayoutData['scene.camera.up'] }),
          };
        }
      });

      // Click handler: clicking a point in the "all days" trace selects that day
      scatter3dRef.current.removeAllListeners('plotly_click');
      scatter3dRef.current.on('plotly_click', (data) => {
        if (data.points && data.points.length > 0) {
          const pt = data.points[0];
          if (pt.curveNumber === 0 && pt.pointNumber != null) {
            const dayIdx = allDayIndices[pt.pointNumber];
            if (dayIdx != null) {
              setTernaryPlaying(false);
              setTernaryDayIndex(dayIdx);
            }
          }
        }
      });
    });

    return () => {
      if (scatter3dRef.current && plotlyInitRef.current) {
        import('plotly.js-gl3d-dist-min').then(Plotly => {
          const PlotlyLib = Plotly.default || Plotly;
          if (scatter3dRef.current) PlotlyLib.purge(scatter3dRef.current);
          plotlyInitRef.current = false;
        });
      }
    };
  }, [ternaryData, ternaryDayIndex, ternarySelectedYear, showAverage, avgAsLine, visibleMonths]);

  const renderTernaryChart = () => {
    if (!ternaryData) return null;
    return (
      <div ref={scatter3dRef} style={{ width: '100%', height: '550px' }} />
    );
  };

  const renderTernaryDataPanel = () => {
    if (!ternaryData) return null;
    const { perDay, extremes, tenYearAvg } = ternaryData;
    const monthDay = dayIndexToMonthDay(ternaryDayIndex);
    const dayData = perDay[monthDay];
    const avgEntry = tenYearAvg[monthDay];
    if (!dayData) return null;

    const yearTemp = dayData.temperature.find(v => v.year === ternarySelectedYear)?.value;
    const yearEt = dayData.et.find(v => v.year === ternarySelectedYear)?.value;
    const yearDli = dayData.dli.find(v => v.year === ternarySelectedYear)?.value;

    const rows = [
      { label: 'Temperature', color: '#ff9800', value: yearTemp, avgValue: avgEntry?.temperature, unit: '\u00B0C', min: extremes.temperature.min, max: extremes.temperature.max },
      { label: 'ET\u2080', color: '#66bb6a', value: yearEt, avgValue: avgEntry?.et, unit: 'mm', min: extremes.et.min, max: extremes.et.max },
      { label: 'DLI', color: '#4fc3f7', value: yearDli, avgValue: avgEntry?.dli, unit: 'mol/m\u00B2/day', min: extremes.dli.min, max: extremes.dli.max }
    ];

    return (
      <div style={{ fontSize: '13px', color: 'white' }}>
        <h4 style={{ marginBottom: '15px', fontSize: '16px', fontWeight: '600', color: '#e91e63' }}>
          {dayIndexToLabel(ternaryDayIndex)}
        </h4>
        {rows.map(row => {
          const diff = (row.value != null && row.avgValue != null) ? row.value - row.avgValue : null;
          const diffPct = (diff != null && row.avgValue !== 0) ? (diff / row.avgValue) * 100 : null;
          const diffColor = diff != null ? (diff > 0 ? '#ff9800' : diff < 0 ? '#4fc3f7' : '#aaa') : '#aaa';
          return (
            <div key={row.label} style={{ marginBottom: '15px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <div style={{ fontWeight: '600', marginBottom: '6px', color: row.color }}>{row.label}</div>
              <div style={{ marginBottom: '3px' }}>
                {ternarySelectedYear}: {row.value != null ? row.value.toFixed(1) : 'N/A'} {row.unit}
              </div>
              <div style={{ color: '#aaa', marginBottom: '3px' }}>
                10yr Avg: {row.avgValue != null ? row.avgValue.toFixed(1) : 'N/A'} {row.unit}
              </div>
              {diff != null && (
                <div style={{ color: diffColor, fontWeight: '600', fontSize: '12px' }}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(1)} {row.unit} vs avg
                  {diffPct != null && <span style={{ color: '#888', fontWeight: '400', marginLeft: '6px' }}>
                    ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(0)}%)
                  </span>}
                </div>
              )}
              <div style={{ color: '#666', fontSize: '11px', marginTop: '4px' }}>
                Range: {row.min.toFixed(1)} – {row.max.toFixed(1)} {row.unit}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const ChartComponent = chartType === 'line' ? Line : Bar;

  // STRI brand colors
  const striBrand = {
    primary: '#006838',      // STRI green
    secondary: '#00a651',    // Lighter green
    accent: '#8dc63f',       // Lime accent
    dark: '#004d2a',         // Dark green
    gradient: 'linear-gradient(135deg, #006838 0%, #00a651 100%)'
  };

  return (
    <div style={{ minHeight: '100vh', background: striBrand.gradient, padding: '20px', fontFamily: "'Montserrat', sans-serif" }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ background: striBrand.gradient, color: 'white', padding: '30px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Logo */}
            <img
              src="/STRIlogo.png"
              alt="STRI Logo"
              style={{
                height: '180px',
                opacity: 0.95
              }}
            />

            {/* Title */}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <h1 style={{ fontSize: '2.5em', marginBottom: '10px', fontFamily: "'Montserrat', sans-serif", fontWeight: '700' }}>STRI WeatherWatch</h1>
              <p style={{ fontFamily: "'Montserrat', sans-serif" }}>Visualize daily weather patterns across months and years</p>
              <p style={{ fontSize: '0.9em', marginTop: '10px', fontFamily: "'Montserrat', sans-serif" }}>
                Current: {currentLocation.name}, {currentLocation.region} | {currentLocation.lat.toFixed(4)}°N, {Math.abs(currentLocation.lon).toFixed(4)}°W
              </p>
            </div>

            {/* UK Map Location Selector */}
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '10px'
            }}>
              <p style={{ fontSize: '0.8em', marginBottom: '8px', textAlign: 'center', fontWeight: '600' }}>Select Location</p>
              <div style={{ position: 'relative', width: '180px', height: '220px' }}>
                <img
                  src="/UK_map.png"
                  alt="UK Map"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    opacity: 0.9
                  }}
                />
                {/* Bingley button - positioned on Yorkshire */}
                <button
                  onClick={() => setSelectedLocation('bingley')}
                  style={{
                    position: 'absolute',
                    top: '64.2%',
                    left: '68.6%',
                    transform: 'translate(-50%, -50%)',
                    width: selectedLocation === 'bingley' ? '28px' : '22px',
                    height: selectedLocation === 'bingley' ? '28px' : '22px',
                    borderRadius: '50%',
                    background: selectedLocation === 'bingley' ? striBrand.accent : 'rgba(255,255,255,0.85)',
                    border: selectedLocation === 'bingley' ? '3px solid #fff' : '2px solid ' + striBrand.primary,
                    cursor: 'pointer',
                    boxShadow: selectedLocation === 'bingley' ? '0 0 12px rgba(141,198,63,0.8)' : '0 2px 6px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s ease'
                  }}
                  title="Bingley, West Yorkshire"
                />
                <span style={{
                  position: 'absolute',
                  top: '52%',
                  left: '68.6%',
                  transform: 'translateX(-50%)',
                  fontSize: '10px',
                  fontWeight: selectedLocation === 'bingley' ? '700' : '500',
                  color: selectedLocation === 'bingley' ? '#fff' : striBrand.dark,
                  textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                  pointerEvents: 'none'
                }}>Bingley</span>

                {/* Winchester button - positioned on Hampshire */}
                <button
                  onClick={() => setSelectedLocation('winchester')}
                  style={{
                    position: 'absolute',
                    top: '80.5%',
                    left: '70.8%',
                    transform: 'translate(-50%, -50%)',
                    width: selectedLocation === 'winchester' ? '28px' : '22px',
                    height: selectedLocation === 'winchester' ? '28px' : '22px',
                    borderRadius: '50%',
                    background: selectedLocation === 'winchester' ? striBrand.accent : 'rgba(255,255,255,0.85)',
                    border: selectedLocation === 'winchester' ? '3px solid #fff' : '2px solid ' + striBrand.primary,
                    cursor: 'pointer',
                    boxShadow: selectedLocation === 'winchester' ? '0 0 12px rgba(141,198,63,0.8)' : '0 2px 6px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s ease'
                  }}
                  title="Winchester, Hampshire"
                />
                <span style={{
                  position: 'absolute',
                  top: '87.5%',
                  left: '70.8%',
                  transform: 'translateX(-50%)',
                  fontSize: '10px',
                  fontWeight: selectedLocation === 'winchester' ? '700' : '500',
                  color: selectedLocation === 'winchester' ? '#fff' : striBrand.dark,
                  textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                  pointerEvents: 'none'
                }}>Winchester</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mode Toggle */}
        <div style={{ padding: '20px 30px', background: '#f0f0f0', borderBottom: '2px solid #e0e0e0', fontFamily: "'Montserrat', sans-serif" }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setActiveTab('standard')}
              style={{
                padding: '12px 24px',
                background: activeTab === 'standard' ? striBrand.gradient : 'white',
                color: activeTab === 'standard' ? 'white' : '#333',
                border: `2px solid ${striBrand.primary}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '15px',
                fontFamily: "'Montserrat', sans-serif"
              }}
            >
              Standard Chart
            </button>
            <button
              onClick={() => setActiveTab('cave')}
              style={{
                padding: '12px 24px',
                background: activeTab === 'cave' ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'white',
                color: activeTab === 'cave' ? 'white' : '#333',
                border: '2px solid #1a1a2e',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '15px',
                fontFamily: "'Montserrat', sans-serif"
              }}
            >
              Cave Graph (Climate Envelope)
            </button>
            <button
              onClick={() => setActiveTab('ternary')}
              style={{
                padding: '12px 24px',
                background: activeTab === 'ternary' ? 'linear-gradient(135deg, #6b3fa0 0%, #e91e63 100%)' : 'white',
                color: activeTab === 'ternary' ? 'white' : '#333',
                border: '2px solid #6b3fa0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '15px',
                fontFamily: "'Montserrat', sans-serif"
              }}
            >
              3D Scatter
            </button>
          </div>
        </div>

        {/* Controls */}
        <div style={{ padding: '30px', background: '#f8f9fa', borderBottom: '2px solid #e9ecef', fontFamily: "'Montserrat', sans-serif" }}>

          {activeTab === 'standard' && (
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
                  <button onClick={selectAllYears} style={{ padding: '8px 16px', background: striBrand.secondary, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", fontWeight: '500' }}>
                    Select All Years
                  </button>
                  <button onClick={clearAllYears} style={{ padding: '8px 16px', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", fontWeight: '500' }}>
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
                        background: selectedYears.includes(year) ? striBrand.gradient : 'white',
                        color: selectedYears.includes(year) ? 'white' : 'black',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontFamily: "'Montserrat', sans-serif",
                        fontWeight: '500'
                      }}
                    >
                      {year}
                    </button>
                  ))}
                </div>

                {/* Averages Section */}
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#2d3748', fontSize: '0.9em' }}>
                    Include Averages:
                  </label>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '6px 12px', background: showAllTimeAvg ? '#e8f5e9' : '#f7f7f7', borderRadius: '6px', border: showAllTimeAvg ? `2px solid ${striBrand.secondary}` : '2px solid #e2e8f0' }}>
                      <input
                        type="checkbox"
                        checked={showAllTimeAvg}
                        onChange={(e) => setShowAllTimeAvg(e.target.checked)}
                        style={{ accentColor: striBrand.primary }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>All-Time Avg</span>
                    </label>
                    {availableDecades.map(decade => (
                      <label key={decade} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '6px 12px', background: selectedDecadeAvgs.includes(decade) ? '#e8f5e9' : '#f7f7f7', borderRadius: '6px', border: selectedDecadeAvgs.includes(decade) ? `2px solid ${striBrand.secondary}` : '2px solid #e2e8f0' }}>
                        <input
                          type="checkbox"
                          checked={selectedDecadeAvgs.includes(decade)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDecadeAvgs([...selectedDecadeAvgs, decade]);
                            } else {
                              setSelectedDecadeAvgs(selectedDecadeAvgs.filter(d => d !== decade));
                            }
                          }}
                          style={{ accentColor: striBrand.primary }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: '500' }}>{decade}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
          {activeTab === 'cave' && (
            <>
              {/* Cave Graph Controls */}
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#2d3748' }}>
                  Overlay Selection:
                  <span style={{ marginLeft: '10px', color: '#a0aec0', fontWeight: '400', fontSize: '0.9em' }}>
                    {caveOverlayYear === 'current' ? 'Current (Recent + Forecast)' : caveOverlayYear}
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={caveOverlayYear}
                    onChange={(e) => setCaveOverlayYear(e.target.value)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '6px',
                      border: '2px solid #1a1a2e',
                      fontSize: '14px',
                      fontWeight: '600',
                      background: 'white',
                      cursor: 'pointer',
                      minWidth: '200px'
                    }}
                  >
                    <option value="current">Current (Recent + Forecast)</option>
                    <optgroup label="Averages">
                      <option value="avg_allTime">All-Time Average (1980-2025)</option>
                      <option value="avg_2020s">2020s Average</option>
                      <option value="avg_2010s">2010s Average</option>
                      <option value="avg_2000s">2000s Average</option>
                      <option value="avg_1990s">1990s Average</option>
                      <option value="avg_1980s">1980s Average</option>
                    </optgroup>
                    <optgroup label="Historical Periods">
                      {(availableOverlayYears.length > 0 ? availableOverlayYears : []).map(sy => (
                        <option key={sy.label} value={sy.label}>{sy.label}</option>
                      ))}
                    </optgroup>
                  </select>
                  <span style={{ color: '#666', fontSize: '0.9em' }}>
                    {availableOverlayYears.length > 0
                      ? `(${availableOverlayYears.length} periods available)`
                      : '(generate graph to see available periods)'}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Metrics (shared - hidden for ternary which uses all three) */}
          {activeTab !== 'ternary' && <div style={{ marginBottom: '25px' }}>
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
                    background: selectedMetric === metric.id ? striBrand.gradient : 'white',
                    color: selectedMetric === metric.id ? 'white' : 'black',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontFamily: "'Montserrat', sans-serif",
                    fontWeight: '500'
                  }}
                >
                  {metric.name}
                </button>
              ))}
            </div>
          </div>}

          {/* 3D Scatter Controls */}
          {activeTab === 'ternary' && (
            <div style={{ marginBottom: '25px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#2d3748' }}>
                  Select Year to Display:
                </label>
                <select
                  value={ternarySelectedYear}
                  onChange={(e) => setTernarySelectedYear(parseInt(e.target.value))}
                  style={{
                    padding: '10px 16px', borderRadius: '6px',
                    border: '2px solid #6b3fa0', fontSize: '14px',
                    fontWeight: '600', background: 'white', cursor: 'pointer'
                  }}
                >
                  {Array.from({ length: 46 }, (_, i) => 2025 - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {ternaryData && (
                <div>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '10px', color: '#2d3748' }}>
                    Date: <span style={{ color: '#6b3fa0', fontSize: '1.1em' }}>
                      {dayIndexToLabel(ternaryDayIndex)}
                    </span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button
                      onClick={() => setTernaryPlaying(!ternaryPlaying)}
                      style={{
                        padding: '8px 16px', borderRadius: '6px',
                        background: ternaryPlaying ? '#e53e3e' : 'linear-gradient(135deg, #6b3fa0 0%, #e91e63 100%)',
                        color: 'white', border: 'none', cursor: 'pointer',
                        fontWeight: '600', fontFamily: "'Montserrat', sans-serif", fontSize: '14px'
                      }}
                    >
                      {ternaryPlaying ? 'Pause' : 'Play'}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={365}
                      value={ternaryDayIndex}
                      onChange={(e) => {
                        setTernaryPlaying(false);
                        setTernaryDayIndex(parseInt(e.target.value));
                      }}
                      style={{ flex: 1, accentColor: '#6b3fa0' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button
                      onClick={() => setShowAverage(!showAverage)}
                      style={{
                        padding: '8px 16px', borderRadius: '6px',
                        background: showAverage ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.05)',
                        color: showAverage ? '#6b3fa0' : '#999',
                        border: showAverage ? '2px solid #6b3fa0' : '2px solid #ccc',
                        cursor: 'pointer', fontWeight: '600',
                        fontFamily: "'Montserrat', sans-serif", fontSize: '13px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {showAverage ? '10yr Avg: ON' : '10yr Avg: OFF'}
                    </button>
                    <button
                      onClick={() => setAvgAsLine(!avgAsLine)}
                      disabled={!showAverage}
                      style={{
                        padding: '8px 16px', borderRadius: '6px',
                        background: avgAsLine ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.05)',
                        color: !showAverage ? '#ccc' : avgAsLine ? '#6b3fa0' : '#999',
                        border: !showAverage ? '2px solid #eee' : avgAsLine ? '2px solid #6b3fa0' : '2px solid #ccc',
                        cursor: showAverage ? 'pointer' : 'not-allowed',
                        fontWeight: '600', fontFamily: "'Montserrat', sans-serif", fontSize: '13px',
                        transition: 'all 0.2s', opacity: showAverage ? 1 : 0.5
                      }}
                    >
                      {avgAsLine ? 'Avg: Line' : 'Avg: Dots'}
                    </button>
                  </div>
                  <div style={{ marginTop: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <label style={{ fontWeight: '600', fontSize: '13px', color: '#2d3748' }}>Months:</label>
                      <button
                        onClick={() => setVisibleMonths(new Set([0,1,2,3,4,5,6,7,8,9,10,11]))}
                        style={{
                          padding: '3px 10px', borderRadius: '4px', fontSize: '11px',
                          background: visibleMonths.size === 12 ? '#6b3fa0' : 'rgba(0,0,0,0.05)',
                          color: visibleMonths.size === 12 ? 'white' : '#666',
                          border: '1px solid #ccc', cursor: 'pointer', fontWeight: '600',
                          fontFamily: "'Montserrat', sans-serif"
                        }}
                      >All</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((name, idx) => {
                        const active = visibleMonths.has(idx);
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              const next = new Set(visibleMonths);
                              if (active) { next.delete(idx); } else { next.add(idx); }
                              if (next.size > 0) setVisibleMonths(next);
                            }}
                            style={{
                              padding: '4px 8px', borderRadius: '4px', fontSize: '11px',
                              background: active ? '#6b3fa0' : 'rgba(0,0,0,0.05)',
                              color: active ? 'white' : '#999',
                              border: active ? '1.5px solid #6b3fa0' : '1.5px solid #ddd',
                              cursor: 'pointer', fontWeight: '600',
                              fontFamily: "'Montserrat', sans-serif",
                              transition: 'all 0.15s', minWidth: '38px'
                            }}
                          >{name}</button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Accumulated Options (Standard Chart only) */}
          {activeTab === 'standard' && (
            <div style={{ marginBottom: '25px', padding: '15px', background: '#f0f7f0', borderRadius: '8px', border: `1px solid ${striBrand.secondary}` }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: accumulatedMode ? '15px' : '0' }}>
                <input
                  type="checkbox"
                  checked={accumulatedMode}
                  onChange={(e) => setAccumulatedMode(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: striBrand.primary }}
                />
                <span style={{ fontWeight: '600', color: '#2d3748' }}>Accumulated Mode</span>
                <span style={{ fontSize: '0.85em', color: '#666' }}>- shows running total over time</span>
              </label>

              {accumulatedMode && (
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontWeight: '500', fontSize: '14px' }}>Mark every:</label>
                    <input
                      type="number"
                      value={thresholdAmount}
                      onChange={(e) => setThresholdAmount(e.target.value)}
                      placeholder="e.g. 200"
                      style={{
                        width: '80px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: `2px solid ${striBrand.primary}`,
                        fontSize: '14px'
                      }}
                    />
                    <span style={{ fontSize: '14px', color: '#666' }}>
                      {metrics.find(m => m.id === selectedMetric)?.unit}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={useAccStartDate}
                        onChange={(e) => setUseAccStartDate(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: striBrand.primary }}
                      />
                      <span style={{ fontWeight: '500', fontSize: '14px' }}>Start accumulation from:</span>
                    </label>
                    {useAccStartDate && (
                      <>
                        <select
                          value={accStartDate.month}
                          onChange={(e) => {
                            const newMonth = parseInt(e.target.value);
                            const maxDay = getDaysInMonth(newMonth);
                            setAccStartDate({ month: newMonth, day: Math.min(accStartDate.day, maxDay) });
                          }}
                          style={{ padding: '6px 10px', borderRadius: '6px', border: `2px solid ${striBrand.primary}`, fontSize: '14px' }}
                        >
                          {months.map(m => <option key={m.num} value={m.num}>{m.name}</option>)}
                        </select>
                        <select
                          value={accStartDate.day}
                          onChange={(e) => setAccStartDate({ ...accStartDate, day: parseInt(e.target.value) })}
                          style={{ padding: '6px 10px', borderRadius: '6px', border: `2px solid ${striBrand.primary}`, fontSize: '14px' }}
                        >
                          {Array.from({ length: getDaysInMonth(accStartDate.month) }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
            {activeTab === 'standard' && (
              <>
                <button
                  onClick={generateChart}
                  disabled={loading}
                  style={{
                    background: striBrand.gradient,
                    color: 'white',
                    border: 'none',
                    padding: '12px 30px',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: "'Montserrat', sans-serif"
                  }}
                >
                  {loading ? 'Loading...' : 'Generate Daily Chart'}
                </button>
                {chartData && (
                  <button
                    onClick={downloadCSV}
                    style={{
                      background: striBrand.gradient,
                      color: 'white',
                      border: 'none',
                      padding: '12px 30px',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontFamily: "'Montserrat', sans-serif"
                    }}
                  >
                    Download CSV
                  </button>
                )}
              </>
            )}
            {activeTab === 'cave' && (
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
                  cursor: caveLoading ? 'not-allowed' : 'pointer',
                  fontFamily: "'Montserrat', sans-serif"
                }}
              >
                {caveLoading ? 'Loading Historical Data...' : 'Generate Cave Graph'}
              </button>
            )}
            {activeTab === 'ternary' && (
              <button
                onClick={generateTernaryGraph}
                disabled={ternaryLoading}
                style={{
                  background: 'linear-gradient(135deg, #6b3fa0 0%, #e91e63 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 30px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: ternaryLoading ? 'not-allowed' : 'pointer',
                  fontFamily: "'Montserrat', sans-serif"
                }}
              >
                {ternaryLoading ? 'Loading All Metrics...' : 'Generate 3D Scatter'}
              </button>
            )}
          </div>
        </div>

        {/* Standard Chart Display */}
        {activeTab === 'standard' && chartData && (
          <div style={{ padding: '30px', fontFamily: "'Montserrat', sans-serif" }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => setChartType('line')}
                style={{
                  padding: '10px 20px',
                  background: chartType === 'line' ? striBrand.primary : 'white',
                  color: chartType === 'line' ? 'white' : striBrand.primary,
                  border: `2px solid ${striBrand.primary}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontFamily: "'Montserrat', sans-serif"
                }}
              >
                Line Chart
              </button>
              <button
                onClick={() => setChartType('bar')}
                style={{
                  padding: '10px 20px',
                  background: chartType === 'bar' ? striBrand.primary : 'white',
                  color: chartType === 'bar' ? 'white' : striBrand.primary,
                  border: `2px solid ${striBrand.primary}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontFamily: "'Montserrat', sans-serif"
                }}
              >
                Bar Chart
              </button>
            </div>

            <div ref={standardChartRef} style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', position: 'relative' }}>
              <button
                data-html-to-canvas-ignore="true"
                onClick={() => copyChartToClipboard(standardChartRef, 'standard')}
                title="Copy chart to clipboard"
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  zIndex: 10,
                  background: copiedChart === 'standard' ? '#4CAF50' : 'rgba(0,0,0,0.06)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: '12px',
                  fontWeight: '600',
                  color: copiedChart === 'standard' ? 'white' : '#555',
                  transition: 'all 0.2s'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                {copiedChart === 'standard' ? 'Copied!' : 'Copy'}
              </button>
              <img
                src="/STRIlogo.png"
                alt="STRI"
                style={{
                  position: 'absolute',
                  bottom: '30px',
                  right: '30px',
                  height: '160px',
                  opacity: 0.15
                }}
              />
              <h3 style={{ marginBottom: '15px', fontFamily: "'Montserrat', sans-serif" }}>
                {accumulatedMode ? 'Accumulated ' : ''}{metrics.find(m => m.id === selectedMetric)?.name} - {formatDateRange()}
                {accumulatedMode && thresholdAmount && (
                  <span style={{ fontSize: '0.8em', color: '#666', fontWeight: '400' }}> (markers every {thresholdAmount})</span>
                )}
              </h3>
              <div style={{ position: 'relative', height: '400px' }}>
                <ChartComponent data={chartData} options={getChartOptions()} />
              </div>
            </div>

            <div style={{ background: '#e8f5e9', borderLeft: `4px solid ${striBrand.secondary}`, padding: '20px', margin: '20px 0', borderRadius: '8px' }}>
              <h3 style={{ color: striBrand.dark, marginBottom: '10px', fontFamily: "'Montserrat', sans-serif" }}>Tip</h3>
              <p style={{ color: striBrand.dark, fontFamily: "'Montserrat', sans-serif" }}>
                Click any year in the legend to toggle it gray. Click again to restore its color. Toggle as many years as you like to focus on specific data.
              </p>
            </div>
          </div>
        )}

        {/* Cave Graph Display */}
        {activeTab === 'cave' && caveData && (
          <div style={{ padding: '30px', fontFamily: "'Montserrat', sans-serif" }}>
            <div ref={caveChartRef} style={{ background: '#1a1a2e', padding: '30px', borderRadius: '12px', position: 'relative' }}>
              <button
                data-html-to-canvas-ignore="true"
                onClick={() => copyChartToClipboard(caveChartRef, 'cave')}
                title="Copy chart to clipboard"
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  zIndex: 10,
                  background: copiedChart === 'cave' ? '#4CAF50' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: '12px',
                  fontWeight: '600',
                  color: copiedChart === 'cave' ? 'white' : '#aaa',
                  transition: 'all 0.2s'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                {copiedChart === 'cave' ? 'Copied!' : 'Copy'}
              </button>
              <img
                src="/STRIlogo.png"
                alt="STRI"
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  height: '160px',
                  opacity: 0.7
                }}
              />
              <h3 style={{ color: 'white', marginBottom: '20px', textAlign: 'center', fontFamily: "'Montserrat', sans-serif", fontWeight: '600' }}>
                Climate Envelope: {metrics.find(m => m.id === selectedMetric)?.name}
                <span style={{ display: 'block', fontSize: '0.8em', color: '#aaa', marginTop: '5px', fontWeight: '400' }}>
                  Historical range (1980-2025)
                  {caveOverlayYear === 'current' ? ' with current weather + forecast' : ` with ${caveOverlayYear} overlay`}
                </span>
              </h3>
              <div style={{ position: 'relative', height: '500px' }}>
                <Line data={getCaveChartData()} options={getCaveChartOptions()} />
              </div>
            </div>

            <div style={{ background: '#2d2d44', borderLeft: `4px solid ${striBrand.accent}`, padding: '20px', margin: '20px 0', borderRadius: '8px' }}>
              <h3 style={{ color: striBrand.accent, marginBottom: '10px', fontFamily: "'Montserrat', sans-serif" }}>Understanding the Cave Graph</h3>
              <ul style={{ color: '#ccc', lineHeight: '1.8', fontFamily: "'Montserrat', sans-serif" }}>
                <li><strong style={{ color: 'white' }}>White band (middle 50%):</strong> Normal range - values between 25th and 75th percentile</li>
                <li><strong style={{ color: '#888' }}>Grey bands (outer 25%):</strong> Unusual range - below 25th or above 75th percentile</li>
                {caveOverlayYear === 'current' ? (
                  <li><strong style={{ color: '#ff6b35' }}>Orange line:</strong> Recent weather (6 months) + 16-day forecast</li>
                ) : (
                  <li><strong style={{ color: striBrand.accent }}>Lime green line:</strong> {caveOverlayYear} historical data</li>
                )}
                <li><strong style={{ color: '#ff0000' }}>Red dashed line:</strong> Today's date</li>
              </ul>
            </div>
          </div>
        )}

        {/* 3D Scatter Plot Display */}
        {activeTab === 'ternary' && ternaryData && (
          <div style={{ padding: '30px', fontFamily: "'Montserrat', sans-serif" }}>
            <div ref={ternaryChartRef} style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #2d1b4e 100%)',
              padding: '30px', borderRadius: '12px', position: 'relative'
            }}>
              <button
                data-html-to-canvas-ignore="true"
                onClick={() => copyChartToClipboard(ternaryChartRef, 'ternary')}
                title="Copy chart to clipboard"
                style={{
                  position: 'absolute', top: '10px', left: '10px', zIndex: 10,
                  background: copiedChart === 'ternary' ? '#4CAF50' : 'rgba(255,255,255,0.1)',
                  border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600',
                  color: copiedChart === 'ternary' ? 'white' : '#aaa', transition: 'all 0.2s'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                {copiedChart === 'ternary' ? 'Copied!' : 'Copy'}
              </button>
              <img
                src="/STRIlogo.png"
                alt="STRI"
                style={{
                  position: 'absolute', top: '20px', right: '20px',
                  height: '160px', opacity: 0.7
                }}
              />

              <h3 style={{
                color: 'white', marginBottom: '20px', textAlign: 'center',
                fontFamily: "'Montserrat', sans-serif", fontWeight: '600'
              }}>
                3D Climate Scatter: {dayIndexToLabel(ternaryDayIndex)}
                <span style={{ display: 'block', fontSize: '0.8em', color: '#aaa', marginTop: '5px', fontWeight: '400' }}>
                  Temperature / ET / DLI — {ternarySelectedYear} vs 10-Year Average (2016–2025)
                </span>
              </h3>

              <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
                <div style={{ flex: '1 1 600px', maxWidth: '900px' }}>
                  {renderTernaryChart()}
                </div>
                <div style={{ flex: '0 0 250px' }}>
                  {renderTernaryDataPanel()}
                </div>
              </div>
            </div>

            <div style={{
              background: '#2d2d44', borderLeft: '4px solid #e91e63',
              padding: '20px', margin: '20px 0', borderRadius: '8px'
            }}>
              <h3 style={{ color: '#e91e63', marginBottom: '10px', fontFamily: "'Montserrat', sans-serif" }}>
                Using the 3D Scatter Plot
              </h3>
              <ul style={{ color: '#ccc', lineHeight: '1.8', fontFamily: "'Montserrat', sans-serif" }}>
                <li><strong style={{ color: '#ff9800' }}>X-axis:</strong> Temperature ({'\u00B0'}C) &nbsp; <strong style={{ color: '#66bb6a' }}>Y-axis:</strong> ET (mm) &nbsp; <strong style={{ color: '#4fc3f7' }}>Z-axis:</strong> DLI (mol/m{'\u00B2'}/day)</li>
                <li><strong style={{ color: 'white' }}>Drag to rotate</strong> the plot. Scroll to zoom. Right-click drag to pan.</li>
                <li><strong style={{ color: 'white' }}>Coloured points:</strong> All days of the selected year, coloured by season (purple{'\u2192'}blue{'\u2192'}green{'\u2192'}orange{'\u2192'}pink)</li>
                <li><strong style={{ color: '#e91e63' }}>Large pink circle:</strong> The currently selected date</li>
                <li><strong style={{ color: 'white' }}>White diamond:</strong> 10-year average (2016{'\u2013'}2025) for the same date</li>
                <li><strong style={{ color: 'white' }}>Dashed line:</strong> Connects current year to the average, showing deviation</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
