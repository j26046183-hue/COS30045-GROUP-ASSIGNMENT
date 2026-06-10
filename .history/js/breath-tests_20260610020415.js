// =========================================================================
// BREATH-TESTS.JS
// 3 Charts (Fully Relational, Approved Academic Chart Pack):
// 1. Historical Trend — LINE CHART (Timeline Tracking)
// 2. Total Breath Tests — SCATTER PLOT (Bubble Dispersion)
// 3. Enforcement Actions — DONUT CHART (Proportional Segmentation)
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

// Label Conversions
const breathLabels = {
    "FINES": "Fines Issued",
    "ARRESTS": "Arrests Made",
    "CHARGES": "Charges Filed"
};

// Color Maps
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

const actionColors = { 
    "FINES": "#2563eb", 
    "ARRESTS": "#ef4444", 
    "CHARGES": "#f59e0b" 
};

// Store raw data globally
let breathHistoricalData = [];
let breathStateData = [];

// =========================================================================
// LOAD CSV FILES AT ONCE (Matching Fines Structure Exactly)
// =========================================================================
Promise.all([
    d3.csv("data/breath_historical_trend.csv"), 
    d3.csv("data/breath_by_state.csv")
]).then(function([historical, byState]) {

    // Parse numeric dimensions safely
    historical.forEach(d => {
        d.YEAR = +d.YEAR;
        d.COUNT = +d.COUNT || 0;
    });

    byState.forEach(d => {
        d.COUNT = +d.COUNT || 0;
        d.FINES = +d.FINES || 0;
        d.ARRESTS = +d.ARRESTS || 0;
        d.CHARGES = +d.CHARGES || 0;
    });

    breathHistoricalData = historical;
    breathStateData = byState;

    // Populate state filter dynamically
    const uniqueStates = [...new Set(breathStateData.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#breath-state-filter");
    
    uniqueStates.forEach(s => {
        stateFilter.append("option").attr("value", s).text(s);
    });

    // Wire up change listener events
    d3.select("#breath-state-filter").on("change", applyBreathFilters);

    // Initial load run
    applyBreathFilters();
});

// =========================================================================
// CENTRAL INTERACTION ROUTINE: FILTER & AGGREGATE ENGINE
// =========================================================================
function applyBreathFilters() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";

    // 1. Filter local arrays
    let filteredHistorical = breathHistoricalData.slice();
    if (selectedState !== "all") {
        filteredHistorical = filteredHistorical.filter(d => d.STATE === selectedState);
    }

    let filteredState = breathStateData.slice();
    if (selectedState !== "all") {
        filteredState = filteredState.filter(d => d.STATE === selectedState);
    }

    // 2. Compute Summary Metric Cards
    const totalTests = d3.sum(filteredState, d => d.COUNT);
    const totalCharges = d3.sum(filteredState, d => d.CHARGES);
    const totalArrests = d3.sum(filteredState, d => d.ARRESTS);

    const topStateSorted = [...filteredState].sort((a, b) => b.COUNT - a.COUNT);
    const topStateString = topStateSorted.length > 0 ? `${topStateSorted[0].STATE} (${(topStateSorted[0].COUNT).toLocaleString()})` : "—";

    d3.select("#breath-total").text(totalTests > 0 ? totalTests.toLocaleString() : "0");
    d3.select("#breath-charges").text(totalCharges > 0 ? totalCharges.toLocaleString() : "0");
    d3.select("#breath-arrests").text(totalArrests > 0 ? totalArrests.toLocaleString() : "0");
    d3.select("#breath-top-state").text(topStateString);

    // 3. Draw approved charts
    drawBreathLineChart(filteredHistorical);
    drawBreathScatterPlot(filteredState);
    drawBreathDonutChart(filteredState);
}

// =========================================================================
// CHART 1: HISTORICAL TREND — LINE CHART
// =========================================================================
function drawBreathLineChart(data) {
    d3.select("#breath-historical-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 30, right: 120, bottom: 40, left: 60 };
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

    const dataByState = d3.groups(data, d => d.STATE);
    const uniqueYears = [...new Set(data.map(d => d.YEAR))].sort((a, b) => a - b);

    const x = d3.scaleLinear().domain(d3.extent(data, d => d.YEAR)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.COUNT) * 1.05 || 100]).range([height, 0]);

    // Grid System
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickValues(uniqueYears).tickFormat(d3.format("d")));

    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(0)}K` : d));

    const lineGenerator = d3.line()
        .x(d => x(d.YEAR))
        .y(d => y(d.COUNT))
        .curve(d3.curveMonotoneX);

    dataByState.forEach(([state, values]) => {
        const sortedValues = values.sort((a,b) => a.YEAR - b.YEAR);
        const pathColor = stateColors[state] || "#64748b";

        const path = svg.append("path")
            .datum(sortedValues)
            .attr("fill", "none")
            .attr("stroke", pathColor)
            .attr("stroke-width", 2.5)
            .attr("d", lineGenerator);

        // Path drawing transition animation
        const totalLength = path.node().getTotalLength();
        path.attr("stroke-dasharray", totalLength + " " + totalLength)
            .attr("stroke-dashoffset", totalLength)
            .transition().duration(900)
            .attr("stroke-dashoffset", 0);

        // Individual point circle dots to make tooltips easy
        svg.selectAll(`.dot-${state}`)
            .data(sortedValues).enter().append("circle")
            .attr("class", `dot-${state}`)
            .attr("cx", d => x(d.YEAR))
            .attr("cy", d => y(d.COUNT))
            .attr("r", 4)
            .attr("fill", pathColor)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .style("opacity", 0)
            .on("mouseover", function(event, d) {
                d3.select(this).style("opacity", 1).attr("r", 6);
                breathTooltip.style("opacity", 1)
                    .html(`<strong>State: ${d.STATE}</strong><br>Year: ${d.YEAR}<br>Tests: ${d.COUNT.toLocaleString()}`);
            })
            .on("mousemove", function(event) {
                breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).style("opacity", 0).attr("r", 4);
                breathTooltip.style("opacity", 0);
            })
            .transition().delay(800).duration(200)
            .style("opacity", 0.3); // Soft resting state visible on graph lines

        if (sortedValues.length > 0) {
            const lastPoint = sortedValues[sortedValues.length - 1];
            svg.append("text")
                .attr("x", x(lastPoint.YEAR) + 6)
                .attr("y", y(lastPoint.COUNT) + 4)
                .style("font-family", "'DM Sans', sans-serif")
                .style("font-size", "10px")
                .style("font-weight", "600")
                .style("fill", pathColor)
                .text(state);
        }
    });
}

// =========================================================================
// CHART 2: TOTAL BREATH TESTS — SCATTER PLOT
// =========================================================================
function drawBreathScatterPlot(data) {
    d3.select("#breath-bar-chart").selectAll("*").remove(); // Targets container ID safely
    if (data.length === 0) return;

    const margin = { top: 30, right: 60, bottom: 40, left: 70 };
    const container = document.getElementById("breath-bar-chart");
    if (!container) return;
    const width = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 240 - margin.top - margin.bottom;

    const svg = d3.select("#breath-bar-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const states = data.map(d => d.STATE).sort();
    
    const x = d3.scalePoint().domain(states).range([40, width - 40]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.COUNT) * 1.15 || 100]).range([height, 0]);
    
    // Scale bubble circle sizes relative to test volume weight
    const r = d3.scaleSqrt().domain([0, d3.max(data, d => d.COUNT) || 1]).range([8, 24]);

    // Grid System Lines
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(0)}K` : d));

    // Plot Floating Scatter Bubble Elements
    const nodes = svg.selectAll(".scatter-node").data(data).enter().append("g").attr("class", "scatter-node");

    nodes.append("circle")
        .attr("cx", d => x(d.STATE))
        .attr("cy", height) // Rise up animation track anchor point
        .attr("r", d => r(d.COUNT))
        .attr("fill", d => stateColors[d.STATE] || "#3b82f6")
        .attr("opacity", 0.85)
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 1).attr("stroke", "#0f172a");
            breathTooltip.style("opacity", 1)
                .html(`<strong>State: ${d.STATE}</strong><br>Total Tests: ${d.COUNT.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.85).attr("stroke", "#fff");
            breathTooltip.style("opacity", 0);
        })
        .transition().duration(800)
        .attr("cy", d => y(d.COUNT));

    // Standardised 11px Typography label tags placed above scatter coordinate points
    nodes.append("text")
        .attr("x", d => x(d.STATE))
        .attr("y", height)
        .attr("text-anchor", "middle")
        .style("font-family", '"DM Sans", sans-serif')
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#475569")
        .text(d => d.COUNT > 0 ? d.COUNT.toLocaleString() : "")
        .transition().duration(800)
        .attr("y", d => y(d.COUNT) - r(d.COUNT) - 6);
}

// =========================================================================
// CHART 3: ENFORCEMENT ACTIONS — DONUT CHART
// =========================================================================
function drawBreathDonutChart(data) {
    d3.select("#breath-actions-chart").selectAll("*").remove(); // Targets container ID safely
    if (data.length === 0) return;

    // Sum structural categories across current scope context
    const totalFines = d3.sum(data, d => d.FINES);
    const totalArrests = d3.sum(data, d => d.ARRESTS);
    const totalCharges = d3.sum(data, d => d.CHARGES);
    const grandTotal = totalFines + totalArrests + totalCharges;

    const margin = { top: 30, right: 160, bottom: 30, left: 60 };
    const container = document.getElementById("breath-actions-chart");
    if (!container) return;
    const width = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 280 - margin.top - margin.bottom;
    const radius = Math.min(width, height) / 2;

    const svg = d3.select("#breath-actions-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left + width / 2},${margin.top + height / 2})`);

    // Empty State Fallback Design Handler
    if (grandTotal === 0) {
        svg.append("circle").attr("r", radius - 10).attr("fill", "none").attr("stroke", "#e2e8f0").attr("stroke-width", 15).style("stroke-dasharray", "4,4");
        svg.append("text").attr("text-anchor", "middle").attr("y", -5).style("font-family", "'DM Sans', sans-serif").style("font-size", "12px").style("font-weight", "600").style("fill", "#94a3b8").text("NO DATA RECORDED");
        svg.append("text").attr("text-anchor", "middle").attr("y", 12).style("font-family", "'DM Sans', sans-serif").style("font-size", "10px").style("fill", "#cbd5e1").text("for current filtering view");
        return;
    }

    const donutData = [
        { action: "FINES", value: totalFines },
        { action: "ARRESTS", value: totalArrests },
        { action: "CHARGES", value: totalCharges }
    ];

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius - 24).outerRadius(radius - 4);

    // Build Donut Ring paths
    const arcs = svg.selectAll(".donut-slice")
        .data(pie(donutData)).enter().append("g")
        .attr("class", "donut-slice");

    arcs.append("path")
        .attr("fill", d => actionColors[d.data.action])
        .attr("d", arc)
        .on("mouseover", function(event, d) {
            // Expand arc slice slightly on hover
            d3.select(this).transition().duration(200).attr("d", d3.arc().innerRadius(radius - 28).outerRadius(radius - 2));
            const pct = ((d.data.value / grandTotal) * 100).toFixed(1);
            breathTooltip.style("opacity", 1)
                .html(`<strong>${breathLabels[d.data.action]}</strong><br>Volume: ${d.data.value.toLocaleString()}<br>Proportion: ${pct}%`);
        })
        .on("mousemove", function(event) {
            breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).transition().duration(200).attr("d", arc);
            breathTooltip.style("opacity", 0);
        })
        .transition().duration(750)
        .attrTween("d", function(d) {
            const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
            return function(t) { return arc(i(t)); };
        });

    // Ring Center Total Text Callout Labels
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.2em")
        .style("font-family", '"DM Sans", sans-serif')
        .style("font-size", "22px")
        .style("font-weight", "700")
        .style("fill", "#1e293b")
        .text(grandTotal.toLocaleString());

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "1.2em")
        .style("font-family", '"DM Sans", sans-serif')
        .style("font-size", "11px")
        .style("font-weight", "500")
        .style("fill", "#64748b")
        .text("Total Actions");

    // Proportional Right Side Canvas Legend System
    const legend = svg.append("g").attr("transform", `translate(${radius + 25}, -35)`);
    donutData.forEach((d, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 24})`);
        const pct = grandTotal > 0 ? ((d.value / grandTotal) * 100).toFixed(0) : 0;

        row.append("rect").attr("width", 12).attr("height", 12).attr("rx", 3).attr("fill", actionColors[d.action]);
        row.append("text").attr("x", 18).attr("y", 10)
            .style("font-family", "'DM Sans', sans-serif").style("font-size", "12px").style("fill", "#475569")
            .text(`${breathLabels[d.action]} (${pct}%)`);
    });
}

// Global window resize listener updates
window.addEventListener("resize", applyBreathFilters);