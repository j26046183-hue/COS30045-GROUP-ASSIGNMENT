// =====================
// BREATH-TESTS.JS
// 3 Charts:
// 1. Historical trend (line/bar) — breath_historical_trend.csv
// 2. Total positive tests by state (horizontal bar) — breath_by_state.csv
// 3. Enforcement actions (grouped bar) — breath_by_state.csv
// =====================

const breathTooltip = d3.select("body").append("div").attr("class", "tooltip");

const breathStateColors = {
    "ACT": "#2563eb", "NSW": "#16a34a", "NT":  "#f59e0b",
    "QLD": "#dc2626", "SA":  "#8b5cf6", "TAS": "#0891b2",
    "VIC": "#db2777", "WA":  "#ea580c"
};

let breathHistoricalData = [];
let breathStateData = [];

Promise.all([
    d3.csv("data/breath_historical_trend.csv"),
    d3.csv("data/breath_by_state.csv")
]).then(function([historical, byState]) {

    // Parse
    historical.forEach(d => { d.YEAR = +d.YEAR; d.COUNT = +d.COUNT; });
    byState.forEach(d => {
        d["TOTAL FINES"] = +d["TOTAL FINES"];
        d["TOTAL CHARGES"] = +d["TOTAL CHARGES"];
        d["TOTAL ARRESTS"] = +d["TOTAL ARRESTS"];
        d.COUNT = +d.COUNT;
    });

    breathHistoricalData = historical;
    breathStateData = byState;

    // Populate state filter
    const states = [...new Set(historical.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#breath-state-filter");
    stateFilter.selectAll("option:not([value='all'])").remove();
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));

    // Populate year filter from historical data
    const years = [...new Set(historical.map(d => d.YEAR))].sort((a,b) => a - b);
    const yearFilter = d3.select("#breath-year-filter");
    if (yearFilter.node()) {
        yearFilter.selectAll("option:not([value='all'])").remove();
        years.forEach(y => yearFilter.append("option").attr("value", y).text(y));
    }

    // Event listeners
    d3.select("#breath-state-filter").on("change", applyBreathFilters);
    if (d3.select("#breath-year-filter").node()) {
        d3.select("#breath-year-filter").on("change", applyBreathFilters);
    }

    applyBreathFilters();
});

function applyBreathFilters() {
    const selectedState = d3.select("#breath-state-filter").property("value");
    const yearFilterNode = d3.select("#breath-year-filter").node();
    const selectedYear = yearFilterNode ? yearFilterNode.value : "all";

    // Filter historical — state + year
    let filteredHistorical = breathHistoricalData.slice();
    if (selectedState !== "all") filteredHistorical = filteredHistorical.filter(d => d.STATE === selectedState);
    if (selectedYear !== "all") filteredHistorical = filteredHistorical.filter(d => d.YEAR === +selectedYear);

    // Filter state data — state only (no year column)
    let filteredState = breathStateData.slice();
    if (selectedState !== "all") filteredState = filteredState.filter(d => d.STATE === selectedState);

    // Update mini stats
    const totalTests = d3.sum(filteredState, d => d.COUNT);
    const totalCharges = d3.sum(filteredState, d => d["TOTAL CHARGES"]);
    const totalArrests = d3.sum(filteredState, d => d["TOTAL ARRESTS"]);
    const topState = [...breathStateData].sort((a,b) => b.COUNT - a.COUNT)[0];

    d3.select("#breath-total").text(totalTests.toLocaleString());
    d3.select("#breath-charges").text(totalCharges.toLocaleString());
    d3.select("#breath-arrests").text(totalArrests.toLocaleString());
    d3.select("#breath-top-state").text(topState ? topState.STATE : "—");

    // Draw all charts
    drawBreathHistorical(filteredHistorical, selectedYear);
    drawBreathBar(filteredState);
    drawBreathActions(filteredState);
}

// ── CHART 1: Historical Trend — auto switches line/bar ──
function drawBreathHistorical(data, selectedYear) {
    d3.select("#breath-historical-chart").selectAll("*").remove();
    if (data.length === 0) {
        d3.select("#breath-historical-chart")
            .append("p")
            .style("text-align", "center")
            .style("color", "#94a3b8")
            .style("padding", "40px")
            .text("No data available for selected filters");
        return;
    }

    if (selectedYear !== "all") {
        drawBreathHistoricalBar(data);
    } else {
        drawBreathHistoricalLine(data);
    }
}

function drawBreathHistoricalLine(data) {
    const margin = { top: 20, right: 120, bottom: 50, left: 70 };
    const width = document.getElementById("breath-historical-chart").offsetWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#breath-historical-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const grouped = d3.group(data, d => d.STATE);
    const uniqueYears = [...new Set(data.map(d => d.YEAR))].sort((a,b) => a - b);

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
        .text("Positive Breath Tests");

    const line = d3.line().x(d => x(d.YEAR)).y(d => y(d.COUNT)).curve(d3.curveMonotoneX);

    grouped.forEach((values, state) => {
        const sorted = values.sort((a,b) => a.YEAR - b.YEAR);
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
                    .html(`<strong>${d.STATE}</strong><br>Year: ${d.YEAR}<br>Positive Tests: ${d.COUNT.toLocaleString()}`);
            })
            .on("mousemove", function(event) {
                breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
            })
            .on("mouseout", function() { breathTooltip.style("opacity", 0); });
    });

    const legend = svg.append("g").attr("transform", `translate(${width + 12}, 0)`);
    ([...grouped.keys()]).sort().forEach((state, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
        row.append("line").attr("x1", 0).attr("x2", 14).attr("y1", 6).attr("y2", 6)
            .attr("stroke", breathStateColors[state] || "#94a3b8").attr("stroke-width", 2.5);
        row.append("text").attr("x", 18).attr("y", 10).attr("font-size", "11px")
            .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif").text(state);
    });
}

function drawBreathHistoricalBar(data) {
    const margin = { top: 20, right: 40, bottom: 50, left: 60 };
    const width = document.getElementById("breath-historical-chart").offsetWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#breath-historical-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const stateMap = d3.rollup(data, v => d3.sum(v, d => d.COUNT), d => d.STATE);
    const chartData = Array.from(stateMap, ([state, count]) => ({ state, count }))
        .sort((a,b) => b.count - a.count);

    const x = d3.scaleBand().domain(chartData.map(d => d.state)).range([0, width]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => d.count) * 1.1 || 100]).range([height, 0]);

    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    svg.append("text")
        .attr("transform", "rotate(-90)").attr("y", -45).attr("x", -height/2)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
        .text("Positive Breath Tests");

    svg.selectAll(".bar").data(chartData).enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.state))
        .attr("y", d => y(d.count))
        .attr("width", x.bandwidth())
        .attr("height", d => Math.max(0, height - y(d.count)))
        .attr("rx", 5)
        .attr("fill", d => breathStateColors[d.state] || "#2563eb")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            breathTooltip.style("opacity", 1)
                .html(`<strong>${d.state}</strong><br>Positive Tests: ${d.count.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() { d3.select(this).attr("opacity", 1); breathTooltip.style("opacity", 0); });

    svg.selectAll(".bar-label").data(chartData).enter().append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.state) + x.bandwidth() / 2)
        .attr("y", d => y(d.count) - 6)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif")
        .text(d => d.count.toLocaleString());
}

// ── CHART 2: Total Tests by State ──
function drawBreathBar(data) {
    d3.select("#breath-bar-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 10, right: 120, bottom: 40, left: 60 };
    const width = document.getElementById("breath-bar-chart").offsetWidth - margin.left - margin.right;
    const height = 320 - margin.top - margin.bottom;

    const svg = d3.select("#breath-bar-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const sorted = [...data].sort((a,b) => b.COUNT - a.COUNT);

    const x = d3.scaleLinear().domain([0, d3.max(sorted, d => d.COUNT) * 1.1 || 100]).range([0, width]);
    const y = d3.scaleBand().domain(sorted.map(d => d.STATE)).range([0, height]).padding(0.25);

    svg.append("g").attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4).tickSize(-height).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
            return d;
        }));
    svg.append("g").attr("class", "axis").call(d3.axisLeft(y));

    svg.selectAll(".bar").data(sorted).enter().append("rect")
        .attr("class", "bar").attr("x", 0).attr("y", d => y(d.STATE))
        .attr("height", y.bandwidth()).attr("width", 0).attr("rx", 5)
        .attr("fill", d => breathStateColors[d.STATE] || "#2563eb")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            breathTooltip.style("opacity", 1)
                .html(`<strong>${d.STATE}</strong><br>Positive Tests: ${d.COUNT.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() { d3.select(this).attr("opacity", 1); breathTooltip.style("opacity", 0); })
        .transition().duration(700).delay((d,i) => i * 80)
        .attr("width", d => x(d.COUNT));

    svg.selectAll(".bar-label").data(sorted).enter().append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.COUNT) + 6)
        .attr("y", d => y(d.STATE) + y.bandwidth() / 2 + 4)
        .attr("font-size", "11px").attr("fill", "#475569")
        .attr("font-family", "DM Sans, sans-serif")
        .text(d => d.COUNT.toLocaleString());
}

// ── CHART 3: Enforcement Actions Grouped Bar ──
function drawBreathActions(data) {
    d3.select("#breath-actions-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 20, right: 160, bottom: 50, left: 60 };
    const width = document.getElementById("breath-actions-chart").offsetWidth - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const svg = d3.select("#breath-actions-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const actions = ["TOTAL FINES", "TOTAL ARRESTS", "TOTAL CHARGES"];
    const actionLabels = { "TOTAL FINES": "Fines", "TOTAL ARRESTS": "Arrests", "TOTAL CHARGES": "Charges" };
    const actionColors = { "TOTAL FINES": "#2563eb", "TOTAL ARRESTS": "#ef4444", "TOTAL CHARGES": "#f59e0b" };
    const actionKeys = ["Fines", "Arrests", "Charges"];

    // Build per-state data
    const chartData = data.map(d => ({
        state: d.STATE,
        Fines: d["TOTAL FINES"],
        Arrests: d["TOTAL ARRESTS"],
        Charges: d["TOTAL CHARGES"]
    })).sort((a,b) => (b.Fines + b.Arrests + b.Charges) - (a.Fines + a.Arrests + a.Charges));

    const states = chartData.map(d => d.state);

    const x0 = d3.scaleBand().domain(states).range([0, width]).padding(0.25);
    const x1 = d3.scaleBand().domain(actionKeys).range([0, x0.bandwidth()]).padding(0.08);
    const maxVal = d3.max(chartData, d => Math.max(d.Fines, d.Arrests, d.Charges)) || 100;
    const y = d3.scaleLinear().domain([0, maxVal * 1.1]).range([height, 0]);

    const colorMap = { "Fines": "#2563eb", "Arrests": "#ef4444", "Charges": "#f59e0b" };

    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x0));
    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    const stateGroups = svg.selectAll(".state-group")
        .data(chartData).enter().append("g")
        .attr("class", "state-group")
        .attr("transform", d => `translate(${x0(d.state)},0)`);

    stateGroups.selectAll("rect")
        .data(d => actionKeys.map(a => ({ action: a, state: d.state, value: d[a] })))
        .enter().append("rect")
        .attr("x", d => x1(d.action))
        .attr("y", height).attr("width", x1.bandwidth()).attr("height", 0).attr("rx", 3)
        .attr("fill", d => colorMap[d.action])
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            breathTooltip.style("opacity", 1)
                .html(`<strong>${d.state}</strong><br>${d.action}: ${d.value.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() { d3.select(this).attr("opacity", 1); breathTooltip.style("opacity", 0); })
        .transition().duration(700).delay((d,i) => i * 40)
        .attr("y", d => d.value > 0 ? y(d.value) : height)
        .attr("height", d => d.value > 0 ? Math.max(height - y(d.value), 3) : 0);

    const legend = svg.append("g").attr("transform", `translate(${width + 12}, 0)`);
    actionKeys.forEach((action, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 24})`);
        row.append("rect").attr("width", 12).attr("height", 12).attr("rx", 3).attr("fill", colorMap[action]);
        row.append("text").attr("x", 16).attr("y", 10).attr("font-size", "12px")
            .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif").text(action);
    });
}