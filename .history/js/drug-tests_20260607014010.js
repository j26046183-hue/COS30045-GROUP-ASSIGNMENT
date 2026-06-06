// =====================
// DRUG-TESTS.JS
// Fully interactive dashboard logic for Roadside Drug Driving Metrics
// Data requirements: Assumes data fields align with YEAR, STATE, DRUG_TYPE, POSITIVE_TESTS, TOTAL_CHARGES, TOTAL_ARRESTS, TOTAL_FINES
// =====================

const drugTooltip = d3.select("body").append("div").attr("class", "tooltip");

// Cohesive Color Schemes
const drugStateColors = {
    "NSW": "#2563eb", "VIC": "#1d4ed8", "QLD": "#10b981", 
    "WA": "#f59e0b",  "SA": "#ef4444", "TAS": "#8b5cf6", 
    "ACT": "#ec4899", "NT": "#64748b"
};

const drugTypeColors = {
    "Amphetamine": "#3b82f6",
    "Methylamphetamine": "#1d4ed8",
    "Cannabis": "#10b981",
    "Cocaine": "#ef4444",
    "Ecstasy": "#f59e0b",
    "Other": "#94a3b8"
};

// Global raw dataset cache
let drugRawData = [];

// Load the source CSV database file
d3.csv("data/drug_enforcement_metrics.csv").then(function(data) {
    
    // Parse structural strings into proper numbers
    data.forEach(d => {
        d.YEAR = +d.YEAR;
        d.POSITIVE_TESTS = +d.POSITIVE_TESTS || 0;
        d.TOTAL_CHARGES = +d.TOTAL_CHARGES || 0;
        d.TOTAL_ARRESTS = +d.TOTAL_ARRESTS || 0;
        d.TOTAL_FINES = +d.TOTAL_FINES || 0;
    });

    drugRawData = data;

    // Build the structural dynamic filter options
    const states = [...new Set(data.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#drug-state-filter");
    states.forEach(s => {
        if(s && s !== "Unknown") stateFilter.append("option").attr("value", s).text(s);
    });

    // Build unique structural year options dynamically
    const years = [...new Set(data.map(d => d.YEAR))].sort((a,b) => b - a);
    const yearFilter = d3.select("#drug-year-filter");
    // Clear static fallback items from HTML blueprint and map programmatically
    yearFilter.selectAll("option").remove();
    yearFilter.append("option").attr("value", "all").text("All Years");
    years.forEach(y => {
        if(y) yearFilter.append("option").attr("value", y).text(y);
    });

    // Register active change event handlers
    d3.select("#drug-state-filter").on("change", applyDrugFilters);
    d3.select("#drug-year-filter").on("change", applyDrugFilters);

    // Initial load execution rendering
    applyDrugFilters();
});

function applyDrugFilters() {
    const selectedState = d3.select("#drug-state-filter").property("value");
    const selectedYear = d3.select("#drug-year-filter").property("value");

    // Filter baseline arrays cross-relationally
    let filteredData = drugRawData.slice();
    if (selectedState !== "all") filteredData = filteredData.filter(d => d.STATE === selectedState);
    if (selectedYear !== "all") filteredData = filteredData.filter(d => d.YEAR === +selectedYear);

    // ── UPDATE THE 6 DYNAMIC MINI STATS CARDS ──
    const totalPositives = d3.sum(filteredData, d => d.POSITIVE_TESTS);
    const totalCharges = d3.sum(filteredData, d => d.TOTAL_CHARGES);
    const totalArrests = d3.sum(filteredData, d => d.TOTAL_ARRESTS);

    // Track dynamic metric winners (Tops)
    const stateMap = d3.rollup(filteredData, v => d3.sum(v, d => d.POSITIVE_TESTS), d => d.STATE);
    const topState = [...stateMap.entries()].sort((a,b) => b[1] - a[1])[0];

    const yearMap = d3.rollup(filteredData, v => d3.sum(v, d => d.POSITIVE_TESTS), d => d.YEAR);
    const topYear = [...yearMap.entries()].sort((a,b) => b[1] - a[1])[0];

    const drugMap = d3.rollup(filteredData, v => d3.sum(v, d => d.POSITIVE_TESTS), d => d.DRUG_TYPE);
    const topDrug = [...drugMap.entries()].sort((a,b) => b[1] - a[1])[0];

    // Push calculations safely directly into DOM nodes
    d3.select("#drug-total").text(totalPositives.toLocaleString());
    d3.select("#drug-charges").text(totalCharges.toLocaleString());
    d3.select("#drug-arrests").text(totalArrests.toLocaleString());
    d3.select("#drug-top").text(topDrug ? topDrug[0] : "—");
    d3.select("#drug-top-state").text(topState ? topState[0] : "—");
    d3.select("#drug-top-year").text(topYear ? topYear[0] : "—");

    // ── DRAW GRAPHICAL COMPONENTS VIA PIPELINE ──
    drawDrugHistorical(filteredData);
    drawDrugDonut(filteredData);
    drawDrugBar(filteredData);
    drawDrugActions(filteredData);
}

// ── CHART 1: HISTORICAL TREND (LINE CHART) ──
function drawDrugHistorical(data) {
    d3.select("#drug-historical-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 20, right: 120, bottom: 40, left: 70 };
    const width = document.getElementById("drug-historical-chart").offsetWidth - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const svg = d3.select("#drug-historical-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Grouping computation by state configurations
    const grouped = d3.rollup(data, v => d3.sum(v, d => d.POSITIVE_TESTS), d => d.STATE, d => d.YEAR);
    
    let chartData = [];
    grouped.forEach((yearMap, state) => {
        yearMap.forEach((total, year) => {
            chartData.push({ state, year, total });
        });
    });
    chartData.sort((a,b) => a.year - b.year);

    const x = d3.scaleLinear().domain(d3.extent(chartData, d => d.year)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => d.total) * 1.1 || 100]).range([height, 0]);

    // Grid System Lines
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")));

    const line = d3.line().x(d => x(d.year)).y(d => y(d.total)).curve(d3.curveMonotoneX);
    const nestedByState = d3.group(chartData, d => d.state);

    nestedByState.forEach((values, state) => {
        const color = drugStateColors[state] || "#64748b";
        svg.append("path").datum(values)
            .attr("fill", "none").attr("stroke", color).attr("stroke-width", 2.5).attr("d", line);

        svg.selectAll(`.dot-${state}`)
            .data(values).enter().append("circle")
            .attr("cx", d => x(d.year)).attr("cy", d => y(d.total)).attr("r", 3.5)
            .attr("fill", color).attr("stroke", "#ffffff").attr("stroke-width", 1.5)
            .on("mouseover", (event, d) => {
                drugTooltip.style("opacity", 1).html(`<strong>State: ${d.state}</strong><br>Year: ${d.year}<br>Positives: ${d.total.toLocaleString()}`);
            })
            .on("mousemove", event => drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px"))
            .on("mouseout", () => drugTooltip.style("opacity", 0));
    });
}

// ── CHART 2: DRUG TYPE BREAKDOWN (DONUT CHART) ──
function drawDrugDonut(data) {
    d3.select("#drug-donut-chart").selectAll("*").remove();
    
    const width = document.getElementById("drug-donut-chart").offsetWidth;
    const height = 280;
    const radius = Math.min(width, height) / 2 - 40;

    const svg = d3.select("#drug-donut-chart")
        .append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${width / 2 - 40},${height / 2})`);

    const rolled = d3.rollup(data, v => d3.sum(v, d => d.POSITIVE_TESTS), d => d.DRUG_TYPE);
    const chartData = [...rolled.entries()].map(([type, value]) => ({ type, value })).filter(d => d.value > 0);

    if(chartData.length === 0) return;

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);

    svg.selectAll("path").data(pie(chartData)).enter().append("path")
        .attr("d", arc).attr("fill", d => drugTypeColors[d.data.type] || "#94a3b8")
        .style("stroke", "#fff").style("stroke-width", "2px")
        .on("mouseover", (event, d) => {
            drugTooltip.style("opacity", 1).html(`<strong>${d.data.type}</strong><br>Detected Count: ${d.data.value.toLocaleString()}`);
        })
        .on("mousemove", event => drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px"))
        .on("mouseout", () => drugTooltip.style("opacity", 0));

    // Dynamic clean structural chart labels legend context
    const legend = d3.select("#drug-donut-chart").select("svg").append("g")
        .attr("transform", `translate(${width - 150}, 40)`);

    chartData.forEach((d, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
        row.append("rect").attr("width", 11).attr("height", 11).attr("fill", drugTypeColors[d.type] || "#64748b").attr("rx", 2);
        row.append("text").attr("x", 18).attr("y", 10).style("font-size", "11px").text(d.type).attr("fill", "#475569");
    });
}

// ── CHART 3: POSITIVE TESTS BY STATE (BAR CHART) ──
function drawDrugBar(data) {
    d3.select("#drug-bar-chart").selectAll("*").remove();
    
    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const width = document.getElementById("drug-bar-chart").offsetWidth - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const svg = d3.select("#drug-bar-chart")
        .append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const rolled = d3.rollup(data, v => d3.sum(v, d => d.POSITIVE_TESTS), d => d.STATE);
    const chartData = [...rolled.entries()].map(([state, value]) => ({ state, value })).sort((a,b) => b.value - a.value);

    const x = d3.scaleBand().domain(chartData.map(d => d.state)).range([0, width]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => d.value) * 1.1 || 100]).range([height, 0]);

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")));

    svg.selectAll(".bar").data(chartData).enter().append("rect")
        .attr("x", d => x(d.state)).attr("y", d => y(d.value))
        .attr("width", x.bandwidth()).attr("height", d => height - y(d.value))
        .attr("fill", d => drugStateColors[d.state] || "#3b82f6").attr("rx", 4)
        .on("mouseover", (event, d) => {
            drugTooltip.style("opacity", 1).html(`<strong>State: ${d.state}</strong><br>Total Positives: ${d.value.toLocaleString()}`);
        })
        .on("mousemove", event => drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px"))
        .on("mouseout", () => drugTooltip.style("opacity", 0));
}

// ── CHART 4: ENFORCEMENT ACTIONS GROUPED BAR CHART (FINES VS ARRESTS VS CHARGES) ──
function drawDrugActions(data) {
    d3.select("#drug-actions-chart").selectAll("*").remove();

    const margin = { top: 30, right: 30, bottom: 40, left: 70 };
    const width = document.getElementById("drug-actions-chart").offsetWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#drug-actions-chart")
        .append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Aggregate enforcement subgroups per state structure execution
    const stateMap = d3.group(data, d => d.STATE);
    const subMetrics = ["Fines", "Arrests", "Charges"];
    
    let chartData = [];
    stateMap.forEach((rows, state) => {
        if (state && state !== "Unknown") {
            chartData.push({
                state: state,
                Fines: d3.sum(rows, d => d.TOTAL_FINES),
                Arrests: d3.sum(rows, d => d.TOTAL_ARRESTS),
                Charges: d3.sum(rows, d => d.TOTAL_CHARGES)
            });
        }
    });

    const x0 = d3.scaleBand().domain(chartData.map(d => d.state)).rangeRound([0, width]).paddingInner(0.2);
    const x1 = d3.scaleBand().domain(subMetrics).rangeRound([0, x0.bandwidth()]).padding(0.05);
    
    const maxVal = d3.max(chartData, d => Math.max(d.Fines, d.Arrests, d.Charges)) || 100;
    const y = d3.scaleLinear().domain([0, maxVal * 1.15]).rangeRound([height, 0]);

    const groupColors = { "Fines": "#f59e0b", "Arrests": "#ef4444", "Charges": "#10b981" };

    // Background horizontal dashed grid line supports
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x0));
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")));

    // Nested cluster data point population parsing map
    svg.append("g").selectAll("g")
        .data(chartData).enter().append("g")
        .attr("transform", d => `translate(${x0(d.state)},0)`)
        .selectAll("rect")
        .data(d => subMetrics.map(key => ({ key, value: d[key], state: d.state })))
        .enter().append("rect")
        .attr("x", d => x1(d.key)).attr("y", d => y(d.value))
        .attr("width", x1.bandwidth()).attr("height", d => height - y(d.value))
        .attr("fill", d => groupColors[d.key]).attr("rx", 2)
        .on("mouseover", (event, d) => {
            drugTooltip.style("opacity", 1).html(`<strong>${d.state} — ${d.key}</strong><br>Total Actions: ${d.value.toLocaleString()}`);
        })
        .on("mousemove", event => drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px"))
        .on("mouseout", () => drugTooltip.style("opacity", 0));

    // Dynamic Action Legend Mapping System Layout Placement Configuration
    const legend = svg.append("g").attr("transform", `translate(${width - 240}, -20)`);
    subMetrics.forEach((metric, idx) => {
        const item = legend.append("g").attr("transform", `translate(${idx * 80}, 0)`);
        item.append("rect").attr("width", 12).attr("height", 12).attr("fill", groupColors[metric]).attr("rx", 2);
        item.append("text").attr("x", 16).attr("y", 11).style("font-size", "11px").text(metric).attr("fill", "#475569");
    });
}