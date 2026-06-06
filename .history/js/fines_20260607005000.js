// =====================
// FINES.JS
// 4 Charts (Fully Relational):
// 1. Historical trend (multi-line) — fines_historical_trend.csv
// 2. Fines by state (horizontal bar) — fines_by_state.csv
// 3. Fines by age group (bar) — fines_age_metric.csv
// 4. Fines by location (horizontal bar) — fines_location_age.csv
// =====================

const finesTooltip = d3.select("body").append("div").attr("class", "tooltip");

// Color maps
const metricColors = {
    "speed_fines":          "#2563eb",
    "mobile_phone_use":      "#f59e0b",
    "non_wearing_seatbelts": "#10b981",
    "unlicensed_driving":    "#ef4444"
};

const metricLabels = {
    "speed_fines":          "Speed Fines",
    "mobile_phone_use":      "Mobile Phone Use",
    "non_wearing_seatbelts": "Non-Wearing Seatbelts",
    "unlicensed_driving":    "Unlicensed Driving"
};

const ageColors = ["#bfdbfe", "#60a5fa", "#2563eb", "#1d4ed8", "#1e3a8a"];
const ageGroups = ["Under 17", "17-25", "26-39", "40-64", "65 and over"];

const locColors = {
    "Major Cities of Australia": "#2563eb",
    "Inner Regional Australia":  "#10b981",
    "Outer Regional Australia":  "#f59e0b",
    "Remote Australia":          "#ef4444",
    "Very Remote Australia":     "#8b5cf6"
};

const locationOrder = [
    "Major Cities of Australia",
    "Inner Regional Australia",
    "Outer Regional Australia",
    "Remote Australia",
    "Very Remote Australia"
];

// Store raw data globally
let finesHistoricalData = [];
let finesStateData = [];
let finesAgeData = [];
let finesLocationData = [];

// Load all 4 CSVs at once
Promise.all([
    d3.csv("data/fines_historical_trend.csv"),
    d3.csv("data/fines_by_state.csv"),
    d3.csv("data/fines_age_metric.csv"),
    d3.csv("data/fines_location_age.csv")
]).then(function([historical, byState, byAge, byLocation]) {

    // Parse numeric dimensions cleanly
    historical.forEach(d => {
        d.YEAR = +d.YEAR;
        d["TOTAL FINES"] = +d["TOTAL FINES"];
        d["TOTAL ARRESTS"] = +d["TOTAL ARRESTS"];
        d["TOTAL CHARGES"] = +d["TOTAL CHARGES"];
    });
    byState.forEach(d => d["TOTAL FINES"] = +d["TOTAL FINES"]);
    byAge.forEach(d => d["TOTAL FINES"] = +d["TOTAL FINES"]);
    byLocation.forEach(d => d["TOTAL FINES"] = +d["TOTAL FINES"]);

    finesHistoricalData = historical;
    finesStateData = byState;
    finesAgeData = byAge.filter(d => d.AGE_GROUP !== "Unknown");
    finesLocationData = byLocation.filter(d => d.LOCATION !== "Unknown" && d.AGE_GROUP !== "Unknown");

    // Populate state filter dynamically
    const states = [...new Set(finesAgeData.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#fines-state-filter");
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));

    // Populate offence filter dynamically
    const metrics = [...new Set(finesHistoricalData.map(d => d.METRIC))].sort();
    const offenceFilter = d3.select("#fines-offence-filter");
    metrics.forEach(m => offenceFilter.append("option")
        .attr("value", m)
        .text(metricLabels[m] || m));

    // Event listeners
    d3.select("#fines-state-filter").on("change", applyFinesFilters);
    d3.select("#fines-offence-filter").on("change", applyFinesFilters);

    applyFinesFilters();
});

function applyFinesFilters() {
    const selectedState = d3.select("#fines-state-filter").property("value");
    const selectedOffence = d3.select("#fines-offence-filter").property("value");

    // ── 1. FILTER & AGGREGATE HISTORICAL DATA ──
    let filteredHistorical = finesHistoricalData.slice();
    if (selectedState !== "all") filteredHistorical = filteredHistorical.filter(d => d.STATE === selectedState);
    if (selectedOffence !== "all") filteredHistorical = filteredHistorical.filter(d => d.METRIC === selectedOffence);

    // Rollup historical data by metric and year to aggregate totals cleanly if multiple states intersect
    const rolledHistoricalMap = d3.rollup(filteredHistorical, 
        v => d3.sum(v, d => d["TOTAL FINES"]),
        d => d.METRIC,
        d => d.YEAR
    );
    let finalHistorical = [];
    rolledHistoricalMap.forEach((yearMap, metric) => {
        yearMap.forEach((totalFines, year) => {
            finalHistorical.push({ YEAR: year, METRIC: metric, "TOTAL FINES": totalFines });
        });
    });

    // ── 2. FILTER & AGGREGATE STATE DATA ──
    let filteredState = finesStateData.slice();
    if (selectedOffence !== "all") filteredState = filteredState.filter(d => d.METRIC === selectedOffence);

    const rolledStateMap = d3.rollup(filteredState, v => d3.sum(v, d => d["TOTAL FINES"]), d => d.STATE);
    let finalState = [...rolledStateMap.entries()].map(([state, total]) => ({ STATE: state, "TOTAL FINES": total }));

    // ── 3. FILTER AGE DATA ──
    let filteredAge = finesAgeData.slice();
    if (selectedState !== "all") filteredAge = filteredAge.filter(d => d.STATE === selectedState);
    if (selectedOffence !== "all") filteredAge = filteredAge.filter(d => d.METRIC === selectedOffence);

    // ── 4. FILTER LOCATION DATA ──
    let filteredLocation = finesLocationData.slice();
    if (selectedState !== "all") filteredLocation = filteredLocation.filter(d => d.STATE === selectedState);
    if (selectedOffence !== "all") filteredLocation = filteredLocation.filter(d => d.METRIC === selectedOffence);

    // ── 5. UPDATE INTERACTIVE MINI STATS CARDS ──
    // Compute Core Sums
    const totalFines = d3.sum(filteredAge, d => d["TOTAL FINES"]);
    const totalArrests = d3.sum(filteredHistorical, d => d["TOTAL ARRESTS"]);
    const totalCharges = d3.sum(filteredHistorical, d => d["TOTAL CHARGES"]);

    // Find Tops
    const topState = finalState.sort((a,b) => b["TOTAL FINES"] - a["TOTAL FINES"])[0];
    const ageMap = d3.rollup(filteredAge, v => d3.sum(v, d => d["TOTAL FINES"]), d => d.AGE_GROUP);
    const topAge = [...ageMap.entries()].sort((a,b) => b[1]-a[1])[0];
    const metricMap = d3.rollup(filteredHistorical, v => d3.sum(v, d => d["TOTAL FINES"]), d => d.METRIC);
    const topOffence = [...metricMap.entries()].sort((a,b) => b[1]-a[1])[0];

    // Push into DOM Elements
    d3.select("#fines-total").text(totalFines.toLocaleString());
    d3.select("#fines-arrests").text(totalArrests.toLocaleString());
    d3.select("#fines-charges").text(totalCharges.toLocaleString());
    d3.select("#fines-top-state").text(topState ? topState.STATE : "—");
    d3.select("#fines-top-age").text(topAge ? topAge[0] : "—");
    d3.select("#fines-top-offence").text(topOffence ? (metricLabels[topOffence[0]] || topOffence[0]) : "—");

    // ── 6. DRAW ALL CONNECTED CHARTS ──
    drawFinesHistorical(finalHistorical);
    drawFinesState(finalState);
    drawFinesAge(filteredAge);
    drawFinesLocation(filteredLocation);
}

// ── CHART 1: Historical Trend ──
function drawFinesHistorical(data) {
    d3.select("#fines-historical-chart").selectAll("*").remove();

    if (data.length === 0) return;

    const margin = { top: 20, right: 160, bottom: 50, left: 80 };
    const width = document.getElementById("fines-historical-chart").offsetWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#fines-historical-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const metrics = [...new Set(data.map(d => d.METRIC))];
    const grouped = d3.group(data, d => d.METRIC);

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.YEAR))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d["TOTAL FINES"]) * 1.1 || 100])
        .range([height, 0]);

    // Grid
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    // Axes
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")).ticks(8));

    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000000) return `${(d/1000000).toFixed(1)}M`;
            if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    // Y label
    svg.append("text")
        .attr("transform", "rotate(-90)").attr("y", -65).attr("x", -height/2)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
        .text("Total Fines");

    const line = d3.line().x(d => x(d.YEAR)).y(d => y(d["TOTAL FINES"])).curve(d3.curveMonotoneX);

    grouped.forEach((values, metric) => {
        const sorted = values.sort((a,b) => a.YEAR - b.YEAR);
        const color = metricColors[metric] || "#94a3b8";

        svg.append("path").datum(sorted)
            .attr("fill", "none").attr("stroke", color)
            .attr("stroke-width", 2.5).attr("d", line);

        svg.selectAll(`.dot-${metric}`)
            .data(sorted).enter().append("circle")
            .attr("cx", d => x(d.YEAR)).attr("cy", d => y(d["TOTAL FINES"]))
            .attr("r", 3.5).attr("fill", color).attr("stroke", "white").attr("stroke-width", 1.5)
            .on("mouseover", function(event, d) {
                finesTooltip.style("opacity", 1)
                    .html(`<strong>${metricLabels[d.METRIC] || d.METRIC}</strong><br>Year: ${d.YEAR}<br>Fines: ${d["TOTAL FINES"].toLocaleString()}`);
            })
            .on("mousemove", function(event) {
                finesTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
            })
            .on("mouseout", function() { finesTooltip.style("opacity", 0); });
    });

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${width + 12}, 0)`);
    metrics.forEach((m, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 22})`);
        row.append("line").attr("x1", 0).attr("x2", 16).attr("y1", 6).attr("y2", 6)
            .attr("stroke", metricColors[m] || "#94a3b8").attr("stroke-width", 2.5);
        row.append("text").attr("x", 22).attr("y", 10).attr("font-size", "11px")
            .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif")
            .text(metricLabels[m] || m);
    });
}

// ── CHART 2: Fines by State ──
function drawFinesState(data) {
    d3.select("#fines-state-chart").selectAll("*").remove();

    if (data.length === 0) return;

    const margin = { top: 10, right: 100, bottom: 40, left: 60 };
    const width = document.getElementById("fines-state-chart").offsetWidth - margin.left - margin.right;
    const height = 320 - margin.top - margin.bottom;

    const svg = d3.select("#fines-state-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const sorted = data.sort((a,b) => b["TOTAL FINES"] - a["TOTAL FINES"]);
    const colorScale = d3.scaleSequential().interpolator(d3.interpolateRgb("#93c5fd", "#1e3a8a"))
        .domain([d3.min(sorted, d => d["TOTAL FINES"]) || 0, d3.max(sorted, d => d["TOTAL FINES"]) || 1]);

    const x = d3.scaleLinear().domain([0, d3.max(sorted, d => d["TOTAL FINES"]) * 1.1 || 100]).range([0, width]);
    const y = d3.scaleBand().domain(sorted.map(d => d.STATE)).range([0, height]).padding(0.25);

    svg.append("g").attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4).tickSize(-height).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(d => d >= 1000000 ? `${(d/1000000).toFixed(1)}M` : `${(d/1000).toFixed(0)}K`));

    svg.append("g").attr("class", "axis").call(d3.axisLeft(y));

    svg.selectAll(".bar").data(sorted).enter().append("rect")
        .attr("class", "bar").attr("x", 0).attr("y", d => y(d.STATE))
        .attr("height", y.bandwidth()).attr("width", 0).attr("rx", 5)
        .attr("fill", d => colorScale(d["TOTAL FINES"]))
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            finesTooltip.style("opacity", 1)
                .html(`<strong>${d.STATE}</strong><br>Total Fines: ${d["TOTAL FINES"].toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            finesTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() { d3.select(this).attr("opacity", 1); finesTooltip.style("opacity", 0); })
        .transition().duration(700).delay((d,i) => i * 80)
        .attr("width", d => x(d["TOTAL FINES"]));

    svg.selectAll(".bar-label").data(sorted).enter().append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d["TOTAL FINES"]) + 6)
        .attr("y", d => y(d.STATE) + y.bandwidth() / 2 + 4)
        .attr("font-size", "11px").attr("fill", "#475569")
        .attr("font-family", "DM Sans, sans-serif")
        .text(d => d["TOTAL FINES"].toLocaleString());
}

// ── CHART 3: Fines by Age Group ──
function drawFinesAge(data) {
    d3.select("#fines-age-chart").selectAll("*").remove();

    const margin = { top: 10, right: 20, bottom: 60, left: 70 };
    const width = document.getElementById("fines-age-chart").offsetWidth - margin.left - margin.right;
    const height = 320 - margin.top - margin.bottom;

    const svg = d3.select("#fines-age-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const chartData = ageGroups.map((age, i) => ({
        age,
        value: d3.sum(data.filter(d => d.AGE_GROUP === age), d => d["TOTAL FINES"]),
        color: ageColors[i]
    }));
    const x = d3.scaleBand().domain(ageGroups).range([0, width]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => d.value) * 1.1 || 100]).range([height, 0]);

    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text").style("text-anchor", "middle").style("font-size", "11px").attr("dy", "1.5em");

    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000000) return `${(d/1000000).toFixed(1)}M`;
            if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    svg.selectAll(".bar").data(chartData).enter().append("rect")
        .attr("class", "bar").attr("x", d => x(d.age)).attr("y", height)
        .attr("width", x.bandwidth()).attr("height", 0).attr("rx", 5)
        .attr("fill", d => d.color)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            finesTooltip.style("opacity", 1)
                .html(`<strong>${d.age}</strong><br>Total Fines: ${d.value.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            finesTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() { d3.select(this).attr("opacity", 1); finesTooltip.style("opacity", 0); })
        .transition().duration(700).delay((d,i) => i * 80)
        .attr("y", d => d.value > 0 ? y(d.value) : height)
        .attr("height", d => d.value > 0 ? Math.max(height - y(d.value), 3) : 0);

    svg.selectAll(".bar-label").data(chartData).enter().append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.age) + x.bandwidth() / 2)
        .attr("y", d => y(d.value) - 6)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif")
        .text(d => d.value === 0 ? "" : d.value.toLocaleString());
}

// ── CHART 4: Fines by Location ──
function drawFinesLocation(data) {
    d3.select("#fines-location-chart").selectAll("*").remove();

    if (data.length === 0) {
        d3.select("#fines-location-chart")
            .append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("justify-content", "center")
            .style("height", "280px")
            .style("color", "#94a3b8")
            .style("font-family", "DM Sans, sans-serif")
            .style("font-size", "13px")
            .style("font-weight", "500")
            .style("background", "#f8fafc")
            .style("border", "1px dashed #e2e8f0")
            .style("border-radius", "8px")
            .text("Regional location data unavailable for selected filters.");
        return;
    }

    const margin = { top: 10, right: 160, bottom: 40, left: 200 };
    const width = document.getElementById("fines-location-chart").offsetWidth - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const svg = d3.select("#fines-location-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const locMap = d3.rollup(data, v => d3.sum(v, d => d["TOTAL FINES"]), d => d.LOCATION);
    const chartData = locationOrder
        .filter(loc => locMap.has(loc))
        .map(loc => ({ location: loc, value: locMap.get(loc) || 0, color: locColors[loc] }))
        .sort((a,b) => b.value - a.value);

    const x = d3.scaleLinear().domain([0, d3.max(chartData, d => d.value) * 1.1 || 100]).range([0, width]);
    const y = d3.scaleBand().domain(chartData.map(d => d.location)).range([0, height]).padding(0.3);

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

    svg.append("g").attr("class", "axis").call(d3.axisLeft(y)).selectAll("text").style("font-size", "11px");

    svg.selectAll(".bar").data(chartData).enter().append("rect")
        .attr("class", "bar").attr("x", 0).attr("y", d => y(d.location))
        .attr("height", y.bandwidth()).attr("width", 0).attr("rx", 5)
        .attr("fill", d => d.color)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            finesTooltip.style("opacity", 1)
                .html(`<strong>${d.location}</strong><br>Total Fines: ${d.value.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            finesTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() { d3.select(this).attr("opacity", 1); finesTooltip.style("opacity", 0); })
        .transition().duration(700).delay((d,i) => i * 100)
        .attr("width", d => x(d.value));

    svg.selectAll(".bar-label").data(chartData).enter().append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.value) + 8)
        .attr("y", d => y(d.location) + y.bandwidth() / 2 + 4)
        .attr("font-size", "11px").attr("fill", "#475569")
        .attr("font-family", "DM Sans, sans-serif")
        .text(d => d.value.toLocaleString());

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${width + 16}, 0)`);
    chartData.forEach((d, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 24})`);
        row.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", d.color);
        row.append("text").attr("x", 14).attr("y", 9).attr("font-size", "10px")
            .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif")
            .text(d.location.replace(" Australia", "").replace(" of", ""));
    });
}