// =========================================================================
// BREATH-TESTS.JS
// Optimized Academic Chart Pack:
// 1. Historical Trend — HEATMAP MATRIX (States vs Years)
// 2. Total Positive Tests — DYNAMIC BAR CHART (Adapts to Single & All States)
// 3. Enforcement Actions — PROPORTIONAL DONUT CHART (With Smart Fallback)
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
// LOAD CSV FILES AT ONCE
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

    if (d3.select("#breath-total").node()) d3.select("#breath-total").text(totalTests > 0 ? totalTests.toLocaleString() : "0");
    if (d3.select("#breath-charges").node()) d3.select("#breath-charges").text(totalCharges > 0 ? totalCharges.toLocaleString() : "0");
    if (d3.select("#breath-arrests").node()) d3.select("#breath-arrests").text(totalArrests > 0 ? totalArrests.toLocaleString() : "0");
    if (d3.select("#breath-top-state").node()) d3.select("#breath-top-state").text(topStateString);

    // 3. Draw updated layout charts
    drawBreathHeatmap(filteredHistorical, selectedState);
    drawBreathBarChart(filteredState, selectedState);
    drawBreathDonutChart(filteredState, selectedState);
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
// CHART 2: TOTAL POSITIVE TESTS — DYNAMIC ADAPTIVE BAR CHART
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

    // Define X domain based on selection state context
    const xDomain = data.map(d => d.STATE);
    const x = d3.scaleBand().domain(xDomain).range([0, width]).padding(selectedState !== "all" ? 0.6 : 0.3);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.COUNT) * 1.15 || 100]).range([height, 0]);

    // Grid System
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(0)}K` : d));

    // Render columns
    svg.selectAll(".breath-bar")
        .data(data).enter().append("rect")
        .attr("class", "breath-bar")
        .attr("x", d => x(d.STATE))
        .attr("width", x.bandwidth())
        .attr("y", height) // Base growth origin
        .attr("height", 0)
        .attr("rx", 4)
        .attr("fill", d => stateColors[d.STATE] || "#3b82f6")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.85);
            breathTooltip.style("opacity", 1)
                .html(`<strong>State: ${d.STATE}</strong><br>Positive Tests: ${d.COUNT.toLocaleString()}`);
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

    // Numeric value tag labels over bars
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
// CHART 3: ENFORCEMENT ACTIONS — DONUT WITH CLEAN EMPTY-STATE FALLBACK
// =========================================================================
function drawBreathDonutChart(data, selectedState) {
    d3.select("#breath-actions-chart").selectAll("*").remove(); 
    if (data.length === 0) return;

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

    // FIX: If a specific state has absolutely 0 actions, render an elegant, customized explanation notice card instead of an empty ring
    if (grandTotal === 0) {
        const fallbackG = d3.select("#breath-actions-chart")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${(width + margin.left + margin.right) / 2}, ${(height + margin.top + margin.bottom) / 2})`);

        fallbackG.append("circle")
            .attr("r", radius - 15)
            .attr("fill", "#f8fafc")
            .attr("stroke", "#e2e8f0")
            .attr("stroke-width", 2)
            .style("stroke-dasharray", "5,5");

        fallbackG.append("text")
            .attr("text-anchor", "middle")
            .attr("y", -15)
            .style("font-family", "'DM Sans', sans-serif")
            .style("font-size", "14px")
            .style("font-weight", "700")
            .style("fill", "#475569")
            .text(`${selectedState.toUpperCase()} DATA NOT REPORTED`);

        fallbackG.append("text")
            .attr("text-anchor", "middle")
            .attr("y", 10)
            .style("font-family", "'DM Sans', sans-serif")
            .style("font-size", "11px")
            .style("fill", "#94a3b8")
            .text("Roadside enforcement outcome records");

        fallbackG.append("text")
            .attr("text-anchor", "middle")
            .attr("y", 25)
            .style("font-family", "'DM Sans', sans-serif")
            .style("font-size", "11px")
            .style("fill", "#94a3b8")
            .text("are omitted or untracked by this state.");
            
        return;
    }

    const svg = d3.select("#breath-actions-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left + width / 2},${margin.top + height / 2})`);

    const donutData = [
        { action: "FINES", value: totalFines },
        { action: "ARRESTS", value: totalArrests },
        { action: "CHARGES", value: totalCharges }
    ].filter(d => d.value > 0);

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius - 24).outerRadius(radius - 4);

    const arcs = svg.selectAll(".donut-slice")
        .data(pie(donutData)).enter().append("g")
        .attr("class", "donut-slice");

    arcs.append("path")
        .attr("fill", d => actionColors[d.data.action])
        .attr("d", arc)
        .on("mouseover", function(event, d) {
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

    // Ring Center Text Label
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

    // Canvas Legend
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