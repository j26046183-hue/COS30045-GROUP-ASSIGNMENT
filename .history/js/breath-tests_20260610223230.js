/**
 * breath-test.js
 * Core interactive visualization engine for Breath Test Enforcement metrics.
 * Architecture: Line Chart (Timeline), Doughnut Chart (Geography), Radar Chart (Demographics).
 */

const breathTooltip = d3.select("body").append("div").attr("class", "tooltip");

// Color systems mapping strictly to jurisdictions
const breathStateColors = {
    "ACT": "#2563eb", "NSW": "#16a34a", "NT":  "#f59e0b",
    "QLD": "#dc2626", "SA":  "#8b5cf6", "TAS": "#0891b2",
    "VIC": "#db2777", "WA":  "#ea580c"
};

// Explicit color profile for regional divisions
const regionalColors = {
    "Major Cities": "#0284c7",
    "Inner Regional": "#0d9488",
    "Outer Regional": "#f59e0b",
    "Remote": "#e11d48",
    "Very Remote": "#475569"
};

// Global raw data storage vectors
let breathHistoricalData = [];
let breathModernData = [];

// Load your TWO CSV data files via Promise engine
Promise.all([
    d3.csv("data/breath_historical_trend.csv").catch(err => { console.error("Missing: breath_historical_trend.csv", err); return null; }),
    d3.csv("data/breath_2023_2024.csv").catch(err => { console.error("Missing: breath_2023_2024.csv", err); return null; })
]).then(function([historical, modern]) {

    // Safety Check: Verify files loaded successfully
    if (!historical || !modern) {
        console.error("Critical Stop: One or both files failed to load. Check file paths or extensions.");
        return;
    }

    // Clean data parsing routines
    historical.forEach(d => { 
        d.YEAR = +d.YEAR; 
        d.COUNT = +d.COUNT; 
    });

    modern.forEach(d => {
        d.YEAR = +d.YEAR;
        d.COUNT = +d.COUNT;
        // Parse outcome counts if they exist in your file
        if (d.FINES) d.FINES = +d.FINES;
        if (d.ARRESTS) d.ARRESTS = +d.ARRESTS;
        if (d.CHARGES) d.CHARGES = +d.CHARGES;
    });

    breathHistoricalData = historical;
    breathModernData = modern;

    // Dynamically build State dropdown list from historical records
    const states = [...new Set(historical.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#breath-state-filter");
    stateFilter.selectAll("option:not([value='all'])").remove();
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));

    // Hook filter change event listener
    d3.select("#breath-state-filter").on("change", applyBreathFilters);

    // Initial render execution
    applyBreathFilters();
}).catch(err => {
    console.error("Error executing breath-test data compilation routines:", err);
});

function applyBreathFilters() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";

    // ── 1. FILTER HISTORICAL TIMELINE STREAM ──
    let filteredHistorical = breathHistoricalData.slice();
    if (selectedState !== "all") {
        filteredHistorical = filteredHistorical.filter(d => d.STATE === selectedState);
    }

    // ── 2. FILTER MODERN GRANULAR STREAM (USED FOR REGION & RADAR DEMOGRAPHICS) ──
    let filteredModern = breathModernData.slice();
    if (selectedState !== "all") {
        filteredModern = filteredModern.filter(d => d.STATE === selectedState);
    }

    // ── 3. CALCULATE LIVE KPI INSIGHTS ──
    const totalHistoricalTests = d3.sum(filteredHistorical, d => d.COUNT);
    const totalFines = d3.sum(filteredModern, d => d.FINES || 0);
    const totalCharges = d3.sum(filteredModern, d => d.CHARGES || 0);

    // Dynamic search for top risk geography zone 
    // * Note: Change 'REGION' to match your column name if different (e.g. 'REMOTENESS')
    const regionMap = d3.rollup(filteredModern, v => d3.sum(v, d => d.COUNT), d => d.REGION);
    const topRegionObj = Array.from(regionMap, ([region, val]) => ({ region, val }))
                              .sort((a, b) => b.val - a.val)[0];

    // Update HTML layout containers dynamically
    d3.select("#breath-total-historical").text(totalHistoricalTests.toLocaleString());
    d3.select("#breath-modern-fines").text(totalFines.toLocaleString());
    d3.select("#breath-modern-charges").text(totalCharges.toLocaleString());
    d3.select("#breath-top-region").text(topRegionObj && topRegionObj.val > 0 ? topRegionObj.region : "—");

    // ── 4. RE-RENDER ALL VISUALS CLEANLY ──
    drawBreathHistorical(filteredHistorical);
    drawBreathRegionalDonut(filteredModern);
    drawBreathDemographicRadar(filteredModern);
}

// ── CHART 1: Historical Trend (Classic Continuous Line Chart) ──
function drawBreathHistorical(data) {
    d3.select("#breath-historical-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 20, right: 120, bottom: 50, left: 75 };
    const width = document.getElementById("breath-historical-chart").offsetWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#breath-historical-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const grouped = d3.group(data, d => d.STATE);
    const uniqueYears = [...new Set(data.map(d => d.YEAR))].sort((a, b) => a - b);

    const x = d3.scaleLinear().domain(d3.extent(data, d => d.YEAR)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.COUNT) * 1.1 || 100]).range([height, 0]);

    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickValues(uniqueYears).tickFormat(d3.format("d")));

    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000000) return `${(d/1000000).toFixed(1)}M`;
            if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    svg.append("text")
        .attr("transform", "rotate(-90)").attr("y", -60).attr("x", -height/2)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
        .text("Breath Tests Conducted");

    const line = d3.line().x(d => x(d.YEAR)).y(d => y(d.COUNT)).curve(d3.curveMonotoneX);

    grouped.forEach((values, state) => {
        const sorted = values.sort((a, b) => a.YEAR - b.YEAR);
        const color = breathStateColors[state] || "#94a3b8";

        svg.append("path").datum(sorted)
            .attr("fill", "none").attr("stroke", color)
            .attr("stroke-width", 2.5).attr("d", line);

        svg.selectAll(`.dot-${state}`)
            .data(sorted).enter().append("circle")
            .attr("cx", d => x(d.YEAR)).attr("cy", d => y(d.COUNT))
            .attr("r", 3.5).attr("fill", color).attr("stroke", "white").attr("stroke-width", 1.5)
            .on("mouseover", function(event, d) {
                breathTooltip.style("opacity", 1)
                    .html(`<strong>${d.STATE}</strong><br>Year: ${d.YEAR}<br>Volume: ${d.COUNT.toLocaleString()}`);
            })
            .on("mousemove", function(event) {
                breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
            })
            .on("mouseout", function() { breathTooltip.style("opacity", 0); });
    });

    const legend = svg.append("g").attr("transform", `translate(${width + 12}, 0)`);
    ([...grouped.keys()]).sort().forEach((state, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 18})`);
        row.append("line").attr("x1", 0).attr("x2", 14).attr("y1", 6).attr("y2", 6)
            .attr("stroke", breathStateColors[state] || "#94a3b8").attr("stroke-width", 2.5);
        row.append("text").attr("x", 18).attr("y", 10).attr("font-size", "11px")
            .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif").text(state);
    });
}

// ── CHART 2: Spatial Regional Distribution (Doughnut Wheel) ──
function drawBreathRegionalDonut(data) {
    d3.select("#breath-donut-chart").selectAll("*").remove();

    const container = document.getElementById("breath-donut-chart");
    if (!container) return;

    const width = container.offsetWidth;
    const height = 320;
    const margin = { top: 20, right: 20, bottom: 65, left: 20 };
    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;

    const svg = d3.select("#breath-donut-chart").append("svg").attr("width", width).attr("height", height);
    const chartG = svg.append("g").attr("transform", `translate(${width / 2}, ${radius + margin.top})`);

    // Grouping structure match
    const regions = ["Major Cities", "Inner Regional", "Outer Regional", "Remote", "Very Remote"];
    const totals = regions.map(region => ({
        region,
        value: d3.sum(data, d => d.REGION === region ? d.COUNT : 0) // Change 'REGION' if column has a different name
    }));

    const totalVolume = d3.sum(totals, d => d.value);

    if (totalVolume === 0) {
        chartG.append("text").attr("text-anchor", "middle")
            .attr("font-size", "13px").attr("fill", "#94a3b8")
            .attr("font-family", "DM Sans, sans-serif").text("No Spatial Data Reported");
        return;
    }

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.60).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(radius * 0.60).outerRadius(radius * 1.05);

    chartG.selectAll(".arc")
        .data(pie(totals.filter(d => d.value > 0))).enter().append("path")
        .attr("class", "arc").attr("d", arc)
        .attr("fill", d => regionalColors[d.data.region] || "#cbd5e1")
        .attr("stroke", "white").attr("stroke-width", 2.5)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("d", arcHover);
            const percentage = ((d.data.value / totalVolume) * 100).toFixed(1);
            breathTooltip.style("opacity", 1)
                .html(`<strong>${d.data.region}</strong><br>Tests: ${d.data.value.toLocaleString()}<br>Share: ${percentage}%`);
        })
        .on("mousemove", function(event) {
            breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("d", arc);
            breathTooltip.style("opacity", 0);
        });

    chartG.append("text").attr("text-anchor", "middle").attr("dy", "-0.2em")
        .attr("font-size", "20px").attr("font-weight", "700")
        .attr("font-family", "Syne, sans-serif").attr("fill", "#0f172a")
        .text(totalVolume >= 1000000 ? `${(totalVolume/1000000).toFixed(2)}M` : totalVolume.toLocaleString());
        
    chartG.append("text").attr("text-anchor", "middle").attr("dy", "1.3em")
        .attr("font-size", "10px").attr("font-weight", "500")
        .attr("font-family", "DM Sans, sans-serif").attr("fill", "#94a3b8")
        .text("Modern Incidents");

    const legendG = svg.append("g").attr("class", "donut-legend");
    let currentX = 0, currentY = 0;
    const spacingX = 130, spacingY = 18;

    totals.forEach((d, i) => {
        const itemG = legendG.append("g").attr("transform", `translate(${currentX}, ${currentY})`);
        itemG.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", regionalColors[d.region]);
        itemG.append("text").attr("x", 15).attr("y", 9).attr("font-size", "11px")
             .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif").text(d.region);

        if (i % 2 === 0) { currentX += spacingX; } 
        else { currentX = 0; currentY += spacingY; }
    });

    const bounds = legendG.node().getBBox();
    legendG.attr("transform", `translate(${(width - bounds.width) / 2}, ${(radius * 2) + margin.top + 20})`);
}

// ── CHART 3: Cohort Demographics Profiling (Radar Web Chart) ──
function drawBreathDemographicRadar(data) {
    d3.select("#breath-radar-chart").selectAll("*").remove();

    const container = document.getElementById("breath-radar-chart");
    if (!container) return;

    const width = container.offsetWidth;
    const height = 320;
    const margin = { top: 40, right: 50, bottom: 40, left: 50 };
    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;

    const svg = d3.select("#breath-radar-chart").append("svg").attr("width", width).attr("height", height)
                  .append("g").attr("transform", `translate(${width / 2}, ${height / 2})`);

    const ageBuckets = ["0-16", "17-25", "26-39", "40-64", "65 and over"];
    
    // Aggregate values
    // * Note: Change 'AGE_GROUP' if your file uses a different column name (like 'AGE')
    const demoMap = d3.rollup(data, v => d3.sum(v, d => d.COUNT), d => d.AGE_GROUP);
    const maxVal = d3.max(ageBuckets, age => demoMap.get(age) || 0) || 100;

    const rScale = d3.scaleLinear().domain([0, maxVal]).range([0, radius]);
    const angleSlice = (Math.PI * 2) / ageBuckets.length;

    // Web Grid Levels
    const levels = 4;
    for (let level = 0; level < levels; level++) {
        const r = radius * ((level + 1) / levels);
        const gridPoints = ageBuckets.map((_, i) => ({
            x: r * Math.sin(angleSlice * i),
            y: -r * Math.cos(angleSlice * i)
        }));

        svg.append("polygon").datum(gridPoints).attr("points", d => d.map(p => `${p.x},${p.y}`).join(" "))
           .attr("fill", "none").attr("stroke", "#f1f5f9").attr("stroke-width", 1);
            
        svg.append("text").attr("x", 4).attr("y", -r + 3).attr("font-size", "9px")
           .attr("fill", "#cbd5e1").attr("font-family", "DM Sans, sans-serif")
           .text(Math.round(maxVal * ((level + 1) / levels)).toLocaleString());
    }

    // Spokes & Axes
    const axisG = svg.selectAll(".axis-spoke").data(ageBuckets).enter().append("g").attr("class", "axis-spoke");
    axisG.append("line").attr("x1", 0).attr("y1", 0)
         .attr("x2", (d, i) => radius * Math.sin(angleSlice * i))
         .attr("y2", (d, i) => -radius * Math.cos(angleSlice * i))
         .attr("stroke", "#e2e8f0").attr("stroke-width", 1);

    axisG.append("text").attr("class", "radar-label")
         .attr("x", (d, i) => (radius + 12) * Math.sin(angleSlice * i))
         .attr("y", (d, i) => -(radius + 12) * Math.cos(angleSlice * i) + 4)
         .attr("text-anchor", (d, i) => {
             const angle = angleSlice * i;
             if (angle === 0 || angle === Math.PI) return "middle";
             return angle < Math.PI ? "start" : "end";
         })
         .attr("font-size", "11px").attr("font-weight", "500").attr("fill", "#475569")
         .attr("font-family", "DM Sans, sans-serif").text(d => d);

    // Active Data Shape Drawing
    const radarPoints = ageBuckets.map((age, i) => {
        const val = demoMap.get(age) || 0;
        return {
            x: rScale(val) * Math.sin(angleSlice * i),
            y: -rScale(val) * Math.cos(angleSlice * i),
            age: age,
            value: val
        };
    });

    const stateFilterValue = d3.select("#breath-state-filter").property("value") || "all";
    const shapeColor = breathStateColors[stateFilterValue] || "#4f46e5";

    svg.append("polygon").datum(radarPoints).attr("points", d => d.map(p => `${p.x},${p.y}`).join(" "))
       .attr("fill", shapeColor).attr("fill-opacity", 0.2).attr("stroke", shapeColor).attr("stroke-width", 2.5);

    svg.selectAll(".radar-dot").data(radarPoints).enter().append("circle").attr("class", "radar-dot")
       .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", 4).attr("fill", shapeColor)
       .attr("stroke", "white").attr("stroke-width", 1.5)
       .on("mouseover", function(event, d) {
           d3.select(this).attr("r", 6);
           breathTooltip.style("opacity", 1).html(`<strong>Age Group: ${d.age}</strong><br>Tests: ${d.value.toLocaleString()}`);
       })
       .on("mousemove", function(event) {
           breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
       })
       .on("mouseout", function() {
           d3.select(this).attr("r", 4);
           breathTooltip.style("opacity", 0);
       });
}