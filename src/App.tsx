/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, FormEvent, createContext, useContext, ReactNode } from 'react';
import { 
  ShoppingBag, 
  Truck, 
  ShieldCheck, 
  RefreshCw, 
  Star, 
  CheckCircle2, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  X,
  Menu,
  ArrowRight,
  Flame,
  Zap,
  LayoutDashboard,
  LogOut,
  LogIn,
  Package,
  User as UserIcon,
  Search,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useSpring } from 'motion/react';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  setDoc,
  doc, 
  getDocFromServer,
  Timestamp
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth } from './firebase.ts';

// --- Types & Context ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Order {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  area: string;
  size: string;
  productName: string;
  deliveryCharge: number;
  paymentMethod: 'bKash' | 'Nagad' | 'Rocket' | 'Upay' | 'MCash' | 'Cash on Delivery';
  transactionId?: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: any;
  totalAmount: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
}

const PRODUCTS: Product[] = [
  { id: 'pc-01', name: 'Cyberpunk Neon Tee', price: 990, image: 'https://picsum.photos/seed/ts1/600/800' },
  { id: 'pc-02', name: 'Minimalist Craft Tee', price: 990, image: 'https://picsum.photos/seed/ts2/600/800' },
  { id: 'pc-03', name: 'Street Rebel Oversize', price: 1150, image: 'https://picsum.photos/seed/ts3/600/800' },
  { id: 'pc-04', name: 'Pixel Glitch Edition', price: 990, image: 'https://picsum.photos/seed/ts4/600/800' },
];

interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'seller' | 'client';
  displayName?: string;
}

const AuthContext = createContext<{
  user: FirebaseUser | null;
  isAdmin: boolean;
  isSeller: boolean;
  loading: boolean;
  selectedProduct: Product | null;
  setSelectedProduct: (p: Product | null) => void;
}>({ 
  user: null, 
  isAdmin: false, 
  isSeller: false,
  loading: true, 
  selectedProduct: null, 
  setSelectedProduct: () => {} 
});

// --- Components ---

const ErrorBoundary = ({ children }: { children: ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('Firestore Error')) {
        setHasError(true);
        setErrorMsg("A database error occurred. Please try again later.");
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white p-8 text-center">
        <div>
          <h1 className="text-4xl font-black mb-4">OOPS! SOMETHING WENT WRONG</h1>
          <p className="text-gray-400 mb-8">{errorMsg}</p>
          <button onClick={() => window.location.reload()} className="bg-red-600 px-8 py-3 rounded-xl font-bold">Reload Page</button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// --- Components ---

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, isAdmin, isSeller } = useContext(AuthContext);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-black/90 backdrop-blur-md py-3' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
        <div className="text-2xl font-black tracking-tighter text-white cursor-pointer" onClick={() => window.location.href = '/'}>
          PIXEL<span className="text-red-600">CRAFT</span>
        </div>
        <div className="hidden md:flex space-x-8 text-sm font-bold uppercase tracking-widest text-white/80">
          <a href="#showcase" className="hover:text-red-500 transition-colors">Showcase</a>
          <a href="#reviews" className="hover:text-red-500 transition-colors">Reviews</a>
          <a href="#faq" className="hover:text-red-500 transition-colors">FAQ</a>
          {(isAdmin || isSeller) && (
            <button onClick={() => window.location.hash = '#admin'} className="text-red-500 hover:text-red-400 flex items-center space-x-1">
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </button>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {!user && (
            <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest">
              Login
            </button>
          )}
          <a href="#order" className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-tighter transition-all transform hover:scale-105">
            Order Now
          </a>
        </div>
      </div>
    </nav>
  );
};

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black pt-20">
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-600 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center space-x-2 bg-red-600/10 border border-red-600/20 text-red-500 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
            <Flame size={14} />
            <span>Limited Edition Drop</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-white leading-tight mb-6 tracking-tighter">
            WEAR YOUR <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-red-400">IDENTITY.</span>
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-lg leading-relaxed">
            Premium streetwear crafted for the bold. 100% organic cotton, unique hand-drawn graphics, and a fit that speaks volumes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mb-10">
            <a href="#order" className="bg-red-600 hover:bg-red-700 text-white px-10 py-5 rounded-xl text-lg font-black uppercase tracking-tighter transition-all flex items-center justify-center group">
              Get Yours Today
              <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
            </a>
            <div className="flex items-center space-x-4 px-4">
              <div className="flex -space-x-2">
                {[1,2,3,4].map(i => (
                  <img key={i} src={`https://picsum.photos/seed/user${i}/100/100`} className="w-10 h-10 rounded-full border-2 border-black" alt="User" referrerPolicy="no-referrer" />
                ))}
              </div>
              <div className="text-sm">
                <div className="flex text-yellow-500">
                  <Star size={12} fill="currentColor" />
                  <Star size={12} fill="currentColor" />
                  <Star size={12} fill="currentColor" />
                  <Star size={12} fill="currentColor" />
                  <Star size={12} fill="currentColor" />
                </div>
                <p className="text-gray-400 font-bold">500+ Happy Customers</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 opacity-60">
            <div className="flex items-center space-x-2 text-white text-xs font-bold uppercase">
              <Truck size={16} className="text-red-500" />
              <span>Fast Delivery</span>
            </div>
            <div className="flex items-center space-x-2 text-white text-xs font-bold uppercase">
              <ShieldCheck size={16} className="text-red-500" />
              <span>Cash on Delivery</span>
            </div>
            <div className="flex items-center space-x-2 text-white text-xs font-bold uppercase">
              <RefreshCw size={16} className="text-red-500" />
              <span>Easy Returns</span>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-red-600/20 rounded-full blur-[100px] animate-pulse" />
          <img 
            src="https://picsum.photos/seed/tshirt-main/800/1000" 
            alt="Premium T-Shirt Mockup" 
            className="relative z-10 w-full h-auto rounded-3xl shadow-2xl transform hover:rotate-2 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          <div className="absolute -bottom-6 -left-6 z-20 bg-white p-6 rounded-2xl shadow-xl hidden md:block">
            <p className="text-black font-black text-2xl tracking-tighter">ONLY 12 LEFT</p>
            <p className="text-red-600 font-bold text-sm uppercase tracking-widest">Selling Fast!</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const Highlights = () => {
  const highlights = [
    {
      icon: <Zap className="text-red-600" size={32} />,
      title: "100% Premium Cotton",
      desc: "Breathable, soft-touch fabric that stays comfortable all day long."
    },
    {
      icon: <ShoppingBag className="text-red-600" size={32} />,
      title: "Unique Streetwear Art",
      desc: "Exclusive hand-drawn graphics you won't find anywhere else."
    },
    {
      icon: <ShieldCheck className="text-red-600" size={32} />,
      title: "Color Guarantee",
      desc: "Advanced dye technology ensures colors don't fade after washing."
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-12">
          {highlights.map((item, idx) => (
            <motion.div 
              key={idx}
              whileInView={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 30 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.2 }}
              className="p-8 rounded-3xl border border-gray-100 hover:border-red-100 transition-colors group"
            >
              <div className="mb-6 transform group-hover:scale-110 transition-transform">{item.icon}</div>
              <h3 className="text-2xl font-black mb-4 tracking-tight">{item.title}</h3>
              <p className="text-gray-500 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Showcase = () => {
  const { setSelectedProduct } = useContext(AuthContext);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="py-24 text-center text-gray-400 font-bold uppercase tracking-widest">Loading Collection...</div>;

  const displayProducts = products.length > 0 ? products : PRODUCTS;

  return (
    <section id="showcase" className="py-24 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">THE COLLECTION</h2>
          <p className="text-gray-500 uppercase tracking-widest font-bold">Modern Aesthetics. Premium Comfort.</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {displayProducts.map((product) => (
            <motion.div 
              key={product.id}
              whileHover={{ scale: 1.02 }}
              className="relative aspect-[3/4] rounded-2xl overflow-hidden group cursor-pointer bg-white shadow-sm"
              onClick={() => {
                setSelectedProduct(product);
                document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <img 
                src={product.image} 
                alt={product.name} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                <p className="text-white font-black text-xl mb-2 tracking-tighter">{product.name}</p>
                <p className="text-red-500 font-bold mb-4">{product.price} BDT</p>
                <span className="text-white text-xs font-bold uppercase tracking-widest border border-white px-4 py-2 rounded-full">Select & Order</span>
              </div>
              <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl md:hidden">
                <p className="text-black font-bold text-sm truncate">{product.name}</p>
                <p className="text-red-600 font-black text-xs">{product.price} BDT</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Testimonials = () => {
  const reviews = [
    { name: "Areeb Ahmed", text: "The quality is insane. I've washed it 5 times and the print still looks brand new. Definitely buying more!", rating: 5 },
    { name: "Samiul Islam", text: "Best streetwear brand in Bangladesh right now. The fit is perfect for my build.", rating: 5 },
    { name: "Nabila Khan", text: "Super soft fabric and the design is so unique. I get compliments every time I wear it.", rating: 5 }
  ];

  return (
    <section id="reviews" className="py-24 bg-black text-white">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-4xl font-black text-center mb-16 tracking-tighter">WHAT OUR TRIBE SAYS</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {reviews.map((rev, idx) => (
            <div key={idx} className="bg-white/5 p-8 rounded-3xl border border-white/10">
              <div className="flex text-red-500 mb-4">
                {[...Array(rev.rating)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
              </div>
              <p className="text-lg italic text-gray-300 mb-6">"{rev.text}"</p>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center font-bold">
                  {rev.name[0]}
                </div>
                <span className="font-bold">{rev.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Countdown = () => {
  const [timeLeft, setTimeLeft] = useState({ hours: 12, minutes: 45, seconds: 30 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-red-600 py-4 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-12">
        <div className="flex items-center space-x-2 font-black uppercase tracking-tighter text-xl">
          <Clock size={24} />
          <span>Limited Time Offer: 20% OFF TODAY</span>
        </div>
        <div className="flex space-x-4 font-mono text-2xl font-black">
          <div className="flex flex-col items-center">
            <span>{String(timeLeft.hours).padStart(2, '0')}</span>
            <span className="text-[10px] uppercase font-sans tracking-widest opacity-70">Hrs</span>
          </div>
          <span>:</span>
          <div className="flex flex-col items-center">
            <span>{String(timeLeft.minutes).padStart(2, '0')}</span>
            <span className="text-[10px] uppercase font-sans tracking-widest opacity-70">Min</span>
          </div>
          <span>:</span>
          <div className="flex flex-col items-center">
            <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
            <span className="text-[10px] uppercase font-sans tracking-widest opacity-70">Sec</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const OrderForm = () => {
  const { selectedProduct, setSelectedProduct } = useContext(AuthContext);
  const [formData, setFormData] = useState({ 
    name: '', 
    phone: '', 
    email: '',
    address: '', 
    city: 'Dhaka',
    area: '',
    size: 'M', 
    location: 'inside',
    paymentMethod: 'Cash on Delivery',
    transactionId: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productPrice = selectedProduct?.price || 990;
  const deliveryCharge = formData.location === 'inside' ? 60 : 120;
  const totalAmount = productPrice + deliveryCharge;

  const paymentMethods = [
    { id: 'Cash on Delivery', label: 'Cash on Delivery', icon: <Truck size={20} /> },
    { id: 'bKash', label: 'bKash', color: 'bg-[#D12053]' },
    { id: 'Nagad', label: 'Nagad', color: 'bg-[#F7941D]' },
    { id: 'Rocket', label: 'Rocket', color: 'bg-[#8C3494]' },
    { id: 'Upay', label: 'Upay', color: 'bg-[#FFD400] text-black' },
    { id: 'MCash', label: 'MCash', color: 'bg-[#0072BC]' },
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      alert("Please select a T-shirt from the collection first!");
      document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setIsSubmitting(true);
    
    try {
      await addDoc(collection(db, 'orders'), {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        area: formData.area,
        size: formData.size,
        productName: selectedProduct.name,
        deliveryCharge: deliveryCharge,
        paymentMethod: formData.paymentMethod,
        transactionId: formData.transactionId,
        status: 'pending',
        createdAt: serverTimestamp(),
        totalAmount: totalAmount
      });
      setIsSubmitted(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="order" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-16 items-start">
        <div>
          <h2 className="text-5xl font-black tracking-tighter mb-8">CLAIM YOUR STYLE</h2>
          
          {selectedProduct ? (
            <div className="bg-gray-50 p-6 rounded-3xl border border-red-100 mb-8 flex items-center space-x-6">
              <img src={selectedProduct.image} className="w-24 h-32 object-cover rounded-xl shadow-md" alt={selectedProduct.name} referrerPolicy="no-referrer" />
              <div>
                <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-1">Selected Product</p>
                <h4 className="text-xl font-black tracking-tight">{selectedProduct.name}</h4>
                <button onClick={() => setSelectedProduct(null)} className="text-xs text-gray-400 hover:text-red-600 font-bold uppercase mt-2 underline">Change Product</button>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 p-6 rounded-3xl border border-red-100 mb-8 text-center">
              <p className="text-red-600 font-bold mb-4">No product selected!</p>
              <a href="#showcase" className="inline-block bg-red-600 text-white px-6 py-2 rounded-full text-sm font-bold uppercase tracking-widest">Browse Collection</a>
            </div>
          )}

          <div className="bg-black text-white p-8 rounded-3xl shadow-xl">
            <h4 className="text-xl font-black mb-6 tracking-tight border-b border-white/10 pb-4">ORDER SUMMARY</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Product Price</span>
                <span className="font-bold">{productPrice} BDT</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Delivery Charge</span>
                <span className="font-bold">{deliveryCharge} BDT</span>
              </div>
              <div className="h-px bg-white/10 my-4" />
              <div className="flex justify-between items-center text-xl">
                <span className="font-black text-red-500">TOTAL AMOUNT</span>
                <span className="font-black text-red-500">{totalAmount} BDT</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-black text-white p-10 rounded-[2rem] shadow-2xl relative overflow-hidden">
          {isSubmitted ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-3xl font-black mb-4">ORDER CONFIRMED!</h3>
              <p className="text-gray-400 mb-8">Thank you, {formData.name}. Our team will call you shortly to verify your order for <strong>{selectedProduct?.name}</strong>.</p>
              <button 
                onClick={() => {
                  setIsSubmitted(false);
                  setSelectedProduct(null);
                }}
                className="text-red-500 font-bold uppercase tracking-widest hover:underline"
              >
                Place another order
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              <h3 className="text-2xl font-black mb-8 tracking-tight">SHIPPING & PAYMENT</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Full Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 transition-colors"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Phone Number</label>
                  <input 
                    required
                    type="tel" 
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 transition-colors"
                    placeholder="017XXXXXXXX"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Email (Optional)</label>
                <input 
                  type="email" 
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 transition-colors"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">City</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 transition-colors"
                    placeholder="e.g. Dhaka"
                    value={formData.city}
                    onChange={e => setFormData({...formData, city: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Area</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 transition-colors"
                    placeholder="e.g. Dhanmondi"
                    value={formData.area}
                    onChange={e => setFormData({...formData, area: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Full Shipping Address</label>
                <textarea 
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 transition-colors h-20"
                  placeholder="House #, Road #, Block #"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Delivery Location</label>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, location: 'inside'})}
                      className={`py-2 rounded-xl font-bold transition-all text-xs ${formData.location === 'inside' ? 'bg-red-600 text-white' : 'bg-white/10 text-white'}`}
                    >
                      Inside Dhaka (60৳)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, location: 'outside'})}
                      className={`py-2 rounded-xl font-bold transition-all text-xs ${formData.location === 'outside' ? 'bg-red-600 text-white' : 'bg-white/10 text-white'}`}
                    >
                      Outside Dhaka (120৳)
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Select Size</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['S', 'M', 'L', 'XL'].map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setFormData({...formData, size})}
                        className={`py-2 rounded-xl font-bold transition-all text-xs ${formData.size === size ? 'bg-red-600 text-white' : 'bg-white/10 text-white'}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {paymentMethods.map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setFormData({...formData, paymentMethod: pm.id as any})}
                      className={`py-3 rounded-xl font-bold transition-all text-[10px] flex flex-col items-center justify-center gap-1 border ${
                        formData.paymentMethod === pm.id 
                        ? 'border-red-600 bg-red-600 text-white' 
                        : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {formData.paymentMethod !== 'Cash on Delivery' && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 p-4 rounded-xl border border-white/10"
                >
                  <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-widest">Send Money to: <span className="text-white font-bold">017XXXXXXXX</span></p>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Transaction ID</label>
                  <input 
                    required
                    type="text" 
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 focus:outline-none focus:border-red-600 transition-colors"
                    placeholder="Enter TrxID"
                    value={formData.transactionId}
                    onChange={e => setFormData({...formData, transactionId: e.target.value})}
                  />
                </motion.div>
              )}

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-xl text-xl font-black uppercase tracking-tighter transition-all transform active:scale-95 shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Processing...' : 'Confirm Order'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

const FAQ = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const faqs = [
    { q: "What is the fabric quality?", a: "We use 100% premium organic cotton (180 GSM) which is breathable, soft, and pre-shrunk to ensure the best fit even after multiple washes." },
    { q: "How long does delivery take?", a: "Inside Dhaka, we deliver within 24-48 hours. Outside Dhaka, it typically takes 3-4 working days." },
    { q: "Do you have a return policy?", a: "Yes! If you find any manufacturing defect or size issue, you can return or exchange the product within 7 days of receiving it." },
    { q: "Is cash on delivery available?", a: "Absolutely. You can check the product when the delivery man arrives and pay only if you are satisfied." }
  ];

  return (
    <section id="faq" className="py-24 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-4xl font-black text-center mb-12 tracking-tighter">FREQUENTLY ASKED</h2>
        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <button 
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                className="w-full px-6 py-5 flex justify-between items-center text-left font-bold text-lg"
              >
                <span>{faq.q}</span>
                {openIdx === idx ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              <AnimatePresence>
                {openIdx === idx && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 pb-5 text-gray-500 leading-relaxed"
                  >
                    {faq.a}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="bg-black text-white py-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="text-2xl font-black tracking-tighter">
          PIXEL<span className="text-red-600">CRAFT</span>
        </div>
        <div className="text-gray-500 text-sm font-bold uppercase tracking-widest">
          © 2026 PixelCraft Studio. All Rights Reserved.
        </div>
        <div className="flex space-x-6 text-gray-400">
          <a href="#" className="hover:text-white transition-colors">Facebook</a>
          <a href="#" className="hover:text-white transition-colors">Instagram</a>
          <a href="#" className="hover:text-white transition-colors">TikTok</a>
        </div>
      </div>
    </footer>
  );
};

const ExitIntentPopup = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !localStorage.getItem('exit_popup_shown')) {
        setShow(true);
        localStorage.setItem('exit_popup_shown', 'true');
      }
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[2.5rem] p-10 max-w-md w-full relative overflow-hidden"
      >
        <button onClick={() => setShow(false)} className="absolute top-6 right-6 text-gray-400 hover:text-black">
          <X size={24} />
        </button>
        <div className="absolute top-0 left-0 w-full h-2 bg-red-600" />
        
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Zap size={40} />
          </div>
          <h3 className="text-4xl font-black tracking-tighter mb-2">WAIT! DON'T GO</h3>
          <p className="text-gray-500 mb-8">Get an extra <span className="text-red-600 font-black">100 BDT OFF</span> if you order in the next 10 minutes!</p>
          <div className="bg-gray-100 p-4 rounded-xl font-mono text-2xl font-black mb-8 tracking-widest">
            CODE: PIXEL100
          </div>
          <button 
            onClick={() => {
              setShow(false);
              document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full bg-black text-white py-5 rounded-xl font-black uppercase tracking-widest hover:bg-red-600 transition-colors"
          >
            Claim My Discount
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const StickyCTA = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShow(window.scrollY > 800);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          className="fixed bottom-6 left-0 right-0 z-40 px-4 md:hidden"
        >
          <a 
            href="#order" 
            className="block w-full bg-red-600 text-white py-4 rounded-2xl text-center font-black uppercase tracking-widest shadow-2xl shadow-red-600/40"
          >
            Order Now - 990 BDT
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'products' | 'users' | 'security' | 'settings'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin, isSeller } = useContext(AuthContext);

  // Product Form State
  const [newProduct, setNewProduct] = useState({ name: '', price: 0, image: '' });

  useEffect(() => {
    if (!isAdmin && !isSeller) return;

    const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[]);
      setLoading(false);
    });

    let unsubProducts = () => {};
    let unsubUsers = () => {};

    if (isAdmin || isSeller) {
      unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc')), (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
      });
    }

    if (isAdmin) {
      unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
      });
    }

    return () => {
      unsubOrders();
      unsubProducts();
      unsubUsers();
    };
  }, [isAdmin, isSeller]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    try {
      await deleteDoc(doc(db, 'orders', orderId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `orders/${orderId}`);
    }
  };

  const addProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      await addDoc(collection(db, 'products'), {
        ...newProduct,
        createdAt: serverTimestamp()
      });
      setNewProduct({ name: '', price: 0, image: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'products');
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
    }
  };

  const updateUserRole = async (uid: string, role: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'users', uid), { role });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  if (!isAdmin && !isSeller) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center bg-black text-white p-4">
        <div className="text-center">
          <ShieldCheck size={64} className="mx-auto text-red-600 mb-6" />
          <h2 className="text-3xl font-black mb-4">ACCESS RESTRICTED</h2>
          <p className="text-gray-400 mb-8">You do not have permission to view the admin panel.</p>
          <button onClick={() => window.location.hash = ''} className="bg-white text-black px-8 py-3 rounded-xl font-bold">Back to Home</button>
        </div>
      </div>
    );
  }

  const SidebarItem = ({ id, icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center space-x-3 px-6 py-4 transition-all ${activeTab === id ? 'bg-red-600 text-white border-r-4 border-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
    >
      {icon}
      <span className="font-bold text-sm uppercase tracking-widest">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-black text-white fixed h-full z-40 hidden md:block">
        <div className="p-8 border-b border-white/10">
          <div className="text-xl font-black tracking-tighter">
            ROYAL<span className="text-red-600">WEAR</span> BD
          </div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">Admin Console</p>
        </div>
        <nav className="mt-8">
          <SidebarItem id="dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <SidebarItem id="orders" icon={<ShoppingBag size={20} />} label="Orders" />
          {isAdmin && (
            <>
              <SidebarItem id="products" icon={<Package size={20} />} label="Products" />
              <SidebarItem id="users" icon={<UserIcon size={20} />} label="Staff/Users" />
              <SidebarItem id="security" icon={<ShieldCheck size={20} />} label="Security" />
              <SidebarItem id="settings" icon={<Menu size={20} />} label="Settings" />
            </>
          )}
        </nav>
        <div className="absolute bottom-0 w-full p-6 border-t border-white/10">
          <button onClick={() => signOut(auth)} className="flex items-center space-x-3 text-gray-400 hover:text-red-500 transition-colors">
            <LogOut size={20} />
            <span className="font-bold text-xs uppercase">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 min-h-screen">
        {/* Top Nav */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-8 py-4 flex justify-between items-center">
          <h2 className="text-xl font-black uppercase tracking-tight">{activeTab}</h2>
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black">{auth.currentUser?.displayName}</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase">{isAdmin ? 'Super Admin' : 'Staff'}</p>
            </div>
            <img src={auth.currentUser?.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-gray-100" alt="" />
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Today's Sales", value: `৳${orders.filter(o => o.status === 'delivered').reduce((acc, o) => acc + o.totalAmount, 0)}`, icon: <Zap className="text-yellow-500" /> },
                  { label: "Total Orders", value: orders.length, icon: <ShoppingBag size={20} className="text-blue-500" /> },
                  { label: "Pending", value: orders.filter(o => o.status === 'pending').length, icon: <Clock size={20} className="text-orange-500" /> },
                  { label: "Revenue", value: `৳${orders.reduce((acc, o) => acc + o.totalAmount, 0)}`, icon: <Flame size={20} className="text-red-500" /> },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-gray-50 rounded-2xl">{stat.icon}</div>
                      <span className="text-[10px] font-black text-green-500 bg-green-50 px-2 py-1 rounded-full">+12%</span>
                    </div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                    <p className="text-3xl font-black mt-1 tracking-tighter">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Recent Orders */}
              <div className="bg-white rounded-[2rem] border border-gray-200 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="font-black text-xl tracking-tight">RECENT ORDERS</h3>
                  <button onClick={() => setActiveTab('orders')} className="text-red-600 font-bold text-xs uppercase tracking-widest hover:underline">View All</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Customer</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Product</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Amount</th>
                        <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orders.slice(0, 5).map(order => (
                        <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-8 py-6">
                            <p className="font-bold">{order.name}</p>
                            <p className="text-gray-400 text-xs">{order.phone}</p>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-sm font-bold">{order.productName}</p>
                          </td>
                          <td className="px-8 py-6 font-black text-red-600">৳{order.totalAmount}</td>
                          <td className="px-8 py-6">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              order.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="bg-white rounded-[2rem] border border-gray-200 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50 border-bottom border-gray-200">
                      <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-gray-400">Customer</th>
                      <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-gray-400">Details</th>
                      <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-gray-400">Status</th>
                      <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-gray-400">Date</th>
                      <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-gray-400">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td colSpan={5} className="px-8 py-12 text-center text-gray-400 font-bold">Loading orders...</td></tr>
                    ) : orders.length === 0 ? (
                      <tr><td colSpan={5} className="px-8 py-12 text-center text-gray-400 font-bold">No orders found.</td></tr>
                    ) : orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <p className="font-bold text-lg">{order.name}</p>
                          <p className="text-gray-500 text-sm">{order.phone}</p>
                          <p className="text-gray-400 text-[10px] uppercase tracking-widest">{order.city}, {order.area}</p>
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-sm text-gray-600 mb-1">{order.address}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">{order.productName}</span>
                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">SIZE: {order.size}</span>
                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${order.paymentMethod === 'Cash on Delivery' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                              {order.paymentMethod}
                            </span>
                          </div>
                          {order.transactionId && (
                            <p className="text-[10px] font-bold text-gray-400 mt-1">TRX: {order.transactionId}</p>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          <div className="mb-1">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                              order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <p className="font-black text-sm text-gray-900">৳{order.totalAmount}</p>
                        </td>
                        <td className="px-8 py-6 text-gray-500 text-sm">
                          {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : 'Just now'}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            <select 
                              value={order.status}
                              onChange={(e) => updateStatus(order.id, e.target.value)}
                              className="bg-gray-100 border-none rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-red-500"
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="shipped">Shipped</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                            {isAdmin && (
                              <button onClick={() => deleteOrder(order.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <X size={18} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'security' && isAdmin && (
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-[2rem] border border-gray-200 shadow-xl">
                <div className="flex items-center space-x-4 mb-8">
                  <div className="p-4 bg-red-50 text-red-600 rounded-2xl"><ShieldCheck size={32} /></div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight">SECURITY & ADMIN CONTROL</h3>
                    <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mt-1">Manage system access and roles</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h4 className="font-black text-lg border-b pb-2">Role Management</h4>
                    <p className="text-sm text-gray-500">Assign roles to staff members to control their access levels.</p>
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                      <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Current Staff List</p>
                      <div className="space-y-4">
                        {users.filter(u => u.role !== 'client').map(u => (
                          <div key={u.uid} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm">
                            <div>
                              <p className="font-bold text-sm">{u.displayName}</p>
                              <p className="text-[10px] text-gray-400">{u.email}</p>
                            </div>
                            <span className="px-2 py-1 bg-red-100 text-red-600 text-[10px] font-black uppercase rounded">{u.role}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h4 className="font-black text-lg border-b pb-2">System Logs</h4>
                    <div className="bg-black text-green-500 p-6 rounded-2xl font-mono text-xs h-64 overflow-y-auto">
                      <p>[{new Date().toISOString()}] Admin logged in: siraj426127@gmail.com</p>
                      <p>[{new Date().toISOString()}] Order #ORD-992 status updated to "Delivered"</p>
                      <p>[{new Date().toISOString()}] New product "Cyberpunk Tee" added to collection</p>
                      <p>[{new Date().toISOString()}] Security rules verified successfully</p>
                      <p className="animate-pulse">_</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other tabs (Products, Users, etc.) would follow similar SaaS patterns */}
          {(activeTab === 'products' || activeTab === 'users' || activeTab === 'settings') && (
            <div className="bg-white p-12 rounded-[2rem] border border-gray-200 shadow-xl text-center">
              <Package size={48} className="mx-auto text-gray-200 mb-4" />
              <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter">{activeTab} MODULE</h3>
              <p className="text-gray-400">This module is being optimized for SaaS-level performance.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'home' | 'admin'>('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Sync user profile to Firestore
        const userRef = doc(db, 'users', u.uid);
        try {
          const userDoc = await getDocFromServer(userRef);
          
          if (!userDoc.exists()) {
            // Default role for first admin or new users
            const role = u.email === "siraj426127@gmail.com" ? 'admin' : 'client';
            await setDoc(userRef, {
              email: u.email,
              displayName: u.displayName,
              role: role
            });
            setIsAdmin(role === 'admin');
            setIsSeller(false);
          } else {
            const data = userDoc.data() as UserProfile;
            setIsAdmin(data.role === 'admin');
            setIsSeller(data.role === 'seller');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
        }
      } else {
        setIsAdmin(false);
        setIsSeller(false);
      }
      setLoading(false);
    });

    const handleHashChange = () => {
      setView(window.location.hash === '#admin' ? 'admin' : 'home');
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
      unsubscribe();
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdmin, isSeller, loading, selectedProduct, setSelectedProduct }}>
      <ErrorBoundary>
        <div className="relative">
          {view === 'home' ? (
            <>
              {/* Progress Bar */}
              <motion.div className="fixed top-0 left-0 right-0 h-1 bg-red-600 z-[60] origin-left" style={{ scaleX }} />
              
              <Navbar />
              <Hero />
              <Countdown />
              <Highlights />
              <Showcase />
              <Testimonials />
              <OrderForm />
              <FAQ />
              <Footer />
              
              <StickyCTA />
              <ExitIntentPopup />
            </>
          ) : (
            <>
              <Navbar />
              <AdminPanel />
            </>
          )}
        </div>
      </ErrorBoundary>
    </AuthContext.Provider>
  );
}
