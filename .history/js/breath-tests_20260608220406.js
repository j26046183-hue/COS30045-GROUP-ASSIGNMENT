// =========================================================================
// BREATH.JS
// 3 Charts (Fully Relational & Flat Structured Layout):
// 1. Historical trend (multi-line) — breathHistoricalData
// 2. Breath tests by state (horizontal bar) — breathStateData (COUNT)
// 3. Enforcement actions by state (grouped bar) — breathStateData (FINES, ARRESTS, CHARGES)
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
    "FINES": "Fines",
    "ARRESTS": "Arrests",
    "CHARGES": "Charges"
};

// Color maps
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
// MAIN DATA INITIALIZER (To be called from your main app loader)
// =========================================================================
function initBreathTests(rawData) {
    console.log("Loading Breath Test datasets...");

    // Filter raw data stream down strictly to breath-related items
    const breathData = rawData.filter(d => d.CATEGORY === "BREATH" || d.TYPE === "BREATH");

    if (breathData.length === 0) {
        console.warn("Warning: No matching breath test records found in source data.");
        return;
    }

    // 1. Roll up historical numbers over the full timeframe
    breathHistoricalData = d3.rollups(breathData, 
        v => d3.sum(v, d => +d.COUNT || 0),
        d => d.STATE,
        d => +d.YEAR
    ).flatMap(([state, years]) => years.map(([year, count]) => ({ STATE: state, YEAR: year, COUNT: count })));

    // 2. Roll up active state reporting metrics window (2023-2024)
    breathStateData = d3.rollups(
        breathData.filter(d => +d.YEAR === 2023 || +d.YEAR === 2024),
        v => ({
            COUNT: d3.sum(v, d => +d.COUNT || 0),
            FINES: d3.sum(v, d => +d.FINES || 0),
            ARRESTS: d3.sum(v, d => +d.ARRESTS || 0),
            CHARGES: d3.sum(v, d => +d.CHARGES || 0)
        }),
        d => d.STATE
    ).map(([state, metrics]) => ({ STATE: state, ...metrics }));

    // Populate drop-down filter elements dynamically
    const uniqueStates = [...new Set(breathHistoricalData.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#breath-state-filter");
    
    uniqueStates.forEach(s => {
        stateFilter.append("option").attr("value", s).text(s);
    });

    // Wire up events
    d3.select("#breath-state-filter").on("change", applyBreathFilters);

    // Initial load run
    applyBreathFilters();
}

// =========================================================================
// CENTRAL INTERACTION ROUTINE: FILTER & AGGREGATE ENGINE
// =========================================================================
function applyBreathFilters() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";

    // ── 1. FILTER HISTORICAL DATA STREAM ──
    let filteredHistorical = breathHistoricalData.slice();
    if (selectedState !== "all") {
        filteredHistorical = filteredHistorical.filter(d => d.STATE === selectedState);
    }

    // ── 2. FILTER STATE ENFORCEMENT SUMMARY DATA ──
    let filteredState = breathStateData.slice();
    if (selectedState !== "all") {
        filteredState = filteredState.filter(d => d.STATE === selectedState);
    }

    // ── 3. COMPUTE SUMMARY CARDS METRICS ──
    const totalTests = d3.sum(filteredState, d => d.COUNT);
    const totalCharges = d3.sum(filteredState, d => d.CHARGES);
    const totalArrests = d3.sum(filteredState, d => d.ARRESTS);

    const topStateSorted = [...filteredState].sort((a, b) => b.COUNT - a.COUNT);
    const topStateString = topStateSorted.length > 0 ? `${topStateSorted[0].STATE} (${(topStateSorted[0].COUNT).toLocaleString()})` : "—";

    d3.select("#breath-total").text(totalTests > 0 ? totalTests.toLocaleString() : "0");
    d3.select("#breath-charges").text(totalCharges > 0 ? totalCharges.toLocaleString() : "0");
    d3.select("#breath-arrests").text(totalArrests > 0 ? totalArrests.toLocaleString() : "0");
    d3.select("#breath-top-state").text(topStateString);

    // ── 4. RE-DRAW ACTIVE GRAPH VISUALIZATIONS ──
    drawBreathHistorical(filteredHistorical);
    drawBreathBar(filteredState);
    drawBreathActions(filteredState);
}

// =========================================================================
// CHART 1: Historical Trend (Multi-Line Chart Layout)
// =========================================================================
function drawBreathHistorical(data) {
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

        const totalLength = path.node().getTotalLength();
        path.attr("stroke-dasharray", totalLength + " " + totalLength)
            .attr("stroke-dashoffset", totalLength)
            .transition().duration(900)
            .attr("stroke-dashoffset", 0);

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
// CHART 2: Breath Tests By State (Horizontal Bar Layout)
// =========================================================================
function drawBreathBar(data) {
    d3.select("#breath-bar-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const sortedData = [...data].sort((a,b) => b.COUNT - a.COUNT);

    const margin = { top: 20, right: 80, bottom: 40, left: 50 };
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

    const y = d3.scaleBand().domain(sortedData.map(d => d.STATE)).range([0, height]).padding(0.35);
    const x = d3.scaleLinear().domain([0, d3.max(sortedData, d => d.COUNT) * 1.05 || 100]).range([0, width]);

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(0)}K` : d));
    svg.append("g").attr("class", "axis").call(d3.axisLeft(y));

    const rows = svg.selectAll(".bar-row").data(sortedData).enter().append("g").attr("class", "bar-row");

    rows.append("rect")
        .attr("x", 0)
        .attr("y", d => y(d.STATE))
        .attr("height", y.bandwidth())
        .attr("rx", 3)
        .attr("fill", d => stateColors[d.STATE] || "#3b82f6")
        .attr("width", 0)
        .transition().duration(800)
        .attr("width", d => Math.max(x(d.COUNT), 0));

    rows.append("text")
        .attr("y", d => y(d.STATE) + y.bandwidth() / 2 + 4)
        .attr("x", 0)
        .style("font-family", '"DM Sans", sans-serif')
        .style("font-size", "11px")
        .style("font-weight", "500")
        .style("fill", "#475569")
        .text(d => d.COUNT > 0 ? d.COUNT.toLocaleString() : "")
        .transition().duration(800)
        .attr("x", d => Math.max(x(d.COUNT), 0) + 8);
}

// =========================================================================
// CHART 3: Enforcement Actions (Grouped Column Layout)
// =========================================================================
function drawBreathActions(data) {
    d3.select("#breath-actions-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 40, right: 160, bottom: 50, left: 60 };
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

    const actions = ["FINES", "ARRESTS", "CHARGES"];
    const states = data.map(d => d.STATE).sort();

    const x0 = d3.scaleBand().domain(states).range([0, width]).padding(0.25);
    const x1 = d3.scaleBand().domain(actions).range([0, x0.bandwidth()]).padding(0.08);

    const maxVal = d3.max(data, d => d3.max(actions, a => d[a])) || 100;
    const y = d3.scaleLinear().domain([0, maxVal * 1.1]).range([height, 0]);

    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x0));
    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(0)}K` : d));

    const stateGroups = svg.selectAll(".state-group")
        .data(data).enter().append("g")
        .attr("class", "state-group")
        .attr("transform", d => `translate(${x0(d.STATE)},0)`);

    // Draw active chart rects
    stateGroups.selectAll("rect")
        .data(d => actions.map(action => ({ action, state: d.STATE, value: d[action] })))
        .enter().append("rect")
        .attr("x", d => x1(d.action))
        .attr("y", height)
        .attr("width", x1.bandwidth())
        .attr("height", 0)
        .attr("rx", 3)
        .attr("fill", d => actionColors[d.action])
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            breathTooltip.style("opacity", 1)
                .html(`<strong>${d.state}</strong><br>${breathLabels[d.action] || d.action}: ${d.value.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            breathTooltip.style("opacity", 0);
        })
        .transition().duration(700).delay((d,i) => i * 40)
        .attr("y", d => d.value > 0 ? y(d.value) : height)
        .attr("height", d => d.value > 0 ? Math.max(height - y(d.value), 3) : 0);

    // ── DATA LABELS: EXACT DESIGN ATTRIBUTES ON TOP OF EVERY ACTIVE ACTION COLUMN ──
    stateGroups.selectAll(".breath-bar-count-label")
        .data(d => actions.map(action => ({ action, value: d[action] })))
        .enter().append("text")
        .attr("class", "breath-bar-count-label")
        .attr("x", d => x1(d.action) + x1.bandwidth() / 2)
        .attr("text-anchor", "middle")
        .style("font-family", '"DM Sans", sans-serif')
        .style("font-size", "11px")
        .style("font-weight", "500")
        .style("fill", "#475569")
        .attr("y", height)
        .text(d => d.value > 0 ? d.value.toLocaleString() : "")
        .transition().duration(700).delay((d,i) => i * 40)
        .attr("y", d => d.value > 0 ? y(d.value) - 7 : height);

    // Append fallback notices for states with unrecorded metric profiles
    data.forEach(d => {
        const total = d.FINES + d.ARRESTS + d.CHARGES;
        if (total === 0) {
            const centerX = x0(d.STATE) + x0.bandwidth() / 2;
            svg.append("text").attr("x", centerX).attr("y", height - 25).attr("text-anchor", "middle")
                .style("font-size", "9px").style("font-weight", "500").style("fill", "#94a3b8")
                .style("font-family", "'DM Sans', sans-serif").text("NO DATA");
            svg.append("text").attr("x", centerX).attr("y", height - 12).attr("text-anchor", "middle")
                .style("font-size", "9px").style("fill", "#cbd5e1")
                .style("font-family", "'DM Sans', sans-serif").text("recorded");
        }
    });

    // Render legend block panel
    const legend = svg.append("g").attr("transform", `translate(${width + 15}, 15)`);
    actions.forEach((action, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 24})`);
        row.append("rect").attr("width", 12).attr("height", 12).attr("rx", 3).attr("fill", actionColors[action]);
        row.append("text").attr("x", 18).attr("y", 10).style("font-size", "12px")
            .style("fill", "#475569").style("font-family", "'DM Sans', sans-serif").text(breathLabels[action] || action);
    });
}

// Global window resize support tracker listener
window.addEventListener("resize", applyBreathFilters);