// =====================
// FINES BY LOCATION
// Horizontal Bar Chart
// With State + Age Group Filters
// =====================

const locMargin = { top: 20, right: 160, bottom: 60, left: 200 };
const locWidth = document.getElementById("location-chart").offsetWidth - locMargin.left - locMargin.right;
const locHeight = 500 - locMargin.top - locMargin.bottom;

// Tooltip
const locTooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip");

// SVG
const locSvg = d3.select("#location-chart")
    .append("svg")
    .attr("width", locWidth + locMargin.left + locMargin.right)
    .attr("height", locHeight + locMargin.top + locMargin.bottom)
    .append("g")
    .attr("transform", `translate(${locMargin.left},${locMargin.top})`);

// Location colors
const locColors = {
    "Major Cities of Australia": "#2563eb",
    "Inner Regional Australia":  "#16a34a",
    "Outer Regional Australia":  "#f59e0b",
    "Remote Australia":          "#dc2626",
    "Very Remote Australia":     "#7c3aed"
};

const locationOrder = [
    "Major Cities of Australia",
    "Inner Regional Australia",
    "Outer Regional Australia",
    "Remote Australia",
    "Very Remote Australia"
];

// Load data
d3.csv("data/fines_location_age.csv").then(function(rawData) {

    // Parse numbers
    rawData.forEach(d => d["TOTAL FINES"] = +d["TOTAL FINES"]);

    // Filter out Unknown location and Unknown age group
    rawData = rawData.filter(d => d.LOCATION !== "Unknown" && d.AGE_GROUP !== "Unknown");

    // Populate state filter dynamically
    const states = [...new Set(rawData.map(d => d.STATE))].sort();
    const stateFilter = d3.select("#loc-state-filter");
    states.forEach(s => stateFilter.append("option").attr("value", s).text(s));

    // Populate age group filter dynamically
    const ageGroups = [...new Set(rawData.map(d => d.AGE_GROUP))]
        .filter(a => a !== "Unknown")
        .sort();
    const ageFilter = d3.select("#loc-age-filter");
    ageGroups.forEach(a => ageFilter.append("option").attr("value", a).text(a));

    // Draw function
    function drawLocChart(data) {

        locSvg.selectAll("*").remove();

        // Sum fines per location
        const locMap = d3.rollup(
            data,
            v => d3.sum(v, d => d["TOTAL FINES"]),
            d => d.LOCATION
        );

        // Build chart data in fixed order
        const chartData = locationOrder
            .filter(loc => locMap.has(loc))
            .map(loc => ({
                location: loc,
                value: locMap.get(loc) || 0,
                color: locColors[loc]
            }))
            .sort((a, b) => b.value - a.value);

        // X scale
        const x = d3.scaleLinear()
            .domain([0, d3.max(chartData, d => d.value) * 1.1])
            .range([0, locWidth]);

        // Y scale
        const y = d3.scaleBand()
            .domain(chartData.map(d => d.location))
            .range([0, locHeight])
            .padding(0.3);

        // Gridlines
        locSvg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0,${locHeight})`)
            .call(d3.axisBottom(x)
                .ticks(5)
                .tickSize(-locHeight)
                .tickFormat(""))
            .selectAll("line")
            .style("stroke", "#f1f5f9")
            .style("stroke-dasharray", "4,4");

        locSvg.select(".grid .domain").remove();

        // X axis
        locSvg.append("g")
            .attr("class", "axis")
            .attr("transform", `translate(0,${locHeight})`)
            .call(d3.axisBottom(x)
                .ticks(5)
                .tickFormat(d => {
                    if (d === 0) return "0";
                    if (d >= 1000000) return `${(d/1000000).toFixed(1)}M`;
                    if (d >= 1000) return `${(d/1000).toFixed(0)}K`;
                    return d;
                }));

        // X axis label
        locSvg.append("text")
            .attr("x", locWidth / 2)
            .attr("y", locHeight + 48)
            .attr("text-anchor", "middle")
            .attr("font-size", "11px")
            .attr("fill", "#94a3b8")
            .attr("font-family", "DM Sans, sans-serif")
            .text("Total Fines");

        // Y axis
        locSvg.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y))
            .selectAll("text")
            .style("font-size", "12px");

        // Bars
        locSvg.selectAll(".bar")
            .data(chartData)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", 0)
            .attr("y", d => y(d.location))
            .attr("height", y.bandwidth())
            .attr("width", 0)
            .attr("rx", 6)
            .attr("fill", d => d.color)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("opacity", 0.8);
                locTooltip
                    .style("opacity", 1)
                    .html(`<strong>${d.location}</strong><br>
                           Total Fines: ${d.value.toLocaleString()}`);
            })
            .on("mousemove", function(event) {
                locTooltip
                    .style("left", (event.pageX + 14) + "px")
                    .style("top", (event.pageY - 32) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("opacity", 1);
                locTooltip.style("opacity", 0);
            })
            .transition()
            .duration(700)
            .delay((d, i) => i * 100)
            .attr("width", d => x(d.value));

        // Value labels
        locSvg.selectAll(".bar-label")
            .data(chartData)
            .enter()
            .append("text")
            .attr("class", "bar-label")
            .attr("x", d => x(d.value) + 8)
            .attr("y", d => y(d.location) + y.bandwidth() / 2 + 4)
            .attr("font-size", "12px")
            .attr("fill", "#475569")
            .attr("font-family", "DM Sans, sans-serif")
            .text(d => d.value.toLocaleString());

        // Legend
        const legend = locSvg.append("g")
            .attr("transform", `translate(${locWidth + 20}, 0)`);

        chartData.forEach((d, i) => {
            const row = legend.append("g")
                .attr("transform", `translate(0, ${i * 26})`);

            row.append("rect")
                .attr("width", 12)
                .attr("height", 12)
                .attr("rx", 3)
                .attr("fill", d.color);

            row.append("text")
                .attr("x", 18)
                .attr("y", 10)
                .attr("font-size", "11px")
                .attr("fill", "#475569")
                .attr("font-family", "DM Sans, sans-serif")
                .text(d.location.replace(" Australia", "").replace(" of", ""));
        });
    }

    // Filter function
    function applyLocFilters() {
        const selectedState = d3.select("#loc-state-filter").property("value");
        const selectedAge = d3.select("#loc-age-filter").property("value");

        let filtered = rawData.slice();

        if (selectedState !== "all") {
            filtered = filtered.filter(d => d.STATE === selectedState);
        }
        if (selectedAge !== "all") {
            filtered = filtered.filter(d => d.AGE_GROUP === selectedAge);
        }

        drawLocChart(filtered);
    }

    // Event listeners
    d3.select("#loc-state-filter").on("change", applyLocFilters);
    d3.select("#loc-age-filter").on("change", applyLocFilters);

    // Initial draw
    applyLocFilters();

    
});