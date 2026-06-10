// =========================================================================
// DRUG-TESTS.JS
// 3 Charts (Fully Relational, Unique Visualization Pack):
// 1. Historical Trend — HEATMAP MATRIX (States vs Years)
// 2. Positive Drug Tests — SCATTER PLOT / BUBBLE DISPERSION
// 3. Enforcement Actions — PROPORTIONAL DONUT SEGMENTATION
// =========================================================================

// Shared Tooltip Instance
const drugTooltip = d3.select("body").selectAll(".drug-tooltip").data([0]).join("div")
    .attr("class", "drug-tooltip")
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
const drugLabels = {
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
let drugHistoricalData = [];
let drugStateData = [];

// =========================================================================
// LOAD CSV FILES AT ONCE (Matching Fines & Breath Structure Exactly)
// =========================================================================
Promise.all([
    d3.csv("data/drug_historical_trend.csv"), 
    d3.csv("data/drug_by_state.csv")
]).then(function([historical, byState]) {

    // Parse data dimensions safely
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

    drugHistoricalData = historical;
    drugStateData = byState;

    // Populate state filter dynamically
    const uniqueStates = [...new Set(drugStateData.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#drug-state-filter");
    
    uniqueStates.forEach(s => {
        stateFilter.append("option").attr("value", s).text(s);
    });

    // Wire up listeners
    d3.select("#drug-state-filter").on("change", applyDrugFilters);

    // Initial draw cycle
    applyDrugFilters();
});

// =========================================================================
// CENTRAL FILTERING ENGINE
// =========================================================================
function applyDrugFilters() {
    const selectedState = d3.select("#drug-state-filter").property("value") || "all";

    // 1. Slice / Filter array paths
    let filteredHistorical = drugHistoricalData.slice();
    if (selectedState !== "all") {
        filteredHistorical = filteredHistorical.filter(d => d.STATE === selectedState);
    }

    let filteredState = drugStateData.slice();
    if (selectedState !== "all") {
        filteredState = filteredState.filter(d => d.STATE === selectedState);
    }

    // 2. Summary Card Metric Calculations
    const totalTests = d3.sum(filteredState, d => d.COUNT);
    const totalCharges = d3.sum(filteredState, d => d.CHARGES);
    const totalArrests = d3.sum(filteredState, d => d.ARRESTS);

    const topStateSorted = [...filteredState].sort((a, b) => b.COUNT - a.COUNT);
    const topStateString = topStateSorted.length > 0 ? `${topStateSorted[0].STATE} (${(topStateSorted[0].COUNT).toLocaleString()})` : "—";

    d3.select("#drug-total").text(totalTests > 0 ? totalTests.toLocaleString() : "0");
    d3.select("#drug-charges").text(totalCharges > 0 ? totalCharges.toLocaleString() : "0");
    d3.select("#drug-arrests").text(totalArrests > 0 ? totalArrests.toLocaleString() : "0");
    d3.select("#drug-top-state").text(topStateString);

    // 3. Render Dashboard Visualizations
    drawDrugHeatmap(filteredHistorical, selectedState);
    drawDrugScatter(filteredState);
    drawDrugDonut(filteredState);
}

// =========================================================================
// CHART 1: HISTORICAL TREND — VISUAL HEATMAP MATRIX
// =========================================================================
function drawDrugHeatmap(data, selectedState) {
    d3.select("#drug-historical-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 30, right: 40, bottom: 40, left: 60 };
    const container = document.getElementById("drug-historical-chart");
    if (!container) return;
    const width = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 260 - margin.top - margin.bottom;

    const svg = d3.select("#drug-historical-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Extract unique coordinate dimensions
    const states = [...new Set(data.map(d => d.STATE))].sort();
    const years = [...new Set(data.map(d => d.YEAR))].sort((a,b) => a-b);

    const x = d3.scaleBand().domain(years).range([0, width]).padding(0.08);
    const y = d3.scaleBand().domain(states).range([0, height]).padding(0.08);

    // Dynamic color gradient engine based on volume density
    const maxVal = d3.max(data, d => d.COUNT) || 1;
    const colorScale = d3.scaleSequential()
        .interpolator(selectedState !== "all" ? d3.interpolateGreens : d3.interpolateBlues)
        .domain([0, maxVal]);

    // Axes
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
    svg.append("g").attr("class", "axis").call(d3.axisLeft(y));

    // Render Heatmap Matrix Blocks
    svg.selectAll(".heatmap-cell")
        .data(data).enter().append("rect")
        .attr("class", "heatmap-cell")
        .attr("x", d => x(d.YEAR))
        .attr("y", d => y(d.STATE))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("rx", 4)
        .style("fill", "#f8fafc") // Base initialization style
        .on("mouseover", function(event, d) {
            d3.select(this).style("stroke", "#0f172a").style("stroke-width", "2px");
            drugTooltip.style("opacity", 1)
                .html(`<strong>State: ${d.STATE}</strong><br>Year: ${d.YEAR}<br>Positive Tests: ${d.COUNT.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("stroke", "none");
            drugTooltip.style("opacity", 0);
        })
        .transition().duration(600)
        .style("fill", d => colorScale(d.COUNT));
}

// =========================================================================
// CHART 2: POSITIVE DRUG TESTS — SCATTER PLOT LAYOUT
// =========================================================================
function drawDrugScatter(data) {
    d3.select("#drug-bar-chart").selectAll("*").remove(); // Reuses your drug-bar-chart container ID natively
    if (data.length === 0) return;

    const margin = { top: 30, right: 60, bottom: 40, left: 70 };
    const container = document.getElementById("drug-bar-chart");
    if (!container) return;
    const width = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 240 - margin.top - margin.bottom;

    const svg = d3.select("#drug-bar-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const states = data.map(d => d.STATE).sort();
    
    const x = d3.scalePoint().domain(states).range([40, width - 40]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.COUNT) * 1.15 || 100]).range([height, 0]);
    
    // Scale bubble circle sizes dynamically relative to density metrics
    const r = d3.scaleSqrt().domain([0, d3.max(data, d => d.COUNT) || 1]).range([8, 24]);

    // Grid System Lines
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(0)}K` : d));

    // Render Scatter Plots Node Elements
    const nodes = svg.selectAll(".scatter-node").data(data).enter().append("g").attr("class", "scatter-node");

    nodes.append("circle")
        .attr("cx", d => x(d.STATE))
        .attr("cy", height) // Animate upwards from bottom base line
        .attr("r", d => r(d.COUNT))
        .attr("fill", d => stateColors[d.STATE] || "#3b82f6")
        .attr("opacity", 0.85)
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 1).attr("stroke", "#0f172a");
            drugTooltip.style("opacity", 1)
                .html(`<strong>${d.STATE}</strong><br>Positive Tests: ${d.COUNT.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.85).attr("stroke", "#fff");
            drugTooltip.style("opacity", 0);
        })
        .transition().duration(800)
        .attr("cy", d => y(d.COUNT));

    // Standardised 11px Typography label offsets placed directly over the scatter points
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
// CHART 3: ENFORCEMENT ACTIONS — PROPORTIONAL DONUT CHART
// =========================================================================
function drawDrugDonut(data) {
    d3.select("#drug-actions-chart").selectAll("*").remove(); // Reuses your drug-actions-chart container ID natively
    if (data.length === 0) return;

    // Aggregate values based on metrics streams inside selection scope context
    const totalFines = d3.sum(data, d => d.FINES);
    const totalArrests = d3.sum(data, d => d.ARRESTS);
    const totalCharges = d3.sum(data, d => d.CHARGES);
    const grandTotal = totalFines + totalArrests + totalCharges;

    const margin = { top: 30, right: 160, bottom: 30, left: 60 };
    const container = document.getElementById("drug-actions-chart");
    if (!container) return;
    const width = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 280 - margin.top - margin.bottom;
    const radius = Math.min(width, height) / 2;

    const svg = d3.select("#drug-actions-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left + width / 2},${margin.top + height / 2})`);

    // Empty Fallback Layout System Engine
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
    const arc = d3.arc().innerRadius(radius - 24).outerRadius(radius - 4).on("mouseover", function() { d3.select(this).attr("opacity", 0.85); });

    // Generate Path Slices
    const arcs = svg.selectAll(".donut-slice")
        .data(pie(donutData)).enter().append("g")
        .attr("class", "donut-slice");

    arcs.append("path")
        .attr("fill", d => actionColors[d.data.action])
        .attr("d", arc)
        .on("mouseover", function(event, d) {
            d3.select(this).transition().duration(200).attr("d", d3.arc().innerRadius(radius - 28).outerRadius(radius - 2));
            const pct = ((d.data.value / grandTotal) * 100).toFixed(1);
            drugTooltip.style("opacity", 1)
                .html(`<strong>${drugLabels[d.data.action]}</strong><br>Volume Count: ${d.data.value.toLocaleString()}<br>Proportion: ${pct}%`);
        })
        .on("mousemove", function(event) {
            drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function(event, d) {
            d3.select(this).transition().duration(200).attr("d", arc);
            drugTooltip.style("opacity", 0);
        })
        // Custom interpolation logic transition for structural pie rotation loading arrays smoothly
        .transition().duration(750)
        .attrTween("d", function(d) {
            const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
            return function(t) { return arc(i(t)); };
        });

    // Central Display Label
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

    // Dynamic Legend Layout Configuration Anchor Block Placement
    const legend = svg.append("g").attr("transform", `translate(${radius + 25}, -35)`);
    donutData.forEach((d, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 24})`);
        const pct = grandTotal > 0 ? ((d.value / grandTotal) * 100).toFixed(0) : 0;

        row.append("rect").attr("width", 12).attr("height", 12).attr("rx", 3).attr("fill", actionColors[d.action]);
        row.append("text").attr("x", 18).attr("y", 10)
            .style("font-family", "'DM Sans', sans-serif").style("font-size", "12px").style("fill", "#475569")
            .text(`${drugLabels[d.action]} (${pct}%)`);
    });
}

// Global window resize architecture layout support
window.addEventListener("resize", applyDrugFilters);