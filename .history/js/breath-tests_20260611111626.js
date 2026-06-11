// =====================
// BREATH-TESTS.JS
// 3 Charts:
// 1. Historical Line Chart — breath_historical_trend.csv
// 2. Regional Donut Chart — breath_2023_2024.csv (filter by year)
// 3. Age Group Bar Chart — breath_2023_2024.csv (filter by year)
// =====================

const breathTooltip = d3.select("body").append("div").attr("class", "tooltip");

const breathStateColors = {
    "ACT": "#2563eb", "NSW": "#16a34a", "NT":  "#f59e0b",
    "QLD": "#dc2626", "SA":  "#8b5cf6", "TAS": "#0891b2",
    "VIC": "#db2777", "WA":  "#ea580c"
};

const regionalColors = {
    "Major Cities":    "#0284c7",
    "Inner Regional":  "#0d9488",
    "Outer Regional":  "#f59e0b",
    "Remote":          "#e11d48",
    "Very Remote":     "#475569"
};

let breathHistoricalData = [];
let breathModernData = [];

Promise.all([
    d3.csv("data/breath_historical_trend.csv").catch(err => { console.error("Missing: breath_historical_trend.csv", err); return null; }),
    d3.csv("data/breath_2023_2024.csv").catch(err => { console.error("Missing: breath_2023_2024.csv", err); return null; })
]).then(function([historical, modern]) {

    if (!historical || !modern) {
        console.error("One or both CSV files failed to load.");
        return;
    }

    // Parse historical
    historical.forEach(d => {
        d.YEAR  = +d.YEAR;
        d.COUNT = +d.COUNT;
        d["TOTAL FINES"]   = +d["TOTAL FINES"]   || 0;
        d["TOTAL CHARGES"] = +d["TOTAL CHARGES"] || 0;
        d["TOTAL ARRESTS"] = +d["TOTAL ARRESTS"] || 0;
    });

    // Parse modern
    modern.forEach(d => {
        d.YEAR  = +d.YEAR;
        d.COUNT = +d.COUNT;
        d["TOTAL FINES"]   = +d["TOTAL FINES"]   || 0;
        d["TOTAL CHARGES"] = +d["TOTAL CHARGES"] || 0;
        d["TOTAL ARRESTS"] = +d["TOTAL ARRESTS"] || 0;
    });

    breathHistoricalData = historical;
    breathModernData     = modern;

    // Populate state filter from historical
    const states = [...new Set(historical.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#breath-state-filter");
    stateFilter.selectAll("option:not([value='all'])").remove();
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));

    // Populate year filters from modern data
    const uniqueYears = [...new Set(modern.map(d => d.YEAR))].filter(y => y).sort((a,b) => b - a);

    // FIXED: Guarantee "All Years" exists for Donut drop-down filter
    const donutYearSelect = d3.select("#breath-donut-year-filter");
    if (donutYearSelect.node()) {
        donutYearSelect.selectAll("option").remove(); // Clear completely
        donutYearSelect.append("option").attr("value", "all").text("All Years"); // Inject dynamically
        uniqueYears.forEach(y => donutYearSelect.append("option").attr("value", y).text(y));
    }

    // FIXED: Guarantee "All Years" exists for Bar drop-down filter
    const barYearSelect = d3.select("#breath-bar-year-filter");
    if (barYearSelect.node()) {
        barYearSelect.selectAll("option").remove(); // Clear completely
        barYearSelect.append("option").attr("value", "all").text("All Years"); // Inject dynamically
        uniqueYears.forEach(y => barYearSelect.append("option").attr("value", y).text(y));
    }

    // Event listeners
    d3.select("#breath-state-filter").on("change", applyBreathFilters);
    if (donutYearSelect.node()) donutYearSelect.on("change", updateDonutOnly);
    if (barYearSelect.node())   barYearSelect.on("change", updateBarOnly);

    applyBreathFilters();

}).catch(err => {
    console.error("Breath test data load error:", err);
});

function applyBreathFilters() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";

    // Filter historical for line chart
    let filteredHistorical = breathHistoricalData.slice();
    if (selectedState !== "all") filteredHistorical = filteredHistorical.filter(d => d.STATE === selectedState);

    // Filter modern for KPIs
    let filteredModern = breathModernData.slice();
    if (selectedState !== "all") filteredModern = filteredModern.filter(d => d.STATE === selectedState);

    // Update mini stats
    const totalCharges = d3.sum(filteredModern, d => d["TOTAL CHARGES"]);
    const totalArrests = d3.sum(filteredModern, d => d["TOTAL ARRESTS"]);
    const topStateObj  = [...breathHistoricalData]
        .reduce((acc, d) => {
            acc[d.STATE] = (acc[d.STATE] || 0) + d.COUNT;
            return acc;
        }, {});
    const topState = Object.entries(topStateObj).sort((a,b) => b[1] - a[1])[0];

    d3.select("#breath-total").text(d3.sum(filteredModern, d => d.COUNT).toLocaleString());
    d3.select("#breath-charges").text(totalCharges.toLocaleString());
    d3.select("#breath-arrests").text(totalArrests.toLocaleString());
    d3.select("#breath-top-state").text(topState ? topState[0] : "—");

    // Draw line chart
    drawBreathHistorical(filteredHistorical);

    // Draw donut and bar with their own year filters
    updateDonutOnly();
    updateBarOnly();
}

function updateDonutOnly() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";
    const donutNode     = d3.select("#breath-donut-year-filter").node();
    const selectedYear  = donutNode ? donutNode.value : "all";

    let filtered = breathModernData.slice();
    if (selectedState !== "all") filtered = filtered.filter(d => d.STATE === selectedState);
    if (selectedYear  !== "all") filtered = filtered.filter(d => d.YEAR === +selectedYear);

    drawBreathRegionalDonut(filtered);
}

function updateBarOnly() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";
    const barNode       = d3.select("#breath-bar-year-filter").node();
    const selectedYear  = barNode ? barNode.value : "all";

    let filtered = breathModernData.slice();
    if (selectedState !== "all") filtered = filtered.filter(d => d.STATE === selectedState);
    if (selectedYear  !== "all") filtered = filtered.filter(d => d.YEAR === +selectedYear);

    renderBreathBarChart(filtered);
}

// ── CHART 1: Historical Line Chart ──
function drawBreathHistorical(data) {
    d3.select("#breath-historical-chart").selectAll("*").remove();
    if (data.length === 0) return;

    const margin = { top: 20, right: 120, bottom: 50, left: 75 };
    const width  = document.getElementById("breath-historical-chart").offsetWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#breath-historical-chart")
        .append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const grouped    = d3.group(data, d => d.STATE);
    const uniqueYrs  = [...new Set(data.map(d => d.YEAR))].sort((a,b) => a - b);

    const x = d3.scaleLinear().domain(d3.extent(data, d => d.YEAR)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.COUNT) * 1.1 || 100]).range([height, 0]);

    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickValues(uniqueYrs).tickFormat(d3.format("d")));

    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000000) return `${(d/1000000).toFixed(1)}M`;
            if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    svg.append("text")
        .attr("transform", "rotate(-90)").attr("y", -60).attr("x", -height/2)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
        .text("Positive Breath Tests");

    const line = d3.line().x(d => x(d.YEAR)).y(d => y(d.COUNT)).curve(d3.curveMonotoneX);

    grouped.forEach((values, state) => {
        const sorted = values.sort((a,b) => a.YEAR - b.YEAR);
        const color  = breathStateColors[state] || "#94a3b8";

        svg.append("path").datum(sorted)
            .attr("fill", "none").attr("stroke", color)
            .attr("stroke-width", 2.5).attr("d", line);

        svg.selectAll(`.dot-${state}`)
            .data(sorted).enter().append("circle")
            .attr("cx", d => x(d.YEAR)).attr("cy", d => y(d.COUNT))
            .attr("r", 3.5).attr("fill", color).attr("stroke", "white").attr("stroke-width", 1.5)
            .on("mouseover", function(event, d) {
                breathTooltip.style("opacity", 1)
                    .html(`<strong>${d.STATE}</strong><br>Year: ${d.YEAR}<br>Tests: ${d.COUNT.toLocaleString()}`);
            })
            .on("mousemove", function(event) {
                breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
            })
            .on("mouseout", function() { breathTooltip.style("opacity", 0); });
    });

    const legend = svg.append("g").attr("transform", `translate(${width + 12}, 0)`);
    ([...grouped.keys()]).sort().forEach((state, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 18})`);
        row.append("line").attr("x1", 0).attr("x2", 14).attr("y1", 6).attr("y2", 6)
            .attr("stroke", breathStateColors[state] || "#94a3b8").attr("stroke-width", 2.5);
        row.append("text").attr("x", 18).attr("y", 10).attr("font-size", "11px")
            .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif").text(state);
    });
}

// ── CHART 2: Regional Donut Chart ──
function drawBreathRegionalDonut(data) {
    d3.select("#breath-donut-chart").selectAll("*").remove();

    const container = document.getElementById("breath-donut-chart");
    if (!container) return;

    const width  = container.offsetWidth;
    const height = 320;
    const margin = { top: 20, right: 20, bottom: 65, left: 20 };
    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;

    const svg    = d3.select("#breath-donut-chart").append("svg").attr("width", width).attr("height", height);
    const chartG = svg.append("g").attr("transform", `translate(${width/2}, ${radius + margin.top})`);

    const regions = ["Major Cities", "Inner Regional", "Outer Regional", "Remote", "Very Remote"];

    const totals = regions.map(region => {
        const rows = data.filter(d => {
            if (!d.LOCATION) return false;
            const norm = d.LOCATION.replace(" of Australia", "").replace(" Australia", "").trim();
            return norm.toLowerCase() === region.toLowerCase();
        });
        return { region, value: d3.sum(rows, d => +d.COUNT || 0) };
    });

    const totalVolume = d3.sum(totals, d => d.value);

    if (totalVolume === 0) {
        chartG.append("text").attr("text-anchor", "middle")
            .attr("font-size", "13px").attr("fill", "#94a3b8")
            .attr("font-family", "DM Sans, sans-serif").text("No Location Data Reported");
        return;
    }

    const pie      = d3.pie().value(d => d.value).sort(null);
    const arc      = d3.arc().innerRadius(radius * 0.60).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(radius * 0.60).outerRadius(radius * 1.05);

    chartG.selectAll(".arc")
        .data(pie(totals.filter(d => d.value > 0))).enter().append("path")
        .attr("class", "arc").attr("d", arc)
        .attr("fill", d => regionalColors[d.data.region] || "#cbd5e1")
        .attr("stroke", "white").attr("stroke-width", 2.5)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("d", arcHover);
            const pct = ((d.data.value / totalVolume) * 100).toFixed(1);
            breathTooltip.style("opacity", 1)
                .html(`<strong>${d.data.region}</strong><br>Tests: ${d.data.value.toLocaleString()}<br>Share: ${pct}%`);
        })
        .on("mousemove", function(event) {
            breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("d", arc);
            breathTooltip.style("opacity", 0);
        });

    chartG.append("text").attr("text-anchor", "middle").attr("dy", "-0.2em")
        .attr("font-size", "20px").attr("font-weight", "700")
        .attr("font-family", "Syne, sans-serif").attr("fill", "#0f172a")
        .text(totalVolume.toLocaleString());

    chartG.append("text").attr("text-anchor", "middle").attr("dy", "1.3em")
        .attr("font-size", "10px").attr("fill", "#94a3b8")
        .attr("font-family", "DM Sans, sans-serif").text("Total Tests");

    // Legend
    const legendG = svg.append("g");
    let cx = 0, cy = 0;
    const sx = 130, sy = 18;
    totals.forEach((d, i) => {
        const g = legendG.append("g").attr("transform", `translate(${cx}, ${cy})`);
        g.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", regionalColors[d.region] || "#cbd5e1");
        g.append("text").attr("x", 15).attr("y", 9).attr("font-size", "11px")
            .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif").text(d.region);
        if (i % 2 === 0) { cx += sx; } else { cx = 0; cy += sy; }
    });
    const bounds = legendG.node().getBBox();
    legendG.attr("transform", `translate(${(width - bounds.width) / 2}, ${radius * 2 + margin.top + 20})`);
}

// ── CHART 3: Age Group Bar Chart ──
function renderBreathBarChart(data) {
    d3.select("#breath-bar-chart").selectAll("*").remove();
    if (!data || data.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 65, left: 75 };
    const width  = document.getElementById("breath-bar-chart").offsetWidth - margin.left - margin.right;
    const height = 320 - margin.top - margin.bottom;

    const svg = d3.select("#breath-bar-chart")
        .append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Roll up by AGE_GROUP
    const rolled = d3.rollups(data, v => d3.sum(v, d => +d.COUNT || 0), d => d.AGE_GROUP)
        .map(([key, value]) => ({ key, value }))
        .filter(d => d.key && d.key !== "Unknown" && d.key !== "undefined" && d.value > 0)
        .sort((a,b) => b.value - a.value);

    if (rolled.length === 0) {
        svg.append("text").attr("x", width/2).attr("y", height/2)
            .attr("text-anchor", "middle").attr("fill", "#94a3b8")
            .attr("font-family", "DM Sans, sans-serif").attr("font-size", "13px")
            .text("No age breakdown available");
        return;
    }
    const x = d3.scaleBand().domain(rolled.map(d => d.key)).range([0, width]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(rolled, d => d.value) * 1.1]).range([height, 0]);

    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em").attr("dy", ".15em")
        .attr("transform", "rotate(-25)")
        .style("font-size", "11px");

    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    svg.append("text")
        .attr("transform", "rotate(-90)").attr("y", -60).attr("x", -height/2)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
        .text("Positive Tests");

    svg.selectAll(".bar").data(rolled).enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.key))
        .attr("width", x.bandwidth())
        .attr("y", height).attr("height", 0)
        .attr("fill", "#ea580c").attr("rx", 4)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill", "#b45309");
            breathTooltip.style("opacity", 1)
                .html(`<strong>${d.key}</strong><br>Tests: ${d.value.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("fill", "#ea580c");
            breathTooltip.style("opacity", 0);
        })
        .transition().duration(700)
        .attr("y", d => y(d.value))
        .attr("height", d => Math.max(0, height - y(d.value)));

    svg.selectAll(".bar-label").data(rolled).enter().append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.key) + x.bandwidth() / 2)
        .attr("y", d => y(d.value) - 6)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif")
        .text(d => d.value.toLocaleString());
}