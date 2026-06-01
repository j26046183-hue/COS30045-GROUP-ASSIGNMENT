// =====================
// FINES BY AGE GROUP
// Grouped Bar Chart
// With State + Metric Filters
// =====================

const ageMargin = { top: 20, right: 160, bottom: 80, left: 80 };
const ageWidth = document.getElementById("age-group-chart").offsetWidth - ageMargin.left - ageMargin.right;
const ageHeight = 600 - ageMargin.top - ageMargin.bottom;

// Tooltip
const ageTooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip");

// SVG
const ageSvg = d3.select("#age-group-chart")
    .append("svg")
    .attr("width", ageWidth + ageMargin.left + ageMargin.right)
    .attr("height", ageHeight + ageMargin.top + ageMargin.bottom)
    .append("g")
    .attr("transform", `translate(${ageMargin.left},${ageMargin.top})`);

// Age group colors
const ageColors = {
    "Under 17":    "#93c5fd",
    "17-25":       "#2563eb",
    "26-39":       "#16a34a",
    "40-64":       "#f59e0b",
    "65 and over": "#dc2626"
};

const ageGroups = ["Under 17", "17-25", "26-39", "40-64", "65 and over"];

// Load data
d3.csv("data/fines_age_metric.csv").then(function(rawData) {

    // Parse numbers
    rawData.forEach(d => d["TOTAL FINES"] = +d["TOTAL FINES"]);

    // Filter unknown
    rawData = rawData.filter(d => d.AGE_GROUP !== "Unknown");
    rawData = rawData.filter(d => d.METRIC !== "Unknown" && d.METRIC !== "" && d.METRIC !== null);

    // Populate state filter dynamically
    const states = [...new Set(rawData.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#age-state-filter");
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));

    // Populate offence filter dynamically — NO "All Offences" option
    const metrics = [...new Set(rawData.map(d => d.METRIC))].sort();
    const offenceFilter = d3.select("#age-offence-filter");
    metrics.forEach(m => offenceFilter.append("option")
        .attr("value", m)
        .text(m.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())));

    // Draw function
    function drawAgeChart(data) {

        ageSvg.selectAll("*").remove();

        // Get unique metrics from filtered data
        const activeMetrics = [...new Set(data.map(d => d.METRIC))].sort();

        // X0 - metrics
        const x0 = d3.scaleBand()
            .domain(activeMetrics)
            .range([0, ageWidth])
            .padding(0.25);

        // X1 - age groups within metric
        const x1 = d3.scaleBand()
            .domain(ageGroups)
            .range([0, x0.bandwidth()])
            .padding(0.08);

        // Calculate max summed value
        const maxVal = d3.max(activeMetrics, metric =>
            d3.max(ageGroups, age =>
                d3.sum(data.filter(d => d.AGE_GROUP === age && d.METRIC === metric), d => d["TOTAL FINES"])
            )
        );

        // Y scale
        const y = d3.scaleLinear()
            .domain([0, maxVal * 1.05])
            .range([ageHeight, 0]);

        // Gridlines
        ageSvg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y)
                .ticks(5)
                .tickSize(-ageWidth)
                .tickFormat(""))
            .selectAll("line")
            .style("stroke", "#f1f5f9")
            .style("stroke-dasharray", "4,4");

        ageSvg.select(".grid .domain").remove();

        // X axis
        ageSvg.append("g")
            .attr("class", "axis")
            .attr("transform", `translate(0,${ageHeight})`)
            .call(d3.axisBottom(x0)
                .tickFormat(d => d.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())))
            .selectAll("text")
            .attr("transform", "rotate(0)")
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .attr("dy", "1.5em");

        // Y axis
        ageSvg.append("g")
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
        ageSvg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -65)
            .attr("x", -ageHeight / 2)
            .attr("text-anchor", "middle")
            .attr("font-size", "11px")
            .attr("fill", "#94a3b8")
            .attr("font-family", "DM Sans, sans-serif")
            .text("Total Fines");

        // Bars grouped by metric
        const metricGroups = ageSvg.selectAll(".metric-group")
            .data(activeMetrics)
            .enter()
            .append("g")
            .attr("class", "metric-group")
            .attr("transform", d => `translate(${x0(d)},0)`);

        metricGroups.selectAll("rect")
            .data(metric => ageGroups.map(age => ({
                age,
                metric,
                value: d3.sum(data.filter(d => d.AGE_GROUP === age && d.METRIC === metric), d => d["TOTAL FINES"])
            })))
            .enter()
            .append("rect")
            .attr("x", d => x1(d.age))
            .attr("y", ageHeight)
            .attr("width", x1.bandwidth())
            .attr("height", 0)
            .attr("rx", 3)
            .attr("fill", d => ageColors[d.age])
            .on("mouseover", function(event, d) {
                d3.select(this).attr("opacity", 0.75);
                ageTooltip
                    .style("opacity", 1)
                    .html(`<strong>${d.age}</strong><br>
                           Offence: ${d.metric.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}<br>
                           Fines: ${d.value.toLocaleString()}`);
            })
            .on("mousemove", function(event) {
                ageTooltip
                    .style("left", (event.pageX + 14) + "px")
                    .style("top", (event.pageY - 32) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("opacity", 1);
                ageTooltip.style("opacity", 0);
            })
            .transition()
            .duration(700)
            .delay((d, i) => i * 40)
            .attr("y", d => d.value > 0 ? Math.min(y(d.value), ageHeight - 3) : ageHeight)
            .attr("height", d => d.value > 0 ? Math.max(ageHeight - y(d.value), 3) : 0);

        // Legend
        const legend = ageSvg.append("g")
            .attr("transform", `translate(${ageWidth + 20}, 0)`);

        ageGroups.forEach((age, i) => {
            const row = legend.append("g")
                .attr("transform", `translate(0, ${i * 26})`);

            row.append("rect")
                .attr("width", 12)
                .attr("height", 12)
                .attr("rx", 3)
                .attr("fill", ageColors[age]);

            row.append("text")
                .attr("x", 18)
                .attr("y", 10)
                .attr("font-size", "12px")
                .attr("fill", "#475569")
                .attr("font-family", "DM Sans, sans-serif")
                .text(age);
        });
    }

    // Filter function
    function applyAgeFilters() {
        const selectedState = d3.select("#age-state-filter").property("value");
        const selectedOffence = d3.select("#age-offence-filter").property("value");

        let filtered = rawData.slice();

        if (selectedState !== "all") {
            filtered = filtered.filter(d => d.STATE === selectedState);
        }

        // Always filter by selected offence — no "All" option
        filtered = filtered.filter(d => d.METRIC === selectedOffence);

        drawAgeChart(filtered);
    }

    // Event listeners
    d3.select("#age-state-filter").on("change", applyAgeFilters);
    d3.select("#age-offence-filter").on("change", applyAgeFilters);

    // Initial draw
    applyAgeFilters();
});