const breathTooltip = d3.select("body").append("div").attr("class", "tooltip");

const breathStateColors = {
    "ACT": "#2563eb", "NSW": "#16a34a", "NT":  "#f59e0b",
    "QLD": "#dc2626", "SA":  "#8b5cf6", "TAS": "#0891b2",
    "VIC": "#db2777", "WA":  "#ea580c"
};

const regionalColors = {
    "Major Cities of Australia":  "#0284c7",
    "Inner Regional Australia":   "#0d9488",
    "Outer Regional Australia":   "#f59e0b",
    "Remote Australia":           "#e11d48",
    "Very Remote Australia":      "#475569",
    "Location Not Specified":     "#10b981"
};

const regionalLabels = {
    "Major Cities of Australia":  "Major Cities",
    "Inner Regional Australia":   "Inner Regional",
    "Outer Regional Australia":   "Outer Regional",
    "Remote Australia":           "Remote",
    "Very Remote Australia":      "Very Remote",
    "Location Not Specified":     "Not Specified"
};

const breathAgeOrder = ["0-16", "17-25", "26-39", "40-64", "65 and over", "Unknown", "All ages"];
const breathAgeColors = ["#f43f5e", "#bfdbfe", "#60a5fa", "#2563eb", "#1d4ed8", "#a855f7", "#ec4899"];

// Two clean data arrays split by your data structures
let granularDataset = []; // For Donut & Bar Charts (2023-2024 breakdowns)
let historicalDataset = []; // For Line Chart & KPI cards (2008-2024 tracking)

// ── LOAD AND SPLIT THE SPLIT DATA STRUCTURES ──
d3.text("data/breath_2023_2024.csv").then(function(rawText) {
    if (!rawText || rawText.trim() === "") {
        console.error("The CSV dataset file is empty.");
        return;
    }

    // Split text file by lines
    const lines = rawText.split(/\r?\n/);
    
    let isSecondBlock = false;
    let firstBlockLines = [];
    let secondBlockLines = [];

    // Separate the lines dynamically when the second header is detected
    lines.forEach(line => {
        if (line.includes('"YEAR","STATE","TOTAL FINES"')) {
            isSecondBlock = true;
        }
        if (line.trim() !== "") {
            if (!isSecondBlock) {
                firstBlockLines.push(line);
            } else {
                secondBlockLines.push(line);
            }
        }
    });

    // Parse both datasets cleanly using D3 text parser
    granularDataset = d3.csvParse(firstBlockLines.join("\n"));
    historicalDataset = d3.csvParse(secondBlockLines.join("\n"));

    // Clean Granular Dataset (Block 1)
    granularDataset.forEach(d => {
        if (d.STATE) d.STATE = d.STATE.trim().toUpperCase();
        if (d.LOCATION) d.LOCATION = d.LOCATION.trim();
        if (d.LOCATION === "Unknown" || !d.LOCATION) d.LOCATION = "Location Not Specified";
        if (d.AGE_GROUP) d.AGE_GROUP = d.AGE_GROUP.trim();

        d.YEAR = +d.YEAR;
        d.COUNT = +d.COUNT || 0;
        d["TOTAL FINES"] = +d["TOTAL FINES"] || 0;
        d["TOTAL CHARGES"] = +d["TOTAL CHARGES"] || 0;
        d["TOTAL ARRESTS"] = +d["TOTAL ARRESTS"] || 0;
    });

    // Clean Historical Dataset (Block 2)
    historicalDataset.forEach(d => {
        if (d.STATE) d.STATE = d.STATE.trim().toUpperCase();
        d.YEAR = +d.YEAR;
        d.COUNT = +d.COUNT || 0;
        d["TOTAL FINES"] = +d["TOTAL FINES"] || 0;
        d["TOTAL CHARGES"] = +d["TOTAL CHARGES"] || 0;
        d["TOTAL ARRESTS"] = +d["TOTAL ARRESTS"] || 0;
    });

    // Build Select Dropdown dynamically from all states inside historical log
    const states = [...new Set(historicalDataset.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#breath-state-filter");
    stateFilter.selectAll("option:not([value='all'])").remove();
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));

    // Fill Year Filters based on Granular data availability (2023, 2024)
    const granularYears = [...new Set(granularDataset.map(d => d.YEAR))].sort((a,b) => b - a);

    const donutYearSelect = d3.select("#breath-donut-year-filter");
    if (donutYearSelect.node()) {
        donutYearSelect.selectAll("option").remove();
        donutYearSelect.append("option").attr("value", "all").text("All Years");
        granularYears.forEach(y => donutYearSelect.append("option").attr("value", y).text(y));
    }

    const barYearSelect = d3.select("#breath-bar-year-filter");
    if (barYearSelect.node()) {
        barYearSelect.selectAll("option").remove();
        barYearSelect.append("option").attr("value", "all").text("All Years");
        granularYears.forEach(y => barYearSelect.append("option").attr("value", y).text(y));
    }

    d3.select("#breath-state-filter").on("change", applyBreathFilters);
    if (donutYearSelect.node()) donutYearSelect.on("change", updateDonutOnly);
    if (barYearSelect.node())   barYearSelect.on("change", updateBarOnly);

    applyBreathFilters();

}).catch(err => console.error("Error splitting or parsing the datasets:", err));


// ── MASTER FILTER & ACCUMULATION (KPIs) ──
function applyBreathFilters() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";

    // KPI Summary Accumulation strictly uses historical lines (Block 2) to prevent duplicate counts
    let kpiFiltered = historicalDataset.slice();
    if (selectedState !== "all") {
        kpiFiltered = kpiFiltered.filter(d => d.STATE === selectedState);
    }
    
    const totalCount = d3.sum(kpiFiltered, d => d.COUNT);
    const totalCharges = d3.sum(kpiFiltered, d => d["TOTAL CHARGES"]);
    const totalArrests = d3.sum(kpiFiltered, d => d["TOTAL ARRESTS"]);

    const stateMap = d3.rollup(historicalDataset, v => d3.sum(v, d => d.COUNT), d => d.STATE);
    const topState = [...stateMap.entries()].sort((a,b) => b[1] - a[1])[0];

    d3.select("#breath-total").text(totalCount ? totalCount.toLocaleString() : "0");
    d3.select("#breath-charges").text(totalCharges ? totalCharges.toLocaleString() : "0");
    d3.select("#breath-arrests").text(totalArrests ? totalArrests.toLocaleString() : "0");
    d3.select("#breath-top-state").text(topState ? topState[0] : "—");

    // Redraw charts
    drawBreathHistorical(kpiFiltered);
    updateDonutOnly();
    updateBarOnly();
}

// ══════════════════════════════════════════
// CHART 1: HISTORICAL LINE CHART (Block 2)
// ══════════════════════════════════════════
function drawBreathHistorical(data) {
    d3.select("#breath-historical-chart").selectAll("*").remove();
    if (!data || data.length === 0) return;

    const lineDataMap = d3.rollup(data, v => d3.sum(v, d => d.COUNT), d => d.STATE, d => d.YEAR);

    const chartLines = [];
    lineDataMap.forEach((yearMap, state) => {
        const points = [];
        yearMap.forEach((count, year) => {
            if (count > 0) {
                points.push({ state: state, year: year, count: count });
            }
        });
        points.sort((a,b) => a.year - b.year);
        if (points.length > 0) chartLines.push({ state: state, values: points });
    });

    const margin = { top: 20, right: 130, bottom: 50, left: 75 };
    const container = document.getElementById("breath-historical-chart");
    if (!container) return;
    const width = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#breath-historical-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const flatPoints = chartLines.flatMap(d => d.values);
    if (flatPoints.length === 0) return;

    const x = d3.scaleLinear().domain(d3.extent(flatPoints, d => d.year)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(flatPoints, d => d.count) * 1.15 || 100]).range([height, 0]);

    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");

    svg.append("g").attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")))
        .selectAll("text").attr("transform", "rotate(-40)").style("text-anchor", "end");

    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d >= 1000000) return `${(d / 1000000).toFixed(1)}M`;
            if (d >= 1000) return `${(d / 1000).toFixed(0)}K`;
            return d;
        }));

    const lineGenerator = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.count))
        .curve(d3.curveMonotoneX);

    chartLines.forEach(lineData => {
        const color = breathStateColors[lineData.state] || "#94a3b8";

        svg.append("path").datum(lineData.values)
            .attr("fill", "none").attr("stroke", color).attr("stroke-width", 2.5).attr("d", lineGenerator);

        svg.selectAll(`.dot-${lineData.state}`)
            .data(lineData.values).enter().append("circle")
            .attr("cx", d => x(d.year)).attr("cy", d => y(d.count)).attr("r", 3.5)
            .attr("fill", color).attr("stroke", "white").attr("stroke-width", 1.5)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("r", 5.5);
                breathTooltip.style("opacity", 1).html(`<strong>${d.state}</strong><br>Year: ${d.year}<br>Positive Tests: ${d.count.toLocaleString()}`);
            })
            .on("mousemove", function(event) {
                breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("r", 3.5); breathTooltip.style("opacity", 0);
            });
    });

    const legend = svg.append("g").attr("transform", `translate(${width + 12}, 0)`);
    chartLines.sort((a,b)=>a.state.localeCompare(b.state)).forEach((lineData, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 18})`);
        row.append("line").attr("x1", 0).attr("x2", 14).attr("y1", 6).attr("y2", 6).attr("stroke", breathStateColors[lineData.state]).attr("stroke-width", 2.5);
        row.append("text").attr("x", 18).attr("y", 10).attr("font-size", "11px").attr("fill", "#475569").text(lineData.state);
    });
}

// ══════════════════════════════════════════
// CHART 2: REGIONAL DONUT CHART (Block 1)
// ══════════════════════════════════════════
function updateDonutOnly() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";
    const donutNode     = d3.select("#breath-donut-year-filter").node();
    const selectedYear  = donutNode ? donutNode.value : "all";

    // Read details exclusively from Granular dataset (Block 1)
    let filtered = granularDataset.slice();

    if (selectedState !== "all") {
        filtered = filtered.filter(d => d.STATE === selectedState);
    }
    if (selectedYear !== "all") {
        filtered = filtered.filter(d => d.YEAR === +selectedYear);
    }

    const locMap = d3.rollup(filtered, v => d3.sum(v, d => d.COUNT), d => d.LOCATION);
    let totals = Array.from(locMap, ([region, value]) => ({ region, value })).filter(d => d.value > 0);

    const totalVolume = d3.sum(totals, d => d.value);

    d3.select("#breath-donut-chart").selectAll("*").remove();
    const container = document.getElementById("breath-donut-chart");
    if (!container) return;

    const width = container.offsetWidth || 320;
    const height = 340;
    const margin = { top: 10, bottom: 70 };
    const radius = Math.min(width, height - margin.top - margin.bottom) / 2;

    const svg = d3.select("#breath-donut-chart").append("svg").attr("width", width).attr("height", height);
    const chartG = svg.append("g").attr("transform", `translate(${width/2}, ${margin.top + radius})`);

    if (totalVolume === 0) {
        chartG.append("circle").attr("r", radius).attr("fill", "none").attr("stroke", "#f1f5f9").attr("stroke-width", 14).attr("stroke-dasharray", "6,4");
        chartG.append("text").attr("text-anchor", "middle").attr("dy", "0.3em").attr("font-size", "13px").attr("fill", "#64748b").text("No records available");
        return;
    }

    const arc = d3.arc().innerRadius(radius * 0.60).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(radius * 0.58).outerRadius(radius * 1.06);
    const pie = d3.pie().value(d => d.value).sort(null).padAngle(0.03);
    
    chartG.selectAll(".arc")
        .data(pie(totals)).enter().append("path").attr("class", "arc").attr("d", arc)
        .attr("fill", d => regionalColors[d.data.region] || "#cbd5e1")
        .attr("stroke", "white").attr("stroke-width", 2.5)
        .on("mouseover", function(event, d) {
            d3.select(this).transition().duration(150).attr("d", arcHover);
            const pct = ((d.data.value / totalVolume) * 100).toFixed(1);
            breathTooltip.style("opacity", 1).html(`<strong>${regionalLabels[d.data.region] || d.data.region}</strong><br>Tests: ${d.data.value.toLocaleString()}<br>Share: ${pct}%`);
        })
        .on("mousemove", function(event) {
            breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).transition().duration(150).attr("d", arc); breathTooltip.style("opacity", 0);
        });

    chartG.append("text").attr("text-anchor", "middle").attr("dy", "-0.3em").attr("font-size", "20px").attr("font-weight", "700").attr("fill", "#0f172a")
        .text(totalVolume >= 1000000 ? `${(totalVolume/1000000).toFixed(2)}M` : totalVolume.toLocaleString());
    chartG.append("text").attr("text-anchor", "middle").attr("dy", "1.2em").attr("font-size", "10px").attr("fill", "#94a3b8").text("TOTAL TESTS");

    const legendG = svg.append("g");
    const itemW = 160, itemH = 20;
    const cols = 2;

    totals.forEach((d, i) => {
        const col = i % cols; const row = Math.floor(i / cols);
        const g = legendG.append("g").attr("transform", `translate(${col * itemW}, ${row * itemH})`);
        g.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", regionalColors[d.region] || "#cbd5e1");
        g.append("text").attr("x", 14).attr("y", 9).attr("font-size", "10px").attr("fill", "#475569").text(regionalLabels[d.region] || d.region);
    });

    const bounds = legendG.node().getBBox();
    legendG.attr("transform", `translate(${(width - bounds.width) / 2}, ${margin.top + radius * 2 + 18})`);
}

// ══════════════════════════════════════════
// CHART 3: AGE GROUP BAR CHART (Block 1)
// ══════════════════════════════════════════
function updateBarOnly() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";
    const barNode       = d3.select("#breath-bar-year-filter").node();
    const selectedYear  = barNode ? barNode.value : "all";

    // Read details exclusively from Granular dataset (Block 1)
    let filtered = granularDataset.slice();

    if (selectedState !== "all") {
        filtered = filtered.filter(d => d.STATE === selectedState);
    }
    if (selectedYear !== "all") {
        filtered = filtered.filter(d => d.YEAR === +selectedYear);
    }

    const ageMap = d3.rollup(filtered, v => d3.sum(v, d => d.COUNT), d => d.AGE_GROUP);
    let chartData = Array.from(ageMap, ([key, value]) => ({
        key,
        value,
        color: breathAgeColors[breathAgeOrder.indexOf(key)] || "#2563eb"
    })).filter(d => d.value > 0);

    // Sort chart bars perfectly into index order
    chartData.sort((a, b) => breathAgeOrder.indexOf(a.key) - breathAgeOrder.indexOf(b.key));

    d3.select("#breath-bar-chart").selectAll("*").remove();
    const container = document.getElementById("breath-bar-chart");
    if (!container) return;

    const margin = { top: 20, right: 20, bottom: 65, left: 75 };
    const width = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 320 - margin.top - margin.bottom;
    const svg = d3.select("#breath-bar-chart").append("svg").attr("width", width + margin.left + margin.right).attr("height", height + margin.top + margin.bottom).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    if (chartData.length === 0) {
        svg.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle").attr("font-size", "13px").attr("fill", "#64748b").text("No records available");
        return;
    }

    const x = d3.scaleBand().domain(chartData.map(d => d.key)).range([0, width]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => d.value) * 1.15]).range([height, 0]);

    svg.append("g").attr("class", "grid").call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat("")).selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x)).selectAll("text").style("text-anchor", "middle").style("font-size", "10px").attr("dy", "1.5em").call(wrap, x.bandwidth());
    
    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d >= 1000000) return `${(d / 1000000).toFixed(1)}M`;
            if (d >= 1000) return `${(d / 1000).toFixed(0)}K`;
            return d;
        }));

    svg.selectAll(".bar")
        .data(chartData).enter().append("rect").attr("class", "bar").attr("x", d => x(d.key)).attr("width", x.bandwidth()).attr("y", height).attr("height", 0).attr("fill", d => d.color).attr("rx", 4)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            breathTooltip.style("opacity", 1).html(`<strong>${d.key}</strong><br>Positive Tests: ${d.value.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            breathTooltip.style("left", (event.pageX + 14) + "px").style("top", (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1); breathTooltip.style("opacity", 0);
        })
        .transition().duration(700)
        .attr("y", d => y(d.value)).attr("height", d => Math.max(0, height - y(d.value)));

    svg.selectAll(".bar-label")
        .data(chartData).enter().append("text").attr("class", "bar-label").attr("x", d => x(d.key) + x.bandwidth() / 2).attr("y", d => y(d.value) - 6).attr("text-anchor", "middle").attr("font-size", "10px").attr("fill", "#475569").text(d => d.value.toLocaleString());
}

function wrap(text, width) {
    text.each(function() {
        var text = d3.select(this), words = text.text().split(/\s+/).reverse(), word, line = [], lineNumber = 0, lineHeight = 1.1, y = text.attr("y"), dy = parseFloat(text.attr("dy")), tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
        while (word = words.pop()) {
            line.push(word); tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop(); tspan.text(line.join(" ")); line = [word];
                tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
            }
        }
    });
}

window.addEventListener("resize", applyBreathFilters);