// =====================
// FINES BY AGE GROUP
// Grouped Bar Chart
// =====================

const agemargin = { top: 20, right: 150, bottom: 80, left: 80 };
const ageWidth = document.getElementById("age-group-chart").offsetWidth - agemargin.left - agemargin.right;
const ageHeight = 400 - agemargin.top - agemargin.bottom;

// Tooltip
const ageTooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip");

// SVG
const ageSvg = d3.select("#age-group-chart")
    .append("svg")
    .attr("width", ageWidth + agemargin.left + agemargin.right)
    .attr("height", ageHeight + agemargin.top + agemargin.bottom)
    .append("g")
    .attr("transform", `translate(${agemargin.left},${agemargin.top})`);

// Colors for each age group
const ageColors = {
    "Under 17": "#93c5fd",
    "17-25": "#2563eb",
    "26-39": "#16a34a",
    "40-64": "#f97316",
    "65 and over": "#dc2626"
};

// Load data
d3.csv("data/fines_age_metric.csv").then(function(data) {

    // Parse numbers
    data.forEach(d => d["TOTAL FINES"] = +d["TOTAL FINES"]);

    // Filter out Unknown age group
    data = data.filter(d => d.AGE_GROUP !== "Unknown");

    // Get unique metrics and age groups
    const metrics = [...new Set(data.map(d => d.METRIC))];
    const ageGroups = ["Under 17", "17-25", "26-39", "40-64", "65 and over"];

    // X0 scale - metrics
    const x0 = d3.scaleBand()
        .domain(metrics)
        .range([0, ageWidth])
        .padding(0.2);

    // X1 scale - age groups within each metric
    const x1 = d3.scaleBand()
        .domain(ageGroups)
        .range([0, x0.bandwidth()])
        .padding(0.05);

    // Y scale
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d["TOTAL FINES"])])
        .range([ageHeight, 0]);

    // Gridlines
    ageSvg.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y)
            .ticks(5)
            .tickSize(-ageWidth)
            .tickFormat(""))
        .selectAll("line")
        .style("stroke", "#e2e8f0")
        .style("stroke-dasharray", "4,4");

    ageSvg.select(".grid .domain").remove();

    // X axis
    ageSvg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${ageHeight})`)
        .call(d3.axisBottom(x0)
            .tickFormat(d => d.replace(/_/g, " ")))
        .selectAll("text")
        .attr("transform", "rotate(-15)")
        .style("text-anchor", "end");

    // Y axis
    ageSvg.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d => d >= 1000000
                ? `${d / 1000000}M`
                : `${d / 1000}K`));

    // Y axis label
    ageSvg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -65)
        .attr("x", -ageHeight / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("fill", "#475569")
        .text("Total Fines");

    // Group bars by metric
    const metricGroups = ageSvg.selectAll(".metric-group")
        .data(metrics)
        .enter()
        .append("g")
        .attr("class", "metric-group")
        .attr("transform", d => `translate(${x0(d)},0)`);

    // Bars
    metricGroups.selectAll("rect")
        .data(metric => ageGroups.map(age => ({
            age,
            metric,
            value: data.find(d => d.AGE_GROUP === age && d.METRIC === metric)?.["TOTAL FINES"] || 0
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
            d3.select(this).attr("opacity", 0.8);
            ageTooltip
                .style("opacity", 1)
                .html(`<strong>${d.age}</strong><br>
                       Offence: ${d.metric.replace(/_/g, " ")}<br>
                       Total Fines: ${d.value.toLocaleString()}`);
        })
        .on("mousemove", function(event) {
            ageTooltip
                .style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            ageTooltip.style("opacity", 0);
        })
        .transition()
        .duration(800)
        .delay((d, i) => i * 50)
        .attr("y", d => y(d.value))
        .attr("height", d => ageHeight - y(d.value));

    // Legend
    const legend = ageSvg.append("g")
        .attr("transform", `translate(${ageWidth + 20}, 0)`);

    ageGroups.forEach((age, i) => {
        legend.append("rect")
            .attr("x", 0)
            .attr("y", i * 24)
            .attr("width", 14)
            .attr("height", 14)
            .attr("rx", 3)
            .attr("fill", ageColors[age]);

        legend.append("text")
            .attr("x", 20)
            .attr("y", i * 24 + 11)
            .attr("font-size", "12px")
            .attr("fill", "#475569")
            .attr("font-family", "DM Sans, sans-serif")
            .text(age);
    });
});