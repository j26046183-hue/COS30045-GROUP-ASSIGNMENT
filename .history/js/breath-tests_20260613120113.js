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
    "Very Remote Australia":      "#475569"
};

const regionalLabels = {
    "Major Cities of Australia":  "Major Cities",
    "Inner Regional Australia":   "Inner Regional",
    "Outer Regional Australia":   "Outer Regional",
    "Remote Australia":           "Remote",
    "Very Remote Australia":      "Very Remote"
};

// Age group display order
const breathAgeOrder = ["0-16", "17-25", "26-39", "40-64", "65 and over"];
const breathAgeColors = ["#bfdbfe", "#60a5fa", "#2563eb", "#1d4ed8", "#1e3a8a"];

let breathHistoricalData = [];
let breathModernData     = [];

// ── LOAD DATA ──
Promise.all([
    d3.csv("data/breath_historical_trend.csv").catch(err => {
        console.error("Missing: breath_historical_trend.csv", err); return null;
    }),
    d3.csv("data/breath_2023_2024.csv").catch(err => {
        console.error("Missing: breath_2023_2024.csv", err); return null;
    })
]).then(function([historical, modern]) {

    if (!historical) { console.error("breath_historical_trend.csv failed to load."); return; }
    if (!modern)     { console.error("breath_2023_2024.csv failed to load."); return; }

    // Parse historical
    historical.forEach(d => {
        d.YEAR             = +d.YEAR;
        d.COUNT            = +d.COUNT            || 0;
        d["TOTAL FINES"]   = +d["TOTAL FINES"]   || 0;
        d["TOTAL CHARGES"] = +d["TOTAL CHARGES"] || 0;
        d["TOTAL ARRESTS"] = +d["TOTAL ARRESTS"] || 0;
    });

    // Parse modern
    modern.forEach(d => {
        d.YEAR             = +d.YEAR;
        d.COUNT            = +d.COUNT            || 0;
        d["TOTAL FINES"]   = +d["TOTAL FINES"]   || 0;
        d["TOTAL CHARGES"] = +d["TOTAL CHARGES"] || 0;
        d["TOTAL ARRESTS"] = +d["TOTAL ARRESTS"] || 0;
    });

    breathHistoricalData = historical;
    breathModernData     = modern;

    // ── Populate top state filter (all 8 states — for KPI + line chart only) ──
    const states = [...new Set(historical.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#breath-state-filter");
    stateFilter.selectAll("option:not([value='all'])").remove();
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));

    // ── Event listeners ──
    // Top filter → KPI cards + line chart only
    d3.select("#breath-state-filter").on("change", applyBreathTopFilters);

    // Breakdown filters → donut + bar only
    d3.select("#breakdown-year-filter").on("change", applyBreakdownFilters);
    d3.select("#breakdown-state-filter").on("change", applyBreakdownFilters);

    // Initial render — defer so DOM is fully laid out first
    requestAnimationFrame(() => {
        applyBreathTopFilters();
        applyBreakdownFilters();
    });

    // Re-render whenever the breath page becomes visible (e.g. nav tab click)
    const breathPage = document.getElementById("page-breath");
    if (breathPage && window.MutationObserver) {
        new MutationObserver(() => {
            if (breathPage.classList.contains("active")) {
                requestAnimationFrame(() => {
                    applyBreathTopFilters();
                    applyBreakdownFilters();
                });
            }
        }).observe(breathPage, { attributes: true, attributeFilter: ["class"] });
    }

}).catch(err => console.error("Breath test data load error:", err));


// ── TOP FILTER: KPI cards + line chart only ──
function applyBreathTopFilters() {
    const selectedState = d3.select("#breath-state-filter").property("value") || "all";

    // Filter historical for line chart
    let filteredHistorical = breathHistoricalData.slice();
    if (selectedState !== "all") {
        filteredHistorical = filteredHistorical.filter(d => d.STATE === selectedState);
    }

    // Mini stats — use historical 2023+2024 data
    const hist2324 = breathHistoricalData.filter(d =>
        d.YEAR >= 2023 && (selectedState === "all" || d.STATE === selectedState)
    );
    const totalCount   = d3.sum(hist2324, d => d.COUNT);
    const totalCharges = d3.sum(hist2324, d => d["TOTAL CHARGES"]);
    const totalArrests = d3.sum(hist2324, d => d["TOTAL ARRESTS"]);

    // Top state by total positive tests across all years
    const stateMap = d3.rollup(breathHistoricalData, v => d3.sum(v, d => d.COUNT), d => d.STATE);
    const topState = [...stateMap.entries()].sort((a,b) => b[1] - a[1])[0];

    d3.select("#breath-total").text(totalCount.toLocaleString());
    d3.select("#breath-charges").text(totalCharges.toLocaleString());
    d3.select("#breath-arrests").text(totalArrests.toLocaleString());
    d3.select("#breath-top-state").text(topState ? topState[0] : "—");

    // Draw line chart only
    drawBreathHistorical(filteredHistorical);
}


// ── BREAKDOWN FILTER: donut + bar only ──
function applyBreakdownFilters() {
    const selectedState = d3.select("#breakdown-state-filter").property("value") || "all";
    const selectedYear  = d3.select("#breakdown-year-filter").property("value")  || "all";

    let filtered = breathModernData.slice();
    if (selectedState !== "all") filtered = filtered.filter(d => d.STATE === selectedState);
    if (selectedYear  !== "all") filtered = filtered.filter(d => d.YEAR === +selectedYear);

    drawBreathRegionalDonut(filtered, selectedState);
    drawBreathAgeBar(filtered, selectedState);
}


// ══════════════════════════════════════════
// CHART 1: HISTORICAL LINE CHART
// ══════════════════════════════════════════
function drawBreathHistorical(data) {
    d3.select("#breath-historical-chart").selectAll("*").remove();
    if (!data || data.length === 0) return;

    const margin = { top: 20, right: 150, bottom: 50, left: 75 };
    const container = document.getElementById("breath-historical-chart");
    if (!container) return;
    const rawWidth = container.getBoundingClientRect().width || container.offsetWidth;
    const width  = Math.max(rawWidth - margin.left - margin.right, 200);
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select("#breath-historical-chart")
        .append("svg")
        .attr("width",  width  + margin.left + margin.right)
        .attr("height", height + margin.top  + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const grouped   = d3.group(data, d => d.STATE);
    const uniqueYrs = [...new Set(data.map(d => d.YEAR))].sort((a,b) => a - b);

    const x = d3.scaleLinear().domain(d3.extent(data, d => d.YEAR)).range([0, width]);
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.COUNT) * 1.15 || 100])
        .range([height, 0]);

    // Grid
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    // X axis
    svg.append("g").attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickValues(uniqueYrs).tickFormat(d3.format("d")))
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

    // Y label
    svg.append("text")
        .attr("transform", "rotate(-90)").attr("y", -60).attr("x", -height/2)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
        .text("Positive Breath Tests");

    const line = d3.line()
        .defined(d => d.COUNT > 0)
        .x(d => x(d.YEAR))
        .y(d => y(d.COUNT))
        .curve(d3.curveMonotoneX);

    grouped.forEach((values, state) => {
        const sorted = [...values].sort((a,b) => a.YEAR - b.YEAR);
        const color  = breathStateColors[state] || "#94a3b8";

        svg.append("path").datum(sorted)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 2.5)
            .attr("d", line);

        svg.selectAll(`.dot-${state}`)
            .data(sorted.filter(d => d.COUNT > 0))
            .enter().append("circle")
            .attr("cx", d => x(d.YEAR))
            .attr("cy", d => y(d.COUNT))
            .attr("r", 3.5)
            .attr("fill", color)
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this).attr("r", 5);
                breathTooltip.style("opacity", 1)
                    .html(`<strong>${d.STATE}</strong><br>Year: ${d.YEAR}<br>Positive Tests: ${d.COUNT.toLocaleString()}`);
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

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${width + 12}, 0)`);
    [...grouped.keys()].sort().forEach((state, i) => {
        const row = legend.append("g").attr("transform", `translate(0, ${i * 18})`);
        row.append("line")
            .attr("x1", 0).attr("x2", 14).attr("y1", 6).attr("y2", 6)
            .attr("stroke", breathStateColors[state] || "#94a3b8")
            .attr("stroke-width", 2.5);
        row.append("text")
            .attr("x", 18).attr("y", 10)
            .attr("font-size", "11px").attr("fill", "#475569")
            .attr("font-family", "DM Sans, sans-serif")
            .text(state);
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

    // Aggregate by location
    const locationOrder = [
        "Major Cities of Australia",
        "Inner Regional Australia",
        "Outer Regional Australia",
        "Remote Australia",
        "Very Remote Australia"
    ];

    const locMap = d3.rollup(data, v => d3.sum(v, d => d.COUNT), d => d.LOCATION);
    const totals = locationOrder
        .map(loc => ({ region: loc, value: locMap.get(loc) || 0 }))
        .filter(d => d.value > 0);

    const totalVolume = d3.sum(totals, d => d.value);

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
            .text("No Data Available");
        return;
    }

    // Arc generators
    const arc = d3.arc()
        .innerRadius(radius * 0.60)
        .outerRadius(radius);

    const arcHover = d3.arc()
        .innerRadius(radius * 0.58)
        .outerRadius(radius * 1.06);

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
                .html(`<strong>${regionalLabels[d.data.region] || d.data.region}</strong><br>Tests: ${d.data.value.toLocaleString()}<br>Percentage: ${pct}%`);
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
            const interp = d3.interpolate(
                { startAngle: d.startAngle, endAngle: d.startAngle }, d
            );
            return t => arc(interp(t));
        });

    // Center label
    chartG.append("text")
        .attr("text-anchor", "middle").attr("dy", "-0.3em")
        .attr("font-family", "Syne, sans-serif")
        .attr("font-size", "20px").attr("font-weight", "700").attr("fill", "#ffffff")
        .text(totalVolume >= 1000000
            ? `${(totalVolume/1000000).toFixed(2)}M`
            : totalVolume.toLocaleString());

    chartG.append("text")
        .attr("text-anchor", "middle").attr("dy", "1.2em")
        .attr("font-size", "10px").attr("fill", "#94a3b8")
        .attr("font-family", "DM Sans, sans-serif")
        .attr("letter-spacing", "0.8px")
        .text("TOTAL TESTS");

    // Legend — centered below donut
    const legendG = svg.append("g");
    const itemW = 130, itemH = 18;
    const cols = 2;

    totals.forEach((d, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const g = legendG.append("g")
            .attr("transform", `translate(${col * itemW}, ${row * itemH})`);
        g.append("rect")
            .attr("width", 10).attr("height", 10).attr("rx", 2)
            .attr("fill", regionalColors[d.region] || "#cbd5e1");
        g.append("text")
            .attr("x", 14).attr("y", 9)
            .attr("font-size", "10px").attr("fill", "#475569")
            .attr("font-family", "DM Sans, sans-serif")
            .text(regionalLabels[d.region] || d.region);
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
        svg.append("text")
            .attr("x", width / 2).attr("y", height / 2)
            .attr("text-anchor", "middle")
            .attr("font-size", "13px").attr("fill", "#94a3b8")
            .attr("font-family", "DM Sans, sans-serif")
            .text("No data available for selected filters");
        return;
    }

    // Rollup by age group — use defined order
    const ageMap = d3.rollup(
        data.filter(d => d.AGE_GROUP && d.AGE_GROUP !== "Unknown" && d.AGE_GROUP !== "All ages"),
        v => d3.sum(v, d => d.COUNT),
        d => d.AGE_GROUP
    );

    const chartData = breathAgeOrder
        .filter(age => (ageMap.get(age) || 0) > 0)
        .map((age, i) => ({
            key:   age,
            value: ageMap.get(age) || 0,
            color: breathAgeColors[breathAgeOrder.indexOf(age)] || "#2563eb"
        }));

    if (chartData.length === 0) {
        svg.append("text")
            .attr("x", width / 2).attr("y", height / 2)
            .attr("text-anchor", "middle").attr("font-size", "13px")
            .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
            .text("No age breakdown available");
        return;
    }

    const x = d3.scaleBand()
        .domain(chartData.map(d => d.key))
        .range([0, width]).padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.value) * 1.15])
        .range([height, 0]);

    // Grid
    svg.append("g").attr("class", "grid")
        .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""))
        .selectAll("line").style("stroke", "#f1f5f9").style("stroke-dasharray", "4,4");
    svg.select(".grid .domain").remove();

    // X axis
    svg.append("g").attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .attr("dy", "1.5em");

    // Y axis
    svg.append("g").attr("class", "axis")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
            if (d === 0) return "0";
            if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
            return d;
        }));

    // Y label
    svg.append("text")
        .attr("transform", "rotate(-90)").attr("y", -60).attr("x", -height/2)
        .attr("text-anchor", "middle").attr("font-size", "11px")
        .attr("fill", "#94a3b8").attr("font-family", "DM Sans, sans-serif")
        .text("Positive Tests");

    // Bars
    svg.selectAll(".bar")
        .data(chartData).enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.key))
        .attr("width", x.bandwidth())
        .attr("y", height).attr("height", 0)
        .attr("fill", d => d.color)
        .attr("rx", 5)
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

    // Value labels
    svg.selectAll(".bar-label")
    .data(chartData).enter().append("text")
    .attr("class", "bar-label")
    .attr("x", d => x(d.key) + x.bandwidth() / 2)
    .attr("y", d => {
        const barHeight = height - y(d.value);
        return barHeight > 300 ? y(d.value) + 20 : y(d.value) - 8;
    })
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("font-family", "DM Sans, sans-serif")
    .attr("fill", d => (height - y(d.value)) > 300 ? "#ffffff" : "#475569")
    .text(d => {
        if (d.value === 0) return "";
        if (d.value >= 1000000) return `${(d.value/1000000).toFixed(1)}M`;
        if (d.value >= 1000)    return `${(d.value/1000).toFixed(0)}K`;
        return d.value.toLocaleString();
    });
}

// Resize support
window.addEventListener("resize", () => {
    applyBreathTopFilters();
    applyBreakdownFilters();
});