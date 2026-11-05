/**
 * Vinted UK: create a clothing draft on https://www.vinted.co.uk/items/new
 *
 * Usage (from your app, after the page has loaded and the user is logged in):
 *
 *   window.__VINTED_ITEM__ = { ...item };   // see the example at the bottom
 *   // then inject and run this file. It auto-runs if __VINTED_ITEM__ is set.
 *
 * Or call it directly:  const report = await window.vintedCreateDraft(item, { saveDraft: false });
 *
 * Native / in-app browser hosts: pass item.itemId (any string) and listen for the events described at
 * notifyHost() below. Script injection cannot return values, so results are pushed out as events.
 *
 * Selector strategy (all verified on the live page, November 2026):
 *   - Real Vinted IDs wherever they exist: catalogue IDs, brand IDs, size IDs,
 *     condition IDs, colour IDs, material IDs, package IDs.
 *   - Stable ids / names / data-testid values only. No CSS classes anywhere.
 *   - Every step is "act, then read the value back", and a final verify loop
 *     re-applies anything Vinted's photo suggestions overwrote late.
 */
(() => {
  'use strict';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---------- diagnostics ----------
  // A compact picture of the page, attached to failure reports so a failed run can be understood
  // without being there: which form fields exist, whether a dialog is stuck open, alert text, size of screen.
  function pageSnapshot() {
    try {
      const has = (id) => !!document.getElementById(id);
      return {
        path: location.pathname.replace(/\d{6,}/, '<id>'),
        viewportWidth: window.innerWidth,
        photoThumbnails: document.querySelectorAll('[data-testid^="media-select-photo-"]:not([data-testid$="--img"])').length,
        fields: { title: has('title'), description: has('description'), category: has('category'), brand: has('brand'), size: has('size'), condition: has('condition'), colour: has('color'), material: has('material'), price: has('price') },
        values: { category: (document.getElementById('category') || {}).value || '', brand: (document.getElementById('brand') || {}).value || '', size: (document.getElementById('size') || {}).value || '' },
        dialogOpen: !!document.querySelector('[data-testid="input-dropdown-save-button"]'),
        alerts: [...document.querySelectorAll('[role="alert"]')].map((e) => (e.innerText || '').trim().slice(0, 120)).filter(Boolean).slice(0, 3),
      };
    } catch (e) { return { snapshotError: String(e && e.message) }; }
  }

  // ---------- host notification (native app / in-app browser) ----------
  // A native host cannot read return values from an injected script, so the script PUSHES events out.
  // It tries, in order: window.mobileApp.postMessage({ detail }) (Capgo Capacitor in-app browser),
  // window.AndroidBridge.postMessage(jsonString) (a plain Android addJavascriptInterface), and a
  // window event 'vinted-draft-event'. Every call is wrapped so it can never break the main flow.
  // Event types: vinted:started, vinted:progress (step, done, total), vinted:report (form filled and verified), vinted:saveResult
  // (sent the instant the save request finishes, before Vinted redirects), vinted:fatal.
  function notifyHost(type, data) {
    try {
      const detail = { type, itemId: window.__VINTED_CURRENT_ID__ || null, at: Date.now(), ...(data || {}) };
      if (window.mobileApp && typeof window.mobileApp.postMessage === 'function') window.mobileApp.postMessage({ detail });
      if (window.AndroidBridge && typeof window.AndroidBridge.postMessage === 'function') window.AndroidBridge.postMessage(JSON.stringify(detail));
      window.dispatchEvent(new CustomEvent('vinted-draft-event', { detail }));
    } catch (e) { /* never let host messaging break the run */ }
  }

  // ---------- generic helpers ----------

  async function waitFor(fn, { timeout = 10000, interval = 100, label = 'condition' } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      let v;
      try { v = fn(); } catch (e) { v = null; }
      if (v) return v;
      await sleep(interval);
    }
    throw new Error(`Timed out waiting for ${label}`);
  }

  // React ignores plain `el.value = x`. Use the native setter, then fire events.
  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Escape on document closes multi-select panels and keeps the selection.
  async function pressEscape() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    await sleep(500);
  }

  // ---------- layout-agnostic panel handling ----------
  // Desktop: a panel has a [data-testid="<field>-content"] container, closes with Escape, and single
  // selects close themselves. Mobile (narrow viewport, for example an Android WebView): panels are
  // full-screen dialogs with NO such container, Escape does nothing, and a choice only applies once the
  // dialog's Save button is pressed. Everything below handles both layouts.
  const SAVE_SEL = '[data-testid="input-dropdown-save-button"]';
  const saveBtn = () => $(SAVE_SEL);

  async function dismissPanels() {
    await pressEscape();
    for (let i = 0; i < 3 && saveBtn(); i++) {
      const dlg = saveBtn().closest('[role="dialog"]');
      const closeBtn = dlg && dlg.querySelector('[data-testid$="-close-button"]');
      if (closeBtn) closeBtn.click(); else await pressEscape();
      await sleep(500);
    }
  }

  // Call right after clicking an option. Mobile: press Save (or just close if nothing changed).
  // Desktop: single selects close themselves; multi-selects are closed with Escape.
  async function finishSelection(panelTestId, multi) {
    await sleep(300);
    if (saveBtn()) {
      await waitFor(() => { const b = saveBtn(); return !b || !b.disabled; }, { timeout: 3000, label: 'save button' }).catch(() => {});
      const b = saveBtn();
      if (b && !b.disabled) {
        b.click();
        await waitFor(() => !saveBtn(), { timeout: 5000, label: 'panel to close after Save' });
      } else {
        await dismissPanels();
      }
      await sleep(400);
      return;
    }
    if (multi) { await pressEscape(); return; }
    await waitFor(() => !$(`[data-testid="${panelTestId}"]`), { timeout: 4000, label: `${panelTestId} to close` });
    await sleep(400);
  }

  const isChecked = (el) => el && el.getAttribute('aria-checked') === 'true';
  const valueOf = (sel) => ($(sel) ? $(sel).value : '');

  // ---------- images ----------

  // Accepts a File/Blob, or { name, type, base64 } / { name, dataUrl } / { name, url }.
  async function toFile(img, index) {
    if (img instanceof File) return img;
    if (img instanceof Blob) return new File([img], `photo_${index + 1}.jpg`, { type: img.type || 'image/jpeg' });
    const name = img.name || `photo_${index + 1}.jpg`;
    if (img.base64 || img.dataUrl) {
      const type = img.type || (img.dataUrl && img.dataUrl.slice(5, img.dataUrl.indexOf(';'))) || 'image/jpeg';
      const raw = img.base64 || img.dataUrl.split(',')[1];
      const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      return new File([bytes], name, { type });
    }
    if (img.url) {
      const blob = await (await fetch(img.url)).blob(); // needs CORS access or a same-origin/data URL
      return new File([blob], name, { type: blob.type || 'image/jpeg' });
    }
    throw new Error(`Unsupported image format at index ${index}`);
  }

  async function uploadImages(images) {
    if (!images || !images.length) {
      // Photos already on the page (for example an existing draft's edit page): just wait for the fields.
      await waitFor(() => $('#brand') && $('#condition') && $('#color'), { timeout: 20000, label: 'fields (no new photos supplied)' });
      await sleep(500);
      return { fieldsRevealed: true };
    }
    const files = [];
    for (let i = 0; i < images.length; i++) files.push(await toFile(images[i], i));

    const input = await waitFor(() => $('input[type="file"][name="photos"]') || $('[data-testid="add-photos-input"]'), { label: 'photo input' });
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for every thumbnail, then for the extra fields to be revealed.
    await waitFor(() => $(`[data-testid="media-select-photo-${files.length - 1}"]`), { timeout: 60000, label: 'photo thumbnails' });
    // The brand, condition, colour and other fields normally appear a few seconds after the photos land.
    // If they are slow (seen on a real phone), do NOT fail: carry on to the category step, because
    // choosing a category also reveals them. The 'fields' step in the plan then waits for them.
    let fieldsRevealed = true;
    try {
      await waitFor(() => $('#brand') && $('#condition') && $('#color'), { timeout: 20000, label: 'fields revealed after upload' });
    } catch (e) { fieldsRevealed = false; }

    if (fieldsRevealed) {
      // Vinted fills suggestions from the photo a few seconds later (category, brand,
      // material, colour). Wait for the first one to land, then carry on. The final
      // verify loop catches anything that arrives even later.
      try {
        await waitFor(() => valueOf('#category'), { timeout: 8000, label: 'photo suggestion' });
      } catch (e) { /* no suggestion arrived, that is fine */ }
      await sleep(1500);
    }
    return { fieldsRevealed };
  }

  // ---------- field fillers ----------

  async function setText(selector, value) {
    const el = await waitFor(() => $(selector), { label: selector });
    setNativeValue(el, String(value));
    await sleep(300);
  }

  // Category: walk the catalogue path by real IDs, then pick the leaf radio.
  // path = [1193, 1195, 1246], leaf = 1550  (Kids > Girls clothing > Jumpers & hoodies > Hoodies & sweatshirts)
  // Returns the leaf's visible label, which is what the #category field shows once it is set.
  async function selectCategoryLeaf(path, leaf, viaSibling) {
    await dismissPanels();
    const input = await waitFor(() => $('#category'), { label: '#category' });
    input.click();
    const leafRadio = () => document.getElementById(`${leaf}-catalog-radio`);
    await waitFor(() => document.getElementById(`catalog-${path[0]}`) || leafRadio(), { timeout: 6000, label: 'category panel' });
    for (const id of path) {
      if (leafRadio()) break; // the panel reopened at the right level already
      const row = await waitFor(() => document.getElementById(`catalog-${id}`), { timeout: 6000, label: `catalogue row ${id}` });
      row.click();
      await sleep(600);
    }
    const wanted = await waitFor(leafRadio, { timeout: 6000, label: `category leaf ${leaf}` });
    const labelBox = wanted.closest('li') || wanted.parentElement.parentElement;
    const label = ((labelBox && labelBox.innerText) || '').trim().split('\n')[0];
    let target = wanted;
    if (viaSibling) {
      target = $$('input[id$="-catalog-radio"]').find((r) => r.id !== wanted.id);
      if (!target) throw new Error('no sibling category available to reset the category dialog');
    }
    target.click();
    await finishSelection('catalog-select-dropdown-content', false); // mobile: presses Save
    await sleep(500);
    return label;
  }

  // The mobile category dialog can keep stale "already selected" state after repeated selections in one
  // page session (for example when the script must redo the category after Vinted's photo suggestion
  // overwrote it). Pressing Save then changes nothing and the field stays wrong. Selecting a different
  // sibling first resets the dialog, after which the wanted leaf saves normally (verified live).
  async function setCategory(path, leaf) {
    const label = await selectCategoryLeaf(path, leaf, false);
    const matches = () => valueOf('#category').trim() === label;
    const settled = async () => { try { await waitFor(matches, { timeout: 2500, label: 'category value' }); return true; } catch (e) { return false; } };
    if (!(await settled())) {
      await selectCategoryLeaf(path, leaf, true);   // pick a sibling to reset the dialog
      await selectCategoryLeaf(path, leaf, false);  // then pick the wanted leaf again
      if (!(await settled())) throw new Error(`category could not be set to "${label}" (field shows "${valueOf('#category')}")`);
    }
    await waitFor(() => !$('input[id$="-catalog-radio"]'), { timeout: 4000, label: 'category dialog to close' });
    await sleep(1200); // size / material fields re-render for the new category
  }

  // Opens a dropdown panel. A click made while another panel is still closing can be
  // swallowed as an "outside click", so close anything open first and retry the click.
  async function openPanel(inputSel, panelTestId) {
    const isOpen = () => !!$(`[data-testid="${panelTestId}"]`) || !!saveBtn(); // desktop container, or mobile dialog
    await dismissPanels();
    for (let attempt = 1; attempt <= 3; attempt++) {
      (await waitFor(() => $(inputSel), { label: inputSel })).click();
      try {
        await waitFor(isOpen, { timeout: 2500, label: `${panelTestId} panel` });
        await sleep(300);
        return;
      } catch (e) {
        if (attempt === 3) throw e;
        await sleep(500);
      }
    }
  }

  // Brand: search by name (React-safe), wait for results, then click the exact brand ID.
  // Falls back to an exact (case-insensitive) name match if the ID is ever not present.
  // Two protections, because a real phone run left the brand empty although Primark was chosen:
  //  1. Vinted can pre-select a brand from the photo (for example from a visible label). Tapping a row
  //     that is already selected may DESELECT it, so an already-correct brand is left alone.
  //  2. The dialog can keep stale state where Save changes nothing. If the field is still wrong,
  //     pick a different brand first to reset the dialog, then pick the wanted one (same fix as category).
  async function chooseBrand(brandId, brandName, viaOther) {
    await openPanel('#brand', 'brand-select-dropdown-content');
    const search = await waitFor(() => $('#brand-search-input'), { label: 'brand search' });
    setNativeValue(search, brandName);
    const findRow = () =>
      document.getElementById(`brand-${brandId}`) ||
      $$('[id^="brand-"][role="radio"]').find((e) => e.innerText.trim().split('\n')[0].toLowerCase() === brandName.toLowerCase());
    let row;
    try {
      row = await waitFor(findRow, { timeout: 6000, label: `brand result ${brandName}` });
    } catch (e) {
      throw new Error(`Brand not found: ${brandName} (${brandId})`);
    }
    let target = row;
    if (viaOther) {
      target = $$('[id^="brand-"][role="radio"]').find((e) => e !== row);
      if (!target) throw new Error('no other brand available to reset the brand dialog');
    }
    if (!isChecked(target)) target.click();
    await finishSelection('brand-select-dropdown-content', false);
    await sleep(300);
  }

  async function setBrand(brandId, brandName) {
    const same = () => valueOf('#brand').trim().toLowerCase() === String(brandName).toLowerCase();
    if (same()) return; // already correct (for example chosen by Vinted from the photo)
    await chooseBrand(brandId, brandName, false);
    const settled = async () => { try { await waitFor(same, { timeout: 2500, label: 'brand value' }); return true; } catch (e) { return false; } };
    if (!(await settled())) {
      await chooseBrand(brandId, brandName, true);   // pick a different brand to reset the dialog
      await chooseBrand(brandId, brandName, false);  // then pick the wanted one again
      if (!(await settled())) throw new Error(`brand could not be set to "${brandName}" (field shows "${valueOf('#brand') || 'nothing'}")`);
    }
  }

  // Brand is MANDATORY on Vinted: either a brand is chosen, or, for an item with no brand, the dialog's
  // "List without brand" option (id "empty-brand") must be chosen (Vinted help page 47). Leaving the field alone is
  // not the same thing: Vinted may have filled in a wrong brand from the photo, which would then stay on the listing.
  // So an item with no brand supplied is set to "List without brand" explicitly.
  const NO_BRAND_LABEL = 'list without brand';
  async function chooseNoBrand(viaOther) {
    await openPanel('#brand', 'brand-select-dropdown-content');
    const noBrandRow = await waitFor(() => document.getElementById('empty-brand'), { timeout: 6000, label: 'the "List without brand" option' });
    let target = noBrandRow;
    if (viaOther) {
      target = $$('[id^="brand-"][role="radio"]')[0];
      if (!target) throw new Error('no brand available to reset the brand dialog');
    }
    if (!isChecked(target)) target.click();
    await finishSelection('brand-select-dropdown-content', false);
    await sleep(300);
  }

  async function setNoBrand() {
    const same = () => valueOf('#brand').trim().toLowerCase() === NO_BRAND_LABEL;
    if (same()) return;
    await chooseNoBrand(false);
    const settled = async () => { try { await waitFor(same, { timeout: 2500, label: 'brand value' }); return true; } catch (e) { return false; } };
    if (!(await settled())) {
      await chooseNoBrand(true);   // pick any brand first to reset the dialog
      await chooseNoBrand(false);  // then pick "List without brand" again
      if (!(await settled())) throw new Error(`could not set "List without brand" (field shows "${valueOf('#brand') || 'nothing'}")`);
    }
  }

  async function setSize(sizeId) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      await openPanel('#size', 'category-size-single-grid-content');
      const opt = await waitFor(() => $(`[data-testid$="-grid-option-${sizeId}"]`), { label: `size ${sizeId} (not offered for this category?)` });
      if (!isChecked(opt)) opt.click(); // a second tap on a selected option can deselect it
      await finishSelection('category-size-single-grid-content', false);
      await sleep(300);
      if (valueOf('#size')) return;
    }
    throw new Error(`size ${sizeId} could not be set (the field stayed empty)`);
  }

  // Some categories (bags, jewellery, sunglasses, watches...) have no size field at all.
  // No field and no sizeId: fine. No field but a sizeId: skip with a warning. Field but no sizeId: error.
  async function setSizeIfPresent(sizeId, report) {
    await sleep(300);
    const present = !!$('#size');
    if (!present) {
      if (sizeId != null) report.warnings.push('size skipped: this category has no size field');
      return;
    }
    if (sizeId == null) throw new Error('this category needs a size but none was supplied');
    await setSize(sizeId);
  }

  async function setCondition(conditionId) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      await openPanel('#condition', 'category-condition-single-list-content');
      await waitFor(() => $('[role="radio"][id^="condition-"]'), { label: 'condition options' });
      const row = document.getElementById(`condition-${conditionId}`);
      if (!row) {
        const offered = $$('[role="radio"][id^="condition-"]').map((e) => e.id.replace('condition-', '')).join(', ');
        await dismissPanels();
        throw new Error(`condition ${conditionId} is not offered for this category (offered: ${offered})`);
      }
      if (!isChecked(row)) row.click(); // a second tap on a selected option can deselect it
      await finishSelection('category-condition-single-list-content', false);
      await sleep(300);
      if (valueOf('#condition')) return;
    }
    throw new Error(`condition ${conditionId} could not be set (the field stayed empty)`);
  }

  // Names currently shown in a multi-select field, for example "Light blue, Multi" -> ['light blue', 'multi'].
  const namesIn = (fieldValue) => String(fieldValue || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const sameNames = (fieldValue, wantedNames) => {
    const a = namesIn(fieldValue).sort();
    const b = [...wantedNames].sort();
    return a.length === b.length && a.every((x, i) => x === b[i]);
  };

  // Multi-selects (colour, material): tick wanted, untick unwanted (incl. stale suggestions), close.
  // Colour rows expose NO selected state (no aria-checked, no role). So the selection is read from the field's
  // text BEFORE the dialog opens (the committed text is accurate; once the dialog is opening, the field text can be
  // momentarily empty, which made an earlier version toggle correct colours off - verified live) and every tap is
  // tracked in a local set. Rows that do expose aria-checked (materials) use that instead.
  // Returns the lower-cased names that should now be selected, for verification.
  async function setMulti({ inputSel, panelId, rowSel, wantedIds, rowId }) {
    const selected = new Set(namesIn(valueOf(inputSel)));
    await openPanel(inputSel, panelId);
    const rows = $$(rowSel).filter((r) => /^[a-z]+-\d+$/.test(r.getAttribute('data-testid') || ''));
    const rowName = (r) => (r.innerText || '').trim().split('\n')[0].toLowerCase();
    const isOn = (r) => { const attr = r.getAttribute('aria-checked'); return attr !== null ? attr === 'true' : selected.has(rowName(r)); };
    const tap = async (r) => {
      r.click();
      const n = rowName(r);
      if (selected.has(n)) selected.delete(n); else selected.add(n);
      await sleep(450);
    };
    const wanted = new Set(wantedIds.map(String));
    // untick anything wrong first (this also frees a slot when the field allows only two colours)
    for (const r of rows) {
      if (!wanted.has(rowId(r)) && isOn(r)) await tap(r);
    }
    for (const id of wanted) {
      const r = rows.find((x) => rowId(x) === id);
      if (!r) throw new Error(`Option ${id} not found in ${panelId}`);
      if (!isOn(r)) await tap(r);
    }
    const wantedNames = rows.filter((r) => wanted.has(rowId(r))).map(rowName);
    await finishSelection(panelId, true); // mobile: Save, desktop: Escape
    return wantedNames;
  }

  const setColours = (ids) => setMulti({
    inputSel: '#color', panelId: 'color-select-dropdown-content',
    rowSel: '[data-testid^="color-"]', wantedIds: ids,
    rowId: (r) => r.getAttribute('data-testid').replace('color-', ''),
  });

  const setMaterials = (ids) => setMulti({
    inputSel: '#material', panelId: 'category-material-multi-list-content',
    rowSel: '[role="checkbox"][data-testid^="material-"]', wantedIds: ids,
    rowId: (r) => r.getAttribute('data-testid').replace('material-', ''),
  });

  // Price. Vinted shows a "Price recommendation" with three levels: Bargain, Optimal and Premium
  // (data-testid pricing-strategy-item-min / -mid / -max). It does NOT appear straight away: in testing it did not
  // show after the category, brand or size, only once the condition had been set. Default rule: price = Vinted's
  // Optimal + 0.50 (item.priceUplift changes the 0.50). A custom item.price, when given, always wins.
  // Tapping the Optimal chip would fill the Optimal amount exactly, so the total is typed instead.
  const optimalPrice = () => {
    const el = $('[data-testid="pricing-strategy-item-mid"]');
    if (!el) return null;
    const m = (el.innerText || '').match(/£\s*([\d,]+(?:\.\d+)?)/);
    return m ? Number(m[1].replace(/,/g, '')) : null;
  };
  const roundPence = (n) => Math.round(n * 100) / 100;

  // Waits for the Optimal amount to appear and stay the same for 1.5s. Resolves null if it never appears.
  async function waitForOptimalPrice(timeoutMs = 15000) {
    let last = null;
    let since = Date.now();
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const v = optimalPrice();
      if (v !== last) { last = v; since = Date.now(); }
      else if (v !== null && Date.now() - since >= 1500) return v;
      await sleep(250);
    }
    return last;
  }

  // Resolves with { value, source, optimal?, uplift? }. source is 'custom' or 'vinted_optimal_plus_uplift'.
  async function setPrice(item) {
    const hasCustom = item.price != null && String(item.price).trim() !== '' && Number(item.price) > 0;
    if (hasCustom) {
      const value = roundPence(Number(item.price));
      await typeText('#price', value.toFixed(2));
      return { value, source: 'custom' };
    }
    const optimal = await waitForOptimalPrice();
    if (optimal === null) {
      throw new Error('no custom price was supplied and Vinted showed no price recommendation (it needs the condition and other fields to be set first)');
    }
    const uplift = item.priceUplift != null && !Number.isNaN(Number(item.priceUplift)) ? Number(item.priceUplift) : 0.5;
    const value = roundPence(optimal + uplift);
    await typeText('#price', value.toFixed(2));
    return { value, source: 'vinted_optimal_plus_uplift', optimal, uplift };
  }

  // Parcel size. Vinted marks ONE option "Recommended" and the recommendation depends on the category (verified live:
  // Small for most kids clothing, Medium for wellington boots). The option that is pre-selected does NOT always follow
  // the recommendation (wellington boots recommend Medium but Small stays pre-selected), and the recommendation arrives
  // about a second after a category change, so it is read once it has settled.
  // item.packageId: 1, 2 or 3 forces that size. Left out (or 'recommended'), the script follows Vinted's recommendation.
  const recommendedPackage = () => {
    const ids = $$('[data-testid^="package-size-suggestion-badge-id-"]')
      .map((e) => e.getAttribute('data-testid').replace('package-size-suggestion-badge-id-', ''))
      .filter((t) => /^[123]$/.test(t));
    return ids.length ? Number(ids[0]) : null;
  };

  // Resolves with { id, source } where source is 'explicit', 'vinted' or 'fallback' (no recommendation was shown).
  async function setPackage(packageId) {
    let id = [1, 2, 3].includes(Number(packageId)) ? Number(packageId) : null;
    let source = id ? 'explicit' : null;
    if (!id) {
      let last = null;
      let since = Date.now();
      const start = Date.now();
      while (Date.now() - start < 8000) {
        const rec = recommendedPackage();
        if (rec !== last) { last = rec; since = Date.now(); }
        else if (rec !== null && Date.now() - since >= 1500) break; // stable for 1.5s
        await sleep(250);
      }
      id = last || 1;
      source = last ? 'vinted' : 'fallback';
    }
    const radio = await waitFor(() => document.getElementById(`package_type_selector_${id}`), { label: `package ${id}` });
    if (!radio.checked) radio.click();
    await sleep(400);
    return { id, source };
  }

  async function typeText(selector, value) {
    const el = await waitFor(() => $(selector), { label: selector });
    el.focus();
    el.select();
    const typed = document.execCommand('insertText', false, String(value));
    if (!typed) setNativeValue(el, String(value)); // fallback, may not persist
    await sleep(400);
    el.blur();
    await sleep(400);
  }

  // Records the draft save request (status, whether our price was in the payload) and any alert text.
  // Results are also copied to sessionStorage because a successful save redirects to the member page.
  function installDraftRecorder() {
    const rec = { requests: [], alerts: [] };
    const isDraftReq = (m, u) => m !== 'GET' && /\/api\/v2\/item_upload\/drafts/.test(u || '');
    const summarise = (body) => {
      try { const o = JSON.parse(body); const d = o.draft || o; return { price: d.price != null ? String(d.price) : null }; }
      catch (e) { return { price: null }; }
    };
    const idFrom = (text) => {
      try { const o = JSON.parse(text); const v = (o.draft && o.draft.id) ?? o.id ?? (o.item && o.item.id); return v != null ? String(v) : null; }
      catch (e) { return null; }
    };
    // Vinted redirects to the member page within a fraction of a second of a successful save, so the
    // outcome is written to sessionStorage the moment the request finishes, not after any delay.
    const persistNow = (entry) => {
      try {
        sessionStorage.setItem('vintedDraftResult', JSON.stringify({
          ok: entry.status >= 200 && entry.status < 300, status: entry.status,
          draftId: entry.draftId || null, sentPrice: entry.price, alerts: rec.alerts.slice(),
        }));
      } catch (e) { /* ignore */ }
      notifyHost('vinted:saveResult', {
        ok: entry.status >= 200 && entry.status < 300, status: entry.status,
        draftId: entry.draftId || null, sentPrice: entry.price, alerts: rec.alerts.slice(),
      });
    };
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__m = m; this.__u = u; return origOpen.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function (body) {
      if (isDraftReq(this.__m, this.__u)) {
        const entry = { method: this.__m, ...summarise(body) };
        this.addEventListener('loadend', () => { entry.status = this.status; entry.draftId = idFrom(this.responseText); rec.requests.push(entry); persistNow(entry); });
      }
      return origSend.apply(this, arguments);
    };
    const origFetch = window.fetch;
    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const m = (init && init.method) || 'GET';
      const entry = isDraftReq(m, url) ? { method: m, ...summarise(init && init.body) } : null;
      const res = await origFetch.apply(this, arguments);
      if (entry) { entry.status = res.status; rec.requests.push(entry); persistNow(entry); }
      return res;
    };
    new MutationObserver((muts) => {
      for (const mu of muts) for (const n of mu.addedNodes) {
        if (n.nodeType !== 1) continue;
        const el = n.matches && n.matches('[role="alert"]') ? n : (n.querySelector && n.querySelector('[role="alert"]'));
        if (el && (el.innerText || '').trim()) rec.alerts.push(el.innerText.trim().slice(0, 200));
      }
    }).observe(document.body, { childList: true, subtree: true });
    return rec;
  }

  async function saveDraftAndConfirm(item, report) {
    const rec = installDraftRecorder();
    try { sessionStorage.setItem('vintedDraftReport', JSON.stringify(report)); } catch (e) { /* ignore */ }
    const btn = await waitFor(() => $('[data-testid="upload-form-save-draft-button"]'), { label: 'save draft button' });
    btn.click();
    try { await waitFor(() => rec.requests.length, { timeout: 15000, label: 'draft save response' }); } catch (e) { /* handled below */ }
    await sleep(600); // let any error alert render
    const last = rec.requests[rec.requests.length - 1];
    const ok = !!last && last.status >= 200 && last.status < 300;
    const result = {
      ok, status: last ? last.status : null, draftId: last ? last.draftId || null : null,
      alerts: rec.alerts.slice(), sentPrice: last ? last.price : null,
      priceSaved: !!last && last.price != null && Number(last.price) === Number(report.price ? report.price.value : item.price),
    };
    if (!last) result.problem = 'no draft request was seen within 15s';
    else if (!ok) result.problem = `Vinted rejected the draft (HTTP ${last.status})${rec.alerts.length ? ': ' + rec.alerts.join(' | ') : ''}`;
    else if (!result.priceSaved) result.problem = 'draft saved but the price was not in the request';
    try { sessionStorage.setItem('vintedDraftResult', JSON.stringify(result)); } catch (e) { /* ignore */ }
    return result;
  }

  // ---------- orchestration ----------

  async function vintedCreateDraft(item, options = {}) {
    const opts = { saveDraft: false, ...options }; // default is a dry run: fill, verify, do not save
    const report = { steps: [], warnings: [], errors: [], saved: false };
    const state = { categoryLabel: '' }; // label we selected, used to spot Vinted overwriting it
    window.__VINTED_CURRENT_ID__ = item.itemId != null ? String(item.itemId) : null; // echoed on every host event
    notifyHost('vinted:started', { dryRun: !opts.saveDraft });

    if (!/\/items\/(new|\d+\/edit)/.test(location.pathname)) throw new Error('Run this on /items/new or a draft edit page');
    const capsWords = (String(item.title || '').match(/\b[A-Z]{3,}\b/g) || []);
    if (capsWords.length) report.warnings.push(`title has all-caps words (${capsWords.join(', ')}); Vinted rejects titles with too many capitals`);

    // 1. Photos first. The remaining fields do not exist until this is done.
    // No brand name supplied (or item.noBrand is true) means the item is listed as "List without brand".
    const hasBrand = !item.noBrand && !!(item.brandName && String(item.brandName).trim());
    if (!hasBrand) report.warnings.push('no brand supplied: the item will be listed as "List without brand"');

    const upload = await uploadImages(item.images);
    if (upload && upload.fieldsRevealed === false) {
      report.warnings.push('the other form fields were not shown within 20s of the upload; continuing with the category step, which also reveals them');
    }
    report.steps.push('images uploaded');

    // 2. Field plan, in dependency order (category first: it drives size and material).
    //    `read` returns what the page currently shows, `expect` is what we want it to contain.
    const plan = [
      { name: 'category',  apply: async () => { await setCategory(item.categoryPath, item.categoryLeafId); state.categoryLabel = valueOf('#category'); },
        ok: () => !!state.categoryLabel && valueOf('#category') === state.categoryLabel },
      { name: 'fields',    apply: async () => { await waitFor(() => $('#brand') && $('#condition') && $('#color'), { timeout: 40000, label: 'the other form fields (shown after a photo upload or a category choice)' }); await sleep(800); },
        ok: () => !!($('#brand') && $('#condition') && $('#color')) },
      { name: 'title',     apply: () => setText('#title', item.title),             ok: () => valueOf('#title') === item.title },
      { name: 'description', apply: () => setText('#description', item.description), ok: () => valueOf('#description') === item.description },
      { name: 'brand',     apply: () => (hasBrand ? setBrand(item.brandId, item.brandName) : setNoBrand()),
        ok: () => valueOf('#brand').trim().toLowerCase() === (hasBrand ? String(item.brandName).toLowerCase() : NO_BRAND_LABEL) },
      { name: 'size',      apply: () => setSizeIfPresent(item.sizeId, report),    ok: () => !$('#size') || !!valueOf('#size') },
      { name: 'condition', apply: () => setCondition(item.conditionId),            ok: () => !!valueOf('#condition') },
      { name: 'colours',   apply: async () => { state.colourNames = await setColours(item.colourIds || []); }, ok: () => sameNames(valueOf('#color'), state.colourNames || []) },
      { name: 'material',  apply: async () => { state.materialNames = await setMaterials(item.materialIds || []); }, ok: () => sameNames(valueOf('#material'), state.materialNames || []) },
      { name: 'price',     apply: async () => { state.price = await setPrice(item); },
        ok: () => !!state.price && parseFloat(valueOf('#price').replace(/[^\d.]/g, '')) === state.price.value
          // when following Vinted, re-apply if the Optimal amount has changed since (it can change as fields are filled)
          && (state.price.source === 'custom' || optimalPrice() === null || roundPence(optimalPrice() + state.price.uplift) === state.price.value) },
      { name: 'package',   apply: async () => { state.parcel = await setPackage(item.packageId); },
        ok: () => !!state.parcel && !!document.getElementById(`package_type_selector_${state.parcel.id}`)?.checked
          // when following Vinted, the recommendation may have changed since (it can update late): re-apply if so
          && (state.parcel.source !== 'vinted' || recommendedPackage() === null || recommendedPackage() === state.parcel.id) },
    ];

    // Progress events let a host app show how far along the run is.
    const totalSteps = plan.length + 2 + (opts.saveDraft ? 1 : 0); // images + each field + verify (+ save)
    let doneSteps = 1;
    notifyHost('vinted:progress', { step: 'images', done: doneSteps, total: totalSteps });

    // 3. Fill one at a time.
    for (const step of plan) {
      let stepOk = true;
      try { await step.apply(); report.steps.push(`filled ${step.name}`); }
      catch (e) { stepOk = false; report.errors.push(`${step.name}: ${e.message}`); }
      doneSteps += 1;
      notifyHost('vinted:progress', { step: step.name, done: doneSteps, total: totalSteps, ok: stepOk });
    }

    // 4. Verify loop: Vinted can overwrite fields late with photo suggestions.
    //    Wait, re-check everything, re-apply any step that drifted.
    for (let pass = 1; pass <= 3; pass++) {
      await sleep(2500);
      const drifted = plan.filter((s) => { try { return !s.ok(); } catch (e) { return true; } });
      if (!drifted.length) { report.steps.push(`verified clean on pass ${pass}`); break; }
      report.steps.push(`pass ${pass} re-applying: ${drifted.map((d) => d.name).join(', ')}`);
      // if category drifted, everything after it must be redone
      const from = plan.findIndex((s) => drifted.includes(s));
      const redo = drifted.some((d) => d.name === 'category') ? plan.slice(from) : drifted;
      for (const step of redo) {
        try { await step.apply(); } catch (e) { report.errors.push(`${step.name} (retry ${pass}): ${e.message}`); }
      }
      if (pass === 3) report.errors.push('fields still drifting after 3 passes');
    }

    doneSteps += 1;
    notifyHost('vinted:progress', { step: 'verified', done: doneSteps, total: totalSteps, ok: !report.errors.length });

    report.finalValues = {
      category: valueOf('#category'), title: valueOf('#title'), brand: valueOf('#brand'),
      size: valueOf('#size'), condition: valueOf('#condition'), colours: valueOf('#color'),
      material: valueOf('#material'), price: valueOf('#price'),
      parcel: state.parcel ? `${{ 1: 'Small', 2: 'Medium', 3: 'Large' }[state.parcel.id]} (${state.parcel.source})` : '',
    };

    // 5. Save as draft only when explicitly asked and nothing failed.
    if (state.price) {
      report.price = { ...state.price };
      if (state.price.source !== 'custom') report.warnings.push(`price set from Vinted's Optimal (${state.price.optimal}) plus ${state.price.uplift}`);
    }
    if (state.parcel) {
      const names = { 1: 'Small', 2: 'Medium', 3: 'Large' };
      report.parcel = { id: state.parcel.id, name: names[state.parcel.id], source: state.parcel.source };
      if (state.parcel.source === 'fallback') report.warnings.push('Vinted showed no recommended parcel size; Small was used');
    }
    if (report.errors.length) report.diagnostics = pageSnapshot();
    notifyHost('vinted:report', { warnings: report.warnings, errors: report.errors, steps: report.steps, finalValues: report.finalValues, willSave: !!(opts.saveDraft && !report.errors.length), diagnostics: report.diagnostics });
    if (opts.saveDraft && !report.errors.length) {
      notifyHost('vinted:progress', { step: 'saving', done: totalSteps - 1, total: totalSteps });
      report.save = await saveDraftAndConfirm(item, report);
      report.saved = report.save.ok;
      report.steps.push(report.save.ok ? 'draft saved' : 'draft NOT saved');
      if (report.save.problem) report.errors.push(report.save.problem);
    }
    return report;
  }

  window.vintedCreateDraft = vintedCreateDraft;
  if (window.__VINTED_ITEM__) {
    window.__VINTED_REPORT__ = null;
    vintedCreateDraft(window.__VINTED_ITEM__, window.__VINTED_OPTIONS__ || {})
      .then((r) => { window.__VINTED_REPORT__ = r; console.log('[vinted-draft]', r); })
      .catch((e) => { window.__VINTED_REPORT__ = { fatal: e.message }; notifyHost('vinted:fatal', { message: e.message, diagnostics: pageSnapshot() }); console.error('[vinted-draft]', e); });
  }
})();

/* ---------- Example item (what your AI analysis step should produce) ----------
window.__VINTED_ITEM__ = {
  images: [ { name: 'hoody_one.jpg', type: 'image/jpeg', base64: '...' } ],
  title: 'Next girls floral zip-up hoodie 12-18 months',
  description: 'Soft blue floral zip-up hoodie from Next.\nHooded, kangaroo pocket, ribbed cuffs and hem.\n85% cotton, 15% polyester.',
  categoryPath: [1193, 1195, 1246],   // Kids > Girls clothing > Jumpers & hoodies
  categoryLeafId: 1550,               // Hoodies & sweatshirts
  brandId: 2287, brandName: 'Next',
  sizeId: 618,                        // 12-18 months / 80 cm
  conditionId: 2,                     // Very good
  colourIds: [26, 15],                // Light blue, Multi
  materialIds: [44, 45],              // Cotton, Polyester
  // price: 6,                     // optional custom price in GBP. Leave out to use Vinted's Optimal price plus 0.50
  // priceUplift: 0.5,               // optional: changes the 0.50 added to Vinted's Optimal price
  // packageId: 1                  // optional: 1 Small, 2 Medium, 3 Large. Leave out to follow Vinted's recommendation
};
window.__VINTED_OPTIONS__ = { saveDraft: false };
*/
