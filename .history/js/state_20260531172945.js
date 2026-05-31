// =====================
// FINES BY STATE CHART
// Horizontal Bar Chart
// =====================

// Margin and dimensions
const stateMargin = { top: 20, right: 120, bottom: 50, left: 60 };
const stateWidth = document.getElementById("state-chart").offsetWidth - stateMargin.left - stateMargin.right;
const stateHeight = 400 - stateMargin.top - stateMargin.bottom;

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
const stateColor = d3.scaleSequential()
    .domain([0, 2500000])
    .interpolator(d3.interpolateBlues);

// Load data
d3.csv("data/fines_by_state.csv").then(function(data) {

    // Parse numbers
    data.forEach(d => d["TOTAL FINES"] = +d["TOTAL FINES"]);

    // Sort descending
    data.sort((a, b) => b["TOTAL FINES"] - a["TOTAL FINES"]);

    // X scale
    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d["TOTAL FINES"])])
        .range([0, stateWidth]);

    // Y scale
    const y = d3.scaleBand()
        .domain(data.map(d => d.STATE))
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
            .tickFormat(d => d >= 1000000
                ? `${d / 1000000}M`
                : `${d / 1000}K`));

    // Y axis
    stateSvg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y));

    // Bars
    stateSvg.selectAll(".bar")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", 0)
        .attr("y", d => y(d.STATE))
        .attr("height", y.bandwidth())
        .attr("width", 0)
        .attr("rx", 6)
        .attr("fill", d => stateColor(d["TOTAL FINES"]))
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            stateTooltip
                .style("opacity", 1)
                .html(`<strong>${d.STATE}</strong><br>Total Fines: ${d["TOTAL FINES"].toLocaleString()}`);
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
        .attr("width", d => x(d["TOTAL FINES"]));

    // Value labels
    stateSvg.selectAll(".bar-label")
        .data(data)
        .enter()
        .append("text")
        .attr("class", "bar-label")
        .attr("x", d => x(d["TOTAL FINES"]) + 8)
        .attr("y", d => y(d.STATE) + y.bandwidth() / 2 + 4)
        .attr("font-size", "12px")
        .attr("fill", "#475569")
        .attr("font-family", "DM Sans, sans-serif")
        .text(d => d["TOTAL FINES"] >= 1000000
            ? `${(d["TOTAL FINES"] / 1000000).toFixed(1)}M`
            : `${(d["TOTAL FINES"] / 1000).toFixed(0)}K`);
});