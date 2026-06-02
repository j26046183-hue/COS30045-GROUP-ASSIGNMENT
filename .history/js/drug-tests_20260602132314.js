// =====================
// DRUG TESTS CHARTS
// Line Chart + Donut Chart
// With State + Year Filters
// =====================

// ── SHARED TOOLTIP ──
const drugTooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip");

// ── COLORS ──
const drugColors = {
    "AMPHETAMINE":       "#2563eb",
    "CANNABIS":          "#16a34a",
    "COCAINE":           "#f59e0b",
    "ECSTASY":           "#dc2626",
    "METHYLAMPHETAMINE": "#7c3aed"
};

const stateColors = {
    "ACT": "#2563eb",
    "NSW": "#16a34a",
    "NT":  "#f59e0b",
    "QLD": "#dc2626",
    "SA":  "#7c3aed",
    "TAS": "#0891b2",
    "VIC": "#db2777",
    "WA":  "#ea580c"
};

// ── LOAD BOTH FILES ──
Promise.all([
    d3.csv("data/drug_by_year_state.csv"),
    d3.csv("data/drug_by_type.csv")
]).then(function([stateData, typeData]) {

    // Parse numbers
    stateData.forEach(d => {
        d.YEAR = +d.YEAR;
        d.COUNT = +d.COUNT;
    });

    typeData.forEach(d => {
        d.YEAR = +d.YEAR;
        d.AMPHETAMINE = +d.AMPHETAMINE;
        d.CANNABIS = +d.CANNABIS;
        d.COCAINE = +d.COCAINE;
        d.ECSTASY = +d.ECSTASY;
        d.METHYLAMPHETAMINE = +d.METHYLAMPHETAMINE;
    });

    // Populate state filter
    const states = [...new Set(stateData.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#drug-state-filter");
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));

    // ── DRAW LINE CHART ──
    function drawLineChart(data) {
        const container = document.getElementById("drug-line-chart");
        d3.select("#drug-line-chart").selectAll("*").remove();

        const margin = { top: 20, right: 120, bottom: 50, left: 70 };
        const width = container.offsetWidth - margin.left - margin.right;
        const height = 380 - margin.top - margin.bottom;

        const svg = d3.select("#drug-line-chart")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Group by state
        const grouped = d3.group(data, d => d.STATE);
        const years = [2023, 2024];

        // X scale
        const x = d3.scalePoint()
            .domain(years)
            .range([0, width])
            .padding(0.5);

        // Y scale
        const maxVal = d3.max(data, d => d.COUNT);
        const y = d3.scaleLinear()
            .domain([0, maxVal * 1.1])
            .range([height, 0]);

        // Gridlines
        svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y)
                .ticks(5)
                .tickSize(-width)
                .tickFormat(""))
            .selectAll("line")
            .style("stroke", "#f1f5f9")
            .style("stroke-dasharray", "4,4");

        svg.select(".grid .domain").remove();

        // X axis
        svg.append("g")
            .attr("class", "axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).tickFormat(d => d.toString()));

        // Y axis
        svg.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y)
                .ticks(5)
                .tickFormat(d => {
                    if (d === 0) return "0";
                    if (d >= 1000000) return `${(d/1000000).toFixed(1)}M`;
                    if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
                    return d;
                }));

        // Y axis label
        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -55)
            .attr("x", -height / 2)
            .attr("text-anchor", "middle")
            .attr("font-size", "11px")
            .attr("fill", "#94a3b8")
            .attr("font-family", "DM Sans, sans-serif")
            .text("Positive Drug Tests");

        // Line generator
        const line = d3.line()
            .x(d => x(d.YEAR))
            .y(d => y(d.COUNT));

        // Draw lines per state
        grouped.forEach((values, state) => {
            const sorted = values.sort((a, b) => a.YEAR - b.YEAR);

            // Line
            svg.append("path")
                .datum(sorted)
                .attr("fill", "none")
                .attr("stroke", stateColors[state] || "#94a3b8")
                .attr("stroke-width", 2.5)
                .attr("d", line);

            // Dots
            svg.selectAll(`.dot-${state}`)
                .data(sorted)
                .enter()
                .append("circle")
                .attr("cx", d => x(d.YEAR))
                .attr("cy", d => y(d.COUNT))
                .attr("r", 5)
                .attr("fill", stateColors[state] || "#94a3b8")
                .attr("stroke", "white")
                .attr("stroke-width", 2)
                .on("mouseover", function(event, d) {
                    drugTooltip
                        .style("opacity", 1)
                        .html(`<strong>${d.STATE}</strong><br>
                               Year: ${d.YEAR}<br>
                               Positive Tests: ${d.COUNT.toLocaleString()}`);
                })
                .on("mousemove", function(event) {
                    drugTooltip
                        .style("left", (event.pageX + 14) + "px")
                        .style("top", (event.pageY - 32) + "px");
                })
                .on("mouseout", function() {
                    drugTooltip.style("opacity", 0);
                });
        });

        // Legend
        const legend = svg.append("g")
            .attr("transform", `translate(${width + 12}, 0)`);

        Array.from(grouped.keys()).sort().forEach((state, i) => {
            const row = legend.append("g")
                .attr("transform", `translate(0, ${i * 22})`);

            row.append("line")
                .attr("x1", 0).attr("x2", 16)
                .attr("y1", 6).attr("y2", 6)
                .attr("stroke", stateColors[state] || "#94a3b8")
                .attr("stroke-width", 2.5);

            row.append("text")
                .attr("x", 22)
                .attr("y", 10)
                .attr("font-size", "11px")
                .attr("fill", "#475569")
                .attr("font-family", "DM Sans, sans-serif")
                .text(state);
        });
    }

    // ── DRAW DONUT CHART ──
    function drawDonutChart(data) {
        d3.select("#drug-donut-chart").selectAll("*").remove();

        const container = document.getElementById("drug-donut-chart");
        const size = Math.min(container.offsetWidth, 380);
        const margin = { top: 20, right: 20, bottom: 20, left: 20 };
        const width = size - margin.left - margin.right;
        const height = size - margin.top - margin.bottom;
        const radius = Math.min(width, height) / 2;

        const svg = d3.select("#drug-donut-chart")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${width / 2 + margin.left},${height / 2 + margin.top})`);

        // Sum drug types across selected years
        const drugs = ["AMPHETAMINE", "CANNABIS", "COCAINE", "ECSTASY", "METHYLAMPHETAMINE"];
        const totals = drugs.map(drug => ({
            drug,
            value: d3.sum(data, d => d[drug])
        }));

        // Pie generator
        const pie = d3.pie()
            .value(d => d.value)
            .sort(null);

        const arc = d3.arc()
            .innerRadius(radius * 0.55)
            .outerRadius(radius);

        const arcHover = d3.arc()
            .innerRadius(radius * 0.55)
            .outerRadius(radius * 1.06);

        // Draw arcs
        svg.selectAll(".arc")
            .data(pie(totals))
            .enter()
            .append("path")
            .attr("class", "arc")
            .attr("d", arc)
            .attr("fill", d => drugColors[d.data.drug])
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("d", arcHover);
                const total = d3.sum(totals, t => t.value);
                const pct = ((d.data.value / total) * 100).toFixed(1);
                drugTooltip
                    .style("opacity", 1)
                    .html(`<strong>${d.data.drug}</strong><br>
                           Count: ${d.data.value.toLocaleString()}<br>
                           Share: ${pct}%`);
            })
            .on("mousemove", function(event) {
                drugTooltip
                    .style("left", (event.pageX + 14) + "px")
                    .style("top", (event.pageY - 32) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("d", arc);
                drugTooltip.style("opacity", 0);
            });

        // Center text
        const total = d3.sum(totals, d => d.value);
        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "-0.3em")
            .attr("font-size", "22px")
            .attr("font-weight", "700")
            .attr("font-family", "Syne, sans-serif")
            .attr("fill", "#0f172a")
            .text(total.toLocaleString());

        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "1.2em")
            .attr("font-size", "11px")
            .attr("fill", "#94a3b8")
            .attr("font-family", "DM Sans, sans-serif")
            .text("Total Detections");

        // Legend below donut
        const legendG = svg.append("g")
            .attr("transform", `translate(${-radius}, ${radius + 20})`);

        totals.forEach((d, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const g = legendG.append("g")
                .attr("transform", `translate(${col * (radius + 10)}, ${row * 22})`);

            g.append("rect")
                .attr("width", 10)
                .attr("height", 10)
                .attr("rx", 2)
                .attr("fill", drugColors[d.drug]);

            g.append("text")
                .attr("x", 14)
                .attr("y", 9)
                .attr("font-size", "10px")
                .attr("fill", "#475569")
                .attr("font-family", "DM Sans, sans-serif")
                .text(d.drug.charAt(0) + d.drug.slice(1).toLowerCase());
        });
    }

    // ── FILTER FUNCTION ──
    function applyDrugFilters() {
        const selectedState = d3.select("#drug-state-filter").property("value");
        const selectedYear = d3.select("#drug-year-filter").property("value");

        // Filter state data for line chart
        let filteredState = stateData.slice();
        if (selectedState !== "all") {
            filteredState = filteredState.filter(d => d.STATE === selectedState);
        }
        if (selectedYear !== "all") {
            filteredState = filteredState.filter(d => d.YEAR === +selectedYear);
        }

        // Filter type data for donut chart
        let filteredType = typeData.slice();
        if (selectedYear !== "all") {
            filteredType = filteredType.filter(d => d.YEAR === +selectedYear);
        }

        drawLineChart(filteredState);
        drawDonutChart(filteredType);
    }

    // ── EVENT LISTENERS ──
    d3.select("#drug-state-filter").on("change", applyDrugFilters);
    d3.select("#drug-year-filter").on("change", applyDrugFilters);

    // ── INITIAL DRAW ──
    applyDrugFilters();
});