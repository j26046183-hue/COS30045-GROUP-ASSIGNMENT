// =====================
// BREATH-TESTS.JS
// 3 Charts:
// 1. Heatmap — breath_historical_trend.csv
// 2. Scatter Plot — breath_by_state.csv
// 3. Donut Chart — breath_by_state.csv
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

    historical.forEach(d => { d.YEAR = +d.YEAR; d.COUNT = +d.COUNT; });
    byState.forEach(d => {
        d["TOTAL FINES"]   = +d["TOTAL FINES"];
        d["TOTAL CHARGES"] = +d["TOTAL CHARGES"];
        d["TOTAL ARRESTS"] = +d["TOTAL ARRESTS"];
        d.COUNT            = +d.COUNT;
    });

    breathHistoricalData = historical;
    breathStateData      = byState;

    // Populate state filter
    const states = [...new Set(historical.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#breath-state-filter");
    stateFilter.selectAll("option:not([value='all'])").remove();
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));

    d3.select("#breath-state-filter").on("change", applyBreathFilters);

    applyBreathFilters();
});

function applyBreathFilters() {
    const selectedState = d3.select("#breath-state-filter").property("value");

    let filteredHistorical = breathHistoricalData.slice();
    if (selectedState !== "all") filteredHistorical = filteredHistorical.filter(d => d.STATE === selectedState);

    let filteredState = breathStateData.slice();
    if (selectedState !== "all") filteredState = filteredState.filter(d => d.STATE === selectedState);

    // Update mini stats
    const totalTests   = d3.sum(filteredState, d => d.COUNT);
    const totalCharges = d3.sum(filteredState, d => d["TOTAL CHARGES"]);
    const totalArrests = d3.sum(filteredState, d => d["TOTAL ARRESTS"]);
    const topState     = [...breathStateData].sort((a,b) => b.COUNT - a.COUNT)[0];

    d3.select("#breath-total").text(totalTests.toLocaleString());
    d3.select("#breath-charges").text(totalCharges.toLocaleString());
    d3.select("#breath-arrests").text(totalArrests.toLocaleString());
    d3.select("#breath-top-state").text(topState ? topState.STATE : "—");

    drawBreathHeatmap(filteredHistorical);
    drawBreathScatter(filteredState);
    drawBreathDonut(filteredState);
}

// ── CHART 1: Heatmap ──
function drawBreathHeatmap(data) {
    d3.select("#breath-historical-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 20, right: 40, bottom: 50, left: 60 };
    const width  = document.getElementById("breath-historical-chart").offsetWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#breath-historical-chart")
        .append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const years  = [...new Set(data.map(d => d.YEAR))].sort((a,b) => a - b);
    const states = [...new Set(data.map(d => d.STATE))].sort();

    const x = d3.scaleBand().domain(years).range([0, width]).padding(0.05);
    const y = d3.scaleBand().domain(states).range([0, height]).padding(0.05);

    const maxCount = d3.max(data, d => d.COUNT) || 1;
    const colorScale = d3.scaleSequential()
        .domain([0, maxCount])
        .interpolator(d3.interpolateBlues);

    // X axis
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end")
        .style("font-size", "10px");

    // Y axis
    svg.append("g").attr("class", "axis").call(d3.axisLeft(y));

    // Cells
    svg.selectAll(".cell")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "cell")
        .attr("x", d => x(d.YEAR))
        .attr("y", d => y(d.STATE))
        .attr("width",  x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("rx", 3)
        .attr("fill", d => d.COUNT > 0 ? colorScale(d.COUNT) : "#f1f5f9")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            breathTooltip.style("opacity", 1)
                .html(`<strong>${d.STATE}</strong><br>Year: ${d.YEAR}<br>Positive Tests: ${d.COUNT.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            breathTooltip
                .style("left", (event.pageX + 14) + "px")
                .style("top",  (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            breathTooltip.style("opacity", 0);
        });

    // Colour legend
    const legendW = 160;
    const legendG = svg.append("g")
        .attr("transform", `translate(${width - legendW}, ${height + 36})`);

    const defs = svg.append("defs");
    const linearGrad = defs.append("linearGradient").attr("id", "breath-heat-grad");
    linearGrad.selectAll("stop")
        .data([
            { offset: "0%",   color: colorScale(0) },
            { offset: "100%", color: colorScale(maxCount) }
        ])
        .enter().append("stop")
        .attr("offset", d => d.offset)
        .attr("stop-color", d => d.color);

    legendG.append("rect")
        .attr("width", legendW).attr("height", 8).attr("rx", 3)
        .style("fill", "url(#breath-heat-grad)");

    legendG.append("text").attr("x", 0).attr("y", 20)
        .attr("font-size", "10px").attr("fill", "#94a3b8")
        .attr("font-family", "DM Sans, sans-serif").text("Low");

    legendG.append("text").attr("x", legendW).attr("y", 20)
        .attr("text-anchor", "end")
        .attr("font-size", "10px").attr("fill", "#94a3b8")
        .attr("font-family", "DM Sans, sans-serif").text("High");
}

// ── CHART 2: Scatter Plot ──
function drawBreathScatter(data) {
    d3.select("#breath-bar-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 20, right: 40, bottom: 60, left: 70 };
    const width  = document.getElementById("breath-bar-chart").offsetWidth - margin.left - margin.right;
    const height = 320 - margin.top - margin.bottom;

    const svg = d3.select("#breath-bar-chart")
        .append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d["TOTAL FINES"]) * 1.15 || 100])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d["TOTAL CHARGES"]) * 1.15 || 100])
        .range([height, 0]);

    const sizeScale = d3.scaleSqrt()
        .domain([0, d3.max(data, d => d.COUNT) || 1])
        .range([6, 28]);

    // Grid
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5).tickSize(-height).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");

    // Axes
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    // X label
    svg.append("text")
        .attr("x", width / 2).attr("y", height + 48)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
        .text("Total Fines");

    // Y label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -55).attr("x", -height / 2)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
        .text("Total Charges");

    // Dots
    svg.selectAll(".dot")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("cx", d => x(d["TOTAL FINES"]))
        .attr("cy", d => y(d["TOTAL CHARGES"]))
        .attr("r",  d => sizeScale(d.COUNT))
        .attr("fill", d => breathStateColors[d.STATE] || "#2563eb")
        .attr("opacity", 0.75)
        .attr("stroke", "white")
        .attr("stroke-width", 1.5)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 1);
            breathTooltip.style("opacity", 1)
                .html(`<strong>${d.STATE}</strong><br>
                       Fines: ${d["TOTAL FINES"].toLocaleString()}<br>
                       Charges: ${d["TOTAL CHARGES"].toLocaleString()}<br>
                       Arrests: ${d["TOTAL ARRESTS"].toLocaleString()}<br>
                       Total Tests: ${d.COUNT.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            breathTooltip
                .style("left", (event.pageX + 14) + "px")
                .style("top",  (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.75);
            breathTooltip.style("opacity", 0);
        });

    // State labels on dots
    svg.selectAll(".dot-label")
        .data(data)
        .enter()
        .append("text")
        .attr("class", "dot-label")
        .attr("x", d => x(d["TOTAL FINES"]))
        .attr("y", d => y(d["TOTAL CHARGES"]) - sizeScale(d.COUNT) - 4)
        .attr("text-anchor", "middle")
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("fill", d => breathStateColors[d.STATE] || "#2563eb")
        .attr("font-family", "DM Sans, sans-serif")
        .text(d => d.STATE);
}

// ── CHART 3: Donut Chart ──
function drawBreathDonut(data) {
    d3.select("#breath-actions-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const container = document.getElementById("breath-actions-chart");
    const size      = Math.min(container.offsetWidth, 360);
    const margin    = { top: 10, right: 10, bottom: 80, left: 10 };
    const radius    = (size - margin.top - margin.bottom) / 2;
    if (radius <= 0) return;

    const svg = d3.select("#breath-actions-chart")
        .append("svg").attr("width", size).attr("height", size)
        .append("g")
        .attr("transform", `translate(${size/2}, ${radius + margin.top})`);

    const totalFines   = d3.sum(data, d => d["TOTAL FINES"]);
    const totalArrests = d3.sum(data, d => d["TOTAL ARRESTS"]);
    const totalCharges = d3.sum(data, d => d["TOTAL CHARGES"]);

    const slices = [
        { label: "Fines",   value: totalFines,   color: "#2563eb" },
        { label: "Arrests", value: totalArrests, color: "#ef4444" },
        { label: "Charges", value: totalCharges, color: "#f59e0b" }
    ].filter(d => d.value > 0);

    const total = d3.sum(slices, d => d.value);

    if (total === 0) {
        svg.append("text").attr("text-anchor", "middle")
            .attr("font-size", "13px").attr("fill", "#94a3b8")
            .attr("font-family", "DM Sans, sans-serif").text("No data available");
        return;
    }

    const pie      = d3.pie().value(d => d.value).sort(null);
    const arc      = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(radius * 0.55).outerRadius(radius * 1.06);

    svg.selectAll(".arc")
        .data(pie(slices)).enter().append("path")
        .attr("class", "arc")
        .attr("d", arc)
        .attr("fill", d => d.data.color)
        .attr("stroke", "white").attr("stroke-width", 2)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("d", arcHover);
            const pct = ((d.data.value / total) * 100).toFixed(1);
            breathTooltip.style("opacity", 1)
                .html(`<strong>${d.data.label}</strong><br>Count: ${d.data.value.toLocaleString()}<br>Share: ${pct}%`);
        })
        .on("mousemove", function(event) {
            breathTooltip
                .style("left", (event.pageX + 14) + "px")
                .style("top",  (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("d", arc);
            breathTooltip.style("opacity", 0);
        });

    // Centre text
    svg.append("text").attr("text-anchor", "middle").attr("dy", "-0.3em")
        .attr("font-size", "20px").attr("font-weight", "700")
        .attr("font-family", "Syne, sans-serif").attr("fill", "#0f172a")
        .text(total.toLocaleString());

    svg.append("text").attr("text-anchor", "middle").attr("dy", "1.2em")
        .attr("font-size", "10px").attr("fill", "#94a3b8")
        .attr("font-family", "DM Sans, sans-serif").text("Total Actions");

    // Legend
    const legendG = svg.append("g")
        .attr("transform", `translate(${-radius}, ${radius + 16})`);

    slices.forEach((d, i) => {
        const g = legendG.append("g").attr("transform", `translate(${i * (radius + 20)}, 0)`);
        g.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", d.color);
        g.append("text").attr("x", 14).attr("y", 9)
            .attr("font-size", "11px").attr("fill", "#475569")
            .attr("font-family", "DM Sans, sans-serif").text(d.label);
    });
}