// =========================================================================
// BREATH-TESTS.JS
// Optimized Academic Chart Pack:
// 1. Historical Trend — HEATMAP MATRIX (States vs Years)
// 2. Total Positive Tests — DYNAMIC BAR CHART (States Comparison)
// 3. Age Demographics — BUBBLE SCATTER PLOT (Positive Tests vs Age Groups)
// =========================================================================

// Shared Tooltip Instance
const breathTooltip = d3.select("body").selectAll(".breath-tooltip").data([0]).join("div")
    .attr("class", "breath-tooltip")
    .style("position", "absolute")
    .style("background-color", "rgba(15, 23, 42, 0.95)")
    .style("color", "#fff")
    .style("padding", "8px 12px")
    .style("border-radius", "6px")
    .style("font-family", "'DM Sans', sans-serif")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.1)")
    .style("opacity", 0)
    .style("z-index", "9999");

// Color Map matching your dashboard theme exactly
const stateColors = { 
    "NSW": "#10b981", 
    "QLD": "#ef4444", 
    "VIC": "#ec4899", 
    "WA": "#f97316", 
    "SA": "#8b5cf6", 
    "TAS": "#06b6d4", 
    "NT": "#eab308", 
    "ACT": "#3b82f6" 
};

// Store raw data globally
let breathHistoricalData = [];
let breathStateData = [];

// =========================================================================
// LOAD CSV FILES AT ONCE
// =========================================================================
Promise.all([
    d3.csv("data/breath_historical_trend.csv"), 
    d3.csv("data/breath_by_state.csv") // Make sure this contains STATE, AGE_GROUP, and COUNT
]).then(function([historical, byState]) {

    // Parse numeric dimensions safely
    historical.forEach(d => {
        d.YEAR = +d.YEAR;
        d.COUNT = +d.COUNT || 0;
    });

    byState.forEach(d => {
        d.COUNT = +d.COUNT || 0;
    });

    breathHistoricalData = historical;
    breathStateData = byState;

    // Populate state filter dynamically
    const uniqueStates = [...new Set(breathStateData.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#breath-state-filter");
    
    uniqueStates.forEach(s => {
        if(stateFilter.node() && !stateFilter.selectAll(`option[value='${s}']`).size()) {
            stateFilter.append("option").attr("value", s).text(s);
        }
    });

    // Wire up change listener events
    d3.select("#breath-state-filter").on("change", applyBreathFilters);

    // Initial load run
    applyBreathFilters();
});

// =========================================================================
// CENTRAL FILTERING ENGINE
// =========================================================================
function applyBreathFilters() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";

    // 1. Filter local arrays for historical trends
    let filteredHistorical = breathHistoricalData.slice();
    if (selectedState !== "all") {
        filteredHistorical = filteredHistorical.filter(d => d.STATE === selectedState);
    }

    // 2. Aggregate data for State Bar Chart (Total per State across all ages)
    let stateAggregated = [];
    const groupedByState = d3.groups(breathStateData, d => d.STATE);
    groupedByState.forEach(([state, records]) => {
        stateAggregated.push({
            STATE: state,
            COUNT: d3.sum(records, r => r.COUNT)
        });
    });

    // If a single state is selected, narrow the bar chart view down to just that state row
    if (selectedState !== "all") {
        stateAggregated = stateAggregated.filter(d => d.STATE === selectedState);
    }

    // 3. Filter raw records for the Age Scatter Plot
    let filteredAgeData = breathStateData.slice();
    if (selectedState !== "all") {
        filteredAgeData = filteredAgeData.filter(d => d.STATE === selectedState);
    }

    // 4. Compute Summary Metric Cards
    const totalTests = d3.sum(filteredAgeData, d => d.COUNT);
    const topStateSorted = [...stateAggregated].sort((a, b) => b.COUNT - a.COUNT);
    const topStateString = topStateSorted.length > 0 ? `${topStateSorted[0].STATE} (${(topStateSorted[0].COUNT).toLocaleString()})` : "—";

    if (d3.select("#breath-total").node()) d3.select("#breath-total").text(totalTests > 0 ? totalTests.toLocaleString() : "0");
    if (d3.select("#breath-top-state").node()) d3.select("#breath-top-state").text(topStateString);

    // 5. Render All 3 Approved Charts
    drawBreathHeatmap(filteredHistorical, selectedState);
    drawBreathBarChart(stateAggregated, selectedState);
    drawBreathScatterPlot(filteredAgeData, selectedState);
}

// =========================================================================
// CHART 1: HISTORICAL TREND — HEATMAP MATRIX
// =========================================================================
function drawBreathHeatmap(data, selectedState) {
    d3.select("#breath-historical-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 30, right: 40, bottom: 40, left: 60 };
    const container = document.getElementById("breath-historical-chart");
    if (!container) return;
    const width = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 260 - margin.top - margin.bottom;

    const svg = d3.select("#breath-historical-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const states = [...new Set(data.map(d => d.STATE))].sort();
    const years = [...new Set(data.map(d => d.YEAR))].sort((a,b) => a-b);

    const x = d3.scaleBand().domain(years).range([0, width]).padding(0.08);
    const y = d3.scaleBand().domain(states).range([0, height]).padding(0.08);

    const maxVal = d3.max(data, d => d.COUNT) || 1;
    const colorScale = d3.scaleSequential()
        .interpolator(selectedState !== "all" ? d3.interpolateGreens : d3.interpolateBlues)
        .domain([0, maxVal]);

    svg.append("g").attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

    svg.append("g").attr("class", "axis").call(d3.axisLeft(y));

    svg.selectAll(".heatmap-cell")
        .data(data).enter().append("rect")
        .attr("class", "heatmap-cell")
        .attr("x", d => x(d.YEAR))
        .attr("y", d => y(d.STATE))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("rx", 4)
        .style("fill", "#f8fafc")
        .on("mouseover", function(event, d) {
            d3.select(this).style("stroke", "#0f172a").style("stroke-width", "2px");
            breathTooltip.style("opacity", 1)
                .html(`<strong>State: ${d.STATE}</strong><br>Year: ${d.YEAR}<br>Total Tests: ${d.COUNT.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("stroke", "none");
            breathTooltip.style("opacity", 0);
        })
        .transition().duration(600)
        .style("fill", d => colorScale(d.COUNT));
}

// =========================================================================
// CHART 2: TOTAL POSITIVE TESTS — VERTICAL BAR CHART
// =========================================================================
function drawBreathBarChart(data, selectedState) {
    d3.select("#breath-bar-chart").selectAll("*").remove(); 
    if (data.length === 0) return;

    const margin = { top: 30, right: 40, bottom: 40, left: 70 };
    const container = document.getElementById("breath-bar-chart");
    if (!container) return;
    const width = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 260 - margin.top - margin.bottom;

    const svg = d3.select("#breath-bar-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const xDomain = data.map(d => d.STATE);
    const x = d3.scaleBand().domain(xDomain).range([0, width]).padding(selectedState !== "all" ? 0.6 : 0.3);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.COUNT) * 1.15 || 100]).range([height, 0]);

    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(0)}K` : d));

    svg.selectAll(".breath-bar")
        .data(data).enter().append("rect")
        .attr("class", "breath-bar")
        .attr("x", d => x(d.STATE))
        .attr("width", x.bandwidth())
        .attr("y", height)
        .attr("height", 0)
        .attr("rx", 4)
        .attr("fill", d => stateColors[d.STATE] || "#3b82f6")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.85);
            breathTooltip.style("opacity", 1)
                .html(`<strong>State: ${d.STATE}</strong><br>Total Positive Tests: ${d.COUNT.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            breathTooltip.style("opacity", 0);
        })
        .transition().duration(600)
        .attr("y", d => y(d.COUNT))
        .attr("height", d => height - y(d.COUNT));

    svg.selectAll(".bar-label")
        .data(data).enter().append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.STATE) + x.bandwidth() / 2)
        .attr("y", height - 5)
        .attr("text-anchor", "middle")
        .style("font-family", '"DM Sans", sans-serif')
        .style("font-size", "11px")
        .style("font-weight", "700")
        .style("fill", "#475569")
        .text(d => d.COUNT > 0 ? d.COUNT.toLocaleString() : "")
        .transition().duration(600)
        .attr("y", d => y(d.COUNT) - 6);
}

// =========================================================================
// CHART 3: AGE DEMOGRAPHICS — CATEGORICAL BUBBLE SCATTER PLOT
// =========================================================================
function drawBreathScatterPlot(data, selectedState) {
    // Target your third column container card
    d3.select("#breath-actions-chart").selectAll("*").remove(); 
    if (data.length === 0) return;

    const margin = { top: 40, right: 60, bottom: 50, left: 70 };
    const container = document.getElementById("breath-actions-chart");
    if (!container) return;
    const width = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 280 - margin.top - margin.bottom;

    const svg = d3.select("#breath-actions-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Extract unique age groups dynamically from your file data column
    const ageGroups = [...new Set(data.map(d => d.AGE_GROUP))].sort();
    
    // Spread Age Groups cleanly across the X Axis as structural categories
    const x = d3.scalePoint().domain(ageGroups).range([40, width - 40]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.COUNT) * 1.2 || 100]).range([height, 0]);
    const r = d3.scaleSqrt().domain([0, d3.max(data, d => d.COUNT) || 1]).range([6, 20]);

    // Grid System Background lines
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    // Axes
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(0)}K` : d));

    // Plot Floating Scatter Nodes
    const nodes = svg.selectAll(".age-scatter-node")
        .data(data)
        .enter().append("g")
        .attr("class", "age-scatter-node");

    // Scatter Circles (Will stack beautifully when "All" is active, or trace a line path when filtered!)
    nodes.append("circle")
        .attr("cx", d => x(d.AGE_GROUP))
        .attr("cy", height)
        .attr("r", d => r(d.COUNT))
        .attr("fill", d => stateColors[d.STATE] || "#6366f1")
        .attr("opacity", selectedState !== "all" ? 0.9 : 0.7)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 1).attr("stroke", "#0f172a").attr("stroke-width", 2);
            breathTooltip.style("opacity", 1)
                .html(`<strong>State: ${d.STATE}</strong><br>Age Brackets: ${d.AGE_GROUP}<br>Positive Detections: ${d.COUNT.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", selectedState !== "all" ? 0.9 : 0.7).attr("stroke", "#fff").attr("stroke-width", 1.5);
            breathTooltip.style("opacity", 0);
        })
        .transition().duration(700)
        .attr("cy", d => y(d.COUNT));

    // Display overlay value labels cleanly if single state focus is active
    if (selectedState !== "all") {
        nodes.append("text")
            .attr("x", d => x(d.AGE_GROUP))
            .attr("y", height)
            .attr("text-anchor", "middle")
            .style("font-family", '"DM Sans", sans-serif')
            .style("font-size", "10px")
            .style("font-weight", "700")
            .style("fill", "#475569")
            .text(d => d.COUNT > 0 ? d.COUNT.toLocaleString() : "")
            .transition().duration(700)
            .attr("y", d => y(d.COUNT) - r(d.COUNT) - 6);
    }
}

// Global window resize listener updates
window.addEventListener("resize", applyBreathFilters);