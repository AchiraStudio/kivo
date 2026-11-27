import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ShoppingCart, Search, Plus, Minus, Trash2, UserCheck, 
  PauseCircle, PlayCircle, Loader2, HelpCircle, Edit3, Check, 
  X as XIcon, Crown, LayoutGrid, List, ArrowRight, RotateCcw,
  Activity, Pill, Package, Baby, ScanBarcode
} from 'lucide-react';
import { usePosStore, PosLine, PosHold } from './POSStore';
import { 
  getItemsFiltered, Item, Customer, getSettings, kickCashDrawer, 
  resolveTierPrice, getCategories, Category 
} from '../../lib/api';
import { applyDiscountsToCart } from '../../lib/discountEngine';
import { useBarcodeScanner, playScanBeep } from '../../hooks/useBarcodeScanner';
import { parseScan, toRegistrationCode } from '../../lib/barcode';
import { findItemByScan } from '../../lib/itemLookup';
import { usePermissions } from '../../lib/permissions';
import { isMobilePlatform } from '../../lib/runtime';
import { useCartBadgeStore } from '../../store/CartBadgeStore';
import BarcodeCameraModal from '../../components/ui/BarcodeCameraModal';
import { toast } from '../../components/ui/Toast';
import PaymentModal from './PaymentModal';
import ReceiptModal from './ReceiptModal';
import CustomerPickerModal from './CustomerPickerModal';
import SalesHistoryModal from './SalesHistoryModal';
import TourGuide from '../../components/ui/TourGuide';
import Button from '../../components/ui/Button';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useGlobalArrowNav } from '../../hooks/useGlobalArrowNav';

function getCategoryAvatar(categoryName?: string) {
  const cat = (categoryName || '').toUpperCase();
  if (cat.includes('ALKES') || cat.includes('ALAT') || cat.includes('MEDIS') || cat.includes('JARUM') || cat.includes('SPUIT') || cat.includes('PERBAN') || cat.includes('KASA')) {
    return {
      Icon: Activity,
      avatarClass: 'bg-info-soft text-info',
    };
  }
  if (cat.includes('BIOTIK') || cat.includes('OBAT') || cat.includes('INTERNIS') || cat.includes('BAPIL') || cat.includes('GENERIK') || cat.includes('TABLET') || cat.includes('KAPSUL') || cat.includes('SIRUP') || cat.includes('INJEKSI') || cat.includes('SALEP')) {
    return {
      Icon: Pill,
      avatarClass: 'bg-primary-soft text-primary',
    };
  }
  if (cat.includes('BABY') || cat.includes('ANAK') || cat.includes('BAYI') || cat.includes('KOSMETIK') || cat.includes('BEAUTY') || cat.includes('SKIN') || cat.includes('PERAWATAN')) {
    return {
      Icon: Baby,
      avatarClass: 'bg-danger-soft text-danger',
    };
  }
  if (cat.includes('HERBAL') || cat.includes('JAMU') || cat.includes('ALAMI') || cat.includes('VITAMIN') || cat.includes('SUPLEMEN')) {
    return {
      Icon: Pill,
      avatarClass: 'bg-success-soft text-success',
    };
  }
  return {
    Icon: Package,
    avatarClass: 'bg-muted text-dim',
  };
}

interface POSProps {
  /** Open rapid registration with this barcode (shown when a scanned code is unknown). */
  onRegisterBarcode?: (barcode: string) => void;
}

export default function POS({ onRegisterBarcode }: POSProps = {}) {
  useGlobalArrowNav();
  const { can } = usePermissions();

  // Item catalog states
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [priceType, setPriceType] = useState<'retail' | 'wholesale'>('retail');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [barcodeSound, setBarcodeSound] = useState(true);
  // Last scanned code that matched no product; drives the "register this barcode" shortcut.
  const [unknownScan, setUnknownScan] = useState<string | null>(null);

  // Cart & Pricing states
  const [cart, setCart] = useState<PosLine[]>([]);
  const [cartDiscount, setCartDiscount] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Grand Total Override states
  const [customGrandTotal, setCustomGrandTotal] = useState<number | null>(null);
  const [isEditingTotal, setIsEditingTotal] = useState(false);
  const [customTotalInput, setCustomTotalInput] = useState('');

  // Tax & Member Discount settings
  const [taxMode, setTaxMode] = useState<string>('none');
  const [taxRate, setTaxRate] = useState<number>(0);
  const [tierMemberDiscount, setTierMemberDiscount] = useState<number>(0);
  const [tierVipDiscount, setTierVipDiscount] = useState<number>(0);

  // Cart item selection & inline price / subtotal editing
  const [selectedCartIdx, setSelectedCartIdx] = useState<number>(-1);
  const [editingPriceIdx, setEditingPriceIdx] = useState<number>(-1);
  const [editingPriceVal, setEditingPriceVal] = useState<string>('');
  const [editingSubtotalIdx, setEditingSubtotalIdx] = useState<number>(-1);
  const [editingSubtotalVal, setEditingSubtotalVal] = useState<string>('');
  const [mobilePosTab, setMobilePosTab] = useState<'catalog' | 'cart'>('catalog');

  // DOM Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const totalEditInputRef = useRef<HTMLInputElement>(null);
  const priceEditInputRef = useRef<HTMLInputElement>(null);
  const subtotalEditInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const cartItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cartListRef = useRef<HTMLDivElement>(null);

  // Highlighted search result. The search box keeps focus, so the cashier can
  // keep typing while moving through results with the arrow keys.
  const [activeItemIdx, setActiveItemIdx] = useState<number>(-1);

  // Modals
  const [showPayment, setShowPayment] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  
  // Tour Guide
  const [runTour, setRunTour] = useState(false);
  const posTourSteps = [
    {
      target: '.tour-pos-search',
      content: 'Ketik nama barang, scan barcode, atau pilih kategori. Tekan Enter untuk memasukkan barang.',
      disableBeacon: true,
    },
    {
      target: '.tour-pos-catalog',
      content: 'Klik produk untuk menambahkannya ke keranjang.',
    },
    {
      target: '.tour-pos-cart',
      content: 'Klik harga untuk mengubahnya (Alt+H) atau atur jumlah item.',
    },
    {
      target: '.tour-pos-total',
      content: 'Klik total untuk menyesuaikan harga secara manual (F8).',
    },
    {
      target: '.tour-pos-payment',
      content: 'Klik Bayar atau tekan End untuk memproses pembayaran.',
    }
  ];

  const holds = usePosStore(state => state.holds);
  const addHold = usePosStore(state => state.addHold);
  const removeHold = usePosStore(state => state.removeHold);

  // Load Settings & Categories on Mount
  useEffect(() => {
    getSettings().then(settings => {
      const mode = settings.find(s => s.key === 'tax_mode')?.value || 'none';
      const rate = parseFloat(settings.find(s => s.key === 'tax_rate')?.value || '0');
      const memberDisc = parseFloat(settings.find(s => s.key === 'tier_member_discount')?.value || '0');
      const vipDisc = parseFloat(settings.find(s => s.key === 'tier_vip_discount')?.value || '0');
      setTaxMode(mode);
      setTaxRate(rate);
      setTierMemberDiscount(memberDisc);
      setTierVipDiscount(vipDisc);
      setBarcodeSound(settings.find(s => s.key === 'barcode_sound')?.value !== 'false');
    }).catch(console.error);

    getCategories().then(setCategories).catch(console.error);
  }, []);

  // Fetch Items based on Search query or Selected Category
  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setFetchError(null);
    try {
      const catFilter = selectedCategory === 'all' ? '' : selectedCategory;
      const res = await getItemsFiltered(search, catFilter, '', true, 1, 40);
      setItems(res.items);
    } catch (e) {
      console.error(e);
      if (!silent) setFetchError('Gagal memuat daftar produk.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, selectedCategory]);

  useEffect(() => {
    const timer = setTimeout(() => fetchItems(false), 250);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  // Real-time synchronization listener (debounced & silent so POS never flickers/reloads)
  useEffect(() => {
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    const handleSync = (ev: Event) => {
      const detail = (ev as CustomEvent<{ table?: string }>).detail;
      if (detail?.table === 'calculate_discounts') return;
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        fetchItems(true);
        getCategories().then(setCategories).catch(console.error);
      }, 350);
    };
    window.addEventListener('kivo:sync', handleSync);
    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      window.removeEventListener('kivo:sync', handleSync);
    };
  }, [fetchItems]);

  const [showCameraScanner, setShowCameraScanner] = useState(false);

  // A scan (hardware 1D/2D scanner or camera) adds the matching product to the cart straight away.
  // The logic lives in a ref so the callback handed to the scanner hook and the camera modal keeps
  // a stable identity (the camera restarts if it changes) yet always sees the current price type.
  const scanLogicRef = useRef<(raw: string) => Promise<void>>(async () => {});
  scanLogicRef.current = async (raw: string) => {
    const parsed = parseScan(raw);
    if (parsed.candidates.length === 0) return;

    let match: Item | null = null;
    try {
      match = await findItemByScan(parsed, { localItems: items });
    } catch (e) {
      console.error(e);
      if (barcodeSound) playScanBeep(false);
      toast.error('Gagal mencari produk', 'Coba scan ulang.');
      return;
    }

    if (match) {
      addToCart(match);
      setSearch('');
      setUnknownScan(null);
      if (barcodeSound) playScanBeep(true);
      return;
    }

    if (barcodeSound) playScanBeep(false);
    setSearch(parsed.raw);
    setUnknownScan(toRegistrationCode(raw));
    toast.warning('Produk belum terdaftar', `Barcode "${parsed.raw}" tidak ditemukan di katalog.`);
  };
  const handleBarcodeScan = useCallback((raw: string) => scanLogicRef.current(raw), []);

  // Hardware scanner hook. The search box is auto-focused and is where scans usually land, so it is
  // explicitly allowed; other fields (price edit, qty, ...) are left alone.
  useBarcodeScanner(handleBarcodeScan, {
    enabled: !showPayment && !showCustomerPicker && !receiptSaleId && !showHistory && !showClearConfirm && !showCameraScanner,
    allowInInputs: (el) => el === searchInputRef.current,
    playBeep: false,
  });

  // Start Line Price Edit
  const startEditPrice = useCallback((idx: number) => {
    if (idx < 0 || idx >= cart.length) return;
    const line = cart[idx];
    if (line.is_bogo_free) return;
    setEditingPriceIdx(idx);
    setEditingPriceVal(line.price.toString());
    setSelectedCartIdx(idx);
    setTimeout(() => priceEditInputRef.current?.focus(), 50);
  }, [cart]);

  const commitPriceEdit = useCallback(() => {
    const newPrice = parseFloat(editingPriceVal);
    if (!isNaN(newPrice) && newPrice >= 0 && editingPriceIdx >= 0) {
      setCart(prev => prev.map((l, i) => i === editingPriceIdx ? { ...l, price: newPrice } : l));
      // Reset manual total override when item prices change
      setCustomGrandTotal(null);
    }
    setEditingPriceIdx(-1);
    setEditingPriceVal('');
  }, [editingPriceVal, editingPriceIdx]);

  const cancelPriceEdit = useCallback(() => {
    setEditingPriceIdx(-1);
    setEditingPriceVal('');
  }, []);

  // Start Line Subtotal Edit
  const startEditSubtotal = useCallback((idx: number) => {
    if (idx < 0 || idx >= cart.length) return;
    const line = cart[idx];
    if (line.is_bogo_free) return;
    const currentSubtotal = Math.max(0, (line.qty * line.price) - line.discount_amount);
    setEditingSubtotalIdx(idx);
    setEditingSubtotalVal(currentSubtotal.toString());
    setSelectedCartIdx(idx);
    setTimeout(() => subtotalEditInputRef.current?.focus(), 50);
  }, [cart]);

  const commitSubtotalEdit = useCallback(() => {
    const newSubtotal = parseFloat(editingSubtotalVal);
    if (!isNaN(newSubtotal) && newSubtotal >= 0 && editingSubtotalIdx >= 0 && editingSubtotalIdx < cart.length) {
      const line = cart[editingSubtotalIdx];
      const targetQty = line.qty > 0 ? line.qty : 1;
      const newUnitPrice = newSubtotal / targetQty;
      setCart(prev => prev.map((l, i) => i === editingSubtotalIdx ? { ...l, price: newUnitPrice, discount_amount: 0 } : l));
      setCustomGrandTotal(null);
    }
    setEditingSubtotalIdx(-1);
    setEditingSubtotalVal('');
  }, [editingSubtotalVal, editingSubtotalIdx, cart]);

  const cancelSubtotalEdit = useCallback(() => {
    setEditingSubtotalIdx(-1);
    setEditingSubtotalVal('');
  }, []);

  // Start Grand Total Price Override
  const startEditGrandTotal = useCallback(() => {
    setIsEditingTotal(true);
    setCustomTotalInput(customGrandTotal !== null ? customGrandTotal.toString() : '');
    setTimeout(() => totalEditInputRef.current?.focus(), 50);
  }, [customGrandTotal]);

  const commitGrandTotalEdit = useCallback(() => {
    const val = parseFloat(customTotalInput);
    if (!isNaN(val) && val >= 0) {
      setCustomGrandTotal(val);
    }
    setIsEditingTotal(false);
  }, [customTotalInput]);

  const cancelGrandTotalEdit = useCallback(() => {
    setIsEditingTotal(false);
  }, []);

  const resetGrandTotalOverride = useCallback(() => {
    setCustomGrandTotal(null);
    setIsEditingTotal(false);
  }, []);

  // Global Keyboard Navigation
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const isInModal = showPayment || showCustomerPicker || receiptSaleId || showHistory || showClearConfirm;

      // Handle Grand Total Edit Mode
      if (isEditingTotal) {
        if (e.key === 'Enter') { e.preventDefault(); commitGrandTotalEdit(); }
        if (e.key === 'Escape') { e.preventDefault(); cancelGrandTotalEdit(); }
        return;
      }

      // Handle Line Item Price Edit Mode
      if (editingPriceIdx >= 0) {
        if (e.key === 'Enter') { e.preventDefault(); commitPriceEdit(); }
        if (e.key === 'Escape') { e.preventDefault(); cancelPriceEdit(); }
        return;
      }

      // Handle Line Item Subtotal Edit Mode
      if (editingSubtotalIdx >= 0) {
        if (e.key === 'Enter') { e.preventDefault(); commitSubtotalEdit(); }
        if (e.key === 'Escape') { e.preventDefault(); cancelSubtotalEdit(); }
        return;
      }

      // F8 or Alt+T: Toggle Grand Total Override
      if (e.key === 'F8' || (e.altKey && (e.key === 't' || e.key === 'T'))) {
        e.preventDefault();
        if (!isInModal && cart.length > 0) {
          startEditGrandTotal();
        }
        return;
      }

      // Alt+H: Edit unit price of selected cart line
      if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        if (!isInModal && selectedCartIdx >= 0) {
          startEditPrice(selectedCartIdx);
        } else if (!isInModal && cart.length > 0) {
          startEditPrice(cart.length - 1);
          setSelectedCartIdx(cart.length - 1);
        }
        return;
      }

      // Alt+S: Edit subtotal of selected cart line
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!isInModal && selectedCartIdx >= 0) {
          startEditSubtotal(selectedCartIdx);
        } else if (!isInModal && cart.length > 0) {
          startEditSubtotal(cart.length - 1);
          setSelectedCartIdx(cart.length - 1);
        }
        return;
      }

      switch (e.key) {
        case 'F1':
          e.preventDefault();
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
          break;
        case 'F2':
          e.preventDefault();
          kickCashDrawer().catch(err => console.error('Cash drawer kick failed:', err));
          break;
        case 'F3':
          e.preventDefault();
          if (!showPayment) setShowCustomerPicker(true);
          break;
        case 'F4':
          e.preventDefault();
          if (cart.length > 0 && !showPayment) handleHold();
          break;
        case 'F5':
          e.preventDefault();
          if (holds.length > 0 && !showPayment) handleResume(holds[0]);
          break;
        case 'F7':
          e.preventDefault();
          if (!isInModal) setShowHistory(true);
          break;
        case 'F9':
          e.preventDefault();
          if (!showPayment && cart.length > 0) {
            setShowClearConfirm(true);
          }
          break;
        case 'End':
          e.preventDefault();
          if (cart.length > 0 && !showPayment && !isInModal) setShowPayment(true);
          break;
        case 'Escape':
          if (showClearConfirm) { setShowClearConfirm(false); return; }
          if (showPayment) setShowPayment(false);
          if (showCustomerPicker) setShowCustomerPicker(false);
          if (showHistory) setShowHistory(false);
          if (receiptSaleId) setReceiptSaleId(null);
          break;
        // Up/Down belong to the search results unless focus is already in the
        // cart list, or Alt is held to jump into it from anywhere.
        case 'ArrowDown':
          if (!e.defaultPrevented && cart.length > 0 && !isInModal && (e.altKey || cartListRef.current?.contains(document.activeElement))) {
            e.preventDefault();
            const next = Math.min(selectedCartIdx + 1, cart.length - 1);
            setSelectedCartIdx(next);
            cartItemRefs.current[next]?.focus();
          }
          break;
        case 'ArrowUp':
          if (!e.defaultPrevented && cart.length > 0 && !isInModal && (e.altKey || cartListRef.current?.contains(document.activeElement))) {
            e.preventDefault();
            const prev = Math.max(selectedCartIdx - 1, 0);
            setSelectedCartIdx(prev);
            cartItemRefs.current[prev]?.focus();
          }
          break;
        case '+':
        case '=':
          if (search.length < 2 && selectedCartIdx >= 0 && !isInModal) {
            e.preventDefault();
            const line = cart[selectedCartIdx];
            if (line && !line.is_bogo_free) updateQty(line.item_id, 1);
          }
          break;
        case '-':
          if (search.length < 2 && selectedCartIdx >= 0 && !isInModal) {
            e.preventDefault();
            const line = cart[selectedCartIdx];
            if (line && !line.is_bogo_free) updateQty(line.item_id, -1);
          }
          break;
        case 'Delete':
          if (search.length < 2 && selectedCartIdx >= 0 && !isInModal) {
            e.preventDefault();
            const line = cart[selectedCartIdx];
            if (line && !line.is_bogo_free) {
              removeItem(line.item_id);
              setSelectedCartIdx(prev => Math.max(0, prev - 1));
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [
    cart, holds, showPayment, showCustomerPicker, receiptSaleId, showHistory, showClearConfirm,
    search, selectedCartIdx, editingPriceIdx, editingPriceVal, editingSubtotalIdx,
    editingSubtotalVal, isEditingTotal, customTotalInput, startEditPrice, commitPriceEdit,
    cancelPriceEdit, startEditSubtotal, commitSubtotalEdit, cancelSubtotalEdit,
    startEditGrandTotal, commitGrandTotalEdit, cancelGrandTotalEdit
  ]);

  // Apply automatic discounts from promotion engine
  useEffect(() => {
    if (cart.length === 0) { setCartDiscount(0); return; }
    const linesForEngine = cart.map((l, i) => ({
      item_id: l.item_id, unit_id: l.unit_id, category_id: undefined,
      qty: l.qty, price: l.price, line_index: i
    }));

    applyDiscountsToCart(linesForEngine, selectedCustomer?.customer_tier, async (result) => {
      setCartDiscount(result.cart_discount);
      let needsUpdate = false;
      let newCart = [...cart];
      const itemsToAdd: PosLine[] = [];

      for (const lineDisc of result.line_discounts) {
        if (!lineDisc.is_bogo_free_item) {
          if (newCart[lineDisc.line_index] && newCart[lineDisc.line_index].discount_amount !== lineDisc.discount_amount) {
            newCart[lineDisc.line_index].discount_amount = lineDisc.discount_amount;
            needsUpdate = true;
          }
        } else {
          const existingFreeIdx = newCart.findIndex(l => l.is_bogo_free && l.item_id === (lineDisc.free_item_id || newCart[lineDisc.line_index]?.item_id));
          if (existingFreeIdx >= 0) {
            if (newCart[existingFreeIdx].qty !== lineDisc.free_item_qty) {
              newCart[existingFreeIdx].qty = lineDisc.free_item_qty;
              needsUpdate = true;
            }
          } else {
            const parentLine = newCart[lineDisc.line_index];
            if (parentLine) {
              itemsToAdd.push({
                item_id: lineDisc.free_item_id || parentLine.item_id,
                item_name: parentLine.item_name,
                unit_id: lineDisc.free_item_unit_id || parentLine.unit_id,
                unit_name: parentLine.unit_name,
                qty: lineDisc.free_item_qty,
                price_type: parentLine.price_type,
                price: parentLine.price,
                discount_amount: parentLine.price * lineDisc.free_item_qty,
                hpp_value: parentLine.hpp_value,
                is_bogo_free: true,
              });
              needsUpdate = true;
            }
          }
        }
      }

      const freeItemCount = newCart.filter(l => l.is_bogo_free).length;
      if (freeItemCount > result.line_discounts.filter(d => d.is_bogo_free_item).length) {
        newCart = newCart.filter(l => !l.is_bogo_free);
        needsUpdate = true;
      }
      if (itemsToAdd.length > 0) { newCart = [...newCart, ...itemsToAdd]; }

      for (let i = 0; i < newCart.length; i++) {
        if (newCart[i].price > 0 && !result.line_discounts.find(d => d.line_index === i && !d.is_bogo_free_item)) {
          if (newCart[i].discount_amount !== 0) { newCart[i].discount_amount = 0; needsUpdate = true; }
        }
      }
      if (needsUpdate) setCart(newCart);
    });
  }, [cart.map(l => `${l.item_id}-${l.qty}-${l.price}`).join('|'), selectedCustomer?.customer_tier]);

  // Number of cards per row in grid view, read from the rendered layout.
  const getGridColumns = () => {
    if (viewMode !== 'grid') return 1;
    const first = itemRefs.current[0];
    if (!first) return 1;
    let cols = 0;
    for (const el of itemRefs.current) {
      if (!el || el.offsetTop !== first.offsetTop) break;
      cols++;
    }
    return Math.max(1, cols);
  };

  const handleBarcodeEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (items.length === 0) return;
      e.preventDefault();
      const step = getGridColumns();
      setActiveItemIdx(prev => {
        if (e.key === 'ArrowDown') return prev < 0 ? 0 : Math.min(prev + step, items.length - 1);
        return prev < 0 ? 0 : Math.max(prev - step, 0);
      });
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && activeItemIdx >= 0 && viewMode === 'grid') {
      // Once a result is highlighted, Left/Right move sideways within the grid.
      e.preventDefault();
      setActiveItemIdx(prev => e.key === 'ArrowRight' ? Math.min(prev + 1, items.length - 1) : Math.max(prev - 1, 0));
    } else if (e.key === 'Escape' && activeItemIdx >= 0) {
      e.preventDefault();
      setActiveItemIdx(-1);
    } else if (e.key === 'Enter') {
      const highlighted = activeItemIdx >= 0 ? items[activeItemIdx] : undefined;
      if (highlighted) {
        e.preventDefault();
        addToCart(highlighted);
        setSearch('');
        setActiveItemIdx(-1);
      } else if (search) {
        if (items.length === 1) {
          addToCart(items[0]);
          setSearch('');
        } else {
          const exact = items.find(i => i.sku === search || i.barcode === search);
          if (exact) {
            addToCart(exact);
            setSearch('');
          }
        }
      }
    }
  };

  // Drop the highlight when the result set changes under it, and keep it in view.
  useEffect(() => {
    setActiveItemIdx(prev => (prev >= items.length ? -1 : prev));
  }, [items]);

  useEffect(() => {
    if (activeItemIdx >= 0) itemRefs.current[activeItemIdx]?.scrollIntoView({ block: 'nearest' });
  }, [activeItemIdx]);

  const addToCart = (item: Item) => {
    setCart(prev => {
      const exists = prev.find(l => l.item_id === item.id && !l.is_bogo_free);
      const newQty = exists ? exists.qty + 1 : 1;
      const baseDefault = priceType === 'wholesale' && item.wholesale_price ? item.wholesale_price : (item.price || 0);
      const resolved = resolveTierPrice(item, newQty, baseDefault);

      if (exists) {
        return prev.map(l => (l.item_id === item.id && !l.is_bogo_free) ? { ...l, qty: newQty, price: resolved.price } : l);
      }
      return [...prev, {
        item_id: item.id, 
        item_name: item.name,
        unit_id: item.base_unit_id || 'unknown', 
        unit_name: item.base_unit_name || 'Unit',
        qty: 1, 
        price_type: priceType, 
        price: resolved.price, 
        discount_amount: 0, 
        hpp_value: item.avg_hpp || 0
      }];
    });
    setCustomGrandTotal(null); // Reset manual total override on cart change
    setSelectedCartIdx(cart.length);
  };

  const updateQty = (itemId: string, delta: number) => {
    setCart(prev => prev.map(l => {
      if (l.item_id === itemId && !l.is_bogo_free) {
        const newQty = l.qty + delta;
        if (newQty <= 0) return l;
        const matchedItem = items.find(i => i.id === itemId);
        let newPrice = l.price;
        if (matchedItem) {
          const baseDefault = l.price_type === 'wholesale' && matchedItem.wholesale_price ? matchedItem.wholesale_price : (matchedItem.price || 0);
          const resolved = resolveTierPrice(matchedItem, newQty, baseDefault);
          newPrice = resolved.price;
        }
        return { ...l, qty: newQty, price: newPrice };
      }
      return l;
    }));
    setCustomGrandTotal(null);
  };

  const removeItem = (itemId: string) => {
    setCart(prev => prev.filter(l => !(l.item_id === itemId && !l.is_bogo_free)));
    setCustomGrandTotal(null);
  };

  // Calculations
  const rawSubtotal = cart.reduce((sum, l) => sum + (l.qty * l.price) - l.discount_amount, 0) - cartDiscount;
  
  let currentTierDiscountPercent = 0;
  if (selectedCustomer?.customer_tier === 'member') currentTierDiscountPercent = tierMemberDiscount;
  if (selectedCustomer?.customer_tier === 'vip') currentTierDiscountPercent = tierVipDiscount;
  
  const tierDiscountAmount = rawSubtotal * (currentTierDiscountPercent / 100);
  const subtotalAfterDiscounts = rawSubtotal - tierDiscountAmount;
  
  const taxAmount = taxMode === 'exclude' 
    ? subtotalAfterDiscounts * (taxRate / 100) 
    : (taxMode === 'include' ? subtotalAfterDiscounts * (1 - 1 / (1 + taxRate / 100)) : 0);
    
  const calculatedGrandTotal = Math.max(0, taxMode === 'exclude' ? subtotalAfterDiscounts + taxAmount : subtotalAfterDiscounts);
  
  // Final Total taking Custom Total Override into account
  const finalPayableTotal = customGrandTotal !== null ? customGrandTotal : calculatedGrandTotal;
  const manualTotalAdjustment = customGrandTotal !== null ? (calculatedGrandTotal - customGrandTotal) : 0;

  const handleHold = () => {
    if (cart.length === 0) return;
    addHold({ 
      id: Date.now().toString(), 
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), 
      lines: cart, 
      price_type: priceType, 
      total: finalPayableTotal 
    });
    setCart([]); 
    setCartDiscount(0); 
    setCustomGrandTotal(null);
    setSelectedCartIdx(-1);
  };

  const handleResume = (hold: PosHold) => {
    setCart(hold.lines); 
    setPriceType(hold.price_type); 
    removeHold(hold.id);
    setCustomGrandTotal(null);
    setSelectedCartIdx(-1);
  };

  const handlePaymentSuccess = (saleId: string, print: boolean) => {
    setCart([]); 
    setCartDiscount(0); 
    setCustomGrandTotal(null);
    setSearch(''); 
    setShowPayment(false);
    setSelectedCartIdx(-1);
    
    if (print) {
      setReceiptSaleId(saleId);
    } else {
      getSettings().then(settings => {
        const pName = settings.find(s => s.key === 'printer_name')?.value;
        if (pName) {
          kickCashDrawer(pName).catch((err: unknown) => console.error("Drawer kick failed", err));
        }
      }).catch(console.error);
    }
  };

  const TIER_LABEL: Record<string, string> = { regular: 'Regular', member: 'Member', vip: 'VIP' };

  // Mirror the cart size onto the mobile "Kasir" tab badge.
  const setCartBadge = useCartBadgeStore((st) => st.setCount);
  const cartPieces = cart.reduce((sum, l) => sum + l.qty, 0);
  useEffect(() => {
    setCartBadge(cartPieces);
  }, [cartPieces, setCartBadge]);

  // Fast in-cart quantity map for item cards
  const cartQtyMap = cart.reduce<Record<string, number>>((acc, line) => {
    if (!line.is_bogo_free) {
      acc[line.item_id] = (acc[line.item_id] || 0) + line.qty;
    }
    return acc;
  }, {});

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 w-full bg-background p-2 sm:p-3 gap-2 sm:gap-3 select-none relative overflow-hidden">
      {/* Mobile Top Segmented Control (< 1024px) */}
      <div className="lg:hidden bg-muted border border-line rounded-lg p-0.5 shrink-0 grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => setMobilePosTab('catalog')}
          className={`flex items-center justify-center gap-1.5 h-10 px-2.5 rounded-md text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            mobilePosTab === 'catalog'
              ? 'bg-card text-heading border border-line'
              : 'text-dim hover:text-heading border border-transparent'
          }`}
        >
          <Search size={13} className="shrink-0" />
          <span className="truncate">Katalog</span>
        </button>

        <button
          type="button"
          onClick={() => setMobilePosTab('cart')}
          className={`flex items-center justify-center gap-1.5 h-10 px-2.5 rounded-md text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            mobilePosTab === 'cart'
              ? 'bg-card text-heading border border-line'
              : 'text-dim hover:text-heading border border-transparent'
          }`}
        >
          <ShoppingCart size={13} className="shrink-0" />
          <span className="truncate">Keranjang</span>
          {cart.length > 0 && (
            <span className="px-1.5 min-w-[18px] h-4 inline-flex items-center justify-center rounded-full text-[10px] font-bold tnum bg-primary-soft text-primary shrink-0">
              {cart.reduce((sum, item) => sum + item.qty, 0)}
            </span>
          )}
        </button>
      </div>

      {/* Left: Catalog & Search */}
      <div className={`flex-1 min-h-0 flex-col bg-card rounded-xl border border-line overflow-hidden min-w-0 ${
        mobilePosTab === 'catalog' ? 'flex' : 'hidden lg:flex'
      }`}>
        {/* Top Control Bar */}
        <div className="p-2.5 sm:p-3 border-b border-line flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-card shrink-0">
          {/* Main Search Box */}
          <div className="flex-1 relative tour-pos-search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dim pointer-events-none" size={15} />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setActiveItemIdx(-1); setUnknownScan(null); }}
              onKeyDown={handleBarcodeEnter}
              placeholder="Cari produk atau scan barcode..."
              className="w-full h-11 lg:h-9 pl-9 pr-20 lg:pr-16 bg-input border border-line rounded-lg text-base lg:text-sm font-medium focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-heading placeholder:text-dim transition-colors"
              autoFocus={!isMobilePlatform()}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setUnknownScan(null); }}
                  aria-label="Hapus pencarian"
                  className="text-dim hover:text-heading w-9 h-9 lg:w-6 lg:h-6 flex items-center justify-center rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <XIcon size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowCameraScanner(true)}
                aria-label="Scan barcode dengan kamera"
                title="Scan Barcode"
                className="text-primary lg:text-dim hover:text-primary hover:bg-muted w-9 h-9 lg:w-6 lg:h-6 flex items-center justify-center rounded-md cursor-pointer transition-colors"
              >
                <ScanBarcode size={20} className="lg:w-[15px] lg:h-[15px]" />
              </button>
            </div>
          </div>

          {/* Controls Row: Pricing Switcher, View Mode & Help */}
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            <div className="flex items-center bg-muted p-0.5 rounded-lg border border-line h-9 shrink-0">
              <button
                type="button"
                onClick={() => setPriceType('retail')}
                className={`px-2.5 h-full rounded-md text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  priceType === 'retail'
                    ? 'bg-card text-heading border border-line'
                    : 'text-dim hover:text-heading border border-transparent'
                }`}
              >
                Eceran
              </button>
              <button
                type="button"
                onClick={() => setPriceType('wholesale')}
                className={`px-2.5 h-full rounded-md text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  priceType === 'wholesale'
                    ? 'bg-card text-heading border border-line'
                    : 'text-dim hover:text-heading border border-transparent'
                }`}
              >
                Grosir
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-medium text-dim tnum px-1.5 hidden md:inline-block">
                {items.length} item
              </span>

              <div className="flex items-center bg-muted p-0.5 rounded-lg border border-line h-9 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`w-8 h-full flex items-center justify-center rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    viewMode === 'grid'
                      ? 'bg-card text-heading border border-line'
                      : 'text-dim hover:text-heading border border-transparent'
                  }`}
                  title="Tampilan Grid"
                  aria-label="Tampilan grid"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`w-8 h-full flex items-center justify-center rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    viewMode === 'table'
                      ? 'bg-card text-heading border border-line'
                      : 'text-dim hover:text-heading border border-transparent'
                  }`}
                  title="Tampilan Daftar"
                  aria-label="Tampilan daftar"
                >
                  <List size={14} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setRunTour(true)}
                className="w-9 h-9 flex items-center justify-center text-dim hover:text-heading hover:bg-muted border border-line bg-card rounded-lg transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title="Panduan Kasir"
                aria-label="Panduan kasir"
              >
                <HelpCircle size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Bar */}
        <div className="px-3 py-2 border-b border-line flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0 bg-card">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-2 lg:px-2.5 lg:py-1 rounded-lg lg:rounded-md text-xs font-semibold shrink-0 transition-colors cursor-pointer whitespace-nowrap border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              selectedCategory === 'all'
                ? 'bg-primary-soft text-primary border-primary/30'
                : 'bg-muted text-body border-transparent hover:bg-muted-hover hover:text-heading'
            }`}
          >
            Semua
          </button>
          {Array.from(new Map(categories.map(c => [c.name.trim().toUpperCase(), c])).values()).map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-2 lg:px-2.5 lg:py-1 rounded-lg lg:rounded-md text-xs font-semibold shrink-0 transition-colors cursor-pointer whitespace-nowrap border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                selectedCategory === cat.id
                  ? 'bg-primary-soft text-primary border-primary/30'
                  : 'bg-muted text-body border-transparent hover:bg-muted-hover hover:text-heading'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Catalog Items Stream */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-3 custom-scrollbar tour-pos-catalog">
          {loading ? (
            <div className="h-full flex flex-col justify-center items-center gap-2">
              <Loader2 className="animate-spin text-primary" size={24} />
              <span className="text-xs text-dim font-medium">Memuat produk...</span>
            </div>
          ) : fetchError ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-danger">{fetchError}</p>
              <Button variant="outline" size="sm" onClick={() => fetchItems(false)}>
                Coba Lagi
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-dim p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-dim mb-2.5 border border-line">
                <Search size={20} />
              </div>
              <p className="text-sm font-semibold text-heading">Produk tidak ditemukan</p>
              <p className="text-xs text-dim mt-1">Ubah kata kunci atau pilih kategori lain.</p>
              {unknownScan && onRegisterBarcode && (can('items.create') || can('items.edit')) && (
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    onRegisterBarcode(unknownScan);
                    setUnknownScan(null);
                  }}
                >
                  Registrasi barcode {unknownScan.length > 24 ? `${unknownScan.slice(0, 24)}…` : unknownScan}
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
              {items.map((item, idx) => {
                const activePrice = priceType === 'wholesale' && item.wholesale_price ? item.wholesale_price : (item.price || 0);
                const inCartQty = cartQtyMap[item.id] || 0;
                const isOutOfStock = item.current_stock !== undefined && item.current_stock <= 0;
                const isLowStock = item.current_stock !== undefined && item.current_stock > 0 && item.current_stock <= (item.min_stock || 5);
                const { Icon: CatIcon, avatarClass } = getCategoryAvatar(item.category_name);

                return (
                  <button
                    key={item.id}
                    type="button"
                    ref={el => { itemRefs.current[idx] = el; }}
                    onClick={() => addToCart(item)}
                    className={`group relative flex flex-col justify-between text-left rounded-xl p-3 transition-colors cursor-pointer select-none border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      activeItemIdx === idx ? 'ring-2 ring-primary ring-offset-1 ring-offset-card ' : ''
                    }${
                      inCartQty > 0
                        ? 'bg-primary-soft/40 border-primary'
                        : 'bg-card border-line hover:border-line-strong active:scale-[0.99]'
                    } ${isOutOfStock ? 'opacity-75 hover:opacity-100' : ''}`}
                  >
                    {inCartQty > 0 && (
                      <div className="absolute -top-1.5 -right-1.5 z-10 bg-primary-soft text-primary border border-primary/30 text-[11px] font-bold tnum px-1.5 h-5 rounded-full flex items-center gap-0.5">
                        <Check size={11} strokeWidth={2.5} />
                        <span>{inCartQty}</span>
                      </div>
                    )}

                    <div>
                      <div className="flex items-start justify-between gap-1.5 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${avatarClass}`}>
                            <CatIcon size={14} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-mono font-medium text-dim truncate">
                              {item.sku}
                            </span>
                            {item.category_name && (
                              <span className="text-[10px] text-dim truncate">
                                {item.category_name}
                              </span>
                            )}
                          </div>
                        </div>

                        {item.current_stock !== undefined && (
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 tnum ${
                            isOutOfStock
                              ? 'text-danger bg-danger-soft'
                              : isLowStock
                              ? 'text-warning bg-warning-soft'
                              : 'text-success bg-success-soft'
                          }`}>
                            {item.current_stock > 0 ? item.current_stock : 'Habis'}
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-[13px] text-heading line-clamp-2 leading-snug min-h-[2.25rem]">
                        {item.name}
                      </h4>

                      <div className="flex items-center gap-1.5 mt-1 min-h-[16px]">
                        {item.requires_prescription === 1 && (
                          <span className="px-1.5 py-0.5 bg-danger-soft text-danger text-[10px] font-bold rounded-md shrink-0">
                            Rx
                          </span>
                        )}
                        {item.generic_name ? (
                          <span className="text-[11px] text-dim truncate" title={item.generic_name}>
                            {item.generic_name}
                          </span>
                        ) : item.rack_location ? (
                          <span className="text-[10px] font-mono text-dim truncate">
                            Rak {item.rack_location}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-line flex items-center justify-between gap-1.5">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-heading text-sm tnum truncate">
                          Rp {activePrice.toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-dim">
                          /{item.base_unit_name || 'Unit'}
                        </span>
                      </div>

                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                        inCartQty > 0
                          ? 'bg-primary-soft text-primary'
                          : 'bg-muted text-body group-hover:bg-muted-hover group-hover:text-heading'
                      }`}>
                        <Plus size={14} strokeWidth={2.25} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="border border-line rounded-xl overflow-hidden bg-card">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted border-b border-line text-xs font-semibold text-dim">
                  <tr>
                    <th className="py-2.5 px-3.5">SKU</th>
                    <th className="py-2.5 px-3.5">Produk</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3 text-center">Stok</th>
                    <th className="py-2.5 px-3.5 text-right">Harga</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((item, idx) => {
                    const activePrice = priceType === 'wholesale' && item.wholesale_price ? item.wholesale_price : (item.price || 0);
                    const inCartQty = cartQtyMap[item.id] || 0;
                    const isOutOfStock = item.current_stock !== undefined && item.current_stock <= 0;
                    const isLowStock = item.current_stock !== undefined && item.current_stock > 0 && item.current_stock <= (item.min_stock || 5);
                    const { Icon: CatIcon, avatarClass } = getCategoryAvatar(item.category_name);

                    return (
                      <tr
                        key={item.id}
                        ref={el => { itemRefs.current[idx] = el; }}
                        onClick={() => addToCart(item)}
                        className={`hover:bg-muted/60 transition-colors cursor-pointer ${
                          activeItemIdx === idx ? 'bg-primary-soft/50 outline-2 -outline-offset-2 outline-primary ' : ''
                        }${
                          inCartQty > 0 ? 'bg-primary-soft/30' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${avatarClass}`}>
                              <CatIcon size={12} />
                            </div>
                            <span className="font-mono text-dim text-[11px]">{item.sku}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 font-semibold text-heading">
                          <div className="flex items-center gap-1.5">
                            {item.requires_prescription === 1 && (
                              <span className="px-1.5 py-0.5 bg-danger-soft text-danger text-[10px] font-bold rounded-md">Rx</span>
                            )}
                            <span>{item.name}</span>
                          </div>
                          {item.generic_name && (
                            <span className="text-[11px] text-dim font-normal block">{item.generic_name}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-dim text-xs">{item.category_name || '-'}</td>
                        <td className="py-2.5 px-3 text-center">
                          {item.current_stock !== undefined ? (
                            <span className={`px-2 py-0.5 rounded-md tnum text-[11px] font-semibold inline-block ${
                              isOutOfStock
                                ? 'text-danger bg-danger-soft'
                                : isLowStock
                                ? 'text-warning bg-warning-soft'
                                : 'text-success bg-success-soft'
                            }`}>
                              {item.current_stock > 0 ? item.current_stock : 'Habis'}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-semibold text-heading tnum text-xs">
                          Rp {activePrice.toLocaleString('id-ID')}
                          <span className="text-[10px] text-dim font-normal ml-0.5">/{item.base_unit_name || 'Unit'}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            className={`px-2.5 py-1 rounded-lg font-semibold text-xs cursor-pointer inline-flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                              inCartQty > 0
                                ? 'bg-primary-soft text-primary'
                                : 'bg-muted text-heading hover:bg-muted-hover'
                            }`}
                          >
                            {inCartQty > 0 ? (
                              <>
                                <Check size={11} strokeWidth={2.5} />
                                <span className="tnum">{inCartQty}</span>
                              </>
                            ) : (
                              <>
                                <Plus size={11} strokeWidth={2.25} />
                                <span>Tambah</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Keyboard Hint Bar */}
        <div className="py-2 px-3 bg-muted/50 border-t border-line hidden lg:flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 text-[11px] text-dim shrink-0">
          {[
            ['F1', 'Cari'],
            ['↑↓ Enter', 'Pilih'],
            ['Alt+↑↓', 'Keranjang'],
            ['F2', 'Laci'],
            ['F3', 'Pelanggan'],
            ['F4', 'Tahan'],
            ['F8', 'Total'],
            ['Alt+H', 'Harga'],
            ['Alt+S', 'Subtotal'],
            ['F7', 'Riwayat'],
            ['End', 'Bayar'],
          ].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1">
              <kbd className="bg-card border border-line px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold text-body">
                {key}
              </kbd>
              <span>{label}</span>
            </span>
          ))}
        </div>

        {/* In-flow Mobile Cart Summary Bar (never overlaps MobileNav) */}
        {cart.length > 0 && mobilePosTab === 'catalog' && (
          <div className="lg:hidden p-2 border-t border-line bg-card shrink-0">
            <button
              type="button"
              onClick={() => setMobilePosTab('cart')}
              className="w-full bg-primary hover:bg-primary-hover text-white px-4 h-14 rounded-xl flex items-center justify-between cursor-pointer active:scale-[0.99] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold tnum">
                  {cart.reduce((sum, item) => sum + item.qty, 0)}
                </span>
                <span className="text-base font-extrabold tnum">
                  Rp {finalPayableTotal.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold">
                <span className="text-sm">Lihat Keranjang</span>
                <ArrowRight size={16} />
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Right: Cart & Checkout Panel */}
      <div className={`flex-1 min-h-0 lg:flex-none flex-col bg-card rounded-xl border border-line overflow-hidden w-full lg:w-96 2xl:w-[410px] lg:shrink-0 ${
        mobilePosTab === 'cart' ? 'flex' : 'hidden lg:flex'
      }`}>

        {/* Customer Header Button */}
        <button
          type="button"
          onClick={() => setShowCustomerPicker(true)}
          className="w-full px-3.5 py-2.5 border-b border-line bg-card flex items-center justify-between cursor-pointer hover:bg-muted/60 transition-colors tour-pos-customer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              selectedCustomer ? 'bg-primary-soft text-primary' : 'bg-muted text-dim'
            }`}>
              <UserCheck size={15} />
            </div>
            <div className="text-left min-w-0">
              <div className="text-xs font-semibold text-heading truncate">
                {selectedCustomer ? selectedCustomer.name : 'Pelanggan Umum'}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-dim">
                  {selectedCustomer ? (TIER_LABEL[selectedCustomer.customer_tier] || 'Regular') : 'Umum'}
                </span>
                {selectedCustomer?.loyalty_points ? (
                  <span className="text-[10px] font-semibold bg-warning-soft text-warning px-1.5 py-0.5 rounded-md tnum">
                    {selectedCustomer.loyalty_points} Poin
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted border border-line text-body rounded-lg text-xs font-medium shrink-0">
            <kbd className="hidden lg:inline font-mono text-[10px] text-dim">F3</kbd>
            <span>Ubah</span>
          </div>
        </button>

        {/* Cart Header & Held Transactions */}
        <div className="px-3.5 py-2 bg-muted/50 border-b border-line flex items-center justify-between text-xs font-semibold text-dim shrink-0">
          <div className="flex items-center gap-1.5">
            <ShoppingCart size={14} className="text-dim" />
            <span className="tnum">Keranjang ({cart.length})</span>
          </div>

          <div className="flex items-center gap-2">
            {holds.length > 0 && (
              <button
                type="button"
                onClick={() => handleResume(holds[0])}
                className="flex items-center gap-1 px-2 py-0.5 bg-warning-soft text-warning border border-warning/30 rounded-md text-[11px] font-semibold cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title="Lanjutkan Transaksi Tertahan (F5)"
              >
                <PlayCircle size={12} />
                <span className="tnum">{holds.length} Tertahan</span>
              </button>
            )}
            <span className="text-xs font-medium text-dim tnum">
              {cart.reduce((s, l) => s + l.qty, 0)} pcs
            </span>
          </div>
        </div>

        {/* Cart Item List */}
        <div ref={cartListRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 tour-pos-cart">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-dim p-6 text-center select-none">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-dim mb-2.5 border border-line">
                <ShoppingCart size={22} />
              </div>
              <p className="text-sm font-semibold text-heading">Keranjang kosong</p>
              <p className="text-xs text-dim mt-1 max-w-[200px]">
                Scan barcode atau pilih produk di katalog.
              </p>
            </div>
          ) : (
            cart.map((l, idx) => {
              const isSelected = selectedCartIdx === idx;
              const isEditingPrice = editingPriceIdx === idx;
              const isEditingSubtotal = editingSubtotalIdx === idx;
              return (
                <div
                  key={`${l.item_id}-${idx}`}
                  ref={el => { cartItemRefs.current[idx] = el; }}
                  tabIndex={0}
                  onFocus={() => setSelectedCartIdx(idx)}
                  onClick={() => setSelectedCartIdx(idx)}
                  className={`p-3 rounded-xl border transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected
                      ? 'border-primary bg-primary-soft/40'
                      : l.is_bogo_free
                      ? 'bg-success-soft/50 border-success/30'
                      : 'bg-card border-line hover:border-line-strong'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {l.is_bogo_free && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-success-soft text-success shrink-0">
                            Gratis
                          </span>
                        )}
                        <h4 className="font-semibold text-xs text-heading line-clamp-1 leading-snug">
                          {l.item_name}
                        </h4>
                      </div>

                      {/* Inline Unit Price Edit */}
                      {isEditingPrice ? (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-xs font-medium text-dim">Rp</span>
                          <input
                            ref={priceEditInputRef}
                            type="number"
                            value={editingPriceVal}
                            onChange={e => setEditingPriceVal(e.target.value)}
                            className="w-24 h-7 text-xs font-semibold px-2 border border-primary rounded-lg bg-input text-heading outline-none focus:ring-2 focus:ring-primary/20 tnum"
                          />
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); commitPriceEdit(); }}
                            aria-label="Simpan harga"
                            className="w-7 h-7 flex items-center justify-center bg-success text-white rounded-lg cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); cancelPriceEdit(); }}
                            aria-label="Batal ubah harga"
                            className="w-7 h-7 flex items-center justify-center bg-muted border border-line text-body hover:text-heading rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <XIcon size={13} />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={e => {
                            if (!l.is_bogo_free) {
                              e.stopPropagation();
                              startEditPrice(idx);
                            }
                          }}
                          className={`inline-flex items-center gap-1 mt-1 group/price ${!l.is_bogo_free ? 'cursor-pointer' : ''}`}
                          title="Klik untuk ubah harga satuan (Alt+H)"
                        >
                          <span className="text-xs font-medium text-dim tnum group-hover/price:text-heading group-hover/price:underline">
                            Rp {l.price.toLocaleString('id-ID')}
                          </span>
                          <span className="text-[11px] text-dim">/ {l.unit_name}</span>
                          {!l.is_bogo_free && (
                            <Edit3 size={11} className="text-dim opacity-60 group-hover/price:opacity-100 group-hover/price:text-heading" />
                          )}
                        </div>
                      )}

                      {l.discount_amount > 0 && (
                        <div className="mt-1">
                          <span className="text-[11px] font-semibold bg-success-soft text-success px-1.5 py-0.5 rounded-md tnum">
                            Diskon -Rp {l.discount_amount.toLocaleString('id-ID')}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); removeItem(l.item_id); }}
                      aria-label={`Hapus ${l.item_name}`}
                      className="text-dim hover:text-danger hover:bg-danger-soft w-10 h-10 lg:w-auto lg:h-auto lg:p-1.5 -mt-1 -mr-1 lg:m-0 flex items-center justify-center rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      title="Hapus Item (Delete)"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Subtotal & Quantity Stepper */}
                  <div className="mt-2.5 pt-2 border-t border-line flex items-center justify-between gap-2">
                    {isEditingSubtotal ? (
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <span className="text-xs font-medium text-dim">Rp</span>
                        <input
                          ref={subtotalEditInputRef}
                          type="number"
                          value={editingSubtotalVal}
                          onChange={e => setEditingSubtotalVal(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitSubtotalEdit(); }
                            if (e.key === 'Escape') { e.preventDefault(); cancelSubtotalEdit(); }
                          }}
                          className="w-24 h-7 text-xs font-semibold px-2 border border-primary rounded-lg bg-input text-heading outline-none focus:ring-2 focus:ring-primary/20 tnum"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); commitSubtotalEdit(); }}
                          aria-label="Simpan subtotal"
                          className="w-7 h-7 flex items-center justify-center bg-success text-white rounded-lg cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title="Simpan Subtotal"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); cancelSubtotalEdit(); }}
                          aria-label="Batal ubah subtotal"
                          className="w-7 h-7 flex items-center justify-center bg-muted border border-line text-body hover:text-heading rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title="Batal"
                        >
                          <XIcon size={13} />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={e => {
                          if (!l.is_bogo_free) {
                            e.stopPropagation();
                            startEditSubtotal(idx);
                          }
                        }}
                        className={`group/subtotal flex flex-col ${!l.is_bogo_free ? 'cursor-pointer' : ''}`}
                        title="Klik untuk ubah subtotal (Alt+S)"
                      >
                        <span className="text-[11px] font-medium text-dim inline-flex items-center gap-1">
                          <span>Subtotal</span>
                          {!l.is_bogo_free && (
                            <Edit3 size={10} className="opacity-60 group-hover/subtotal:opacity-100" />
                          )}
                        </span>
                        <span className="font-bold text-sm text-heading tnum group-hover/subtotal:underline">
                          Rp {((l.qty * l.price) - l.discount_amount).toLocaleString('id-ID')}
                        </span>
                      </div>
                    )}

                    {!l.is_bogo_free && (
                      <div className="flex items-center bg-muted rounded-lg p-0.5 border border-line">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); updateQty(l.item_id, -1); }}
                          aria-label={`Kurangi jumlah ${l.item_name}`}
                          className="w-10 h-10 lg:w-7 lg:h-7 flex items-center justify-center bg-card text-heading hover:bg-danger-soft hover:text-danger rounded-md transition-colors active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-10 lg:w-8 text-center text-sm lg:text-xs font-bold text-heading tnum">
                          {l.qty}
                        </span>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); updateQty(l.item_id, 1); }}
                          aria-label={`Tambah jumlah ${l.item_name}`}
                          className="w-10 h-10 lg:w-7 lg:h-7 flex items-center justify-center bg-card text-heading hover:bg-muted-hover rounded-md transition-colors active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Footer & Total Override */}
        <div className="p-2.5 sm:p-3.5 bg-muted/40 border-t border-line shrink-0 space-y-2 sm:space-y-3">
          {(cartDiscount > 0 || currentTierDiscountPercent > 0 || taxRate > 0) && (
            <div className="space-y-1.5 pb-2 text-xs border-b border-line">
              {cartDiscount > 0 && (
                <div className="flex justify-between items-center text-body">
                  <span>Diskon Promo</span>
                  <span className="font-semibold text-success tnum">-Rp {cartDiscount.toLocaleString('id-ID')}</span>
                </div>
              )}
              {currentTierDiscountPercent > 0 && (
                <div className="flex justify-between items-center text-primary font-semibold">
                  <span className="flex items-center gap-1">
                    <Crown size={12} /> Diskon Member ({currentTierDiscountPercent}%)
                  </span>
                  <span className="tnum">-Rp {tierDiscountAmount.toLocaleString('id-ID')}</span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex justify-between items-center text-dim">
                  <span>Pajak ({taxRate}%)</span>
                  <span className="tnum">
                    {taxMode === 'exclude' ? '+' : ''}Rp {taxAmount.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Total Box (Click to Override) */}
          <div
            onClick={cart.length > 0 ? startEditGrandTotal : undefined}
            className={`p-3 rounded-xl border transition-colors tour-pos-total group ${
              cart.length > 0 ? 'cursor-pointer ' : ''
            }${
              customGrandTotal !== null
                ? 'bg-warning-soft/50 border-warning/40'
                : 'bg-card border-line hover:border-line-strong'
            }`}
            title="Klik untuk ubah total (F8 / Alt+T)"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-dim">Total</span>
                <kbd className="text-[10px] font-mono font-semibold bg-muted border border-line text-dim px-1.5 py-0.5 rounded-md">
                  F8
                </kbd>
              </div>

              {customGrandTotal !== null && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    resetGrandTotalOverride();
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 bg-warning-soft text-warning border border-warning/30 text-[11px] font-semibold rounded-md cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  title="Kembalikan ke total normal"
                >
                  <RotateCcw size={11} /> Reset
                </button>
              )}
            </div>

            {customGrandTotal !== null && !isEditingTotal && (
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <span className="text-dim line-through tnum">
                  Rp {Math.round(calculatedGrandTotal).toLocaleString('id-ID')}
                </span>
                <span className="text-[11px] font-semibold text-warning bg-warning-soft px-1.5 py-0.5 rounded-md">
                  Disesuaikan
                </span>
              </div>
            )}

            {isEditingTotal ? (
              <div className="mt-2 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                <span className="text-sm font-semibold text-dim">Rp</span>
                <input
                  ref={totalEditInputRef}
                  type="number"
                  value={customTotalInput}
                  onChange={e => setCustomTotalInput(e.target.value)}
                  placeholder={calculatedGrandTotal.toString()}
                  className="w-full h-9 text-base font-bold px-2.5 border border-primary rounded-lg bg-input text-heading outline-none focus:ring-2 focus:ring-primary/20 tnum"
                />
                <Button variant="secondary" size="sm" type="button" onClick={commitGrandTotalEdit}>
                  <Check size={14} />
                </Button>
                <Button variant="outline" size="sm" type="button" onClick={cancelGrandTotalEdit}>
                  Batal
                </Button>
              </div>
            ) : (
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold text-heading tnum tracking-tight">
                  Rp {Math.round(finalPayableTotal).toLocaleString('id-ID')}
                </span>
                {cart.length > 0 && (
                  <Edit3 size={14} className="text-dim group-hover:text-heading transition-colors shrink-0" />
                )}
              </div>
            )}
          </div>

          {/* Primary & Secondary Action Buttons */}
          <div className="grid grid-cols-5 gap-2">
            <Button
              variant="outline"
              size="lg"
              type="button"
              onClick={handleHold}
              disabled={cart.length === 0}
              className="col-span-2 px-3 h-12 lg:h-11"
            >
              <PauseCircle size={15} />
              <span>Tahan</span>
            </Button>

            <Button
              variant="primary"
              size="lg"
              type="button"
              onClick={() => setShowPayment(true)}
              disabled={cart.length === 0}
              className="col-span-3 tour-pos-payment h-12 lg:h-11 text-base lg:text-sm"
            >
              <span>Bayar</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showPayment && (
        <PaymentModal
          branchId="branch_001"
          cart={cart}
          total={finalPayableTotal}
          priceType={priceType}
          customerId={selectedCustomer?.id}
          taxAmount={taxAmount}
          discountAmount={
            cart.reduce((s, l) => s + (l.discount_amount || 0), 0) +
            cartDiscount +
            tierDiscountAmount +
            Math.max(0, manualTotalAdjustment)
          }
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {showCustomerPicker && (
        <CustomerPickerModal
          isOpen={showCustomerPicker}
          onClose={() => setShowCustomerPicker(false)}
          onSelect={setSelectedCustomer}
          selectedId={selectedCustomer?.id}
        />
      )}

      {receiptSaleId && (
        <ReceiptModal
          saleId={receiptSaleId}
          onClose={() => {
            setReceiptSaleId(null);
            searchInputRef.current?.focus();
          }}
        />
      )}

      {showHistory && (
        <SalesHistoryModal
          isOpen={showHistory}
          onClose={() => {
            setShowHistory(false);
            searchInputRef.current?.focus();
          }}
        />
      )}

      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          setCart([]);
          setCartDiscount(0);
          setCustomGrandTotal(null);
          setSelectedCartIdx(-1);
          setShowClearConfirm(false);
        }}
        title="Kosongkan Keranjang?"
        message="Semua item di keranjang transaksi ini akan dihapus."
        confirmText="Kosongkan"
      />

      <BarcodeCameraModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onDetected={handleBarcodeScan}
        title="Scan Barcode Kasir"
      />

      <TourGuide
        steps={posTourSteps}
        run={runTour}
        onFinish={() => setRunTour(false)}
      />
    </div>
  );
}
