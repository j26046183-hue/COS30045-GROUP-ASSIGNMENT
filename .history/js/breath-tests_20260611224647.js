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
    "Location Not Specified":     "#94a3b8" // Slate gray to keep newly added state rows looking clean
};

const regionalLabels = {
    "Major Cities of Australia":  "Major Cities",
    "Inner Regional Australia":   "Inner Regional",
    "Outer Regional Australia":   "Outer Regional",
    "Remote Australia":           "Remote",
    "Very Remote Australia":      "Very Remote",
    "Location Not Specified":     "Not Specified"
};

// Explicit presentation order for all demographics present in your dataset
const breathAgeOrder = ["Under 17", "17-25", "26-39", "40-64", "65 and over", "Age Group Not Specified"];
const breathAgeColors = ["#cbd5e1", "#bfdbfe", "#60a5fa", "#2563eb", "#1d4ed8", "#475569"];

// Both blocks now reference slices from our single master dataset array
let breathMasterData = [];
let breathHistoricalData = [];
let breathModernData     = [];

// ── LOAD UNIFIED DATA ──
// We load your single file directly. No Promise.all array management needed!
d3.csv("data/breath_2023_2024.csv").then(function(rawCSV) {
    if (!rawCSV || rawCSV.length === 0) { 
        console.error("Unified breath data file failed to parse or is empty."); 
        return; 
    }

    // Single pass-through to clean data types uniformly
    rawCSV.forEach(d => {
        d.YEAR           = +d.YEAR;
        d.COUNT          = +d.COUNT          || 0;
        d["TOTAL FINES"]   = +d["TOTAL FINES"]   || 0;
        d["TOTAL CHARGES"] = +d["TOTAL CHARGES"] || 0;
        d["TOTAL ARRESTS"] = +d["TOTAL ARRESTS"] || 0;
    });

    breathMasterData = rawCSV;

    // Split data programmatically based on your database design thresholds:
    // 1. Historical trend tracks the overall aggregate numbers across all years
    breathHistoricalData = breathMasterData; 
    
    // 2. Modern data handles 2023 and 2024 exclusively for the Donut and Bar breakdowns
    breathModernData = breathMasterData.filter(d => d.YEAR === 2023 || d.YEAR === 2024);

    // ── Populate state filter using all states present across history ──
    const states = [...new Set(breathHistoricalData.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#breath-state-filter");
    stateFilter.selectAll("option:not([value='all'])").remove();
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));

    // ── Populate year selectors dynamically for the fine-grained cards ──
    const uniqueYears = [...new Set(breathModernData.map(d => d.YEAR))].sort((a,b) => b - a);

    const donutYearSelect = d3.select("#breath-donut-year-filter");
    if (donutYearSelect.node()) {
        donutYearSelect.selectAll("option").remove();
        donutYearSelect.append("option").attr("value", "all").text("All Years");
        uniqueYears.forEach(y => donutYearSelect.append("option").attr("value", y).text(y));
    }

    const barYearSelect = d3.select("#breath-bar-year-filter");
    if (barYearSelect.node()) {
        barYearSelect.selectAll("option").remove();
        barYearSelect.append("option").attr("value", "all").text("All Years");
        uniqueYears.forEach(y => barYearSelect.append("option").attr("value", y).text(y));
    }

    // ── Interactive UI Triggers ──
    d3.select("#breath-state-filter").on("change", applyBreathFilters);
    if (donutYearSelect.node()) donutYearSelect.on("change", updateDonutOnly);
    if (barYearSelect.node())   barYearSelect.on("change", updateBarOnly);

    // Run initial visualization render pass
    applyBreathFilters();

}).catch(err => console.error("Error reading unified breath test CSV matrix:", err));


// ── MASTER FILTER & ACCUMULATION ──
function applyBreathFilters() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";

    // 1. Line Chart Data Isolation
    // When showing historical view, we don't look at granular rows. We filter to rows that represent yearly totals.
    let filteredHistorical = breathHistoricalData.slice();
    if (selectedState !== "all") {
        filteredHistorical = filteredHistorical.filter(d => d.STATE === selectedState);
    }

    // 2. Main Metric Summary Cards 
    // We isolate 2023/2024 to compute aggregate KPI sums across all granular breakdowns safely
    let filteredStats = breathModernData.slice();
    if (selectedState !== "all") {
        filteredStats = filteredStats.filter(d => d.STATE === selectedState);
    }
    
    const totalCount   = d3.sum(filteredStats, d => d.COUNT);
    const totalCharges = d3.sum(filteredStats, d => d["TOTAL CHARGES"]);
    const totalArrests = d3.sum(filteredStats, d => d["TOTAL ARRESTS"]);

    // Calculate absolute historical top performer across full timeline
    const stateMap = d3.rollup(
        breathHistoricalData.filter(d => d.LOCATION === "All regions" || d.LOCATION === "Location Not Specified"), 
        v => d3.sum(v, d => d.COUNT), 
        d => d.STATE
    );
    const topState = [...stateMap.entries()].sort((a,b) => b[1] - a[1])[0];

    // Inject formatting into card nodes
    d3.select("#breath-total").text(totalCount.toLocaleString());
    d3.select("#breath-charges").text(totalCharges.toLocaleString());
    d3.select("#breath-arrests").text(totalArrests.toLocaleString());
    d3.select("#breath-top-state").text(topState ? topState[0] : "—");

    // Redraw charts
    drawBreathHistorical(filteredHistorical);
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

    drawBreathRegionalDonut(filtered, selectedState);
}

function updateBarOnly() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";
    const barNode       = d3.select("#breath-bar-year-filter").node();
    const selectedYear  = barNode ? barNode.value : "all";

    let filtered = breathModernData.slice();
    if (selectedState !== "all") filtered = filtered.filter(d => d.STATE === selectedState);
    if (selectedYear  !== "all") filtered = filtered.filter(d => d.YEAR === +selectedYear);

    drawBreathAgeBar(filtered, selectedState);
}

// ══════════════════════════════════════════
// CHART 1: HISTORICAL LINE CHART
// ══════════════════════════════════════════
function drawBreathHistorical(data) {
    d3.select("#breath-historical-chart").selectAll("*").remove();
    if (!data || data.length === 0) return;

    // Separate aggregate total trend rows from fine-grained micro-rows to ensure line charts scale beautifully
    const lineDataMap = d3.rollup(
        data,
        v => d3.sum(v, d => d.COUNT),
        d => d.STATE,
        d => d.YEAR
    );

    // Convert map metrics back into clean array layouts for D3 path creation
    const chartLines = [];
    lineDataMap.forEach((yearMap, state) => {
        const points = [];
        yearMap.forEach((count, year) => {
            points.push({ state: state, year: year, count: count });
        });
        points.sort((a,b) => a.year - b.year);
        chartLines.push({ state: state, values: points });
    });

    const margin = { top: 20, right: 130, bottom: 50, left: 75 };
    const container = document.getElementById("breath-historical-chart");
    if (!container) return;
    const width  = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#breath-historical-chart")
        .append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const allYears = [...new Set(data.map(d => d.YEAR))].sort((a,b) => a - b);
    
    // Flat mapping array helpers for axis scaling domains
    const flatPoints = chartLines.flatMap(d => d.values);

    const x = d3.scaleLinear().domain(d3.extent(flatPoints, d => d.year)).range([0, width]);
    const y = d3.scaleLinear()
        .domain([0, d3.max(flatPoints, d => d.count) * 1.15 || 100])
        .range([height, 0]);

    // Background Grid lines
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    // X axis
    svg.append("g").attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickValues(allYears.filter((y,i)=> i % 2 === 0 || y >= 2022)).tickFormat(d3.format("d")))
        .selectAll("text").attr("transform", "rotate(-40)")
        .style("text-anchor", "end").style("font-size", "10px");

    // Y axis
    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000000) return `${(d/1000000).toFixed(1)}M`;
            if (d >= 1000)    return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    // Y axis label placement
    svg.append("text")
        .attr("transform", "rotate(-90)").attr("y", -60).attr("x", -height/2)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
        .text("Positive Breath Tests / Volume");

    const lineGenerator = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.count))
        .curve(d3.curveMonotoneX);

    chartLines.forEach(lineData => {
        const color = breathStateColors[lineData.state] || "#94a3b8";

        // Draw Line paths
        svg.append("path").datum(lineData.values)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 2.5)
            .attr("d", lineGenerator);

        // Append interactive hover circles
        svg.selectAll(`.dot-${lineData.state}`)
            .data(lineData.values)
            .enter().append("circle")
            .attr("cx", d => x(d.year))
            .attr("with-year", d => d.year)
            .attr("cy", d => y(d.count))
            .attr("r", 3.5)
            .attr("fill", color)
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this).attr("r", 5.5);
                breathTooltip.style("opacity", 1)
                    .html(`<strong>${d.state}</strong><br>Year: ${d.year}<br>Positive Tests: ${d.count.toLocaleString()}`);
            })
            .on("mousemove", function(event) {
                breathTooltip
                    .style("left", (event.pageX + 14) + "px")
                    .style("top",  (event.pageY - 32) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("r", 3.5);
                breathTooltip.style("opacity", 0);
            });
    });

    // Right-hand margin Legend construction
    const legend = svg.append("g").attr("transform", `translate(${width + 12}, 0)`);
    chartLines.sort((a,b)=>a.state.localeCompare(b.state)).forEach((lineData, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 18})`);
        row.append("line")
            .attr("x1", 0).attr("x2", 14).attr("y1", 6).attr("y2", 6)
            .attr("stroke", breathStateColors[lineData.state] || "#94a3b8")
            .attr("stroke-width", 2.5);
        row.append("text")
            .attr("x", 18).attr("y", 10)
            .attr("font-size", "11px").attr("fill", "#475569")
            .attr("font-family", "DM Sans, sans-serif")
            .text(lineData.state);
    });
}


// ══════════════════════════════════════════
// CHART 2: REGIONAL DONUT CHART
// ══════════════════════════════════════════
function drawBreathRegionalDonut(data, selectedState) {
    d3.select("#breath-donut-chart").selectAll("*").remove();

    const container = document.getElementById("breath-donut-chart");
    if (!container) return;

    const width  = container.offsetWidth || 320;
    const height = 340;
    const margin = { top: 10, bottom: 70 };
    const radius = Math.min(width, height - margin.top - margin.bottom) / 2;

    const svg    = d3.select("#breath-donut-chart")
        .append("svg").attr("width", width).attr("height", height);
    const chartG = svg.append("g")
        .attr("transform", `translate(${width/2}, ${margin.top + radius})`);

    const locationOrder = [
        "Major Cities of Australia",
        "Inner Regional Australia",
        "Outer Regional Australia",
        "Remote Australia",
        "Very Remote Australia",
        "Location Not Specified"
    ];

    const locMap = d3.rollup(data, v => d3.sum(v, d => d.COUNT), d => d.LOCATION);
    const totals = locationOrder
        .map(loc => ({ region: loc, value: locMap.get(loc) || 0 }))
        .filter(d => d.value > 0);

    const totalVolume = d3.sum(totals, d => d.value);

    // Empty state render check
    if (totalVolume === 0) {
        chartG.append("circle")
            .attr("r", radius)
            .attr("fill", "none")
            .attr("stroke", "#e2e8f0")
            .attr("stroke-width", 28)
            .attr("stroke-dasharray", "8,6");
        chartG.append("text")
            .attr("text-anchor", "middle").attr("dy", "0.4em")
            .attr("font-size", "12px").attr("fill", "#94a3b8")
            .attr("font-family", "DM Sans, sans-serif")
            .text("No Spatial Volume Registered");
        return;
    }

    const arc = d3.arc().innerRadius(radius * 0.60).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(radius * 0.58).outerRadius(radius * 1.06);
    const pie = d3.pie().value(d => d.value).sort(null).padAngle(0.03);
    
    // Draw slices
    chartG.selectAll(".arc")
        .data(pie(totals))
        .enter().append("path")
        .attr("class", "arc")
        .attr("d", arc)
        .attr("fill", d => regionalColors[d.data.region] || "#cbd5e1")
        .attr("stroke", "white")
        .attr("stroke-width", 2.5)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).transition().duration(150).attr("d", arcHover);
            const pct = ((d.data.value / totalVolume) * 100).toFixed(1);
            breathTooltip.style("opacity", 1)
                .html(`<strong>${regionalLabels[d.data.region] || d.data.region}</strong><br>Tests: ${d.data.value.toLocaleString()}<br>Share: ${pct}%`);
        })
        .on("mousemove", function(event) {
            breathTooltip
                .style("left", (event.pageX + 14) + "px")
                .style("top",  (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).transition().duration(150).attr("d", arc);
            breathTooltip.style("opacity", 0);
        })
        .transition().duration(700).delay((d,i) => i * 100)
        .attrTween("d", function(d) {
            const interp = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d);
            return t => arc(interp(t));
        });

    // Central metrics label text string
    chartG.append("text")
        .attr("text-anchor", "middle").attr("dy", "-0.3em")
        .attr("font-family", "Syne, sans-serif")
        .attr("font-size", "20px").attr("font-weight", "700").attr("fill", "#0f172a")
        .text(totalVolume >= 1000000 ? `${(totalVolume/1000000).toFixed(2)}M` : totalVolume.toLocaleString());

    chartG.append("text")
        .attr("text-anchor", "middle").attr("dy", "1.2em")
        .attr("font-size", "10px").attr("fill", "#94a3b8")
        .attr("font-family", "DM Sans, sans-serif")
        .attr("letter-spacing", "0.8px")
        .text("TOTAL TESTS");

    // Render legend block below donut circle
    const legendG = svg.append("g");
    const itemW = 135, itemH = 18;
    const cols = 2;

    totals.forEach((d, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const g = legendG.append("g").attr("transform", `translate(${col * itemW}, ${row * itemH})`);
        g.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", regionalColors[d.region] || "#cbd5e1");
        g.append("text").attr("x", 14).attr("y", 9).attr("font-size", "10px").attr("fill", "#475569")
            .attr("font-family", "DM Sans, sans-serif").text(regionalLabels[d.region] || d.region);
    });

    const bounds = legendG.node().getBBox();
    legendG.attr("transform", `translate(${(width - bounds.width) / 2}, ${margin.top + radius * 2 + 18})`);
}


// ══════════════════════════════════════════
// CHART 3: AGE GROUP BAR CHART
// ══════════════════════════════════════════
function drawBreathAgeBar(data, selectedState) {
    d3.select("#breath-bar-chart").selectAll("*").remove();

    const container = document.getElementById("breath-bar-chart");
    if (!container) return;

    const margin = { top: 20, right: 20, bottom: 65, left: 75 };
    const width  = Math.max(container.offsetWidth - margin.left - margin.right, 100);
    const height = 320 - margin.top - margin.bottom;

    const svg = d3.select("#breath-bar-chart")
        .append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    if (data.length === 0) {
        svg.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle")
            .attr("font-size", "13px").attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
            .text("No demographic records matching filters");
        return;
    }

    // Rollup maps. Excludes 'All ages' blocks to allow standard age categories to resolve cleanly.
    const ageMap = d3.rollup(
        data.filter(d => d.AGE_GROUP && d.AGE_GROUP !== "Unknown" && d.AGE_GROUP !== "All ages" && d.AGE_GROUP !== "All regions"),
        v => d3.sum(v, d => d.COUNT),
        d => d.AGE_GROUP
    );

    const chartData = breathAgeOrder
        .filter(age => (ageMap.get(age) || 0) > 0)
        .map(age => ({
            key:   age,
            value: ageMap.get(age) || 0,
            color: breathAgeColors[breathAgeOrder.indexOf(age)] || "#2563eb"
        }));

    // If counts are zero (like NT's 2023 granular rows), verify if we should notify about metric reporting rules
    if (chartData.length === 0) {
        svg.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle")
            .attr("font-size", "12px").attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
            .text("No granular age breakdown metrics returned for metric selection");
        return;
    }

    const x = d3.scaleBand().domain(chartData.map(d => d.key)).range([0, width]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => d.value) * 1.15]).range([height, 0]);

    // Grid background
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    // X axis configuration
    svg.append("g").attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", "middle")
        .style("font-size", "10px")
        .attr("dy", "1.5em")
        .call(wrap, x.bandwidth()); // Text wrap safety fallback utility for longer labels

    // Y axis configuration
    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000000) return `${(d/1000000).toFixed(1)}M`;
            if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    // Y Axis metric label
    svg.append("text")
        .attr("transform", "rotate(-90)").attr("y", -60).attr("x", -height/2)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
        .text("Positive Test Count");

    // Bars
    svg.selectAll(".bar")
        .data(chartData).enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.key))
        .attr("width", x.bandwidth())
        .attr("y", height).attr("height", 0)
        .attr("fill", d => d.color)
        .attr("rx", 4)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            breathTooltip.style("opacity", 1)
                .html(`<strong>${d.key}</strong><br>Positive Tests: ${d.value.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            breathTooltip
                .style("left", (event.pageX + 14) + "px")
                .style("top",  (event.pageY - 32) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            breathTooltip.style("opacity", 0);
        })
        .transition().duration(700).delay((d,i) => i * 80)
        .attr("y", d => y(d.value))
        .attr("height", d => Math.max(0, height - y(d.value)));

    // Individual value text labels placement above bars
    svg.selectAll(".bar-label")
        .data(chartData).enter().append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d.key) + x.bandwidth() / 2)
        .attr("y", d => y(d.value) - 6)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px").attr("fill", "#475569")
        .attr("font-family", "DM Sans, sans-serif")
        .text(d => d.value.toLocaleString());
}

// Axis text overflow wrapping formatting layout framework tool
function wrap(text, width) {
    text.each(function() {
        var text = d3.select(this),
            words = text.text().split(/\s+/).reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1.1, 
            y = text.attr("y"),
            dy = parseFloat(text.attr("dy")),
            tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
            }
        }
    });
}

// Window resize listener
window.addEventListener("resize", applyBreathFilters);