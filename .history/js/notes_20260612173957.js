// =====================
// NOTES.JS — Page-specific data notes panel
// =====================

const pageNotes = {

    fines: {
        title: "📋 Fines — Data Notes",
        items: [
            {
                type: "warning",
                heading: "No Fines Data for ACT, QLD & WA",
                body: "ACT, QLD and WA do not report fine amounts for roadside enforcement actions. These states appear in arrest and charge counts only, not in fine volume comparisons."
            },
            {
                type: "warning",
                heading: "NSW Arrests Not Reported",
                body: "NSW records zero arrests across all fines offence types. Arrest data for fines enforcement is not reported by NSW and should not be interpreted as no arrests occurring."
            },
            {
                type: "info",
                heading: "Large 'Unknown' Age Group in NSW, QLD & VIC",
                body: "A significant portion of fines — particularly speed and mobile phone offences — are camera-detected and cannot be linked to a registered driver's age. In NSW alone, over 1.4 million speed fines and 350,000 mobile phone fines carry no age data. These are excluded from the age group chart."
            },
            {
                type: "info",
                heading: "Location Breakdown: 4 States Only",
                body: "Location-level data (Major Cities, Inner/Outer Regional, Remote, Very Remote) is only available for NSW, VIC, SA and ACT. NT, QLD, TAS and WA report all fines under 'Unknown' location and are excluded from the location chart."
            },
            {
                type: "trend",
                heading: "NSW Mobile Phone Fines Surged in 2020",
                body: "NSW mobile phone fines jumped from ~25,000 in 2019 to over 151,000 in 2020 — a 6× increase. This coincides with the rollout of fixed camera-based mobile phone detection, which dramatically expanded enforcement coverage."
            },
            {
                type: "trend",
                heading: "Seatbelt & Unlicensed Data Gaps in Early Years",
                body: "Non-wearing seatbelt fines were not reported by most states before 2017. Unlicensed driving fines only appear from 2023 onwards. Comparing these offence types across the full 2008–2024 range will show artificially low early figures."
            }
        ]
    },

    drugs: {
        title: "📋 Drug Tests — Data Notes",
        items: [
            {
                type: "warning",
                heading: "NT: 2023 Positive Tests Only — No Totals",
                body: "In 2023, the Northern Territory only reported the number of positive drug test results (573). The total number of tests conducted was not provided, making it impossible to calculate a detection rate for NT in 2023."
            },
            {
                type: "warning",
                heading: "QLD & TAS: No Drug Type Breakdown",
                body: "Queensland and Tasmania do not report positive tests broken down by drug type (amphetamine, cannabis, etc.). Their totals appear in the historical trend and state comparisons but are excluded from the drug type donut chart."
            },
            {
                type: "warning",
                heading: "QLD & WA: No Fines or Arrests Reported",
                body: "Queensland reports no fines and no arrests for drug-related enforcement. WA similarly reports no fines. The enforcement actions chart for these states reflects charges only and understates the true enforcement picture."
            },
            {
                type: "info",
                heading: "SA Drug Type Figures Appear Aggregated",
                body: "South Australia reports identical counts for Cannabis, Ecstasy and Methylamphetamine in both 2023 and 2024 (e.g. all three show 288 in 2024). This is likely a reporting artefact where SA records a combined positive result rather than per-substance breakdowns."
            },
            {
                type: "trend",
                heading: "NSW Testing Scaled Up Sharply from 2015",
                body: "NSW positive drug tests grew from 542 in 2008 to 9,123 in 2015 as roadside testing expanded, then surged to 40,551 in 2023 — a 75× increase from the baseline. This reflects program growth, not necessarily a proportional rise in drug-driving prevalence."
            },
            {
                type: "trend",
                heading: "VIC Positives Dropped Significantly in 2024",
                body: "Victoria recorded 5,376 positive drug tests in 2024, down from 10,628 in 2022 — a drop of nearly 50%. This may reflect changes in testing volumes, enforcement focus, or reporting methodology rather than a halving of drug-driving incidents."
            },
            {
                type: "trend",
                heading: "COVID-19 Visible in 2020 QLD Data",
                body: "Queensland saw positive drug tests fall from 14,020 in 2018 to 8,871 in 2020, likely reflecting reduced traffic volumes and enforcement activity during COVID-19 restrictions. Numbers recovered to 12,064 by 2024."
            }
        ]
    },

    breath: {
        title: "📋 Breath Tests — Data Notes",
        items: [
            {
                type: "warning",
                heading: "TAS Excluded from 2023–2024 Breakdown Charts",
                body: "Tasmania did not report breath test data for 2023 or 2024. It appears in the historical line chart up to 2022 but is completely absent from the location and age breakdown charts. Comparisons involving recent years should not include TAS."
            },
            {
                type: "warning",
                heading: "VIC: Positive Tests Recorded, No Enforcement Actions",
                body: "Victoria records positive breath test counts but reports zero fines, zero charges and zero arrests for 2023–2024. Enforcement outcome data is not provided by VIC and the figures should not be interpreted as no action being taken."
            },
            {
                type: "warning",
                heading: "ACT: No Fines Issued for Breath Tests",
                body: "The ACT records charges and arrests for positive breath tests but reports no fines. This is consistent across both 2023 and 2024 and reflects how the ACT processes drink-driving offences through the courts rather than on-the-spot fines."
            },
            {
                type: "warning",
                heading: "NSW: No Arrests Reported for Breath Tests",
                body: "NSW records positive test counts, fines and charges but reports zero arrests for breath test enforcement in both 2023 and 2024. Arrest data is not provided by NSW for this offence category."
            },
            {
                type: "info",
                heading: "Location & Age Breakdown: ACT, NSW, NT & VIC Only",
                body: "Only ACT, NSW, NT and VIC provide location and age group breakdowns for breath test data. QLD, SA, TAS and WA do not report this level of detail — their records appear as 'Unknown' location and are excluded from the breakdown charts."
            },
            {
                type: "trend",
                heading: "Long-Term Decline in Positive Tests Nationally",
                body: "Nationally, positive breath tests have fallen steadily — NSW dropped from 27,368 in 2008 to 12,995 in 2024, and QLD from a peak of 33,638 in 2010 to 15,336 in 2024. This suggests improved compliance over the 16-year period, though testing volumes also vary year to year."
            },
            {
                type: "trend",
                heading: "COVID-19 Impact Visible in 2020–2021",
                body: "Most states recorded notable dips in positive breath tests during 2020–2021. Victoria dropped from 9,235 in 2019 to 4,976 in 2020. Tasmania shows no data at all for 2020 and 2021. Reduced road activity during lockdowns directly affected testing and detection numbers."
            }
        ]
    }
};


// ── Build and inject the panel HTML ──
function buildNotesPanel() {
    const panel = document.createElement('div');
    panel.id = 'notes-panel';
    panel.innerHTML = `
        <div id="notes-toggle" onclick="toggleNotes()">
            <span id="notes-toggle-icon">📋</span>
            <span id="notes-toggle-label">Data Notes</span>
        </div>
        <div id="notes-drawer">
            <div id="notes-header">
                <span id="notes-title">Data Notes</span>
                <button id="notes-close" onclick="toggleNotes()">✕</button>
            </div>
            <div id="notes-body"></div>
        </div>
    `;
    document.body.appendChild(panel);
}


// ── Render notes for a given page ──
function renderNotes(pageId) {
    const data   = pageNotes[pageId];
    const body   = document.getElementById('notes-body');
    const title  = document.getElementById('notes-title');
    const panel  = document.getElementById('notes-panel');
    const toggle = document.getElementById('notes-toggle');

    if (!data) {
        // Home page — hide the toggle entirely
        if (panel)  panel.style.display = 'none';
        return;
    }

    if (panel)  panel.style.display = '';
    if (title)  title.textContent = data.title;

    body.innerHTML = data.items.map(item => `
        <div class="note-item note-${item.type}">
            <div class="note-heading">
                <span class="note-icon">${noteIcon(item.type)}</span>
                ${item.heading}
            </div>
            <div class="note-body">${item.body}</div>
        </div>
    `).join('');
}

function noteIcon(type) {
    if (type === 'warning') return '⚠️';
    if (type === 'trend')   return '📈';
    return 'ℹ️';
}


// ── Toggle open/close ──
let notesOpen = false;

function toggleNotes() {
    notesOpen = !notesOpen;
    const drawer = document.getElementById('notes-drawer');
    const panel  = document.getElementById('notes-panel');
    if (notesOpen) {
        drawer.classList.add('open');
        panel.classList.add('active');
    } else {
        drawer.classList.remove('open');
        panel.classList.remove('active');
    }
}


// ── Hook into switchPage ──
const _originalSwitchPage = window.switchPage;
window.switchPage = function(pageId) {
    _originalSwitchPage(pageId);
    renderNotes(pageId);
    // Close the drawer on page switch so it doesn't linger
    if (notesOpen) {
        notesOpen = false;
        document.getElementById('notes-drawer').classList.remove('open');
        document.getElementById('notes-panel').classList.remove('active');
    }
};


// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
    buildNotesPanel();
    // Detect which page is active on load
    const activePage = document.querySelector('.page.active');
    const pageId = activePage ? activePage.id.replace('page-', '') : 'home';
    renderNotes(pageId);
});