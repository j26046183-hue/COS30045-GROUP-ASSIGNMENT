// =====================
// DRUG-TESTS.JS (HYBRID SINGLE STATE + LOCAL RECENT YEAR FILTER)
// 4 Charts Summary Grid Matrix:
// 1. Historical trend — Listens to State Filter (Shows complete 2008-2024 timeline)
// 2. Drug type breakdown (Donut) — Listens to State Filter + Local 2023-2024 Year Filter 🚀
// 3. Positive tests (Lollipop) — Listens to State Filter + Local 2023-2024 Year Filter 🍭
// 4. Enforcement actions (Grouped Bar) — Listens to State Filter (Aggregates historical footprints)
// =====================

const drugTooltip = d3.select("body").append("div").attr("class", "tooltip");

const stateLineColors = {
    "ACT": "#2563eb", "NSW": "#16a34a", "NT":  "#f59e0b",
    "QLD": "#dc2626", "SA":  "#8b5cf6", "TAS": "#0891b2",
    "VIC": "#db2777", "WA":  "#ea580c"
};

const drugColors = {
    "AMPHETAMINE":       "#2563eb",
    "CANNABIS":          "#16a34a",
    "COCAINE":           "#f59e0b",
    "ECSTASY":           "#dc2626",
    "METHYLAMPHETAMINE": "#8b5cf6"
};

const drugLabels = {
    "AMPHETAMINE":       "Amphetamine",
    "CANNABIS":          "Cannabis",
    "COCAINE":           "Cocaine",
    "ECSTASY":           "Ecstasy",
    "METHYLAMPHETAMINE": "Methylamphetamine"
};

// Global data storage matrices
let drugHistoricalData = [];
let drugTypeData = [];
let drugStateData = [];

// Load all CSVs via Promise engine
Promise.all([
    d3.csv("data/drug_historical_trend.csv"),
    d3.csv("data/drug_by_type.csv"),
    d3.csv("data/drug_by_year_state.csv")
]).then(function([historical, byType, byState]) {

    // Clean data parsing routines
    historical.forEach(d => { d.YEAR = +d.YEAR; d.COUNT = +d.COUNT; });
    byType.forEach(d => {
        d.YEAR = +d.YEAR;
        d.AMPHETAMINE = +d.AMPHETAMINE;
        d.CANNABIS = +d.CANNABIS;
        d.COCAINE = +d.COCAINE;
        d.ECSTASY = +d.ECSTASY;
        d.METHYLAMPHETAMINE = +d.METHYLAMPHETAMINE;
    });
    byState.forEach(d => {
        d.YEAR = +d.YEAR;
        d.COUNT = +d.COUNT;
        d.FINES = +d.FINES;
        d.ARRESTS = +d.ARRESTS;
        d.CHARGES = +d.CHARGES;
    });

    drugHistoricalData = historical;
    drugTypeData = byType;
    drugStateData = byState;

    // Dynamically build global State dropdown filter list
    const states = [...new Set(historical.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#drug-state-filter");
    stateFilter.selectAll("option:not([value='all'])").remove();
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));

    // Hook listeners directly to cross-filter loops
    d3.select("#drug-state-filter").on("change", applyDrugFilters);
    
    // Hook listener directly to your specific mid-row year filter dropdown!
    d3.select("#drug-recent-year-filter").on("change", applyDrugFilters);

    // Initial render call execution
    applyDrugFilters();
});

function applyDrugFilters() {
    // Read the active filter variables from selection elements
    const selectedState = d3.select("#drug-state-filter").property("value") || "all";
    const selectedRecentYear = d3.select("#drug-recent-year-filter").property("value") || "all";

    // ── 1. FILTER GENERAL FOOTPRINT ARRAYS (Listens only to State to stay stable) ──
    let filteredHistorical = drugHistoricalData.slice();
    if (selectedState !== "all") filteredHistorical = filteredHistorical.filter(d => d.STATE === selectedState);

    let filteredState = drugStateData.slice();
    if (selectedState !== "all") filteredState = filteredState.filter(d => d.STATE === selectedState);

    // ── 2. SPECIAL MIXED LOCAL FILTER (Donut & Lollipop listen to BOTH State and Year) ──
    let filteredType = drugTypeData.slice();
    if (selectedState !== "all") filteredType = filteredType.filter(d => d.STATE === selectedState);
    if (selectedRecentYear !== "all") filteredType = filteredType.filter(d => d.YEAR === +selectedRecentYear);

    let filteredLollipop = drugStateData.slice();
    if (selectedState !== "all") filteredLollipop = filteredLollipop.filter(d => d.STATE === selectedState);
    if (selectedRecentYear !== "all") filteredLollipop = filteredLollipop.filter(d => d.YEAR === +selectedRecentYear);

    // ── 3. CALCULATE INTERACTIVE TOP CARD SUMMARY STATS ──
    const totalTests = d3.sum(filteredState, d => d.COUNT);
    const totalCharges = d3.sum(filteredState, d => d.CHARGES);
    const totalArrests = d3.sum(filteredState, d => d.ARRESTS);
    
    const drugs = ["AMPHETAMINE", "CANNABIS", "COCAINE", "ECSTASY", "METHYLAMPHETAMINE"];
    const drugTotals = drugs.map(drug => ({ drug, value: d3.sum(filteredType, d => d[drug]) }));
    const topDrug = drugTotals.sort((a,b) => b.value - a.value)[0];

    // Update Top Dashboard summary text blocks
    d3.select("#drug-total").text(totalTests.toLocaleString());
    d3.select("#drug-charges").text(totalCharges.toLocaleString());
    d3.select("#drug-arrests").text(totalArrests.toLocaleString());
    d3.select("#drug-top").text(topDrug && topDrug.value > 0 ? (drugLabels[topDrug.drug] || topDrug.drug) : "—");

    // ── 4. REDRAW ACTIVE CANVAS BLOCKS CLEANLY ──
    drawDrugHistorical(filteredHistorical);
    drawDrugDonut(filteredType);       // Receives the dual-filtered dataset 🚀
    drawDrugBar(filteredLollipop);     // Receives the dual-filtered dataset 🍭
    drawDrugActions(filteredState);
}

// ── CHART 1: Historical Trend Line Layout ──
function drawDrugHistorical(data) {
    d3.select("#drug-historical-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 20, right: 120, bottom: 50, left: 70 };
    const width = document.getElementById("drug-historical-chart").offsetWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#drug-historical-chart")
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
        .attr("transform", "rotate(-90)").attr("y", -55).attr("x", -height/2)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
        .text("Positive Drug Tests");

    const line = d3.line().x(d => x(d.YEAR)).y(d => y(d.COUNT)).curve(d3.curveMonotoneX);

    grouped.forEach((values, state) => {
        const sorted = values.sort((a,b) => a.YEAR - b.YEAR);
        const color = stateLineColors[state] || "#94a3b8";

        svg.append("path").datum(sorted)
            .attr("fill", "none").attr("stroke", color)
            .attr("stroke-width", 2.5).attr("d", line);

        svg.selectAll(`.dot-${state}`)
            .data(sorted).enter().append("circle")
            .attr("cx", d => x(d.YEAR)).attr("cy", d => y(d.COUNT) || height)
            .attr("r", 3.5).attr("fill", color).attr("stroke", "white").attr("stroke-width", 1.5)
            .on("mouseover", function(event, d) {
                drugTooltip.style("opacity", 1)
                    .html(`<strong>${d.STATE}</strong><br>Year: ${d.YEAR}<br>Positive Tests: ${d.COUNT.toLocaleString()}`);
            })
            .on("mousemove", function(event) {
                drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
            })
            .on("mouseout", function() { drugTooltip.style("opacity", 0); });
    });

    const legend = svg.append("g").attr("transform", `translate(${width + 12}, 0)`);
    ([...grouped.keys()]).sort().forEach((state, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
        row.append("line").attr("x1", 0).attr("x2", 14).attr("y1", 6).attr("y2", 6)
            .attr("stroke", stateLineColors[state] || "#94a3b8").attr("stroke-width", 2.5);
        row.append("text").attr("x", 18).attr("y", 10).attr("font-size", "11px")
            .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif").text(state);
    });
}

// ── CHART 2: Perfectly Styled & Centered Drug Type Donut Breakdown ──
function drawDrugDonut(data) {
    d3.select("#drug-donut-chart").selectAll("*").remove();
    const container = document.getElementById("drug-donut-chart");
    if (!container) return;
    
    const width = container.offsetWidth;
    const height = 320; 
    const margin = { top: 20, right: 20, bottom: 60, left: 20 };
    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;

    const svg = d3.select("#drug-donut-chart").append("svg").attr("width", width).attr("height", height);
    const chartG = svg.append("g").attr("transform", `translate(${width / 2}, ${radius + margin.top})`);

    const drugs = ["AMPHETAMINE", "CANNABIS", "COCAINE", "ECSTASY", "METHYLAMPHETAMINE"];
    const totals = drugs.map(drug => ({ drug, value: d3.sum(data, d => d[drug]) }));
    const total = d3.sum(totals, d => d.value);

    if (total === 0) {
        chartG.append("text").attr("text-anchor", "middle")
            .attr("font-size", "13px").attr("fill", "#94a3b8")
            .attr("font-family", "DM Sans, sans-serif").text("No Breakdowns Available");
        return;
    }

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.60).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(radius * 0.60).outerRadius(radius * 1.05);

    chartG.selectAll(".arc")
        .data(pie(totals.filter(d => d.value > 0))).enter().append("path")
        .attr("class", "arc").attr("d", arc).attr("fill", d => drugColors[d.data.drug])
        .attr("stroke", "white").attr("stroke-width", 2.5)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("d", arcHover);
            const pct = ((d.data.value / total) * 100).toFixed(1);
            drugTooltip.style("opacity", 1)
                .html(`<strong>${drugLabels[d.data.drug]}</strong><br>Count: ${d.data.value.toLocaleString()}<br>Percentage: ${pct}%`);
        })
        .on("mousemove", function(event) {
            drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() { d3.select(this).attr("d", arc); drugTooltip.style("opacity", 0); });

    chartG.append("text").attr("text-anchor", "middle").attr("dy", "-0.2em")
        .attr("font-size", "22px").attr("font-weight", "700")
        .attr("font-family", "Syne, sans-serif").attr("fill", "#0f172a").text(total.toLocaleString());
        
    chartG.append("text").attr("text-anchor", "middle").attr("dy", "1.2em")
        .attr("font-size", "11px").attr("font-weight", "500")
        .attr("font-family", "DM Sans, sans-serif").attr("fill", "#94a3b8").text("Total Detections");

    const legendG = svg.append("g").attr("class", "donut-legend");
    let currentX = 0, currentY = 0;
    const itemSpacingX = 135, itemSpacingY = 20;

    totals.forEach((d, i) => {
        const itemG = legendG.append("g").attr("transform", `translate(${currentX}, ${currentY})`);
        itemG.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2.5).attr("fill", drugColors[d.drug]);
        itemG.append("text").attr("x", 16).attr("y", 9).attr("font-size", "11px").attr("font-weight", "500")
            .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif").text(drugLabels[d.drug]);
        if (i % 2 === 0) currentX += itemSpacingX; else { currentX = 0; currentY += itemSpacingY; }
    });

    const legendBounds = legendG.node().getBBox();
    legendG.attr("transform", `translate(${(width - legendBounds.width) / 2}, ${(radius * 2) + margin.top + 25})`);
}

// ── CHART 3: Premium Modern Horizontal Lollipop Chart Layout ──
function drawDrugBar(data) {
    d3.select("#drug-bar-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 20, right: 80, bottom: 40, left: 60 };
    const width = document.getElementById("drug-bar-chart").offsetWidth - margin.left - margin.right;
    const height = 320 - margin.top - margin.bottom;

    const svg = d3.select("#drug-bar-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Roll up based on whatever data comes down the local pipeline loop
    const stateMap = d3.rollup(data, v => d3.sum(v, d => d.COUNT), d => d.STATE);
    const chartData = Array.from(stateMap, ([state, count]) => ({ state, count }))
        .sort((a,b) => b.count - a.count);

    const x = d3.scaleLinear().domain([0, d3.max(chartData, d => d.count) * 1.1 || 100]).range([0, width]);
    const y = d3.scaleBand().domain(chartData.map(d => d.state)).range([0, height]).padding(0.5);

    svg.append("g").attr("class", "grid").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4).tickSize(-height).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(d => d >= 1000000 ? `${(d/1000000).toFixed(1)}M` : d >= 1000 ? `${(d/1000).toFixed(0)}K` : d));
    svg.append("g").attr("class", "axis").call(d3.axisLeft(y));

    // Stems
    svg.selectAll(".lollipop-line")
        .data(chartData).enter().append("line")
        .attr("class", "lollipop-line").attr("x1", 0).attr("x2", 0)
        .attr("y1", d => y(d.state) + y.bandwidth() / 2).attr("y2", d => y(d.state) + y.bandwidth() / 2)
        .attr("stroke", d => stateLineColors[d.state] || "#2563eb").attr("stroke-width", 2.5)
        .transition().duration(800).delay((d,i) => i * 50).attr("x2", d => x(d.count));

    // Circles
    svg.selectAll(".lollipop-circle")
        .data(chartData).enter().append("circle")
        .attr("class", "lollipop-circle").attr("cx", 0).attr("cy", d => y(d.state) + y.bandwidth() / 2)
        .attr("r", 6).attr("fill", d => stateLineColors[d.state] || "#2563eb").attr("stroke", "white").attr("stroke-width", 1.5)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 8);
            drugTooltip.style("opacity", 1).html(`<strong>${d.state}</strong><br>Positive Tests: ${d.count.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() { d3.select(this).attr("r", 6); drugTooltip.style("opacity", 0); })
        .transition().duration(800).delay((d,i) => i * 50).attr("cx", d => x(d.count));

    // Data Indicators
    svg.selectAll(".lollipop-label")
        .data(chartData).enter().append("text")
        .attr("class", "lollipop-label").attr("x", d => x(d.count) + 12).attr("y", d => y(d.state) + y.bandwidth() / 2 + 4)
        .attr("font-size", "11px").attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif")
        .text(d => d.count.toLocaleString());
}

// ── CHART 4: Grouped Bar Enforcement Layout with Explicit State Missing Notes ──
function drawDrugActions(data) {
    d3.select("#drug-actions-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 40, right: 160, bottom: 50, left: 60 };
    const width = document.getElementById("drug-actions-chart").offsetWidth - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const svg = d3.select("#drug-actions-chart").append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const stateMap = d3.rollup(data, v => ({ FINES: d3.sum(v, d => d.FINES), ARRESTS: d3.sum(v, d => d.ARRESTS), CHARGES: d3.sum(v, d => d.CHARGES) }), d => d.STATE);
    const states = [...stateMap.keys()].sort();
    const actions = ["FINES", "ARRESTS", "CHARGES"];
    const actionColors = { "FINES": "#2563eb", "ARRESTS": "#ef4444", "CHARGES": "#f59e0b" };

    const x0 = d3.scaleBand().domain(states).range([0, width]).padding(0.25);
    const x1 = d3.scaleBand().domain(actions).range([0, x0.bandwidth()]).padding(0.08);
    const maxVal = d3.max(states, s => d3.max(actions, a => stateMap.get(s)[a])) || 100;
    const y = d3.scaleLinear().domain([0, maxVal * 1.1]).range([height, 0]);

    svg.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat("")).selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x0));
    svg.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(0)}K` : d));

    const stateGroups = svg.selectAll(".state-group").data(states).enter().append("g").attr("transform", d => `translate(${x0(d)},0)`);

    stateGroups.selectAll("rect")
        .data(state => actions.map(action => ({ action, state, value: stateMap.get(state)[action] })))
        .enter().append("rect")
        .attr("x", d => x1(d.action)).attr("y", height).attr("width", x1.bandwidth()).attr("height", 0).attr("rx", 3).attr("fill", d => actionColors[d.action])
        .on("mouseover", function(event, d) { d3.select(this).attr("opacity", 0.8); drugTooltip.style("opacity", 1).html(`<strong>${d.state}</strong><br>${d.action}: ${d.value.toLocaleString()}`); })
        .on("mousemove", function(event) { drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px"); })
        .on("mouseout", function() { d3.select(this).attr("opacity", 1); drugTooltip.style("opacity", 0); })
        .transition().duration(700).delay((d,i) => i * 40).attr("y", d => d.value > 0 ? y(d.value) : height).attr("height", d => d.value > 0 ? Math.max(height - y(d.value), 3) : 0);

    states.forEach(state => {
        const metrics = stateMap.get(state);
        if (metrics.FINES + metrics.ARRESTS + metrics.CHARGES === 0) {
            const cx = x0(state) + x0.bandwidth() / 2;
            svg.append("text").attr("x", cx).attr("y", height - 25).attr("text-anchor", "middle").attr("font-size", "9px").attr("font-weight", "500").attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif").text("NO DATA");
            svg.append("text").attr("x", cx).attr("y", height - 12).attr("text-anchor", "middle").attr("font-size", "9px").attr("fill", "#cbd5e1").attr("font-family", "DM Sans, sans-serif").text("RECORDED");
        }
    });

    svg.append("text").attr("x", 0).attr("y", -15).attr("font-size", "11px").attr("font-style", "italic").attr("fill", "#64748b").attr("font-family", "DM Sans, sans-serif").text("* Note: Fines not reported for ACT, QLD, WA. Arrests not reported for NSW.");

    const legend = svg.append("g").attr("transform", `translate(${width + 12}, 15)`);
    actions.forEach((action, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 24})`);
        row.append("rect").attr("width", 12).attr("height", 12).attr("rx", 3).attr("fill", actionColors[action]);
        row.append("text").attr("x", 16).attr("y", 10).attr("font-size", "12px").attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif").text(action);
    });
}