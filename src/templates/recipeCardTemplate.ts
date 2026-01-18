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
      margin: 10mm;
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
      max-height: calc(297mm - 20mm); /* A4 height minus @page margins */
      display: flex;
      flex-direction: column;
      gap: 4mm;
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
      font-size: 18pt;
      font-weight: 700;
      line-height: 1.1;
      margin: 0;
      color: #d32f2f;
    }

    .meta {
      font-size: 9pt;
      color: #666;
      margin: 1mm 0 0 0;
    }

    .section-heading {
      font-size: 11pt;
      font-weight: 700;
      color: #d32f2f;
      margin: 0 0 2mm 0;
    }

    /* =========
       LAYOUT
       ========= */
    .header {
      display: flex;
      flex-direction: column;
      gap: 1mm;
    }

    /* Top section: Image + Ingredients side by side */
    .top {
      display: grid;
      grid-template-columns: 70mm 1fr;
      gap: 5mm;
      align-items: start;
    }

    .box {
      border: 0.5mm solid #111;
      border-radius: 2mm;
      overflow: hidden;
      background: #fff;
    }

    .box-header {
      background: #f2f2f2;
      padding: 2.5mm 4mm;
      border-bottom: 0.35mm solid #111;
    }

    .box-body {
      padding: 3mm 4mm;
    }

    /* Smaller image box */
    .image-box {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 55mm;
      width: 70mm;
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
      font-size: 9pt;
      color: #555;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    /* Ingredients formatting */
    .ingredients-list {
      font-size: 8.5pt;
      line-height: 1.2;
    }

    .ingredients-list ul {
      margin: 0;
      padding-left: 4mm;
    }

    .ingredients-list li {
      margin: 0 0 1mm 0;
    }

    /* Steps section - dynamic list */
    .steps-wrap {
      flex: 1;
    }

    .steps-list {
      display: flex;
      flex-direction: column;
      gap: 2mm;
    }

    .step-row {
      display: flex;
      gap: 3mm;
      align-items: flex-start;
      padding: 2.5mm 3mm;
      border: 0.35mm solid #ddd;
      border-radius: 2mm;
      background: #fafafa;
    }

    .step-num {
      width: 5.5mm;
      height: 5.5mm;
      min-width: 5.5mm;
      border-radius: 50%;
      background: #d32f2f;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 8pt;
      line-height: 1;
    }

    .step-text {
      margin: 0;
      flex: 1;
      font-size: 8.5pt;
      line-height: 1.3;
    }

    .no-steps {
      font-size: 9pt;
      color: #666;
      font-style: italic;
    }

    /* Footer */
    .footer {
      font-size: 8pt;
      color: #777;
      display: flex;
      justify-content: space-between;
      margin-top: 2mm;
      padding-top: 2mm;
      border-top: 0.35mm solid #eee;
    }

    .footer a {
      color: #d32f2f;
      text-decoration: none;
    }

    /* Print refinements */
    @media print {
      a { color: inherit; text-decoration: none; }
      .footer a { color: #d32f2f; }
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

    <!-- TOP: IMAGE + INGREDIENTS -->
    <div class="top no-break">
      <!-- Image (or placeholder fallback) -->
      <div class="box image-box">
        {{image_block}}
      </div>

      <!-- Ingredients -->
      <div class="box">
        <div class="box-header">
          <p class="section-heading" style="margin:0;">Ingredients</p>
        </div>
        <div class="box-body ingredients-list">
          {{ingredients_html}}
        </div>
      </div>
    </div>

    <!-- STEPS - Dynamic list -->
    <div class="steps-wrap no-break">
      <p class="section-heading">Method</p>
      <div class="steps-list">
        {{steps_html}}
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <span>{{footer_left}}</span>
      <span>{{footer_right}}</span>
    </div>

  </div>
</body>
</html>`;
