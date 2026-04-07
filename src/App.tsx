/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { analyzeFoodImage } from './services/aiService';
import { 
  Camera, 
  Upload, 
  History, 
  LogOut, 
  Loader2, 
  Utensils, 
  Flame, 
  Beef, 
  Droplets, 
  Wheat,
  ChevronRight,
  User,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// --- Types ---
interface AnalysisResult {
  id?: string;
  detected_foods: string[];
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
  image_url: string;
  created_at?: string;
}

// --- Main App Component ---
export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {!session ? <AuthScreen /> : <Dashboard session={session} />}
    </div>
  );
}

// --- Auth Component ---
function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email for confirmation!');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-card rounded-3xl p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
            <Utensils className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">NutriScan AI</h1>
          <p className="text-slate-500 mt-2">Your personal nutrition assistant</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-emerald-600 font-medium hover:underline"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Dashboard Component ---
function Dashboard({ session }: { session: any }) {
  const [view, setView] = useState<'upload' | 'history'>('upload');
  const [analyzing, setAnalyzing] = useState(false);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('food_analysis')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setHistory(data);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setCurrentResult(null);

    try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('food-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('food-images')
        .getPublicUrl(filePath);

      // 2. Convert to Base64 for Gemini
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64data = reader.result as string;

        // 3. Analyze with AI
        const analysis = await analyzeFoodImage(base64data);
        
        const finalResult: AnalysisResult = {
          ...analysis,
          image_url: publicUrl,
          user_id: session.user.id
        };

        // 4. Save to Database
        const { data: savedData, error: saveError } = await supabase
          .from('food_analysis')
          .insert([finalResult])
          .select()
          .single();

        if (saveError) throw saveError;

        setCurrentResult(savedData);
        fetchHistory();
      };
    } catch (err: any) {
      console.error(err);
      alert('Error analyzing food: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
            <Utensils className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">NutriScan</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => supabase.auth.signOut()}
            className="p-2 text-slate-500 hover:text-red-500 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-slate-200/50 p-1 rounded-2xl w-fit">
        <button 
          onClick={() => setView('upload')}
          className={cn(
            "px-6 py-2 rounded-xl font-medium transition-all flex items-center gap-2",
            view === 'upload' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Plus className="w-4 h-4" /> Analyze
        </button>
        <button 
          onClick={() => setView('history')}
          className={cn(
            "px-6 py-2 rounded-xl font-medium transition-all flex items-center gap-2",
            view === 'history' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
          )}
        >
          <History className="w-4 h-4" /> History
        </button>
      </div>

      <AnimatePresence mode="wait">
        {view === 'upload' ? (
          <motion.div 
            key="upload"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            {/* Upload Area */}
            {!currentResult && !analyzing && (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-3xl p-12 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group"
              >
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-emerald-100 transition-colors">
                  <Camera className="w-10 h-10 text-slate-400 group-hover:text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">Upload Food Photo</h2>
                <p className="text-slate-500 text-center max-w-xs">
                  Snap a picture of your meal to get instant nutritional breakdown
                </p>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden" 
                  accept="image/*"
                />
              </div>
            )}

            {/* Analyzing State */}
            {analyzing && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                  <Utensils className="w-10 h-10 text-emerald-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <h3 className="text-xl font-semibold mt-8 text-slate-900">Analyzing your meal...</h3>
                <p className="text-slate-500 mt-2">Gemini AI is identifying ingredients and estimating macros</p>
              </div>
            )}

            {/* Result Display */}
            {currentResult && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card rounded-3xl overflow-hidden"
              >
                <div className="grid md:grid-cols-2 gap-0">
                  <div className="h-64 md:h-auto relative">
                    <img 
                      src={currentResult.image_url} 
                      alt="Analyzed food" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-slate-900">Analysis Result</h2>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
                        {currentResult.calories} kcal
                      </span>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Detected Foods</h4>
                        <div className="flex flex-wrap gap-2">
                          {currentResult.detected_foods.map((food, i) => (
                            <span key={i} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm">
                              {food}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <MacroCard icon={<Beef className="w-4 h-4" />} label="Protein" value={`${currentResult.protein}g`} color="bg-blue-50 text-blue-600" />
                        <MacroCard icon={<Droplets className="w-4 h-4" />} label="Fats" value={`${currentResult.fats}g`} color="bg-amber-50 text-amber-600" />
                        <MacroCard icon={<Wheat className="w-4 h-4" />} label="Carbs" value={`${currentResult.carbs}g`} color="bg-orange-50 text-orange-600" />
                      </div>

                      <button 
                        onClick={() => setCurrentResult(null)}
                        className="w-full mt-4 py-3 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Analyze Another
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid gap-4"
          >
            {history.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No analysis history yet</p>
              </div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="glass-card rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                  <img 
                    src={item.image_url} 
                    className="w-16 h-16 rounded-xl object-cover" 
                    alt="Food"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 truncate">
                      {item.detected_foods.join(', ')}
                    </h4>
                    <p className="text-sm text-slate-500">
                      {new Date(item.created_at!).toLocaleDateString()} • {item.calories} kcal
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div className="text-center px-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">P</p>
                      <p className="text-sm font-bold text-blue-600">{item.protein}g</p>
                    </div>
                    <div className="text-center px-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">F</p>
                      <p className="text-sm font-bold text-amber-600">{item.fats}g</p>
                    </div>
                    <div className="text-center px-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">C</p>
                      <p className="text-sm font-bold text-orange-600">{item.carbs}g</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MacroCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) {
  return (
    <div className={cn("p-3 rounded-2xl flex flex-col items-center text-center", color)}>
      <div className="mb-1">{icon}</div>
      <p className="text-[10px] font-bold uppercase opacity-70">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
