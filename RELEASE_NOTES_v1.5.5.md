# Kivo v1.5.5 Release Notes

**Release Date:** November 23, 2026
**Version:** `1.5.5`

## Summary

Kivo v1.5.5 makes **hardware barcode scanners (1D and 2D) work properly at the cashier** and adds **Registrasi Cepat** (rapid registration) for attaching barcodes to your catalog. Scans now go straight into the cart, 2D codes (QR / DataMatrix, including GS1) are understood, and unknown barcodes can be assigned to an existing product or turned into a new one in a few seconds. This release is frontend-only: no database or Rust changes.

## Highlights

### 1. Scan straight into the cart (POS)
- **Fixed:** scans were ignored while the auto-focused search box had focus, and pressing Enter matched against a stale list of only the first 40 products, so most scans in a real catalog did nothing. Scans now add the matching product to the cart (and raise the quantity on repeat scans) wherever the cursor is.
- Matching is exact on SKU or barcode and **case-insensitive** (scanners are affected by Caps Lock), with a catalog lookup when the product is not in the visible list.
- The beep now respects **Settings -> Hardware -> Suara Beep Barcode** (previously saved but never read) and plays a single success or failure tone.
- An unknown code shows a **"Registrasi barcode ..."** shortcut in the product list area.

### 2. 2D codes (QR / DataMatrix) and GS1
- GS1 element strings (GTIN + expiry + batch/serial) are parsed in both raw and bracketed `(01)...(17)...(10)...` form, including AIM symbology prefixes (`]d2`, `]Q3`) and the GS separator (sent by scanners as Ctrl+]).
- The product is matched by its **GTIN**, since batch and serial differ on every pack. GTIN-14, EAN-13 and UPC-A spellings of the same code are treated as equal.
- Camera scanning also requests DataMatrix where the device supports it.
- Plain 1D codes, SKUs and QR codes containing arbitrary text keep working exactly as before.

### 3. Registrasi Cepat (rapid registration)
- New **Registrasi Cepat** button on the product list. It also opens automatically from an unknown scan at the cashier or in the product list.
- Scan a barcode, then either:
  - **Pasangkan ke produk yang ada** - search by name or SKU and assign the barcode. Only the barcode changes. Replacing an existing real barcode asks for confirmation. A barcode that merely equals the item's internal code (as produced by spreadsheet imports without real barcodes) counts as "no barcode yet" and needs no confirmation.
  - **Buat produk baru** - enter name and selling price (cost, unit and category optional). A SKU like `MED-1234`, the base unit and regular/member/VIP prices are created for you. Enter moves from name to price and saves.
- After each save it is ready for the next scan, with a list of what was just registered. **Buka form lengkap** hands the barcode to the full product form.
- If creating a product fails part-way, it is rolled back so the barcode is not left stuck on a half-built product.

### 4. Safer registration in the product form
- A scan fills the Barcode field wherever the cursor is (the characters the scanner "typed" into another field are removed again). GS1 codes are stored by GTIN.
- A barcode already used by another product is flagged immediately and again on save, instead of a raw database UNIQUE error.

### 5. Scanner reliability
- Timing between keystrokes now uses the browser's event timestamp. A slow render (for example re-rendering the product grid after every character on a low-end terminal) can no longer split one scan into fragments.
- When a drawer or modal is opened over a page, only it receives scans, instead of both reacting to the same barcode.

## Notes and limitations

- **Box-level barcodes** (a separate barcode for a box or strip unit) are not matched at scan time; a scan resolves to the product's base unit. This needs a backend lookup and unit selection in the cart.
- Registrasi Cepat replaces a product's barcode; Kivo supports one barcode per product at scan time.
- **Re-importing a spreadsheet overwrites barcodes.** The Excel importer sets each product's barcode from the sheet (or from the SKU when the sheet's barcode is empty). Barcodes assigned in the app will be replaced if the same sheet is imported again.
- Imported products start with zero stock; use **Tambah Stok Massal** or Stock Opname to set quantities.
