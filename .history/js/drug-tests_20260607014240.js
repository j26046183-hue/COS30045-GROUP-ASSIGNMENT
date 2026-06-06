// ==========================================
// DRUG-TESTS.JS
// Production-ready D3 Architecture for Roadside Drug Driving Metrics
// ==========================================

// Global raw dataset cache
let drugRawData = [];

// Clean global tooltip configuration
const drugTooltip = d3.select("body")
    .selectAll(".drug-tooltip")
    .data([0])
    .join("div")
    .attr("class", "drug-tooltip")
    .style("position", "absolute")
    .style("background", "rgba(15, 23, 42, 0.95)")
    .style("color", "#fff")
    .style("padding", "8px 12px")
    .style("border-radius", "6px")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("box-shadow", "0 4px 6px -1px rgb(0 0 0 / 0.1)")
    .style("z-index", "9999")
    .style("font-family", "'DM Sans', sans-serif");

// Cohesive Dashboard Color Schemes
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

// Load the source CSV database file
d3.csv("data/drug_enforcement_metrics.csv").then(function(data) {
    
    // Parse structural strings into clean numbers with column-fallback options
    data.forEach(d => {
        d.YEAR = +d.YEAR || +d.Year || 0;
        d.STATE = d.STATE || d.State || "Unknown";
        d.DRUG_TYPE = d.DRUG_TYPE || d.Drug_Type || d.Substance || "Other";
        
        // Match numbers or provide structural zero defaults
        d.POSITIVE_TESTS = +d.POSITIVE_TESTS || +d.Positive_Tests || 0;
        d.TOTAL_CHARGES = +d.TOTAL_CHARGES || +d.Total_Charges || 0;
        d.TOTAL_ARRESTS = +d.TOTAL_ARRESTS || +d.Total_Arrests || 0;
        d.TOTAL_FINES = +d.TOTAL_FINES || +d.Total_Fines || 0;
    });

    drugRawData = data;

    // Dynamically inject configuration states into dropdown
    const states = [...new Set(data.map(d => d.STATE))].filter(s => s && s !== "Unknown").sort();
    const stateFilter = d3.select("#drug-state-filter");
    
    // Clean old options except baseline default "all"
    stateFilter.selectAll("option:not([value='all'])").remove();
    states.forEach(s => {
        stateFilter.append("option").attr("value", s).text(s);
    });

    // Register event listeners to update automatically
    d3.select("#drug-state-filter").on("change", applyDrugFilters);
    d3.select("#drug-year-filter").on("change", applyDrugFilters);

    // Initial operational render pass
    applyDrugFilters();
}).catch(function(err) {
    console.error("Critical error reading drug_enforcement_metrics.csv file:", err);
});

function applyDrugFilters() {
    const selectedState = d3.select("#drug-state-filter").property("value") || "all";
    const selectedYear = d3.select("#drug-year-filter").property("value") || "all";

    // Filter raw data cache cross-relationally
    let filteredData = drugRawData.slice();
    if (selectedState !== "all") filteredData = filteredData.filter(d => d.STATE === selectedState);
    if (selectedYear !== "all") filteredData = filteredData.filter(d => d.YEAR === +selectedYear);

    // ── 1. RENDER MINI STATS CARDS ──
    const totalPositives = d3.sum(filteredData, d => d.POSITIVE_TESTS);
    const totalCharges = d3.sum(filteredData, d => d.TOTAL_CHARGES);
    const totalArrests = d3.sum(filteredData, d => d.TOTAL_ARRESTS);

    // Roll up top drug type
    const drugMap = d3.rollup(filteredData, v => d3.sum(v, d => d.POSITIVE_TESTS), d => d.DRUG_TYPE);
    const topDrugArr = [...drugMap.entries()].sort((a,b) => b[1] - a[1]);
    const topDrugName = topDrugArr.length > 0 && topDrugArr[0][1] > 0 ? topDrugArr[0][0] : "None";

    // Bind values safely directly into DOM nodes
    d3.select("#drug-total").text(totalPositives ? totalPositives.toLocaleString() : "0");
    d3.select("#drug-charges").text(totalCharges ? totalCharges.toLocaleString() : "0");
    d3.select("#drug-arrests").text(totalArrests ? totalArrests.toLocaleString() : "0");
    d3.select("#drug-top").text(topDrugName);

    // ── 2. EXECUTE CHART DRAWING PIPELINES ──
    drawDrugHistorical(filteredData);
    drawDrugDonut(filteredData);
    drawDrugBar(filteredData);
    drawDrugActions(filteredData);
}

// ── CHART 1: HISTORICAL TREND (LINE CHART) ──
function drawDrugHistorical(data) {
    const container = d3.select("#drug-historical-chart");
    container.selectAll("*").remove();
    
    const containerNode = document.getElementById("drug-historical-chart");
    if (!containerNode || data.length === 0) return;

    const margin = { top: 20, right: 120, bottom: 40, left: 70 };
    const width = containerNode.offsetWidth - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    if (width <= 0) return;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Grouping computation across time fields
    const grouped = d3.rollup(data, v => d3.sum(v, d => d.POSITIVE_TESTS), d => d.STATE, d => d.YEAR);
    
    let chartData = [];
    grouped.forEach((yearMap, state) => {
        yearMap.forEach((total, year) => {
            if(year > 0) chartData.push({ state, year, total });
        });
    });
    chartData.sort((a,b) => a.year - b.year);

    if (chartData.length === 0) return;

    const x = d3.scaleLinear().domain(d3.extent(chartData, d => d.year)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => d.total) * 1.15 || 100]).range([height, 0]);

    // Grid System
    svg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line")
        .style("stroke", "#f1f5f9")
        .style("stroke-dasharray", "4,4");

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(Math.min(10, chartData.length)));
        
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")));

    const line = d3.line().x(d => x(d.year)).y(d => y(d.total)).curve(d3.curveMonotoneX);
    const nestedByState = d3.group(chartData, d => d.state);

    nestedByState.forEach((values, state) => {
        const color = drugStateColors[state] || "#64748b";
        
        // Draw path
        svg.append("path")
            .datum(values)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 2.5)
            .attr("d", line);

        // Interactive node dots
        svg.selectAll(`.dot-${state}`)
            .data(values).enter().append("circle")
            .attr("cx", d => x(d.year))
            .attr("cy", d => y(d.total))
            .attr("r", 4)
            .attr("fill", color)
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1.5)
            .style("cursor", "pointer")
            .on("mouseover", (event, d) => {
                drugTooltip.style("opacity", 1)
                    .html(`<strong>State: ${d.state}</strong><br>Year: ${d.year}<br>Positives: ${d.total.toLocaleString()}`);
            })
            .on("mousemove", event => {
                drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
            })
            .on("mouseout", () => drugTooltip.style("opacity", 0));
    });
}

// ── CHART 2: DRUG TYPE BREAKDOWN (DONUT CHART) ──
function drawDrugDonut(data) {
    const container = d3.select("#drug-donut-chart");
    container.selectAll("*").remove();
    
    const containerNode = document.getElementById("drug-donut-chart");
    if (!containerNode || data.length === 0) return;

    const width = containerNode.offsetWidth;
    const height = 280;
    const radius = Math.min(width, height) / 2 - 40;

    if (width <= 0) return;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2 - 60},${height / 2})`);

    const rolled = d3.rollup(data, v => d3.sum(v, d => d.POSITIVE_TESTS), d => d.DRUG_TYPE);
    const chartData = [...rolled.entries()].map(([type, value]) => ({ type, value })).filter(d => d.value > 0);

    if (chartData.length === 0) {
        container.append("div").style("text-align", "center").style("line-height", "280px").style("color", "#94a3b8").text("No data available for this selection");
        return;
    }

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);

    svg.selectAll("path")
        .data(pie(chartData))
        .enter().append("path")
        .attr("d", arc)
        .attr("fill", d => drugTypeColors[d.data.type] || "#94a3b8")
        .style("stroke", "#fff")
        .style("stroke-width", "2px")
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => {
            drugTooltip.style("opacity", 1)
                .html(`<strong>Substance: ${d.data.type}</strong><br>Count: ${d.data.value.toLocaleString()}`);
        })
        .on("mousemove", event => {
            drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", () => drugTooltip.style("opacity", 0));

    // Dynamic clean structural legends
    const legend = container.select("svg").append("g")
        .attr("transform", `translate(${width - 140}, 40)`);

    chartData.forEach((d, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 22})`);
        row.append("rect").attr("width", 12).attr("height", 12).attr("fill", drugTypeColors[d.type] || "#64748b").attr("rx", 3);
        row.append("text").attr("x", 18).attr("y", 11).style("font-size", "11px").text(d.type).attr("fill", "#475569");
    });
}

// ── CHART 3: POSITIVE TESTS BY STATE (BAR CHART) ──
function drawDrugBar(data) {
    const container = d3.select("#drug-bar-chart");
    container.selectAll("*").remove();
    
    const containerNode = document.getElementById("drug-bar-chart");
    if (!containerNode || data.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const width = containerNode.offsetWidth - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    if (width <= 0) return;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const rolled = d3.rollup(data, v => d3.sum(v, d => d.POSITIVE_TESTS), d => d.STATE);
    const chartData = [...rolled.entries()].map(([state, value]) => ({ state, value })).sort((a,b) => b.value - a.value);

    const x = d3.scaleBand().domain(chartData.map(d => d.state)).range([0, width]).padding(0.35);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => d.value) * 1.1 || 100]).range([height, 0]);

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")));

    svg.selectAll(".bar")
        .data(chartData).enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.state))
        .attr("y", d => y(d.value))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.value))
        .attr("fill", d => drugStateColors[d.state] || "#3b82f6")
        .attr("rx", 4)
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => {
            drugTooltip.style("opacity", 1).html(`<strong>State: ${d.state}</strong><br>Positives: ${d.value.toLocaleString()}`);
        })
        .on("mousemove", event => {
            drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", () => drugTooltip.style("opacity", 0));
}

// ── CHART 4: ENFORCEMENT ACTIONS GROUPED BAR ──
function drawDrugActions(data) {
    const container = d3.select("#drug-actions-chart");
    container.selectAll("*").remove();

    const containerNode = document.getElementById("drug-actions-chart");
    if (!containerNode || data.length === 0) return;

    const margin = { top: 40, right: 30, bottom: 40, left: 70 };
    const width = containerNode.offsetWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    if (width <= 0) return;

    const svg = container.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

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

    const x0 = d3.scaleBand().domain(chartData.map(d => d.state)).rangeRound([0, width]).paddingInner(0.25);
    const x1 = d3.scaleBand().domain(subMetrics).rangeRound([0, x0.bandwidth()]).padding(0.06);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => Math.max(d.Fines, d.Arrests, d.Charges)) * 1.15 || 100]).rangeRound([height, 0]);

    const groupColors = { "Fines": "#f59e0b", "Arrests": "#ef4444", "Charges": "#10b981" };

    // Background system grids
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x0));
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("~s")));

    // Populate clusters programmatically
    svg.append("g").selectAll("g")
        .data(chartData).enter().append("g")
        .attr("transform", d => `translate(${x0(d.state)},0)`)
        .selectAll("rect")
        .data(d => subMetrics.map(key => ({ key, value: d[key], state: d.state })))
        .enter().append("rect")
        .attr("x", d => x1(d.key))
        .attr("y", d => y(d.value))
        .attr("width", x1.bandwidth())
        .attr("height", d => height - y(d.value))
        .attr("fill", d => groupColors[d.key])
        .attr("rx", 2)
        .style("cursor", "pointer")
        .on("mouseover", (event, d) => {
            drugTooltip.style("opacity", 1).html(`<strong>${d.state} — ${d.key}</strong><br>Total Action Volume: ${d.value.toLocaleString()}`);
        })
        .on("mousemove", event => {
            drugTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", () => drugTooltip.style("opacity", 0));

    // Map Legend Layout directly into top right corner space
    const legend = svg.append("g").attr("transform", `translate(${width - 260}, -25)`);
    subMetrics.forEach((metric, idx) => {
        const item = legend.append("g").attr("transform", `translate(${idx * 85}, 0)`);
        item.append("rect").attr("width", 12).attr("height", 12).attr("fill", groupColors[metric]).attr("rx", 3);
        item.append("text").attr("x", 18).attr("y", 11).style("font-size", "11px").text(metric).attr("fill", "#475569");
    });
}