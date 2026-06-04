// =====================
// FINES BY AGE GROUP
// Bar Chart — X axis = Age Groups
// With State + Offence Filters
// =====================

const ageMargin = { top: 20, right: 40, bottom: 80, left: 80 };
const ageWidth = document.getElementById("age-group-chart").offsetWidth - ageMargin.left - ageMargin.right;
const ageHeight = 500 - ageMargin.top - ageMargin.bottom;

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

// Age groups in order
const ageGroups = ["Under 17", "17-25", "26-39", "40-64", "65 and over"];

// Color scale — single blue ramp per age group
const ageBarColors = [
    "#bfdbfe",
    "#60a5fa",
    "#2563eb",
    "#1d4ed8",
    "#1e3a8a"
];

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

    // Populate offence filter dynamically
    const metrics = [...new Set(rawData.map(d => d.METRIC))].sort();
    const offenceFilter = d3.select("#age-offence-filter");
    metrics.forEach(m => offenceFilter.append("option")
        .attr("value", m)
        .text(m.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())));

    // Draw function
    function drawAgeChart(data) {

        ageSvg.selectAll("*").remove();

        // Sum fines per age group
        const chartData = ageGroups.map((age, i) => ({
            age,
            value: d3.sum(data.filter(d => d.AGE_GROUP === age), d => d["TOTAL FINES"]),
            color: ageBarColors[i]
        }));

        // X scale — age groups
        const x = d3.scaleBand()
            .domain(ageGroups)
            .range([0, ageWidth])
            .padding(0.3);

        // Y scale
        const maxVal = d3.max(chartData, d => d.value);
        const y = d3.scaleLinear()
            .domain([0, maxVal * 1.1])
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
            .call(d3.axisBottom(x))
            .selectAll("text")
            .style("text-anchor", "middle")
            .style("font-size", "13px")
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

        // Bars
        ageSvg.selectAll(".bar")
            .data(chartData)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.age))
            .attr("y", ageHeight)
            .attr("width", x.bandwidth())
            .attr("height", 0)
            .attr("rx", 6)
            .attr("fill", d => d.color)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("opacity", 0.8);
                ageTooltip
                    .style("opacity", 1)
                    .html(`<strong>${d.age}</strong><br>
                           Total Fines: ${d.value.toLocaleString()}`);
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
            .delay((d, i) => i * 80)
            .attr("y", d => d.value > 0 ? y(d.value) : ageHeight)
            .attr("height", d => d.value > 0 ? Math.max(ageHeight - y(d.value), 3) : 0);

        // Value labels on top of bars — exact numbers
        ageSvg.selectAll(".bar-label")
            .data(chartData)
            .enter()
            .append("text")
            .attr("class", "bar-label")
            .attr("x", d => x(d.age) + x.bandwidth() / 2)
            .attr("y", d => y(d.value) - 8)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("fill", "#475569")
            .attr("font-family", "DM Sans, sans-serif")
            .text(d => d.value === 0 ? "" : d.value.toLocaleString());
    }

    // Filter function
    function applyAgeFilters() {
        const selectedState = d3.select("#age-state-filter").property("value");
        const selectedOffence = d3.select("#age-offence-filter").property("value");

        let filtered = rawData.slice();

        if (selectedState !== "all") {
            filtered = filtered.filter(d => d.STATE === selectedState);
        }

        filtered = filtered.filter(d => d.METRIC === selectedOffence);

        drawAgeChart(filtered);
    }

    // Event listeners
    d3.select("#age-state-filter").on("change", applyAgeFilters);
    d3.select("#age-offence-filter").on("change", applyAgeFilters);

    // Initial draw
    applyAgeFilters();

    
});