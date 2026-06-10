/**
 * breath-test.js
 * Core interactive visualization engine for Breath Test Enforcement metrics.
 * Tailored explicitly to 2-file structure using real data metrics schema.
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

    // ── 2. FILTER MODERN GRANULAR STREAM ──
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
    drawBreathRegionalDonut(filteredModern);
    renderBreathBarChart(filteredData); 
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

    const regions = ["Major Cities", "Inner Regional", "Outer Regional", "Remote", "Very Remote"];
    
    // Parse location strings from your explicit layout pattern
    const totals = regions.map(region => {
        const matchingRows = data.filter(d => {
            if (!d.LOCATION) return false;
            const normalized = d.LOCATION.replace(" of Australia", "").replace(" Australia", "").trim();
            return normalized.toLowerCase() === region.toLowerCase();
        });
        return {
            region,
            value: d3.sum(matchingRows, d => d.COUNT)
        };
    });

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

// Function to render the new Demographics Bar Chart
function renderBreathBarChart(data) {
    // 1. Clear any old chart content
    const container = d3.select("#breath-bar-chart");
    container.selectAll("*").remove();

    // 2. Setup dynamic width and height based on the card container
    const margin = { top: 30, right: 30, bottom: 50, left: 60 };
    const width = container.node().getBoundingClientRect().width - margin.left - margin.right || 450;
    const height = 320 - margin.top - margin.bottom;

    // 3. Append the SVG element
    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // 4. Aggregate and process data (Grouping by Age Group / Category)
    // Replace 'Age_Group' or 'Category' with whatever column name matches your CSV
    const groupField = data[0].hasOwnProperty('Age_Group') ? 'Age_Group' : 'Category';
    
    let rolledData = d3.rollups(
        data,
        v => d3.sum(v, d => +d.Positive_Tests || +d.Value || 0),
        d => d[groupField]
    ).map(([key, value]) => ({ key, value }))
     .filter(d => d.key && d.key !== "Unknown" && d.key !== "undefined");

    // Sort bars from highest to lowest volume
    rolledData.sort((a, b) => b.value - a.value);

    // 5. Create Scales
    const x = d3.scaleBand()
        .domain(rolledData.map(d => d.key))
        .range([0, width])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, d3.max(rolledData, d => d.value) * 1.1]) // Add 10% headroom
        .range([height, 0]);

    // 6. Colors matching your dashboard theme (Orange accents for breath tests)
    const barColor = "#f97316"; 
    const hoverColor = "#ea580c";

    // 7. Add X Axis
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-25)") // Slanted labels so they don't overlap
        .style("font-family", "'DM Sans', sans-serif")
        .style("font-size", "11px")
        .style("color", "#64748b");

    // 8. Add Y Axis
    svg.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",")))
        .style("font-family", "'DM Sans', sans-serif")
        .style("font-size", "11px")
        .style("color", "#64748b");

    // 9. Create Tooltip container if it doesn't exist
    let tooltip = d3.select(".chart-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("class", "chart-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background-color", "#1e293b")
            .style("color", "#fff")
            .style("padding", "8px 12px")
            .style("border-radius", "6px")
            .style("font-family", "'DM Sans', sans-serif")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("box-shadow", "0 4px 6px -1px rgba(0,0,0,0.1)")
            .style("z-index", "1000");
    }

    // 10. Render the Bars with Transitions
    svg.selectAll(".bar")
        .data(rolledData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.key))
        .attr("width", x.bandwidth())
        .attr("y", height) // Start down at base line for transition animation
        .attr("height", 0)
        .attr("fill", barColor)
        .attr("rx", 4) // Rounded top corners
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", hoverColor);
            tooltip.style("visibility", "visible")
                .html(`<strong>${d.key}</strong><br>Positive Tests: ${d.value.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            tooltip.style("top", (event.pageY - 40) + "px")
                   .style("left", (event.pageX + 15) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("fill", barColor);
            tooltip.style("visibility", "hidden");
        })
        .transition() // Growth animation
        .duration(800)
        .attr("y", d => y(d.value))
        .attr("height", d => height - y(d.value));
}