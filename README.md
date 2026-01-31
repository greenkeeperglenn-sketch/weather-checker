# Winchester Weather App - Vercel Deployment

Real-time Winchester weather data comparison tool with interactive charts.

## 🚀 Deploy to Vercel

### Method 1: Deploy via Vercel Dashboard (Easiest)

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/winchester-weather.git
   git push -u origin main
   ```

2. **Deploy on Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Click "Deploy"
   - Done! Your app is live

### Method 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

## 📁 Project Structure

```
vercel-weather-app/
├── pages/
│   ├── index.js          # Main app page
│   └── api/
│       └── weather.js    # API endpoint for fetching data
├── package.json          # Dependencies
├── vercel.json          # Vercel configuration
└── README.md            # This file
```

## 🌐 Features

- ✅ Real data from Open-Meteo API
- ✅ Interactive daily charts
- ✅ Multi-month, multi-year comparison
- ✅ Click legend to highlight specific years
- ✅ CSV download
- ✅ Line and bar chart views
- ✅ Responsive design

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## 📊 How to Use

1. **Select Months** - Choose one or more months (e.g., Oct, Nov, Dec)
2. **Select Years** - Pick any years from 2014-2026
3. **Select Metric** - Choose one weather variable
4. **Generate Chart** - Click to fetch real data and display
5. **Interact** - Click legend items to highlight specific years
6. **Download** - Export data as CSV

## 🔑 Environment Variables

No API keys needed! The Open-Meteo API is free and requires no authentication.

## 📝 Notes

- Data is fetched in real-time from Open-Meteo Historical Weather API
- Server-side API route prevents CORS issues
- Vercel's serverless functions handle the API calls
- Data goes back to 1940 (we show 2014-2026)

## 🆘 Troubleshooting

**Build fails:**
- Make sure all files are in the correct structure
- Check package.json has all dependencies

**API errors:**
- Open-Meteo has rate limits (fair use)
- Check that months/years are valid

**Chart not displaying:**
- Ensure you've selected months, years, and a metric
- Check browser console for errors

## 📧 Support

For issues or questions, check:
- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Open-Meteo API Docs](https://open-meteo.com/en/docs/historical-weather-api)
