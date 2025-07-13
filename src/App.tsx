import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, X, Trophy, Filter, ShoppingCart, Sun, Moon, QrCode } from 'lucide-react';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import QrScannerModal from './QrScannerModal';

interface Product {
  id: string;
  name: string;
  brand: string;
  category: 'smartphones' | 'laptops' | 'home_appliances' | string;
  price: number | string;
  specs: Record<string, any>;
  image?: string;
  buy?: string;
}

interface CategoryWeights {
  [key: string]: number;
}

const SPEC_KEY_MAP: Record<string, string> = {
  'Rear-Facing Camera MP': 'camera',
  'RAM Memory (GB)': 'ram',
  'Screen Size (inch)': 'screen',
  'Weight (g)': 'weight',
  'Resolution (ppi)': 'resolution',
  'ROM (GB)': 'storage',
  'Battery Capacity (mAh)': 'battery',
  'Processor Brand': 'processor',
  // Add more mappings as needed for your Firestore spec keys
};

const App = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonResults, setComparisonResults] = useState<any[]>([]);
  const [isDark, setIsDark] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalProduct, setModalProduct] = useState<any | null>(null);
  const [categoryWeights, setCategoryWeights] = useState<any>(null);
  const [categoryScoringMap, setCategoryScoringMap] = useState<any>(null);
  const [useCustomWeights, setUseCustomWeights] = useState(false);
  const [customWeights, setCustomWeights] = useState<any>({});
  const [weightError, setWeightError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalKey, setQrModalKey] = useState(Date.now());
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const [qrKey, setQrKey] = useState(Date.now());
  const [categoryError, setCategoryError] = useState<string | null>(null);
  // Add a reload trigger
  const [reloadKey, setReloadKey] = useState(0);

  // On mount, set theme from localStorage
  useEffect(() => {
    const dark = localStorage.getItem('theme') === 'dark';
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', newDark);
  };

  // Update fetchProducts to use localStorage cache, but refetch on reloadKey change
  useEffect(() => {
    async function fetchProducts() {
      const cached = localStorage.getItem('products');
      const cacheTime = localStorage.getItem('products_cache_time');
      const now = Date.now();
      if (cached && cacheTime && now - Number(cacheTime) < 3600 * 1000 && reloadKey === 0) {
        setProducts(JSON.parse(cached));
        setLoading(false);
      } else {
        const querySnapshot = await getDocs(collection(db, 'products'));
        const items = querySnapshot.docs.map(doc => doc.data());
        setProducts(items);
        setLoading(false);
        localStorage.setItem('products', JSON.stringify(items));
        localStorage.setItem('products_cache_time', String(now));
      }
    }
    fetchProducts();
  }, [reloadKey]);

  // Helper to clear all category caches
  function clearCategoryCache() {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('category_')) {
        localStorage.removeItem(key);
      }
    });
  }

  // Reload handler
  const handleReload = () => {
    setLoading(true);
    localStorage.removeItem('products');
    localStorage.removeItem('products_cache_time');
    clearCategoryCache();
    setReloadKey(k => k + 1);
  };

  // Update fetchCategoryData to use localStorage cache
  async function fetchCategoryData(categoryId: string) {
    const cacheKey = `category_${categoryId}`;
    const cacheTimeKey = `category_${categoryId}_cache_time`;
    const cached = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(cacheTimeKey);
    const now = Date.now();
    if (cached && cacheTime && now - Number(cacheTime) < 3600 * 1000) {
      const data = JSON.parse(cached);
      setCategoryWeights(data.weightage);
      setCategoryScoringMap(data.scoringMap);
      return data;
    } else {
      const catDoc = await getDoc(doc(db, 'categories', categoryId));
      if (catDoc.exists()) {
        setCategoryWeights(catDoc.data().weightage);
        setCategoryScoringMap(catDoc.data().scoringMap);
        localStorage.setItem(cacheKey, JSON.stringify(catDoc.data()));
        localStorage.setItem(cacheTimeKey, String(now));
        return catDoc.data();
      }
      return null;
    }
  }

  // Add this useEffect after the other useEffects
  useEffect(() => {
    if (selectedProducts.length > 0) {
      const category = selectedProducts[0].category;
      // Only fetch if not already loaded or if category changed
      if (!categoryWeights || selectedProducts[0].category !== categoryWeights._category) {
        fetchCategoryData(category).then(data => {
          if (data) {
            // Optionally, tag the weights with the category for quick check
            setCategoryWeights({ ...data.weightage, _category: category });
            setCategoryScoringMap(data.scoringMap);
          }
        });
      }
    }
  }, [selectedProducts]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const name = product.name || '';
      const brand = product.brand || '';
      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           brand.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory, products]);

  const normalizeValue = (value: any, min: number, max: number, reverse = false): number => {
    if (typeof value === 'string') {
      // Handle energy efficiency ratings
      const ratings = { 'A+++': 5, 'A++': 4, 'A+': 3, 'A': 2, 'B': 1 };
      value = ratings[value as keyof typeof ratings] || 1;
      min = 1;
      max = 5;
    }
    
    const normalized = (value - min) / (max - min);
    return reverse ? 1 - normalized : normalized;
  };

  const calculateScore = (products: Product[]): any[] => {
    if (products.length === 0) return [];

    const category = products[0].category;
    const weights = categoryWeights; // Use weights from Firestore
    const specs = Object.keys(weights);

    // Get min/max values for normalization
    const ranges: Record<string, { min: number; max: number; reverse?: boolean }> = {};
    
    specs.forEach(spec => {
      const values = products.map(p => {
        let value = p.specs[spec];
        if (typeof value === 'string' && spec === 'energy_efficiency') {
          const ratings = { 'A+++': 5, 'A++': 4, 'A+': 3, 'A': 2, 'B': 1 };
          value = ratings[value as keyof typeof ratings] || 1;
        }
        return typeof value === 'number' ? value : 0;
      });
      
      ranges[spec] = {
        min: Math.min(...values),
        max: Math.max(...values),
        reverse: spec === 'weight' || spec === 'price' || spec === 'power'
      };
    });

    // Calculate scores
    return products.map(product => {
      let totalScore = 0;
      const specScores: Record<string, number> = {};

      specs.forEach(spec => {
        const value = product.specs[spec];
        const range = ranges[spec];
        const normalized = normalizeValue(value, range.min, range.max, range.reverse);
        const weighted = normalized * weights[spec];
        
        specScores[spec] = normalized;
        totalScore += weighted;
      });

      return {
        product,
        totalScore: Math.round(totalScore * 100) / 10, // Scale to 1-10
        specScores
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
  };

  const addToComparison = (product: Product) => {
    if (selectedProducts.length >= 4) return;
    
    if (selectedProducts.length > 0 && selectedProducts[0].category !== product.category) {
      alert('Please select products from the same category for comparison.');
      return;
    }

    if (!selectedProducts.find(p => p.id === product.id)) {
      setSelectedProducts([...selectedProducts, product]);
    }
  };

  const removeFromComparison = (productId: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId));
  };

  // Updated compareProducts
  const compareProducts = async () => {
    if (selectedProducts.length < 2) return;
    const category = selectedProducts[0].category;
    const catData = await fetchCategoryData(category);
    if (!catData) return;
    let weights = catData.weightage;
    if (useCustomWeights) {
      // Parse and sanitize custom weights
      const parsedWeights: any = {};
      let sum = 0;
      Object.keys(customWeights).forEach(key => {
        let val = parseFloat(customWeights[key]);
        if (isNaN(val)) val = 0;
        parsedWeights[key] = val;
        sum += val;
      });
      if (sum === 0) {
        setWeightError('Custom weights must sum to more than 0.');
        return;
      }
      weights = {};
      Object.keys(parsedWeights).forEach(key => {
        weights[key] = parsedWeights[key] / sum;
      });
      setWeightError(null);
    }
    const scoringMap = catData.scoringMap || {};
    const specList = catData.specs || Object.keys(weights);

    // For numeric normalization, get min/max for each spec
    const numericSpecs = specList.filter((spec: any) => !scoringMap[spec]);
    const minMax: Record<string, { min: number, max: number }> = {};
    numericSpecs.forEach((spec: any) => {
      const values = selectedProducts.map(p => Number((p.specs || {})[spec])).filter(v => !isNaN(v));
      minMax[spec] = {
        min: values.length ? Math.min(...values) : 0,
        max: values.length ? Math.max(...values) : 1,
      };
    });

    // Calculate scores
    const results = selectedProducts.map(product => {
      let totalScore = 0;
      let specScores: Record<string, number> = {};
      specList.forEach((spec: any) => {
        let score = 0;
        const specs = product.specs || {};
        let value = specs[spec];
        // Convert string numbers to numbers for scoring
        if (typeof value === 'string' && !isNaN(Number(value))) value = Number(value);
        const weight = !isNaN(weights[spec]) ? weights[spec] : 0;
        // 1. Boolean: if true, add full weight; if false/missing, add 0
        if (typeof value === 'boolean') {
          score = value ? 1 : 0;
        // 2. If missing, score is 0
        } else if (value === undefined || value === null || value === "") {
          score = 0;
        // 3. If scoringMap is present, use mapped score
        } else if (scoringMap[spec]) {
          score = scoringMap[spec][String(value)] ?? 0;
        // 4. Else, normalize numeric value
        } else if (!isNaN(Number(value))) {
          const v = Number(value);
          const { min, max } = minMax[spec];
          score = max !== min ? (v - min) / (max - min) : 1;
        }
        specScores[spec] = score;
        totalScore += score * weight;
      });
      // 5. Scale to 0-100 and round
      return {
        product,
        totalScore: Math.round((isNaN(totalScore) ? 0 : totalScore) * 100),
        specScores,
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
    setComparisonResults(results);
    setShowComparison(true);
  };

  const startNewComparison = () => {
    setSelectedProducts([]);
    setShowComparison(false);
    setComparisonResults([]);
  };

  const getSpecDisplayName = (spec: string): string => {
    const names: Record<string, string> = {
      processor: 'Processor',
      battery: 'Battery (mAh)',
      camera: 'Camera (MP)',
      storage: 'Storage (GB)',
      screen: 'Screen (inches)',
      weight: 'Weight (g)',
      ram: 'RAM (GB)',
      energy_efficiency: 'Energy Rating',
      capacity: 'Capacity (L)',
      features: 'Features',
      warranty: 'Warranty (years)',
      power: 'Power (W)',
      // Airpod-related
      'Battery Life (h)': 'Battery Life (h)',
      'Playback Time (h)': 'Playback Time (h)',
      'Bluetooth': 'Bluetooth',
      'Microphone': 'Microphone',
      'Charging Cable': 'Charging Cable',
      'Dust Resistant': 'Dust Resistant',
      'Multi-point Connection': 'Multi-point Connection',
      'Voice Assistant Support': 'Voice Assistant Support',
      'Water Resistant': 'Water Resistant',
      'App Support': 'App Support',
    };
    return names[spec] || spec;
  };

  // Update getSpecValue to handle missing specs gracefully
  const getSpecValue = (product: any, spec: string): string => {
    const specs = product.specs || {};
    const value = specs[spec];
    if (value === undefined || value === null || value === "") return "N/A";
    if (spec === 'weight') return `${value}g`;
    if (spec === 'RAM Memory (GB)') return `${value} GB`;
    if (spec === 'ROM (GB)') return `${value} GB`;
    if (spec === 'Screen Size (inch)') return `${value}"`;
    if (spec === 'Front-Facing Camera MP' || spec === 'Rear-Facing Camera MP') return `${value} MP`;
    return value?.toString() || 'N/A';
  };

  const getCategoryDisplayName = (category: string): string => {
    const names: Record<string, string> = {
      smartphones: 'Smartphones',
      laptops: 'Laptops',
      home_appliances: 'Home Appliances',
      airpod: 'Airpods',
    };
    return names[category] || category;
  };

  const getProgressBarColor = (score: number): string => {
    if (score >= 0.7) return '#00ADB5'; // Teal for best
    if (score >= 0.4) return '#FFCC00'; // Yellow for middle
    return '#FF6B6B'; // Red for worst
  };

  // Helper for rank badge color
  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-warning text-warning-foreground';
    return 'bg-muted text-muted-foreground';
  };

  // Add a useEffect to stop all video streams when showQrModal closes
  useEffect(() => {
    if (!showQrModal) {
      // Stop and remove all video elements
      const stopAndRemoveVideos = () => {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          if (video.srcObject) {
            try {
              const tracks = (video.srcObject as MediaStream).getTracks();
              tracks.forEach(track => track.stop());
            } catch {}
            video.srcObject = null;
          }
          if (video.parentNode) {
            video.parentNode.removeChild(video);
          }
        });
      };
      stopAndRemoveVideos();
      // Failsafe: try again after 500ms in case video is re-added by library
      setTimeout(stopAndRemoveVideos, 500);
      // Try to stop all active media streams from navigator (extra failsafe)
      if (navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices) {
        if ((navigator as any)._mediaStream) {
          try {
            (navigator as any)._mediaStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
          } catch {}
        }
      }
    }
  }, [showQrModal]);

  // Add this effect to set the video id when the modal is open
  useEffect(() => {
    if (showQrModal) {
      const interval = setInterval(() => {
        const video = document.querySelector('video');
        if (video && !video.id) {
          video.id = 'qr-video';
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [showQrModal]);

  // Helper to stop all video streams
  const stopAllVideoStreams = () => {
    const video = document.getElementById('qr-video') as HTMLVideoElement | null;
    if (video && video.srcObject) {
      const tracks = (video.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      video.srcObject = null;
    }
  };

  // Refactor QR scan handler to always check current selectedProducts and products
  const addProductByIdWithCategoryCheck = async (productId: string) => {
    // Try local cache first
    let product = products.find(p => p.id === productId);
    if (!product) {
      // Fetch from Firestore if not in local cache
      const docSnap = await getDoc(doc(db, 'products', productId));
      if (docSnap.exists()) product = docSnap.data();
    }
    if (!product) {
      setToast({ type: 'error', message: 'Product not found.' });
      return;
    }
    // Always use latest selectedProducts
    setSelectedProducts(prev => {
      // If already present, do nothing
      if (prev.find(p => p.id === product.id)) {
        setToast({ type: 'info', message: 'Product already in comparison list.' });
        return prev;
      }
      // If category mismatch, show error
      if (prev.length > 0 && prev[0].category !== product.category) {
        setCategoryError('Category does not match. Please clear your comparison list first.');
        return prev;
      }
      setToast({ type: 'success', message: 'Product added for comparison!' });
      return [...prev, product];
    });
  };

  const handleCloseQrModal = () => {
    stopAllVideoStreams();
    setShowQrModal(false);
    setQrKey(Date.now());
  };

  // Helper to truncate strings
  function truncate(str: string, n: number) {
    return str.length > n ? str.slice(0, n) + '...' : str;
  }

  // ProductCard component
  function ProductCard({ product, onAdd, isSelected, canAdd, categoryMismatch, onClick }: any) {
    console.log('ProductCard:', product);
    // Helper to extract key specs for mobile category
    function getKeySpecs(product: any) {
      if (!product.specs) return [];
      if (product.category && product.category.startsWith('airpod')) {
        return [
          { label: 'Battery Life', value: product.specs['Battery Life (h)'] ? product.specs['Battery Life (h)'] + ' h' : undefined },
          { label: 'Playback Time', value: product.specs['Playback Time (h)'] ? product.specs['Playback Time (h)'] + ' h' : undefined },
          { label: 'Bluetooth', value: product.specs['Bluetooth'] ? 'Yes' : 'No' },
          { label: 'Microphone', value: product.specs['Microphone'] ? 'Yes' : 'No' },
          { label: 'Charging Cable', value: product.specs['Charging Cable'] ? 'Yes' : 'No' },
          { label: 'Weight', value: product.specs['Weight'] ? product.specs['Weight'] : undefined },
        ].filter(x => x.value !== undefined && x.value !== '');
      }
      return [
        { label: 'Display', value: product.specs['Display Technology'] },
        { label: 'RAM', value: product.specs['RAM Memory (GB)'] ? product.specs['RAM Memory (GB)'] + ' GB' : undefined },
        { label: 'Camera', value: product.specs['Rear-Facing Camera MP'] ? product.specs['Rear-Facing Camera MP'] + ' MP' : undefined },
        { label: 'Processor', value: product.specs['Processor Brand'] },
        { label: 'Battery', value: product.specs['Battery Capacity (mAh)'] },
        { label: 'Screen', value: product.specs['Screen Size (inch)'] ? product.specs['Screen Size (inch)'] + ' inch' : undefined },
      ].filter(x => x.value);
    }
    const keySpecs = getKeySpecs(product);
    return (
      <div className="flex flex-col items-center">
        <div className="card mb-4 relative group cursor-pointer" style={{ minHeight: 370 }} onClick={() => onClick(product)}>
          {product.image && (
            <img src={product.image} alt={product.name} className="img w-24 h-24 object-contain rounded-lg" />
          )}
          {/* Always visible basic info */}
          <div className="flex flex-col items-center justify-center z-10 relative pt-20 pb-2 w-full transition-opacity duration-200 group-hover:opacity-0">
            <div className="font-bold text-lg head text-white text-center truncate w-44">{truncate(product.name, 32)}</div>
            <div className="text text-sm mb-1 text-gray-300">{product.specs?.Brand || product.brand}</div>
            {product.price !== undefined && product.price !== null && product.price !== '' && (
              <div className="price font-bold text-base mb-1 text-yellow-400">{product.price}</div>
            )}
            {keySpecs.slice(0, 4).map((spec, i) => (
              <span key={spec.label + '-' + i} className="text-xs text-gray-300">
                <span className="font-medium">{spec.label}:</span> {spec.value}
              </span>
            ))}
          </div>
          {/* Hover details */}
          <div className={`
            textBox absolute top-0 left-0 right-0
            flex flex-col items-start justify-start gap-2
            bg-black/80 backdrop-blur-sm rounded-t-[20px] p-4 pt-6
            opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20
            text-white
          `} style={{ height: '240px', maxHeight: '70%' }}>
            <div className="font-bold text text-left truncate w-44">{truncate(product.name, 32)}</div>
            {Object.entries(product.specs || {}).slice(0, 7).map(([key, value], i) => (
              <span key={key + '-' + i}>
                <span className="font-medium">{getSpecDisplayName(key)}:</span> {String(value)}
              </span>
            ))}
          </div>
          {/* Buy button always at the bottom of the card */}
          {product.buy && (
            <a
              href={product.buy}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute left-1/2 -translate-x-1/2 bottom-4 px-4 py-2 rounded-lg font-bold text-sm transition-colors z-20"
              style={{ width: '90%', textAlign: 'center', background: '#FFCC00', color: '#0D0302', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              onClick={e => e.stopPropagation()}
            >
              Buy
            </a>
          )}
        </div>
        <button
          onClick={() => onAdd(product)}
          disabled={isSelected || !canAdd || categoryMismatch}
          className={`w-full py-3 px-4 rounded-lg font-bold transition-all duration-200 flex items-center justify-center gap-2 mt-auto ${
            isSelected 
              ? 'bg-success/20 text-success cursor-not-allowed'
              : !canAdd || categoryMismatch
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'compare-button hover:bg-accent/90'
          }`}
        >
          {isSelected ? (
            <>Selected <X className="w-4 h-4" /></>
          ) : (
            <>Add to Compare <Plus className="w-4 h-4" /></>
          )}
        </button>
        {categoryMismatch && (
          <p className="text-xs text-destructive mt-2 text-center">
            Different category from selected products
          </p>
        )}
      </div>
    );
  }

  // SimpleProductCard for recommended section (no button)
  function SimpleProductCard({ product, onClick }: any) {
    function getKeySpecs(product: any) {
      if (!product.specs) return [];
      if (product.category && product.category.startsWith('airpod')) {
        return [
          { label: 'Battery Life', value: product.specs['Battery Life (h)'] ? product.specs['Battery Life (h)'] + ' h' : undefined },
          { label: 'Playback Time', value: product.specs['Playback Time (h)'] ? product.specs['Playback Time (h)'] + ' h' : undefined },
          { label: 'Bluetooth', value: product.specs['Bluetooth'] ? 'Yes' : 'No' },
          { label: 'Microphone', value: product.specs['Microphone'] ? 'Yes' : 'No' },
          { label: 'Charging Cable', value: product.specs['Charging Cable'] ? 'Yes' : 'No' },
          { label: 'Weight', value: product.specs['Weight'] ? product.specs['Weight'] : undefined },
        ].filter(x => x.value !== undefined && x.value !== '');
      }
      // fallback: show first 4 specs
      return Object.entries(product.specs).slice(0, 4).map(([key, value]) => ({ label: getSpecDisplayName(key), value }));
    }
    const keySpecs = getKeySpecs(product);
    return (
      <div className="flex flex-col items-center">
        <div className="card mb-4 relative group cursor-pointer" style={{ minHeight: 370 }} onClick={() => onClick(product)}>
          {product.image && (
            <img src={product.image} alt={product.name} className="img w-24 h-24 object-contain rounded-lg" />
          )}
          {/* Always visible name and specs for recommended section */}
          <div className="flex flex-col items-center justify-center z-10 relative pt-20 pb-2 w-full">
            <div className="font-bold text-lg head text-white text-center truncate w-44">{truncate(product.name, 32)}</div>
            {keySpecs.map((spec, i) => (
              <span key={spec.label + '-' + i} className="text-xs text-gray-300">
                <span className="font-medium">{spec.label}:</span> {spec.value}
              </span>
            ))}
          </div>
          {/* Buy button always at the bottom of the card */}
          {product.buy && (
            <a
              href={product.buy}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute left-1/2 -translate-x-1/2 bottom-4 px-4 py-2 rounded-lg font-bold text-sm transition-colors z-20"
              style={{ width: '90%', textAlign: 'center', background: '#FFCC00', color: '#0D0302', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              onClick={e => e.stopPropagation()}
            >
              Buy
            </a>
          )}
        </div>
      </div>
    );
  }

  // ProductDetailModal component
  function ProductDetailModal({ product, onClose }: { product: any, onClose: () => void }) {
    const [enlarged, setEnlarged] = React.useState(false);
    const images = product.images ? product.images : [product.image];
    // Prepare key specs for airpod
    const airpodKeySpecs = product.category && product.category.startsWith('airpod') ? [
      { label: 'Price', value: product.price },
      { label: 'Battery Life', value: product.specs?.['Battery Life (h)'] ? product.specs['Battery Life (h)'] + ' h' : undefined },
      { label: 'Playback Time', value: product.specs?.['Playback Time (h)'] ? product.specs['Playback Time (h)'] + ' h' : undefined },
      { label: 'Bluetooth', value: product.specs?.['Bluetooth'] ? 'Yes' : 'No' },
      { label: 'Microphone', value: product.specs?.['Microphone'] ? 'Yes' : 'No' },
      { label: 'Charging Cable', value: product.specs?.['Charging Cable'] ? 'Yes' : 'No' },
      { label: 'Weight', value: product.specs?.['Weight'] ? product.specs['Weight'] : undefined },
    ].filter(x => x.value !== undefined && x.value !== '') : null;
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm">
        <div className="relative bg-gradient-to-br from-[#23272f] to-[#1a1d23] rounded-2xl shadow-2xl max-w-2xl w-full border border-accent/30 mt-6 max-h-[90vh] overflow-y-auto p-0 sm:p-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-2xl z-20"
          >
            <X />
          </button>
          <div className="p-6 sm:p-8 space-y-6">
            {/* Media */}
            <div className="flex flex-col items-center mb-2">
              <div className="bg-white/10 rounded-xl p-2 mb-4">
                <img
                  src={images[0]}
                  alt={product.name}
                  className="w-40 h-40 object-contain rounded-xl shadow-lg border border-white/10 cursor-zoom-in bg-white/10"
                  onClick={() => setEnlarged(true)}
                />
              </div>
            </div>
            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-accent/20 text-accent text-xs font-semibold">{product.category}</span>
              {product.specs?.Brand && (
                <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold">{product.specs.Brand}</span>
              )}
            </div>
            {/* Title & Price */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <h2 className="text-2xl font-bold text-white text-left leading-tight break-words max-w-xl">{product.name}</h2>
              <div className="text-xl font-bold text-yellow-400 whitespace-nowrap">{product.price}</div>
            </div>
            {/* Description */}
            <div className="bg-white/5 p-4 rounded-lg text-gray-200 mb-2 text-sm leading-relaxed border border-white/10">
              {product.description}
            </div>
            {/* Key Specs */}
            <div>
              <h4 className="text-lg font-semibold text-accent mb-2">Key Specifications</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-white/5 rounded-lg p-4 border border-white/10">
                {(airpodKeySpecs || Object.entries(product.specs || {}).slice(0, 6).map(([key, value]) => ({ label: key, value })) ).map((spec, i) => (
                  <div key={spec.label + '-' + i} className="flex flex-col">
                    <span className="text-xs text-gray-400">{spec.label}</span>
                    <span className="font-medium text-white break-words">{String(spec.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* All Specs */}
            <div>
              <h4 className="text-lg font-semibold text-accent mb-2 mt-4">All Specifications</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-white/5 rounded-lg p-4 border border-white/10">
                {Object.entries(product.specs || {}).map(([key, value]) => (
                  <div key={key} className="flex flex-col">
                    <span className="text-xs text-gray-400">{key}</span>
                    <span className="font-medium text-white break-words">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Enlarged image lightbox */}
          {enlarged && (
            <div
              className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center cursor-zoom-out"
              onClick={() => setEnlarged(false)}
            >
              <img src={images[0]} alt="Enlarged" className="max-w-4xl max-h-[90vh] rounded-lg shadow-2xl border-4 border-white" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Header */}
      <header className="bg-card border-b-2 border-primary sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
            <h1 className="text-4xl font-bold text-foreground text-center tracking-tight flex-1">
              Product Comparison Tool
            </h1>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleReload}
                aria-label="Reload data from Firestore"
                className="p-2 rounded-lg border border-border bg-muted hover:bg-accent transition-colors flex items-center justify-center"
                disabled={loading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw"><path d="M21 2v6h-6"/><path d="M3 22v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.13-3.36L21 8"/><path d="M20.49 15A9 9 0 0 1 5.34 18.36L3 16"/></svg>
              </button>
            <button
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
                className="p-2 rounded-lg border border-border bg-muted hover:bg-accent transition-colors flex items-center justify-center"
            >
                {isDark ? <Sun className="w-6 h-6 text-warning" /> : <Moon className="w-6 h-6 text-accent" />}
                <span className="sr-only">Toggle dark mode</span>
            </button>
          </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-primary rounded-lg focus:border-accent focus:outline-none transition-colors bg-background text-foreground shadow-sm"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-primary rounded-lg focus:border-accent focus:outline-none transition-colors bg-background text-foreground cursor-pointer shadow-sm"
              >
                <option value="all">All Categories</option>
                <option value="smartphones">Smartphones</option>
                <option value="laptops">Laptops</option>
                <option value="home_appliances">Home Appliances</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Selected Products Panel */}
        {selectedProducts.length > 0 && !showComparison && (
          <div className="bg-card border-2 border-accent rounded-xl p-6 mb-8 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-foreground">
                Selected Products ({selectedProducts.length} of 4)
                </h3>
                <button
                  onClick={compareProducts}
                  disabled={selectedProducts.length < 2 || (useCustomWeights && !!weightError)}
                className={`px-6 py-3 rounded-lg font-bold text-white transition-all duration-200 ${
                  selectedProducts.length >= 2 && (!useCustomWeights || !weightError)
                    ? 'bg-accent hover:bg-accent/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
                >
                  Compare Products
                </button>
              </div>
            {/* User-Adjustable Weights UI */}
            {selectedProducts.length > 1 && categoryWeights && (
              <div className="mb-6 p-4 rounded-lg bg-muted border border-border">
                <div className="flex items-center gap-4 mb-2">
                  <label className="font-semibold text-foreground">Weights:</label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      checked={!useCustomWeights}
                      onChange={() => {
                        setUseCustomWeights(false);
                        setCustomWeights({});
                        setWeightError(null);
                      }}
                    />
                    <span>Default</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      checked={useCustomWeights}
                      onChange={() => {
                        setUseCustomWeights(true);
                        // Initialize custom weights with current weights
                        setCustomWeights({ ...categoryWeights });
                      }}
                    />
                    <span>Custom</span>
                  </label>
                    </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {Object.keys(categoryWeights).map((spec) => (
                    <div key={spec} className="flex flex-col gap-1">
                      <label className="text-sm text-muted-foreground">{getSpecDisplayName(spec)}</label>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        disabled={!useCustomWeights}
                        value={useCustomWeights ? (customWeights[spec] ?? 0) : categoryWeights[spec]}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          const newWeights = { ...customWeights, [spec]: isNaN(val) ? 0 : val };
                          setCustomWeights(newWeights);
                          setWeightError(null); // No sum-to-1 error
                        }}
                        className={`border rounded px-2 py-1 w-20 ${useCustomWeights ? 'bg-white' : 'bg-muted'} text-foreground`}
                      />
                    </div>
                  ))}
                </div>
                {useCustomWeights && weightError && (
                  <div className="text-destructive mt-2 font-semibold">{weightError}</div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              {selectedProducts.map((product) => (
                <div key={product.id} className="bg-secondary border-2 border-accent rounded-lg p-4 relative flex flex-col items-center w-56">
                    <button
                      onClick={() => removeFromComparison(product.id)}
                    className="absolute top-2 right-2 bg-destructive text-white border-none rounded-full w-8 h-8 cursor-pointer flex items-center justify-center hover:bg-destructive/90 transition-colors"
                    >
                    <X size={16} />
                    </button>
                  <div className="w-16 h-16 bg-accent rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-white text-2xl">📦</span>
                    )}
                  </div>
                  <h4 className="text-lg font-bold text-foreground mb-1 text-center">
                    {product.name}
                  </h4>
                  <p className="text-muted-foreground mb-1 text-sm text-center">
                    {product.brand}
                  </p>
                  <p className="text-xl font-bold text-primary mb-1">
                    {product.price}
                  </p>
                  {product.buy && (
                    <a
                      href={product.buy}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 px-4 py-2 bg-accent text-white rounded-lg font-bold text-sm hover:bg-accent/90 transition-colors"
                    >
                      Buy
                    </a>
                  )}
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Comparison Results Table */}
        {showComparison && comparisonResults.length > 0 && categoryWeights && (
          <div className="bg-card border-2 border-accent rounded-xl p-8 mb-8 shadow-lg overflow-x-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-foreground">
                Comparison Results
              </h2>
              <button
                onClick={startNewComparison}
                className="bg-warning text-warning-foreground border-none px-6 py-3 rounded-lg font-bold cursor-pointer transition-all duration-200 hover:bg-warning/90"
              >
                Start New Comparison
              </button>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-lg font-bold text-foreground py-2 px-4 border-b-2 border-border bg-muted">Specification</th>
                    {comparisonResults.map((result, idx) => (
                      <th key={result.product.id} className="text-center py-2 px-4 border-b-2 border-border bg-muted">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mb-1 ${getRankBadgeColor(idx+1)}`}>Rank {idx+1}</span>
                          <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center overflow-hidden mb-1">
                            {result.product.image ? (
                              <img src={result.product.image} alt={result.product.name} className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-white text-xl">📦</span>
                      )}
                      </div>
                          <span className="font-bold text-foreground text-base text-center">{truncate(result.product.name, 32)}</span>
                          <span className="text-muted-foreground text-xs">{result.product.specs?.Brand || result.product.brand}</span>
                          <span className="text-accent text-2xl font-bold mt-1">{result.totalScore}/100</span>
                          {result.product.buy && (
                            <a
                              href={result.product.buy}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 px-4 py-2 rounded-lg font-bold text-xs transition-colors"
                              style={{ display: 'inline-block', background: '#FFCC00', color: '#0D0302', width: '90%', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                            >
                              Buy
                            </a>
                      )}
                    </div>
                        </th>
                      ))}
                    </tr>
                  {/* Weights Row */}
                  <tr>
                    <td className="py-2 px-4 font-semibold text-muted-foreground bg-muted">Weight</td>
                    {comparisonResults.map((_, idx) => (
                      <td key={idx} className="py-2 px-4 text-center bg-muted"></td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                  {/* Show weights for each spec in the first column */}
                  {Object.keys(categoryWeights || {}).map((spec: any) => {
  // Find best value index/indices
  let bestIdxs: number[] = [];
  let bestValue: any = null;
  let isMinBetter = ['weight', 'price', 'power'].includes(spec);
  comparisonResults.forEach((result, idx) => {
    const value = result.product.specs ? result.product.specs[spec] : undefined;
    if (value === undefined || value === null || value === "") return;
    if (bestValue === null ||
      (isMinBetter ? value < bestValue : value > bestValue)) {
      bestValue = value;
      bestIdxs = [idx];
    } else if (value === bestValue) {
      bestIdxs.push(idx);
    }
  });
  return (
    <tr key={spec} className="border-b border-border">
      <td className="py-3 px-4 font-medium text-muted-foreground whitespace-nowrap flex flex-col">
                          {getSpecDisplayName(spec)}
        <span className="text-xs text-accent font-semibold">Weight: {(
          useCustomWeights
            ? (function() {
                const sum = Object.values(customWeights).reduce((a: number, b: any) => Number(a) + Number(b), 0) || 1;
                return (customWeights[spec] / sum).toFixed(2);
              })()
            : categoryWeights[spec].toFixed(2)
        )}</span>
                        </td>
      {comparisonResults.map((result, idx) => {
                          const score = result.specScores[spec];
        const valueDisplay = getSpecValue(result.product, spec);
        const isBestOrTie = bestIdxs.includes(idx) && valueDisplay !== 'N/A';
                          return (
          <td key={result.product.id + '-' + spec} className={`py-3 px-4 text-center align-middle ${isBestOrTie ? 'bg-green-100 dark:bg-green-900 font-bold' : ''}`}> 
            <div className="flex flex-col items-center gap-1">
              <span className="font-bold text-foreground text-sm">
                {valueDisplay}
              </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
  );
})}
                  </tbody>
                </table>
              </div>
            </div>
        )}
        {/* Recommended Airpods Section for Mobile Comparison */}
        {showComparison && selectedProducts.length > 0 && selectedProducts[0].category && selectedProducts[0].category.startsWith('mobile') && (() => {
          const airpodProducts = products.filter(p => p.category && p.category.startsWith('airpod'));
          if (airpodProducts.length === 0) return null;
          return (
            <div className="bg-card border-2 border-accent rounded-xl p-8 mb-8 shadow-lg overflow-x-auto mt-10">
              <h3 className="text-2xl font-bold text-foreground mb-4">Recommended products to buy</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {airpodProducts.map((product) => (
                  <SimpleProductCard
                    key={product.id}
                    product={product}
                    onClick={setModalProduct}
                  />
                ))}
          </div>
            </div>
          );
        })()}

        {/* Product Grid */}
        {!showComparison && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {loading ? (
              <div className="col-span-full text-center text-muted-foreground">Loading products...</div>
            ) : (
              filteredProducts.map((product) => {
                const isSelected = !!selectedProducts.find(p => p.id === product.id);
              const canAdd = selectedProducts.length < 4;
              const categoryMismatch = selectedProducts.length > 0 && selectedProducts[0].category !== product.category;
              return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAdd={addToComparison}
                    isSelected={isSelected}
                    canAdd={canAdd}
                    categoryMismatch={categoryMismatch}
                    onClick={setModalProduct}
                  />
                );
              })
                      )}
                    </div>
        )}
        {/* Add QR scan icon button for mobile/tablet only (md:hidden) */}
        {!showComparison && (
          <div className="flex justify-end mb-4 z-10 relative">
                    <button
              className="p-3 bg-accent text-white rounded-full shadow hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent"
              onClick={() => { setQrModalKey(Date.now()); setShowQrModal(true); }}
              aria-label="Scan QR to Add Product"
            >
              <QrCode className="w-7 h-7" />
                    </button>
          </div>
        )}
        <QrScannerModal
          key={qrModalKey}
          open={showQrModal}
          onClose={() => setShowQrModal(false)}
          onScan={async (value) => {
            // Debug: print the raw QR value
            console.log('QR raw value:', value);
            // Extract product ID from scanned value
            let productId = value;
            let url = value;
            try {
              url = value.startsWith('@') ? value.slice(1) : value;
              console.log('URL after @ removal:', url);
              if (url.startsWith('http://') || url.startsWith('https://')) {
                // Try to extract ?add=PRODUCT_ID
                const urlObj = new URL(url);
                const addParam = urlObj.searchParams.get('add');
                if (addParam) {
                  productId = addParam;
                  console.log('Extracted productId from ?add= param:', productId);
                } else {
                  // Fallback: /product_ or last segment
                  const match = url.match(/\/product[_-]([\w-]+)/i);
                  if (match && match[1]) {
                    productId = match[1];
                    console.log('Extracted productId from /product_: ', productId);
                  } else {
                    const parts = url.split('/');
                    productId = parts[parts.length - 1];
                    console.log('Extracted productId from last segment:', productId);
                  }
                }
              }
            } catch (e) {
              console.log('Error extracting productId:', e);
            }
            console.log('Final productId used:', productId);
            let product = products.find(p => p.id === productId);
            if (!product) {
              setToast({ type: 'error', message: 'Product not found.' });
              return;
            }
            setSelectedProducts(prev => {
              if (prev.find(p => p.id === product.id)) {
                setToast({ type: 'info', message: 'Product already in comparison list.' });
                return prev;
              }
              if (prev.length > 0 && prev[0].category !== product.category) {
                setCategoryError('Category does not match. Please clear your comparison list first.');
                return prev;
              }
              setToast({ type: 'success', message: 'Product added for comparison!' });
              return [...prev, product];
            });
          }}
        />
        {modalProduct && (
          <ProductDetailModal product={modalProduct} onClose={() => setModalProduct(null)} />
        )}
        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold text-muted-foreground mb-3">
              No products found
            </h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </main>
      {/* Category Error Modal */}
      {categoryError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-card p-6 rounded-xl shadow-lg relative w-[350px] max-w-full">
            <button
              className="absolute top-2 right-2 text-xl"
              onClick={() => setCategoryError(null)}
              aria-label="Close Error Modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <h2 className="text-lg font-bold mb-2 text-destructive">Category Mismatch</h2>
            <div className="mb-4 text-sm text-muted-foreground">
              {categoryError}
            </div>
            <button
              className="mt-2 px-4 py-2 bg-accent text-white rounded-lg font-bold"
              onClick={() => setCategoryError(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;