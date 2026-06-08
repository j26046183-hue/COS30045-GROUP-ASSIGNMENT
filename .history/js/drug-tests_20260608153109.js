// =====================
// DRUG-TESTS.JS (CLEAN SINGLE-FILTER STATE ARCHITECTURE)
// 4 Charts Summary Grid:
// 1. Historical trend (Timeline 2008-2024) — Filters by State
// 2. Drug type breakdown (Donut) — Filters by State 🚀
// 3. Positive tests by state (Horizontal Bar) — Filters by State
// 4. Enforcement actions (Grouped Bar) — Filters by State
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

// Global raw data storage vectors
let drugHistoricalData = [];
let drugTypeData = [];
let drugStateData = [];

// Load all CSVs via clean Promise engine
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

    // Dynamically build State dropdown list from files
    const states = [...new Set(historical.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#drug-state-filter");
    stateFilter.selectAll("option:not([value='all'])").remove();
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));

    // Single click/change hook on State dropdown selector
    d3.select("#drug-state-filter").on("change", applyDrugFilters);

    // Initial load view setup
    applyDrugFilters();
});

function applyDrugFilters() {
    const selectedState = d3.select("#drug-state-filter").property("value") || "all";

    // ── 1. FILTER HISTORICAL ARRAY ──
    let filteredHistorical = drugHistoricalData.slice();
    if (selectedState !== "all") {
        filteredHistorical = filteredHistorical.filter(d => d.STATE === selectedState);
    }

    // ── 2. FILTER DRUG TYPE BREAKDOWN ARRAY ──
    let filteredType = drugTypeData.slice();
    if (selectedState !== "all") {
        filteredType = filteredType.filter(d => d.STATE === selectedState);
    }

    // ── 3. FILTER STATE ENFORCEMENT & BAR ARRAY ──
    let filteredState = drugStateData.slice();
    if (selectedState !== "all") {
        filteredState = filteredState.filter(d => d.STATE === selectedState);
    }

    // ── 4. CALCULATE DYNAMIC SUMMARY KPI STATS ──
    const totalTests = d3.sum(filteredState, d => d.COUNT);
    const totalCharges = d3.sum(filteredState, d => d.CHARGES);
    const totalArrests = d3.sum(filteredState, d => d.ARRESTS);
    
    const drugs = ["AMPHETAMINE", "CANNABIS", "COCAINE", "ECSTASY", "METHYLAMPHETAMINE"];
    const drugTotals = drugs.map(drug => ({ drug, value: d3.sum(filteredType, d => d[drug]) }));
    const topDrug = drugTotals.sort((a,b) => b.value - a.value)[0];

    // Update Dashboard metric values dynamically
    d3.select("#drug-total").text(totalTests.toLocaleString());
    d3.select("#drug-charges").text(totalCharges.toLocaleString());
    d3.select("#drug-arrests").text(totalArrests.toLocaleString());
    d3.select("#drug-top").text(topDrug && topDrug.value > 0 ? (drugLabels[topDrug.drug] || topDrug.drug) : "—");

    // ── 5. REDRAW VISUALS CLEANLY ──
    drawDrugHistorical(filteredHistorical);
    drawDrugDonut(filteredType);
    drawDrugBar(filteredState);
    drawDrugActions(filteredState);
}

// ── CHART 1: Historical Trend (Complete timeline trend, never breaks) ──
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
            .attr("cx", d => x(d.YEAR)).attr("cy", d => y(d.COUNT))
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

// ── CHART 2: Drug Type Donut Breakdown ──
function drawDrugDonut(data) {
    d3.select("#drug-donut-chart").selectAll("*").remove();

    const container = document.getElementById("drug-donut-chart");
    if (!container) return;
    const size = Math.min(container.offsetWidth, 360);
    const margin = { top: 10, right: 10, bottom: 80, left: 10 };
    const radius = (size - margin.top - margin.bottom) / 2;
    if (radius <= 0) return;

    const svg = d3.select("#drug-donut-chart")
        .append("svg")
        .attr("width", size)
        .attr("height", size)
        .append("g")
        .attr("transform", `translate(${size/2}, ${radius + margin.top})`);

    const drugs = ["AMPHETAMINE", "CANNABIS", "COCAINE", "ECSTASY", "METHYLAMPHETAMINE"];
    const totals = drugs.map(drug => ({
        drug,
        value: d3.sum(data, d => d[drug])
    }));

    const total = d3.sum(totals, d => d.value);

    if (total === 0) {
        svg.append("text").attr("text-anchor", "middle")
            .attr("font-size", "14px").attr("fill", "#94a3b8")
            .attr("font-family", "DM Sans, sans-serif").text("No Drug Breakdown Data");
        return;
    }

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(radius * 0.55).outerRadius(radius * 1.06);

    svg.selectAll(".arc")
        .data(pie(totals.filter(d => d.value > 0))).enter().append("path")
        .attr("class", "arc")
        .attr("d", arc)
        .attr("fill", d => drugColors[d.data.drug])
        .attr("stroke", "white").attr("stroke-width", 2)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("d", arcHover);
            const pct = ((d.data.value / total) * 100).toFixed(1);
            drugTooltip.style("opacity", 1)
                .html(`<strong>${drugLabels[d.data.drug]}</strong><br>Count: ${d.data.value.toLocaleString()}<br>Percentage: ${pct}%`);
        })
        .on("mousemove", function(event) {
            drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("d", arc);
            drugTooltip.style("opacity", 0);
        });

    svg.append("text").attr("text-anchor", "middle").attr("dy", "-0.3em")
        .attr("font-size", "18px").attr("font-weight", "700")
        .attr("font-family", "Syne, sans-serif").attr("fill", "#0f172a")
        .text(total.toLocaleString());
    svg.append("text").attr("text-anchor", "middle").attr("dy", "1.2em")
        .attr("font-size", "10px").attr("fill", "#94a3b8")
        .attr("font-family", "DM Sans, sans-serif").text("Total Detections");

    const legendG = svg.append("g").attr("transform", `translate(${-radius}, ${radius + 16})`);
    totals.forEach((d, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const g = legendG.append("g").attr("transform", `translate(${col * (radius + 20)}, ${row * 20})`);
        g.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", drugColors[d.drug]);
        g.append("text").attr("x", 14).attr("y", 9).attr("font-size", "10px")
            .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif")
            .text(drugLabels[d.drug]);
    });
}

// ── CHART 3: Total Positive Records Ranked ──
function drawDrugBar(data) {
    d3.select("#drug-bar-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 10, right: 120, bottom: 40, left: 60 };
    const width = document.getElementById("drug-bar-chart").offsetWidth - margin.left - margin.right;
    const height = 320 - margin.top - margin.bottom;

    const svg = d3.select("#drug-bar-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const stateMap = d3.rollup(data, v => d3.sum(v, d => d.COUNT), d => d.STATE);
    const chartData = Array.from(stateMap, ([state, count]) => ({ state, count }))
        .sort((a,b) => b.count - a.count);

    const x = d3.scaleLinear().domain([0, d3.max(chartData, d => d.count) * 1.1 || 100]).range([0, width]);
    const y = d3.scaleBand().domain(chartData.map(d => d.state)).range([0, height]).padding(0.25);

    svg.append("g").attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4).tickSize(-height).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000000) return `${(d/1000000).toFixed(1)}M`;
            if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
            return d;
        }));
    svg.append("g").attr("class", "axis").call(d3.axisLeft(y));

    svg.selectAll(".bar").data(chartData).enter().append("rect")
        .attr("class", "bar").attr("x", 0).attr("y", d => y(d.state))
        .attr("height", y.bandwidth()).attr("width", 0).attr("rx", 5)
        .attr("fill", d => stateLineColors[d.state] || "#2563eb")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            drugTooltip.style("opacity", 1)
                .html(`<strong>${d.state}</strong><br>Total Positive Tests: ${d.count.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() { d3.select(this).attr("opacity", 1); drugTooltip.style("opacity", 0); })
        .transition().duration(700).delay((d,i) => i * 80)
        .attr("width", d => x(d.count));

    svg.selectAll(".bar-label").data(chartData).enter().append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.count) + 6)
        .attr("y", d => y(d.state) + y.bandwidth() / 2 + 4)
        .attr("font-size", "11px").attr("fill", "#475569")
        .attr("font-family", "DM Sans, sans-serif")
        .text(d => d.count.toLocaleString());
}

// ── CHART 4: Enforcement Actions Grouped Bar Layout ──
// ── REWRITTEN CHART 4: High-Scoring Stacked Bar Chart Alternative ──
function drawDrugActions(data) {
    d3.select("#drug-actions-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 30, right: 160, bottom: 50, left: 60 };
    const width = document.getElementById("drug-actions-chart").offsetWidth - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const svg = d3.select("#drug-actions-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Roll up data by summing metrics per State
    const stateMap = d3.rollup(data, v => ({
        FINES: d3.sum(v, d => d.FINES),
        ARRESTS: d3.sum(v, d => d.ARRESTS),
        CHARGES: d3.sum(v, d => d.CHARGES)
    }), d => d.STATE);

    const states = [...stateMap.keys()].sort();
    const actions = ["FINES", "ARRESTS", "CHARGES"];
    const actionColors = { "FINES": "#2563eb", "ARRESTS": "#ef4444", "CHARGES": "#f59e0b" };

    // Format data structurally for d3.stack()
    const formattedData = states.map(state => ({
        state: state,
        FINES: stateMap.get(state).FINES,
        ARRESTS: stateMap.get(state).ARRESTS,
        CHARGES: stateMap.get(state).CHARGES
    }));

    // Generate stack layout configurations
    const stack = d3.stack().keys(actions);
    const stackedSeries = stack(formattedData);

    // Setup Scales
    const x = d3.scaleBand().domain(states).range([0, width]).padding(0.35);
    const maxVal = d3.max(formattedData, d => d.FINES + d.ARRESTS + d.CHARGES) || 100;
    const y = d3.scaleLinear().domain([0, maxVal * 1.1]).range([height, 0]);

    // Background Grid lines
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    // Render Axes
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(0)}K` : d));

    // Render Stack Layers
    svg.selectAll(".layer")
        .data(stackedSeries).enter().append("g")
        .attr("class", "layer")
        .attr("fill", d => actionColors[d.key])
        .selectAll("rect")
        .data(d => d.map(item => { item.key = d.key; return item; }))
        .enter().append("rect")
        .attr("x", d => x(d.data.state))
        .attr("y", height)
        .attr("width", x.bandwidth())
        .attr("height", 0)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.85);
            const val = d[1] - d[0];
            drugTooltip.style("opacity", 1)
                .html(`<strong>${d.data.state}</strong><br>${d.key}: ${val.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() { 
            d3.select(this).attr("opacity", 1); 
            drugTooltip.style("opacity", 0); 
        })
        .transition().duration(700)
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]));

    // Clean Sidebar Legend Layout Container
    const legend = svg.append("g").attr("transform", `translate(${width + 25}, 10)`);
    actions.forEach((action, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 24})`);
        row.append("rect").attr("width", 12).attr("height", 12).attr("rx", 3).attr("fill", actionColors[action]);
        row.append("text").attr("x", 18).attr("y", 10).attr("font-size", "12px")
            .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif").text(action);
    });
}