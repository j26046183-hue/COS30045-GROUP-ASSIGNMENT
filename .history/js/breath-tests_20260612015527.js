// js/breath-tests.js

// 1. Wait for DOM content to load safely
document.addEventListener("DOMContentLoaded", function () {
    // Simulated or loaded data placeholder - replace with your actual d3.csv / d3.json loader if needed
    // e.g., d3.csv("data/breath_tests.csv").then(function(data) { ... });
    
    // Setup listener for page switching to re-render charts when container becomes active
    // This fixes the "0 width" problem when rendering hidden tabs
    const breathTabLink = document.querySelector('[data-page="breath"]');
    if (breathTabLink) {
        breathTabLink.addEventListener('click', () => {
            // Give the browser a split second to apply CSS display block before drawing
            setTimeout(() => {
                renderBreathCharts();
            }, 100);
        });
    }

    // Initial render attempt
    renderBreathCharts();
});

function renderBreathCharts() {
    // Clean up any previous SVG elements to avoid stacking graphs over each other on tab switch
    d3.select("#breath-historical-chart").selectAll("*").remove();
    d3.select("#breath-donut-chart").selectAll("*").remove();
    d3.select("#breath-bar-chart").selectAll("*").remove();

    // ==========================================
    // CHART 1: HISTORICAL BREATH TEST TREND
    // ==========================================
    const histContainer = d3.select("#breath-historical-chart").node();
    // Dynamically look up dimensions from HTML/CSS, use robust fallbacks if 0
    const histWidth = histContainer ? histContainer.getBoundingClientRect().width : 800;
    const histHeight = 380; 

    // Increase margins so axis labels like "Positive Breath Tests" and years don't overlap
    const margin = { top: 40, right: 120, bottom: 60, left: 60 };
    const width = histWidth - margin.left - margin.right;
    const height = histHeight - margin.top - margin.bottom;

    const svgHist = d3.select("#breath-historical-chart")
        .append("svg")
        .attr("width", histWidth)
        .attr("height", histHeight)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // --- Mock Data for Structure Realism (Replace with your actual state data arrays) ---
    const years = Array.from({length: 17}, (_, i) => 2008 + i);
    const mockStates = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
    const lineData = [];
    
    mockStates.forEach(state => {
        years.forEach(year => {
            lineData.push({
                year: year,
                state: state,
                value: Math.floor(Math.random() * 20000) + 5000
            });
        });
    });

    // Scales
    const xScale = d3.scaleLinear()
        .domain(d3.extent(lineData, d => d.year))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(lineData, d => d.value) * 1.1])
        .range([height, 0]);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Axes Layout Fixes
    const xAxis = d3.axisBottom(xScale).tickFormat(d3.format("d")).ticks(years.length / 2);
    const yAxis = d3.axisLeft(yScale).tickFormat(d3.format(".1s")); // clean formats like 10k, 20k

    // Render X Axis with rotated/spaced labels to stop overlapping text
    svgHist.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis)
        .selectAll("text")
        .attr("transform", "translate(-10,10)rotate(-25)")
        .style("text-anchor", "end")
        .style("font-family", "'DM Sans', sans-serif");

    // Render Y Axis
    svgHist.append("g")
        .call(yAxis)
        .style("font-family", "'DM Sans', sans-serif");

    // Grouping and Line Generation
    const dataByState = d3.group(lineData, d => d.state);
    const lineGenerator = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX);

    dataByState.forEach((stateData, stateName) => {
        svgHist.append("path")
            .datum(stateData)
            .attr("fill", "none")
            .attr("stroke", colorScale(stateName))
            .attr("stroke-width", 2.5)
            .attr("d", lineGenerator);

        // Append line-end text descriptors safely within the right margin 
        const lastPoint = stateData[stateData.length - 1];
        svgHist.append("text")
            .attr("x", xScale(lastPoint.year) + 5)
            .attr("y", yScale(lastPoint.value) + 4)
            .text(stateName)
            .style("fill", colorScale(stateName))
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .style("font-family", "'DM Sans', sans-serif");
    });


    // ==========================================
    // CHART 2: ENFORCEMENT OUTCOME RATIOS (DONUT)
    // ==========================================
    const donutContainer = d3.select("#breath-donut-chart").node();
    const donutWidth = donutContainer ? donutContainer.getBoundingClientRect().width : 400;
    const donutHeight = 320;
    const radius = Math.min(donutWidth, donutHeight) / 2 - 30;

    const svgDonut = d3.select("#breath-donut-chart")
        .append("svg")
        .attr("width", donutWidth)
        .attr("height", donutHeight)
        .append("g")
        .attr("transform", `translate(${donutWidth / 2}, ${donutHeight / 2})`);

    const donutData = [
        { label: "Charges", value: 25400 },
        { label: "Arrests", value: 12851 },
        { label: "Fines / Warnings", value: 3100 }
    ];

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);
    const donutColors = d3.scaleOrdinal(["#0088cc", "#ff9900", "#cc0000"]);

    const arcs = svgDonut.selectAll(".arc")
        .data(pie(donutData))
        .enter()
        .append("g")
        .attr("class", "arc");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => donutColors(d.data.label));

    // Total Count Center Text
    svgDonut.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-5px")
        .text("41,351")
        .style("font-size", "22px")
        .style("font-weight", "bold")
        .style("font-family", "'Syne', sans-serif");

    svgDonut.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "15px")
        .text("TOTAL TESTS")
        .style("font-size", "10px")
        .style("fill", "#64748b")
        .style("font-family", "'DM Sans', sans-serif");


    // ==========================================
    // CHART 3: AGE PROFILE DISTRIBUTION (BAR)
    // ==========================================
    const barContainer = d3.select("#breath-bar-chart").node();
    const barWidth = barContainer ? barContainer.getBoundingClientRect().width : 400;
    const barHeight = 320;

    const barMargin = { top: 20, right: 20, bottom: 40, left: 50 };
    const bWidth = barWidth - barMargin.left - barMargin.right;
    const bHeight = barHeight - barMargin.top - barMargin.bottom;

    const svgBar = d3.select("#breath-bar-chart")
        .append("svg")
        .attr("width", barWidth)
        .attr("height", barHeight)
        .append("g")
        .attr("transform", `translate(${barMargin.left}, ${barMargin.top})`);

    const ageData = [
        { group: "Under 17", count: 1200 },
        { group: "17–25", count: 15132 },
        { group: "26–39", count: 26363 },
        { group: "40–64", count: 24633 },
        { group: "65+", count: 4210 }
    ];

    const xBarScale = d3.scaleBand()
        .domain(ageData.map(d => d.group))
        .range([0, bWidth])
        .padding(0.3);

    const yBarScale = d3.scaleLinear()
        .domain([0, d3.max(ageData, d => d.count) * 1.1])
        .range([bHeight, 0]);

    // Draw bars
    svgBar.selectAll(".bar")
        .data(ageData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => xBarScale(d.group))
        .attr("y", d => yBarScale(d.count))
        .attr("width", xBarScale.bandwidth())
        .attr("height", d => bHeight - yBarScale(d.count))
        .attr("fill", "#2563eb")
        .attr("rx", 4); // Soft rounded tops

    // Value Labels on top of bars
    svgBar.selectAll(".val-label")
        .data(ageData)
        .enter()
        .append("text")
        .attr("x", d => xBarScale(d.group) + xBarScale.bandwidth() / 2)
        .attr("y", d => yBarScale(d.count) - 6)
        .attr("text-anchor", "middle")
        .text(d => d3.format(",")(d.count))
        .style("font-size", "11px")
        .style("fill", "#475569")
        .style("font-family", "'DM Sans', sans-serif");

    // Axes
    svgBar.append("g")
        .attr("transform", `translate(0, ${bHeight})`)
        .call(d3.axisBottom(xBarScale))
        .style("font-family", "'DM Sans', sans-serif");

    svgBar.append("g")
        .call(d3.axisLeft(yBarScale).ticks(5).tickFormat(d3.format(".1s")))
        .style("font-family", "'DM Sans', sans-serif");
}