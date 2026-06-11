// =====================
// 4 Charts:
// 1. Historical trend (multi-line)   — fines_historical_trend.csv
// 2. Fines by state (horizontal bar) — fines_by_state.csv
// 3. Fines by age group (bar)        — fines_age_metric.csv
// 4. Fines by location (horizontal)  — fines_location_age.csv

const finesTooltip = d3.select("body").append("div").attr("class", "tooltip");

const metricColors = {
    "speed_fines":           "#2563eb",
    "mobile_phone_use":      "#f59e0b",
    "non_wearing_seatbelts": "#10b981",
    "unlicensed_driving":    "#ef4444"
};

const metricLabels = {
    "speed_fines":           "Speed Fines",
    "mobile_phone_use":      "Mobile Phone Use",
    "non_wearing_seatbelts": "Non-Wearing Seatbelts",
    "unlicensed_driving":    "Unlicensed Driving"
};

const ageColors  = ["#bfdbfe", "#60a5fa", "#2563eb", "#1d4ed8", "#1e3a8a"];
const ageGroups  = ["Under 17", "17-25", "26-39", "40-64", "65 and over"];

// Location config — Unknown kept but renamed
const locColors = {
    "Major Cities of Australia": "#2563eb",
    "Inner Regional Australia":  "#10b981",
    "Outer Regional Australia":  "#f59e0b",
    "Remote Australia":          "#ef4444",
    "Very Remote Australia":     "#8b5cf6",
    "Location Not Specified":    "#94a3b8"   // renamed Unknown
};

const locationOrder = [
    "Major Cities of Australia",
    "Inner Regional Australia",
    "Outer Regional Australia",
    "Remote Australia",
    "Very Remote Australia",
    "Location Not Specified"
];

// Global data stores
let finesHistoricalData = [];
let finesStateData      = [];
let finesAgeData        = [];
let finesLocationData   = [];

// ── LOAD ALL 4 CSVs ──
Promise.all([
    d3.csv("data/fines_historical_trend.csv"),
    d3.csv("data/fines_by_state.csv"),
    d3.csv("data/fines_age_metric.csv"),
    d3.csv("data/fines_location_age.csv")
]).then(function([historical, byState, byAge, byLocation]) {

    // Parse numbers
    historical.forEach(d => {
        d.YEAR             = +d.YEAR;
        d["TOTAL FINES"]   = +d["TOTAL FINES"]   || 0;
        d["TOTAL ARRESTS"] = +d["TOTAL ARRESTS"] || 0;
        d["TOTAL CHARGES"] = +d["TOTAL CHARGES"] || 0;
    });
    byState.forEach(d => {
        d["TOTAL FINES"] = +d["TOTAL FINES"] || 0;
    });
    byAge.forEach(d => {
        d["TOTAL FINES"] = +d["TOTAL FINES"] || 0;
    });
    byLocation.forEach(d => {
        d["TOTAL FINES"] = +d["TOTAL FINES"] || 0;
        // Rename Unknown location so chart always shows something
        if (d.LOCATION === "Unknown") d.LOCATION = "Location Not Specified";
    });

    // Filter Unknown age group silently — all 8 states still have real age data
    finesHistoricalData = historical;
    finesStateData      = byState;
    finesAgeData        = byAge.filter(d => d.AGE_GROUP !== "Unknown");
    finesLocationData   = byLocation.filter(d => d.AGE_GROUP !== "Unknown");

    // Populate state filter from historical (all 8 states)
    const states = [...new Set(historical.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#fines-state-filter");
    stateFilter.selectAll("option:not([value='all'])").remove();
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));

    // Populate offence filter from historical
    const metrics = [...new Set(historical.map(d => d.METRIC))].sort();
    const offenceFilter = d3.select("#fines-offence-filter");
    offenceFilter.selectAll("option:not([value='all'])").remove();
    metrics.forEach(m => offenceFilter.append("option")
        .attr("value", m)
        .text(metricLabels[m] || m));

    // Event listeners
    d3.select("#fines-state-filter").on("change", applyFinesFilters);
    d3.select("#fines-offence-filter").on("change", applyFinesFilters);

    applyFinesFilters();

}).catch(err => console.error("Fines data load error:", err));


// ── MASTER FILTER ──
function applyFinesFilters() {
    const selectedState   = d3.select("#fines-state-filter").property("value")   || "all";
    const selectedOffence = d3.select("#fines-offence-filter").property("value") || "all";

    // ── 1. Historical: filter state + offence, then rollup ──
    let filtHistorical = finesHistoricalData.slice();
    if (selectedState   !== "all") filtHistorical = filtHistorical.filter(d => d.STATE  === selectedState);
    if (selectedOffence !== "all") filtHistorical = filtHistorical.filter(d => d.METRIC === selectedOffence);

    const rolledHistMap = d3.rollup(
        filtHistorical,
        v => d3.sum(v, d => d["TOTAL FINES"]),
        d => d.METRIC, d => d.YEAR
    );
    const finalHistorical = [];
    rolledHistMap.forEach((yearMap, metric) => {
        yearMap.forEach((total, year) => {
            finalHistorical.push({ YEAR: year, METRIC: metric, "TOTAL FINES": total });
        });
    });

    // ── 2. State chart: offence filter only — always shows all 8 states ──
    let filtState = finesStateData.slice();
    if (selectedOffence !== "all") filtState = filtState.filter(d => d.METRIC === selectedOffence);
    const rolledStateMap = d3.rollup(filtState, v => d3.sum(v, d => d["TOTAL FINES"]), d => d.STATE);
    const finalState = [...rolledStateMap.entries()]
        .map(([state, total]) => ({ STATE: state, "TOTAL FINES": total }));

    // ── 3. Age: both filters — all 8 states always have 17-25 to 65+ ──
    let filtAge = finesAgeData.slice();
    if (selectedState   !== "all") filtAge = filtAge.filter(d => d.STATE  === selectedState);
    if (selectedOffence !== "all") filtAge = filtAge.filter(d => d.METRIC === selectedOffence);

    // ── 4. Location: both filters — Unknown renamed so always shows ──
    let filtLocation = finesLocationData.slice();
    if (selectedState   !== "all") filtLocation = filtLocation.filter(d => d.STATE  === selectedState);
    if (selectedOffence !== "all") filtLocation = filtLocation.filter(d => d.METRIC === selectedOffence);

    // ── Mini stats ──
    const totalFines   = d3.sum(filtAge, d => d["TOTAL FINES"]);
    const totalArrests = d3.sum(filtHistorical, d => d["TOTAL ARRESTS"]);
    const totalCharges = d3.sum(filtHistorical, d => d["TOTAL CHARGES"]);
    const topState     = [...finalState].sort((a,b) => b["TOTAL FINES"] - a["TOTAL FINES"])[0];
    const ageMap       = d3.rollup(filtAge, v => d3.sum(v, d => d["TOTAL FINES"]), d => d.AGE_GROUP);
    const topAge       = [...ageMap.entries()].sort((a,b) => b[1] - a[1])[0];
    const metricMap    = d3.rollup(filtHistorical, v => d3.sum(v, d => d["TOTAL FINES"]), d => d.METRIC);
    const topOffence   = [...metricMap.entries()].sort((a,b) => b[1] - a[1])[0];

    d3.select("#fines-total").text(totalFines.toLocaleString());
    d3.select("#fines-arrests").text(totalArrests.toLocaleString());
    d3.select("#fines-charges").text(totalCharges.toLocaleString());
    d3.select("#fines-top-state").text(topState   ? topState.STATE   : "—");
    d3.select("#fines-top-age").text(topAge       ? topAge[0]        : "—");
    d3.select("#fines-top-offence").text(topOffence ? (metricLabels[topOffence[0]] || topOffence[0]) : "—");

    // ── Draw all 4 charts ──
    drawFinesHistorical(finalHistorical);
    drawFinesState(finalState);
    drawFinesAge(filtAge);
    drawFinesLocation(filtLocation);
}


// ══════════════════════════════════════════
// CHART 1: HISTORICAL TREND (multi-line)
// ══════════════════════════════════════════
function drawFinesHistorical(data) {
    d3.select("#fines-historical-chart").selectAll("*").remove();
    const container = document.getElementById("fines-historical-chart");
    if (!container || data.length === 0) return;

    const margin = { top: 20, right: 160, bottom: 55, left: 80 };
    const width  = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#fines-historical-chart")
        .append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const metrics    = [...new Set(data.map(d => d.METRIC))];
    const grouped    = d3.group(data, d => d.METRIC);
    const uniqueYrs  = [...new Set(data.map(d => d.YEAR))].sort((a,b) => a - b);

    const x = d3.scaleLinear().domain(d3.extent(data, d => d.YEAR)).range([0, width]);
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d["TOTAL FINES"]) * 1.15 || 100])
        .range([height, 0]);

    // Grid
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    // X axis — every year shown
    svg.append("g").attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickValues(uniqueYrs).tickFormat(d3.format("d")))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end")
        .style("font-size", "10px");

    // Y axis
    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000000) return `${(d/1000000).toFixed(1)}M`;
            if (d >= 1000)    return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    // Y label
    svg.append("text")
        .attr("transform", "rotate(-90)").attr("y", -65).attr("x", -height/2)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
        .text("Total Fines");

    const line = d3.line()
        .x(d => x(d.YEAR)).y(d => y(d["TOTAL FINES"]))
        .curve(d3.curveMonotoneX);

    grouped.forEach((values, metric) => {
        const sorted = [...values].sort((a,b) => a.YEAR - b.YEAR);
        const color  = metricColors[metric] || "#94a3b8";

        svg.append("path").datum(sorted)
            .attr("fill", "none").attr("stroke", color)
            .attr("stroke-width", 2.5).attr("d", line);

        svg.selectAll(`.dot-${metric.replace(/[^a-z0-9]/gi, "_")}`)
            .data(sorted).enter().append("circle")
            .attr("cx", d => x(d.YEAR)).attr("cy", d => y(d["TOTAL FINES"]))
            .attr("r", 3.5).attr("fill", color).attr("stroke", "white").attr("stroke-width", 1.5)
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this).attr("r", 5);
                finesTooltip.style("opacity", 1)
                    .html(`<strong>${metricLabels[d.METRIC] || d.METRIC}</strong><br>Year: ${d.YEAR}<br>Fines: ${d["TOTAL FINES"].toLocaleString()}`);
            })
            .on("mousemove", function(event) {
                finesTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("r", 3.5);
                finesTooltip.style("opacity", 0);
            });
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


// ══════════════════════════════════════════
// CHART 2: FINES BY STATE (horizontal bar)
// ══════════════════════════════════════════
function drawFinesState(data) {
    d3.select("#fines-state-chart").selectAll("*").remove();
    const container = document.getElementById("fines-state-chart");
    if (!container || data.length === 0) return;

    const margin = { top: 10, right: 130, bottom: 40, left: 60 };
    const width  = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 320 - margin.top - margin.bottom;

    const svg = d3.select("#fines-state-chart")
        .append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const sorted  = [...data].sort((a,b) => +b["TOTAL FINES"] - +a["TOTAL FINES"]);
    const maxVal  = d3.max(sorted, d => +d["TOTAL FINES"]) || 1;
    const minVal  = d3.min(sorted, d => +d["TOTAL FINES"]) || 0;

    const colorScale = d3.scaleSequential()
        .interpolator(d3.interpolateRgb("#93c5fd", "#1e3a8a"))
        .domain([minVal, maxVal]);

    const x = d3.scaleLinear().domain([0, maxVal * 1.1]).range([0, width]);
    const y = d3.scaleBand().domain(sorted.map(d => d.STATE)).range([0, height]).padding(0.25);

    // Grid
    svg.append("g").attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4).tickSize(-height).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    // X axis
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000000) return `${(d/1000000).toFixed(1)}M`;
            if (d >= 1000)    return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    // Y axis
    svg.append("g").attr("class", "axis").call(d3.axisLeft(y));

    // Bars
    svg.selectAll(".bar").data(sorted).enter().append("rect")
        .attr("class", "bar")
        .attr("x", 0).attr("y", d => y(d.STATE))
        .attr("height", y.bandwidth()).attr("width", 0).attr("rx", 5)
        .attr("fill", d => colorScale(+d["TOTAL FINES"]))
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            finesTooltip.style("opacity", 1)
                .html(`<strong>${d.STATE}</strong><br>Total Fines: ${(+d["TOTAL FINES"]).toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            finesTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            finesTooltip.style("opacity", 0);
        })
        .transition().duration(700).delay((d,i) => i * 80)
        .attr("width", d => Math.max(x(+d["TOTAL FINES"]), 0));

    // Labels
    svg.selectAll(".bar-label").data(sorted).enter().append("text")
        .attr("class", "bar-label")
        .attr("x", d => Math.max(x(+d["TOTAL FINES"]), 0) + 6)
        .attr("y", d => y(d.STATE) + y.bandwidth() / 2 + 4)
        .attr("font-size", "11px").attr("fill", "#475569")
        .attr("font-family", "DM Sans, sans-serif")
        .text(d => (+d["TOTAL FINES"]).toLocaleString());
}


// ══════════════════════════════════════════
// CHART 3: FINES BY AGE GROUP (vertical bar)
// ══════════════════════════════════════════
function drawFinesAge(data) {
    d3.select("#fines-age-chart").selectAll("*").remove();
    const container = document.getElementById("fines-age-chart");
    if (!container) return;

    const margin = { top: 10, right: 20, bottom: 60, left: 70 };
    const width  = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 320 - margin.top - margin.bottom;

    const svg = d3.select("#fines-age-chart")
        .append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const chartData = ageGroups.map((age, i) => ({
        age,
        value: d3.sum(data.filter(d => d.AGE_GROUP === age), d => d["TOTAL FINES"]),
        color: ageColors[i]
    }));

    // Guard: if ALL values are 0 (shouldn't happen but just in case)
    const totalVal = d3.sum(chartData, d => d.value);

    const x = d3.scaleBand().domain(ageGroups).range([0, width]).padding(0.3);
    const y = d3.scaleLinear()
        .domain([0, totalVal > 0 ? d3.max(chartData, d => d.value) * 1.15 : 100])
        .range([height, 0]);

    // Grid
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    // X axis
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", "middle").style("font-size", "11px").attr("dy", "1.5em");

    // Y axis
    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000000) return `${(d/1000000).toFixed(1)}M`;
            if (d >= 1000)    return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    // Y label
    svg.append("text")
        .attr("transform", "rotate(-90)").attr("y", -60).attr("x", -height/2)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
        .text("Total Fines");

    // Bars
    svg.selectAll(".bar").data(chartData).enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.age)).attr("y", height)
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
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            finesTooltip.style("opacity", 0);
        })
        .transition().duration(700).delay((d,i) => i * 80)
        .attr("y",      d => d.value > 0 ? y(d.value) : height)
        .attr("height", d => d.value > 0 ? Math.max(height - y(d.value), 3) : 0);

    // Labels
    svg.selectAll(".bar-label").data(chartData).enter().append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.age) + x.bandwidth() / 2)
        .attr("y", d => d.value > 0 ? y(d.value) - 6 : height - 6)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#475569").attr("font-family", "DM Sans, sans-serif")
        .text(d => d.value === 0 ? "" : d.value.toLocaleString());
}


// ══════════════════════════════════════════
// CHART 4: FINES BY LOCATION (horizontal bar)
// Unknown renamed → "Location Not Specified"
// so NT/QLD/TAS/WA always show something
// ══════════════════════════════════════════
function drawFinesLocation(data) {
    d3.select("#fines-location-chart").selectAll("*").remove();
    const container = document.getElementById("fines-location-chart");
    if (!container) return;

    const margin = { top: 10, right: 180, bottom: 40, left: 210 };
    const width  = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#fines-location-chart")
        .append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Rollup — Unknown already renamed to "Location Not Specified" at load time
    const locMap   = d3.rollup(data, v => d3.sum(v, d => d["TOTAL FINES"]), d => d.LOCATION);
    const chartData = locationOrder
        .filter(loc => locMap.has(loc) && (locMap.get(loc) || 0) > 0)
        .map(loc => ({
            location: loc,
            value:    locMap.get(loc) || 0,
            color:    locColors[loc]  || "#94a3b8"
        }))
        .sort((a,b) => b.value - a.value);

    // Fallback: if no location data at all (shouldn't happen now)
    if (chartData.length === 0) {
        svg.append("text")
            .attr("x", width / 2).attr("y", height / 2)
            .attr("text-anchor", "middle").attr("font-size", "13px")
            .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
            .text("No location data available");
        return;
    }

    const x = d3.scaleLinear().domain([0, d3.max(chartData, d => d.value) * 1.1]).range([0, width]);
    const y = d3.scaleBand().domain(chartData.map(d => d.location)).range([0, height]).padding(0.3);

    // Grid
    svg.append("g").attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4).tickSize(-height).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    // X axis
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000000) return `${(d/1000000).toFixed(1)}M`;
            if (d >= 1000)    return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    // Y axis
    svg.append("g").attr("class", "axis").call(d3.axisLeft(y))
        .selectAll("text").style("font-size", "11px");

    // Bars
    svg.selectAll(".bar").data(chartData).enter().append("rect")
        .attr("class", "bar")
        .attr("x", 0).attr("y", d => y(d.location))
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
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            finesTooltip.style("opacity", 0);
        })
        .transition().duration(700).delay((d,i) => i * 100)
        .attr("width", d => Math.max(x(d.value), 0));

    // Labels
    svg.selectAll(".bar-label").data(chartData).enter().append("text")
        .attr("class", "bar-label")
        .attr("x", d => Math.max(x(d.value), 0) + 8)
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

// Resize support
window.addEventListener("resize", applyFinesFilters);