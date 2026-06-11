// js/breath-tests.js

document.addEventListener("DOMContentLoaded", function () {
    // 1. Setup a global tab event listener to capture when the user switches to this tab.
    // This solves the problem of D3 loading 0-width charts inside hidden containers.
    const navLinks = document.querySelectorAll('.nav-links a, .nav-card');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            // Check if the clicked element or its target is navigating to the breath test page
            const targetPage = this.getAttribute('data-page') || 
                               (this.getAttribute('onclick') && this.getAttribute('onclick').includes('breath') ? 'breath' : '');
            
            if (targetPage === 'breath' || this.id === 'page-breath') {
                // Allow CSS time to apply display: block or switch classes before drawing
                setTimeout(() => {
                    initBreathDashboard();
                }, 150);
            }
        });
    });

    // 2. Initial execution in case the page defaults or refreshes directly on this tab
    if (document.getElementById('page-breath').classList.contains('active')) {
        initBreathDashboard();
    }
});

function initBreathDashboard() {
    // Always clear out old SVGs first to prevent multiple charts from generating on top of each other
    d3.select("#breath-historical-chart").selectAll("*").remove();
    d3.select("#breath-donut-chart").selectAll("*").remove();
    d3.select("#breath-bar-chart").selectAll("*").remove();

    // ==========================================
    // DATA DECLARATION (2008 - 2024 Framework)
    // ==========================================
    
    // Generate simulated timeline array mimicking BITRE's structures across states
    const statesList = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];
    const baseTimelineData = [];
    
    // Seed continuous dataset with baseline structures matching your layout profile
    statesList.forEach((state, stateIndex) => {
        let baseVal = [1500, 22000, 1000, 28000, 8000, 5000, 14000, 11000][stateIndex];
        for (let year = 2008; year <= 2024; year++) {
            // Apply slight random variance year-over-year to model real trend behaviors
            let variance = (Math.sin(year) * 0.15) + (Math.cos(stateIndex) * 0.1);
            baseVal = Math.max(200, baseVal * (1 + variance * 0.08));
            
            // Replicate specific drops/peaks seen in your target visualization
            let finalVal = baseVal;
            if (year > 2019 && state === "VIC") finalVal = baseVal * 0.65; // COVID enforcement drop
            if (year > 2021 && state === "QLD") finalVal = baseVal * 1.2;
            
            baseTimelineData.push({
                year: year,
                state: state,
                positiveTests: Math.round(finalVal)
            });
        }
    });

    // Aggregate stat metrics for cards
    document.getElementById("breath-total").innerText = "116,984";
    document.getElementById("breath-charges").innerText = "25,400";
    document.getElementById("breath-arrests").innerText = "12,851";
    document.getElementById("breath-top-state").innerText = "VIC";

    // Initialize all 3 graphic elements
    drawHistoricalTimeline(baseTimelineData);
    drawOutcomeDonut();
    drawAgeProfileDistribution();
}

// ==========================================
// 1. HISTORICAL LINE CHART
// ==========================================
function drawHistoricalTimeline(data) {
    const container = d3.select("#breath-historical-chart").node();
    const containerWidth = container ? container.getBoundingClientRect().width : 900;
    const containerHeight = 380;

    // Generous margins prevent text and years from crashing into borders
    const margin = { top: 30, right: 80, bottom: 50, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = d3.select("#breath-historical-chart")
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Scale mappings
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.year))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.positiveTests) * 1.1])
        .range([height, 0]);

    // Color definitions mapping to your interface's legend rules
    const colorMap = {
        "ACT": "#2563eb", "NSW": "#16a34a", "NT": "#ea580c", "QLD": "#dc2626",
        "SA": "#9333ea", "TAS": "#0d9488", "VIC": "#db2777", "WA": "#eab308"
    };

    // Axes Layout Definitions
    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d3.format("d"))
        .ticks(17); // Ensures every year from 2008 to 2024 matches an index tick

    const yAxis = d3.axisLeft(yScale)
        .tickFormat(d3.format(".1s")); // Converts 30000 into clean "30k" labels

    // Render X Axis with rotated text elements to solve the side-by-side clustering problem
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(xAxis)
        .selectAll("text")
        .attr("transform", "translate(-10, 6) rotate(-35)")
        .style("text-anchor", "end")
        .style("font-family", "'DM Sans', sans-serif")
        .style("font-size", "11px")
        .style("fill", "#64748b");

    // Render Y Axis
    svg.append("g")
        .call(yAxis)
        .selectAll("text")
        .style("font-family", "'DM Sans', sans-serif")
        .style("font-size", "11px")
        .style("fill", "#64748b");

    // Grid lines for clear tracking
    svg.append("g")
        .attr("class", "grid")
        .attr("opacity", 0.1)
        .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(""));

    // Group elements by state sequence
    const dataGrouped = d3.group(data, d => d.state);

    const linePathGenerator = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.positiveTests))
        .curve(d3.curveMonotoneX); // Clean smooth curves connecting nodes

    // Render Paths
    dataGrouped.forEach((stateData, stateName) => {
        svg.append("path")
            .datum(stateData)
            .attr("fill", "none")
            .attr("stroke", colorMap[stateName] || "#cbd5e1")
            .attr("stroke-width", 2.5)
            .attr("d", linePathGenerator);

        // Append line-end descriptors directly past the final timeline coordinate (2024)
        const lastRecord = stateData.find(d => d.year === 2024);
        if (lastRecord) {
            svg.append("text")
                .attr("x", xScale(lastRecord.year) + 6)
                .attr("y", yScale(lastRecord.positiveTests) + 4)
                .text(stateName)
                .style("fill", colorMap[stateName])
                .style("font-size", "11px")
                .style("font-weight", "600")
                .style("font-family", "'DM Sans', sans-serif");
        }
    });
}

// ==========================================
// 2. ENFORCEMENT OUTCOME RATIOS (DONUT CHART)
// ==========================================
function drawOutcomeDonut() {
    const container = d3.select("#breath-donut-chart").node();
    const containerWidth = container ? container.getBoundingClientRect().width : 400;
    const containerHeight = 320;
    const radius = Math.min(containerWidth, containerHeight) / 2 - 25;

    const svg = d3.select("#breath-donut-chart")
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${containerWidth / 2}, ${containerHeight / 2})`);

    // Dataset structure mapped from your screen indicator counters
    const donutData = [
        { status: "Charges Filed", count: 25400, color: "#1d4ed8" },
        { status: "Arrests Made", count: 12851, color: "#eab308" },
        { status: "Fines Issued", count: 3100, color: "#dc2626" }
    ];

    const pieLayout = d3.pie()
        .value(d => d.count)
        .sort(null);

    const arcSelection = d3.arc()
        .innerRadius(radius * 0.6) // Creates the cutout inner ring hole
        .outerRadius(radius);

    const segments = svg.selectAll(".arc")
        .data(pieLayout(donutData))
        .enter()
        .append("g")
        .attr("class", "arc");

    segments.append("path")
        .attr("d", arcSelection)
        .attr("fill", d => d.data.color)
        .attr("stroke", "#ffffff")
        .style("stroke-width", "2px");

    // Center Display Total Summary Figures
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-4px")
        .text("41,351")
        .style("font-size", "24px")
        .style("font-weight", "800")
        .style("font-family", "'Syne', sans-serif")
        .style("fill", "#0f172a");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "16px")
        .text("TOTAL TESTS")
        .style("font-size", "10px")
        .style("font-weight", "700")
        .style("letter-spacing", "1px")
        .style("fill", "#64748b")
        .style("font-family", "'DM Sans', sans-serif");
}

// ==========================================
// 3. AGE PROFILE DISTRIBUTION (BAR CHART)
// ==========================================
function drawAgeProfileDistribution() {
    const container = d3.select("#breath-bar-chart").node();
    const containerWidth = container ? container.getBoundingClientRect().width : 400;
    const containerHeight = 320;

    const margin = { top: 30, right: 20, bottom: 40, left: 50 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = d3.select("#breath-bar-chart")
        .append("svg")
        .attr("width", containerWidth)
        .attr("height", containerHeight)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const ageDistributionData = [
        { classification: "Under 17", tally: 1200 },
        { classification: "17–25", tally: 15132 },
        { classification: "26–39", tally: 26363 },
        { classification: "40–64", tally: 24633 },
        { classification: "65+", tally: 4210 }
    ];

    // Scale assignments
    const xBandScale = d3.scaleBand()
        .domain(ageDistributionData.map(d => d.classification))
        .range([0, width])
        .padding(0.35); // Balances column structural gaps nicely

    const yLinearScale = d3.scaleLinear()
        .domain([0, d3.max(ageDistributionData, d => d.tally) * 1.15])
        .range([height, 0]);

    // Draw active chart column bars
    svg.selectAll(".enforcement-bar")
        .data(ageDistributionData)
        .enter()
        .append("rect")
        .attr("class", "enforcement-bar")
        .attr("x", d => xBandScale(d.classification))
        .attr("y", d => yLinearScale(d.tally))
        .attr("width", xBandScale.bandwidth())
        .attr("height", d => height - yLinearScale(d.tally))
        .attr("fill", "#2563eb")
        .attr("rx", 5); // Smooth rounded tops for a modern aesthetic

    // Add value labels on top of each bar element
    svg.selectAll(".bar-value-label")
        .data(ageDistributionData)
        .enter()
        .append("text")
        .attr("class", "bar-value-label")
        .attr("x", d => xBandScale(d.classification) + xBandScale.bandwidth() / 2)
        .attr("y", d => yLinearScale(d.tally) - 8)
        .attr("text-anchor", "middle")
        .text(d => d3.format(",")(d.tally))
        .style("font-family", "'DM Sans', sans-serif")
        .style("font-size", "11px")
        .style("font-weight", "500")
        .style("fill", "#334155");

    // X Axis layout attachment
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xBandScale).tickSize(0).tickPadding(8))
        .style("font-family", "'DM Sans', sans-serif")
        .style("font-size", "11px")
        .style("color", "#64748b");

    // Y Axis layout attachment
    svg.append("g")
        .call(d3.axisLeft(yLinearScale).ticks(5).tickFormat(d3.format(".1s")))
        .style("font-family", "'DM Sans', sans-serif")
        .style("font-size", "11px")
        .style("color", "#64748b");
}