export const recipeCardTemplate = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>{{title}}</title>

  <style>
    /* =========
       PAGE SETUP
       ========= */
    @page {
      size: A4;
      margin: 12mm;
    }

    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
      background: #fff;
      color: #111;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Make everything fit cleanly on 1 page */
    .page {
      width: 100%;
      height: calc(297mm - 24mm); /* A4 height minus @page margins (12mm top+bottom) */
      display: flex;
      flex-direction: column;
      gap: 6mm;
    }

    /* Prevent awkward splitting */
    .no-break {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* =========
       TYPOGRAPHY
       ========= */
    .title {
      font-size: 20pt;
      font-weight: 700;
      line-height: 1.1;
      margin: 0;
      color: #d32f2f; /* Gousto-ish red */
    }

    .meta {
      font-size: 9.5pt;
      color: #666;
      margin: 1mm 0 0 0;
    }

    .section-heading {
      font-size: 12pt;
      font-weight: 700;
      color: #d32f2f;
      margin: 0;
    }

    .small {
      font-size: 9pt;
      line-height: 1.25;
      margin: 0;
    }

    /* =========
       LAYOUT
       ========= */
    .header {
      display: flex;
      flex-direction: column;
      gap: 1mm;
    }

    /* Top half: Image + Ingredients */
    .top {
      display: grid;
      grid-template-columns: 95mm 1fr;
      gap: 6mm;
      align-items: stretch;
    }

    .box {
      border: 0.5mm solid #111;
      border-radius: 2mm;
      overflow: hidden;
      background: #fff;
    }

    .box-header {
      background: #f2f2f2;
      padding: 3mm 4mm;
      border-bottom: 0.35mm solid #111;
    }

    .box-body {
      padding: 4mm;
    }

    /* Image box is a fixed square-ish area */
    .image-box {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 80mm;           /* fixed to keep single-page layout stable */
      width: 95mm;
      padding: 0;
    }

    .image-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .placeholder {
      width: 100%;
      height: 100%;
      background: #f2f2f2;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10pt;
      color: #555;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    /* Ingredients formatting */
    .ingredients-list {
      font-size: 9pt;
      line-height: 1.25;
    }

    .ingredients-list ul {
      margin: 0;
      padding-left: 4mm;
    }

    .ingredients-list li {
      margin: 0 0 1.2mm 0;
    }

    .ingredients-section-title {
      font-weight: 700;
      margin: 0 0 2mm 0;
    }

    /* Steps section */
    .steps-wrap {
      display: flex;
      flex-direction: column;
      gap: 3mm;
      flex: 1; /* take remaining page space */
    }

    /* 2 columns × 4 rows fixed grid */
    .steps-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: repeat(4, 1fr);
      gap: 0;
      border: 0.5mm solid #111;
      border-radius: 2mm;
      overflow: hidden;
      flex: 1;
      min-height: 128mm; /* tuned to fit with top section + header */
    }

    .step-cell {
      border-right: 0.35mm solid #111;
      border-bottom: 0.35mm solid #111;
      padding: 4mm;
      font-size: 9pt;
      line-height: 1.25;
      display: flex;
      gap: 3mm;
      align-items: flex-start;
      background: #fff;
    }

    /* remove right border on right column */
    .step-cell:nth-child(2n) {
      border-right: none;
    }

    /* remove bottom border on last row */
    .step-cell:nth-last-child(-n + 2) {
      border-bottom: none;
    }

    .step-num {
      width: 7mm;
      height: 7mm;
      min-width: 7mm;
      border-radius: 2mm;
      background: #f2f2f2;
      border: 0.35mm solid #111;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 9pt;
      line-height: 1;
    }

    .step-text {
      margin: 0;
      flex: 1;
    }

    /* Optional footer */
    .footer {
      font-size: 8.5pt;
      color: #777;
      display: flex;
      justify-content: space-between;
      margin-top: 1mm;
    }

    /* Print refinements */
    @media print {
      a { color: inherit; text-decoration: none; }
      .page { gap: 6mm; }
    }
  </style>
</head>

<body>
  <div class="page">

    <!-- HEADER -->
    <div class="header no-break">
      <h1 class="title">{{title}}</h1>
      <p class="meta">{{meta}}</p>
    </div>

    <!-- TOP HALF: IMAGE + INGREDIENTS -->
    <div class="top no-break">

      <!-- Image (or placeholder fallback) -->
      <div class="box image-box">
        {{image_block}}
      </div>

      <!-- Ingredients -->
      <div class="box">
        <div class="box-header">
          <p class="section-heading">Ingredients</p>
        </div>
        <div class="box-body ingredients-list">
          {{ingredients_html}}
        </div>
      </div>

    </div>

    <!-- BOTTOM HALF: STEPS -->
    <div class="steps-wrap no-break">
      <p class="section-heading">Steps</p>

      <div class="steps-grid">
        <!-- Up to 8 steps. Empty cells allowed. -->
        <div class="step-cell">
          <div class="step-num">1</div>
          <p class="step-text">{{step_1}}</p>
        </div>
        <div class="step-cell">
          <div class="step-num">2</div>
          <p class="step-text">{{step_2}}</p>
        </div>
        <div class="step-cell">
          <div class="step-num">3</div>
          <p class="step-text">{{step_3}}</p>
        </div>
        <div class="step-cell">
          <div class="step-num">4</div>
          <p class="step-text">{{step_4}}</p>
        </div>
        <div class="step-cell">
          <div class="step-num">5</div>
          <p class="step-text">{{step_5}}</p>
        </div>
        <div class="step-cell">
          <div class="step-num">6</div>
          <p class="step-text">{{step_6}}</p>
        </div>
        <div class="step-cell">
          <div class="step-num">7</div>
          <p class="step-text">{{step_7}}</p>
        </div>
        <div class="step-cell">
          <div class="step-num">8</div>
          <p class="step-text">{{step_8}}</p>
        </div>
      </div>

      <div class="footer">
        <span>{{footer_left}}</span>
        <span>{{footer_right}}</span>
      </div>
    </div>

  </div>
</body>
</html>`;
