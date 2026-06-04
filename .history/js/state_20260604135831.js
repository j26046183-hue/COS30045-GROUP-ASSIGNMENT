const stateMargin = { top: 20, right: 150, bottom: 40, left: 60 };
const stateWidth = document.getElementById("state-chart").offsetWidth - stateMargin.left - stateMargin.right;
const stateHeight = 420 - stateMargin.top - stateMargin.bottom;

// Tooltip
const stateTooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip");

// SVG
const stateSvg = d3.select("#state-chart")
    .append("svg")
    .attr("width", stateWidth + stateMargin.left + stateMargin.right)
    .attr("height", stateHeight + stateMargin.top + stateMargin.bottom)
    .append("g")
    .attr("transform", `translate(${stateMargin.left},${stateMargin.top})`);

// Color scale
const stateColorScale = d3.scaleSequential()
    .interpolator(d3.interpolateRgb("#93c5fd", "#1e3a8a"));

// Load data
d3.csv("data/fines_age_metric.csv").then(function(rawData) {

    // Parse numbers
    rawData.forEach(d => d["TOTAL FINES"] = +d["TOTAL FINES"]);

    // Populate age group filter
    const ageGroups = [...new Set(rawData.map(d => d.AGE_GROUP))]
        .filter(a => a !== "Unknown")
        .sort();

    const ageFilter = d3.select("#state-age-filter");
    ageGroups.forEach(age => {
        ageFilter.append("option").attr("value", age).text(age);
    });

    // Populate metric filter
    const metrics = [...new Set(rawData.map(d => d.METRIC))].sort();
    const metricFilter = d3.select("#state-metric-filter");
    metrics.forEach(metric => {
        metricFilter.append("option")
            .attr("value", metric)
            .text(metric.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
    });

    // Draw chart function
    function drawStateChart(data) {

        // Clear previous chart
        stateSvg.selectAll("*").remove();

        // Group by state and sum fines
        const stateMap = d3.rollup(
            data,
            v => d3.sum(v, d => d["TOTAL FINES"]),
            d => d.STATE
        );

        const stateData = Array.from(stateMap, ([state, total]) => ({ state, total }))
            .sort((a, b) => b.total - a.total);

        // Update color scale domain
        stateColorScale.domain([d3.min(stateData, d => d.total), d3.max(stateData, d => d.total)]);
        // X scale
        const x = d3.scaleLinear()
            .domain([0, d3.max(stateData, d => d.total)])
            .range([0, stateWidth]);

        // Y scale
        const y = d3.scaleBand()
            .domain(stateData.map(d => d.state))
            .range([0, stateHeight])
            .padding(0.25);

        // Gridlines
        stateSvg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${stateHeight})`)
            .call(d3.axisBottom(x)
                .ticks(5)
                .tickSize(-stateHeight)
                .tickFormat(""))
            .selectAll("line")
            .style("stroke", "#e2e8f0")
            .style("stroke-dasharray", "4,4");

        stateSvg.select(".grid .domain").remove();

        // X axis
        stateSvg.append("g")
            .attr("class", "axis")
            .attr("transform", `translate(0,${stateHeight})`)
            .call(d3.axisBottom(x)
                .ticks(5)
                .tickFormat(d => {
                    if (d === 0) return "0";
                    if (d >= 1000000) return `${(d / 1000000).toFixed(1)}M`;
                    if (d >= 1000) return `${(d / 1000).toFixed(0)}K`;
                    return d;
                }));

        // Y axis
        stateSvg.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y));

        // Bars
        stateSvg.selectAll(".bar")
            .data(stateData)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", 0)
            .attr("y", d => y(d.state))
            .attr("height", y.bandwidth())
            .attr("width", 0)
            .attr("rx", 6)
            .attr("fill", d => stateColorScale(d.total))
            .on("mouseover", function(event, d) {
                d3.select(this).attr("opacity", 0.8);
                stateTooltip
                    .style("opacity", 1)
                    .html(`<strong>${d.state}</strong><br>Total Fines: ${d.total.toLocaleString()}`);
            })
            .on("mousemove", function(event) {
                stateTooltip
                    .style("left", (event.pageX + 12) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("opacity", 1);
                stateTooltip.style("opacity", 0);
            })
            .transition()
            .duration(800)
            .delay((d, i) => i * 80)
            .attr("width", d => x(d.total));

        // Value labels
        stateSvg.selectAll(".bar-label")
            .data(stateData)
            .enter()
            .append("text")
            .attr("class", "bar-label")
            .attr("x", d => x(d.total) + 8)
            .attr("y", d => y(d.state) + y.bandwidth() / 2 + 4)
            .attr("font-size", "12px")
            .attr("fill", "#475569")
            .attr("font-family", "DM Sans, sans-serif")
            .text(d => d.total.toLocaleString());
    }

    // Filter function
    function applyFilters() {
        const selectedAge = d3.select("#state-age-filter").property("value");
        const selectedMetric = d3.select("#state-metric-filter").property("value");

        let filtered = rawData.filter(d => d.AGE_GROUP !== "Unknown");

        if (selectedAge !== "all") {
            filtered = filtered.filter(d => d.AGE_GROUP === selectedAge);
        }
        if (selectedMetric !== "all") {
            filtered = filtered.filter(d => d.METRIC === selectedMetric);
        }

        drawStateChart(filtered);
    }

    // Event listeners
    d3.select("#state-age-filter").on("change", applyFilters);
    d3.select("#state-metric-filter").on("change", applyFilters);

    // Initial draw
    applyFilters();

    
});