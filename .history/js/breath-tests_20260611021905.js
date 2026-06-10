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

    // Clean data parsing routines for historical file
    historical.forEach(d => { 
        d.YEAR = +d.YEAR; 
        d.COUNT = +d.COUNT; 
    });

    // Clean data parsing routines for modern file (matches your exact CSV keys)
    modern.forEach(d => {
        d.YEAR = +d.YEAR;
        d.COUNT = +d.COUNT;
        d["TOTAL FINES"] = +d["TOTAL FINES"] || 0;
        d["TOTAL CHARGES"] = +d["TOTAL CHARGES"] || 0;
        d["TOTAL ARRESTS"] = +d["TOTAL ARRESTS"] || 0;
    });

    breathHistoricalData = historical;
    breathModernData = modern;

    // Dynamically build State dropdown list from historical records
    const states = [...new Set(historical.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#breath-state-filter");
    stateFilter.selectAll("option:not([value='all'])").remove();
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));
    
    // FIXED: Extracted unique years from the valid modern array instead of undefined "data"
    const uniqueYears = [...new Set(modern.map(d => d.YEAR))].filter(y => y).sort((a, b) => b - a);

    const donutYearSelect = d3.select("#donut-year-filter");
    donutYearSelect.selectAll("*").remove(); // Prevent duplicates
    donutYearSelect.append("option").attr("value", "all").text("All Years");
    uniqueYears.forEach(y => donutYearSelect.append("option").attr("value", y).text(y));

    const barYearSelect = d3.select("#bar-year-filter");
    barYearSelect.selectAll("*").remove(); // Prevent duplicates
    barYearSelect.append("option").attr("value", "all").text("All Years");
    uniqueYears.forEach(y => barYearSelect.append("option").attr("value", y).text(y));
    
    // Hook filter change event listeners
    d3.select("#breath-state-filter").on("change", applyBreathFilters); 
    d3.select("#donut-year-filter").on("change", updateDonutOnly);      
    d3.select("#bar-year-filter").on("change", updateBarOnly);          

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

    // ── 2. FILTER MODERN GRANULAR STREAM FOR KPIs ──
    let filteredModern = breathModernData.slice();
    if (selectedState !== "all") {
        filteredModern = filteredModern.filter(d => d.STATE === selectedState);
    }

    // Helper to sanitize incoming LOCATION column entries down to standard names
    const normalizeRegion = (locString) => {
        if (!locString) return "Unknown";
        return locString.replace(" of Australia", "").replace(" Australia", "").trim();
    };

    // ── 3. CALCULATE LIVE KPI INSIGHTS ──
    const totalHistoricalTests = d3.sum(filteredHistorical, d => d.COUNT);
    const totalFines = d3.sum(filteredModern, d => d["TOTAL FINES"]);
    const totalCharges = d3.sum(filteredModern, d => d["TOTAL CHARGES"]);

    // Aggregate values to find top geographical zone dynamically
    const regionMap = d3.rollup(filteredModern, 
        v => d3.sum(v, d => d.COUNT), 
        d => normalizeRegion(d.LOCATION)
    );
    const topRegionObj = Array.from(regionMap, ([region, val]) => ({ region, val }))
                              .sort((a, b) => b.val - a.val)[0];

    // Update HTML layout containers dynamically
    d3.select("#breath-total-historical").text(totalHistoricalTests.toLocaleString());
    d3.select("#breath-modern-fines").text(totalFines.toLocaleString());
    d3.select("#breath-modern-charges").text(totalCharges.toLocaleString());
    d3.select("#breath-top-region").text(topRegionObj && topRegionObj.val > 0 ? topRegionObj.region : "—");

    // ── 4. RE-RENDER ALL VISUALS CLEANLY ──
    drawBreathHistorical(filteredHistorical);
    
    // FIXED: Instead of evaluating charts twice with old variables, let local functions draw them independently
    updateDonutOnly();
    updateBarOnly();
}

// UPDATES ONLY THE DONUT CHART
function updateDonutOnly() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";
    const selectedYear = d3.select("#donut-year-filter").property("value") || "all"; 

    // FIXED: Target breathModernData source stream instead of broken master definition
    let filtered = breathModernData.slice();
    if (selectedState !== "all") filtered = filtered.filter(d => d.STATE === selectedState);
    if (selectedYear !== "all") filtered = filtered.filter(d => d.YEAR === +selectedYear);

    // Render only the donut chart
    drawBreathRegionalDonut(filtered);
}

// UPDATES ONLY THE BAR CHART
function updateBarOnly() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";
    const selectedYear = d3.select("#bar-year-filter").property("value") || "all"; 

    // FIXED: Target breathModernData source stream instead of broken master definition
    let filtered = breathModernData.slice();
    if (selectedState !== "all") filtered = filtered.filter(d => d.STATE === selectedState);
    if (selectedYear !== "all") filtered = filtered.filter(d => d.YEAR === +selectedYear);

    // Render only the bar chart
    renderBreathBarChart(filtered);
}

// ── CHART 1: Historical Trend (Line Chart) ──
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
// ── CHART 2: Spatial Regional Distribution (Doughnut Wheel) ──
function drawBreathRegionalDonut(data) {
    // 1. Reset and select elements securely
    d3.select("#breath-donut-chart").selectAll("*").remove();

    const container = document.getElementById("breath-donut-chart");
    if (!container) return;

    const width = container.offsetWidth;
    const height = 320;
    const margin = { top: 20, right: 20, bottom: 80, left: 20 };
    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;

    const svg = d3.select("#breath-donut-chart")
                  .append("svg")
                  .attr("width", width)
                  .attr("height", height);

    const chartG = svg.append("g")
                      .attr("transform", `translate(${width / 2}, ${radius + margin.top})`);

    // Helper to sanitize name strings (e.g., "Major Cities of Australia" -> "Major Cities")
    const cleanLabel = (str) => {
        if (!str) return "Unknown";
        let clean = str.replace(/\s+of\s+Australia/gi, "").trim();
        return clean.charAt(0).toUpperCase() + clean.slice(1);
    };

    // 2. Extract and Aggregate Counts based on cleaned keys
    const countsMap = d3.rollup(
        data,
        v => d3.sum(v, d => +d.COUNT || 0),
        d => cleanLabel(d.LOCATION)
    );

    // Convert map to layout array structure
    let totals = Array.from(countsMap, ([region, value]) => ({ region, value }));

    // Remove empty strings or dead zero entries to prevent pie layout distortion
    totals = totals.filter(d => d.value > 0);

    const totalVolume = d3.sum(totals, d => d.value);

    // 3. Fail-safe Fallback UI if data totals collapse to 0
    if (totalVolume === 0 || totals.length === 0) {
        chartG.append("text")
              .attr("text-anchor", "middle")
              .attr("font-size", "14px")
              .attr("fill", "#94a3b8")
              .attr("font-family", "DM Sans, sans-serif")
              .text("No Spatial Data Recorded for Selection");
        return;
    }

    // 4. Color Palette configuration matching design token scheme
    const baseColors = {
        "Major Cities": "#0f766e",   // Teal 700
        "Inner Regional": "#0d9488",  // Teal 600
        "Outer Regional": "#2dd4bf",  // Teal 400
        "Remote": "#99f6e4",          // Teal 200
        "Very Remote": "#ccfbf1",     // Teal 100
        "All regions": "#38bdf8",     // Sky Blue
        "Unknown": "#94a3b8"          // Slate Gray
    };

    const getHexColor = (name) => baseColors[name] || d3.scaleOrdinal(d3.schemeTeal[5])(name);

    // 5. Build Pie Generator layout
    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.58).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(radius * 0.58).outerRadius(radius * 1.06);

    // Render out paths
    chartG.selectAll(".arc")
        .data(pie(totals))
        .enter()
        .append("path")
        .attr("class", "arc")
        .attr("d", arc)
        .attr("fill", d => getHexColor(d.data.region))
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2)
        .on("mouseover", function(event, d) {
            d3.select(this).transition().duration(150).attr("d", arcHover);
            const pct = ((d.data.value / totalVolume) * 100).toFixed(1);
            
            // Ensure you have global 'breathTooltip' configured elsewhere in your script
            if (typeof breathTooltip !== "undefined") {
                breathTooltip.style("opacity", 1)
                    .html(`<strong>${d.data.region}</strong><br/>Tests: ${d.data.value.toLocaleString()}<br/>Share: ${pct}%`);
            }
        })
        .on("mousemove", function(event) {
            if (typeof breathTooltip !== "undefined") {
                breathTooltip.style("left", (event.pageX + 12) + "px")
                             .style("top", (event.pageY - 28) + "px");
            }
        })
        .on("mouseout", function() {
            d3.select(this).transition().duration(150).attr("d", arc);
            if (typeof breathTooltip !== "undefined") {
                breathTooltip.style("opacity", 0);
            }
        });

    // Center Summary Typography Label
    chartG.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "-0.15em")
          .attr("font-size", "22px")
          .attr("font-weight", "700")
          .attr("font-family", "Syne, sans-serif")
          .attr("fill", "#0f172a")
          .text(totalVolume >= 1e6 ? `${(totalVolume / 1e6).toFixed(2)}M` : totalVolume.toLocaleString());
        
    chartG.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "1.25em")
          .attr("font-size", "11px")
          .attr("font-weight", "500")
          .attr("font-family", "DM Sans, sans-serif")
          .attr("fill", "#64748b")
          .text("Positive Cases");

    // 6. Dynamic Legend Layout Calculations
    const legendG = svg.append("g").attr("class", "donut-legend");
    let lineX = 0, lineY = 0;
    const strideX = 145, strideY = 20;

    totals.forEach((item, index) => {
        const entryG = legendG.append("g").attr("transform", `translate(${lineX}, ${lineY})`);
        
        entryG.append("rect")
              .attr("width", 11)
              .attr("height", 11)
              .attr("rx", 2)
              .attr("fill", getHexColor(item.region));

        entryG.append("text")
              .attr("x", 16)
              .attr("y", 10)
              .attr("font-size", "11px")
              .attr("fill", "#334155")
              .attr("font-family", "DM Sans, sans-serif")
              .text(`${item.region} (${((item.value / totalVolume) * 100).toFixed(0)}%)`);

        if ((index + 1) % 2 === 0) {
            lineX = 0;
            lineY += strideY;
        } else {
            lineX += strideX;
        }
    });

    // Auto-center legend positioning beneath chart base boundary box
    const bbox = legendG.node().getBBox();
    legendG.attr("transform", `translate(${(width - bbox.width) / 2}, ${(radius * 2) + margin.top + 24})`);
}